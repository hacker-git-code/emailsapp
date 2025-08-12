# model.py

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
# No API key needed for local model

system_prompt = (
    "You are Vibe Coding Assistant, a highly skilled developer assistant. "
    "You can chat, write websites, and build apps. Provide clear explanations and code blocks."
)

code_prompt = (
    "You are Vibe Coding Assistant specialized in generating code. "
    "Respond only with code blocks for the user's request, without additional commentary."
)

LOCAL_LLM_URL = "http://localhost:5001/v1/chat/completions"

# Chat history management for session-based conversations
class ChatSession:
    def __init__(self, system_prompt=system_prompt):
        self.system_prompt = system_prompt
        self.history = [
            {"role": "system", "content": self.system_prompt}
        ]

    def add_user_message(self, content):
        self.history.append({"role": "user", "content": content})

    def add_assistant_message(self, content):
        self.history.append({"role": "assistant", "content": content})

    def clear_history(self):
        self.history = [
            {"role": "system", "content": self.system_prompt}
        ]

    def get_history(self):
        return self.history

# Singleton session for simple use (can be extended for multi-user)
chat_session = ChatSession()

def generate_chat(prompt, use_history=True):
    """
    Generate a chat response from the local LLM server, with optional chat history.
    """
    if use_history:
        chat_session.add_user_message(prompt)
        data = {"messages": chat_session.get_history()}
    else:
        data = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        }
    resp = requests.post(LOCAL_LLM_URL, json=data)
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    if use_history:
        chat_session.add_assistant_message(content)
    return content

def reset_chat_history():
    """
    Clear the chat history for the current session.
    """
    chat_session.clear_history()

def stream_generate_code(prompt):
    """
    Generate code from the local LLM server (no streaming, just returns the result).
    """
    data = {
        "messages": [
            {"role": "system", "content": code_prompt},
            {"role": "user", "content": prompt}
        ]
    }
    resp = requests.post(LOCAL_LLM_URL, json=data)
    resp.raise_for_status()
    # Simulate streaming by yielding lines
    content = resp.json()["choices"][0]["message"]["content"]
    for line in content.splitlines():
        yield {"choices": [{"delta": {"content": line + "\n"}}]}

def generate_code(prompt):
    return stream_generate_code(prompt)