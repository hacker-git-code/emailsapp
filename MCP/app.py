from flask import Flask, render_template, request, jsonify, Response
import model
import time
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

# In-memory chat history
chat_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_code', methods=['POST'])
def generate_code():
    prompt = request.json.get('prompt')
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400

    try:
        # Log user prompt
        chat_history.append({'role': 'user', 'content': prompt})

        # Generate chat response
        chat_resp = model.generate_chat(prompt)
        chat_history.append({'role': 'bot', 'content': chat_resp})

        # Stream code generation
        code_stream = model.stream_generate_code(prompt)
        def generate():
            # Send chat message first
            yield f"data: {json.dumps({'type':'chat','message':{'role':'bot','content': chat_resp}})}\n\n"
            buffer = ''
            code_lines = []
            for chunk in code_stream:
                delta = chunk.choices[0].delta.get('content', '')
                buffer += delta
                # Stream each completed line
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    code_lines.append(line)
                    yield f"data: {json.dumps({'type':'code_line','line': line})}\n\n"
            # Remaining buffer
            if buffer.strip():
                code_lines.append(buffer)
                yield f"data: {json.dumps({'type':'code_line','line': buffer})}\n\n"
            # Final complete event
            full_code = '\n'.join(code_lines)
            yield f"data: {json.dumps({'type':'complete','code': full_code})}\n\n"
        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_changes', methods=['POST'])
def save_changes():
    try:
        changes = request.json
        # Validate required fields
        if not changes or 'timestamp' not in changes or 'code' not in changes:
            return jsonify({'error': 'Missing required fields: code and timestamp'}), 400
        # Save changes to history
        chat_history.append({
            'role': 'system',
            'content': 'Code changes accepted',
            'timestamp': changes['timestamp'],
            'code': changes['code']
        })
        # Persist changes to a file for durability
        try:
            with open('data/code_changes_log.json', 'a', encoding='utf-8') as f:
                f.write(json.dumps({
                    'timestamp': changes['timestamp'],
                    'code': changes['code']
                }) + '\n')
        except Exception as file_err:
            # Log file error but do not block response
            print(f"File write error: {file_err}")
        return jsonify({'success': True, 'message': 'Changes saved and logged.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat_history', methods=['GET'])
def get_chat_history():
    # Advanced: support filtering and pagination
    role = request.args.get('role')
    limit = request.args.get('limit', type=int)
    # Reverse chronological order
    filtered_history = list(reversed(chat_history))
    if role:
        filtered_history = [msg for msg in filtered_history if msg.get('role') == role]
    if limit:
        filtered_history = filtered_history[:limit]
    return jsonify(filtered_history)

@app.route('/reset_chat', methods=['POST'])
def reset_chat():
    try:
        model.reset_chat_history()
        chat_history.clear()
        return jsonify({'success': True, 'message': 'Chat history reset.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)