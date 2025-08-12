from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import os
import logging
import socket
import threading
import time
from waitress import serve

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Model configuration
MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
CACHE_DIR = os.path.join(os.path.dirname(__file__), "model_cache")
DEFAULT_PORT = 5001
MAX_RETRIES = 5

model_config = {
    "max_length": 2048,
    "temperature": 0.7,
    "top_p": 0.95,
    "repetition_penalty": 1.1
}

class ModelManager:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.lock = threading.Lock()
        self.is_loaded = False

    def load_model(self):
        if self.is_loaded:
            return

        with self.lock:
            if self.is_loaded:  # Double-check pattern
                return
            
            try:
                logger.info("Creating cache directory if it doesn't exist...")
                os.makedirs(CACHE_DIR, exist_ok=True)

                logger.info("Loading tokenizer...")
                self.tokenizer = AutoTokenizer.from_pretrained(
                    MODEL_NAME,
                    padding_side='left',
                    cache_dir=CACHE_DIR
                )
                self.tokenizer.pad_token = self.tokenizer.eos_token

                logger.info("Loading model...")
                self.model = AutoModelForCausalLM.from_pretrained(
                    MODEL_NAME,
                    torch_dtype=torch.float32,
                    device_map="cpu",
                    low_cpu_mem_usage=True,
                    cache_dir=CACHE_DIR
                )
                
                self.is_loaded = True
                logger.info("Model and tokenizer loaded successfully!")
            except Exception as e:
                logger.error(f"Error loading model: {str(e)}")
                raise

    def generate_response(self, messages, max_new_tokens=256, language_hint=None):
        if not self.is_loaded:
            self.load_model()

        try:
            # Format prompt based on language
            if language_hint and language_hint.lower() in LANGUAGE_PROMPTS:
                prefix = LANGUAGE_PROMPTS[language_hint.lower()]
                messages = [{"role": "system", "content": prefix}] + messages

            # Create prompt
            prompt = self.format_messages(messages)
            inputs = self.tokenizer(prompt, return_tensors="pt", padding=True)

            with self.lock:  # Thread-safe generation
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=max_new_tokens,
                        **model_config,
                        pad_token_id=self.tokenizer.eos_token_id,
                        do_sample=True
                    )

            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            return response[len(prompt):].strip()
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise

    def format_messages(self, messages):
        formatted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
            else:
                formatted.append(f"User: {content}")
        return "\n".join(formatted)

# Initialize model manager
model_manager = ModelManager()

# Language-specific prompts
LANGUAGE_PROMPTS = {
    "python": "You are a Python expert. Write clean, efficient Python code that follows PEP 8 guidelines. Task: ",
    "javascript": "You are a JavaScript expert. Write modern ES6+ code. Task: ",
    "html": "You are an HTML5 expert. Write semantic, accessible HTML code. Task: ",
    "css": "You are a CSS expert. Write modern, responsive CSS code. Task: "
}

def find_available_port(start_port=DEFAULT_PORT, max_port=DEFAULT_PORT + 10):
    """Find an available port starting from start_port"""
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    raise RuntimeError(f"No available ports found between {start_port} and {max_port}")

@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        messages = data.get("messages", [])
        if not messages:
            return jsonify({"error": "No messages provided"}), 400

        language = data.get("language")
        max_tokens = data.get("max_tokens", 256)

        reply = model_manager.generate_response(
            messages, 
            max_new_tokens=max_tokens,
            language_hint=language
        )

        return jsonify({
            "choices": [{
                "message": {"role": "assistant", "content": reply},
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": len(str(messages)),
                "completion_tokens": len(reply),
                "total_tokens": len(str(messages)) + len(reply)
            }
        })
    except Exception as e:
        logger.error(f"Error in chat_completions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model": MODEL_NAME,
        "model_loaded": model_manager.is_loaded
    })

def start_server(port=None, retries=MAX_RETRIES):
    """Start the server with retry logic"""
    for attempt in range(retries):
        try:
            if port is None:
                port = find_available_port()
            
            logger.info(f"Starting server on http://localhost:{port}")
            logger.info("Loading model (this may take a few minutes on first run)...")
            model_manager.load_model()  # Pre-load the model
            
            # Use waitress for production-grade serving
            serve(app, host="0.0.0.0", port=port)
            return
        except Exception as e:
            if attempt < retries - 1:
                next_port = port + 1 if port else None
                wait_time = 2 ** attempt
                logger.warning(f"Failed to start server: {str(e)}")
                logger.info(f"Retrying in {wait_time} seconds on port {next_port or 'auto'}...")
                time.sleep(wait_time)
                port = next_port
            else:
                logger.error("Failed to start server after maximum retries")
                raise

if __name__ == "__main__":
    start_server()
