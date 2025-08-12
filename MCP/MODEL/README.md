# Local Code Generation API

This is a lightweight local code generation API using TinyLlama-1.1B-Chat. It runs entirely on CPU and is optimized for low-end PCs.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:5001`

## API Usage

Send POST requests to `/v1/chat/completions` with the following format:

```json
{
    "messages": [
        {"role": "user", "content": "Write a function to calculate fibonacci numbers"}
    ],
    "language": "python"  // Optional: "python", "javascript", "html", or "css"
}
```

### Example using curl:
```bash
curl -X POST http://localhost:5001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Write a function that adds two numbers"}],"language":"python"}'
```

### Supported Languages
- Python
- JavaScript
- HTML
- CSS

The model is optimized for code generation in these languages while maintaining a small footprint suitable for local execution.
