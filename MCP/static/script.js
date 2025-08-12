let editor;
let isEditing = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    setupEventListeners();
    loadChatHistory();

    // Menu functionality
    const menuModal = document.getElementById('menu-modal');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const menuItems = document.querySelectorAll('.menu-item');

    // Remove old menu event listeners
    const menuBtn = document.getElementById('toggle-menu-btn');
    menuBtn.replaceWith(menuBtn.cloneNode(true));
    const newMenuBtn = document.getElementById('toggle-menu-btn');

    // Add new event listeners
    newMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuModal.style.display = 'block';
        console.log('Menu opened'); // Debug log
    });

    closeMenuBtn.addEventListener('click', () => {
        menuModal.style.display = 'none';
        console.log('Menu closed'); // Debug log
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === menuModal) {
            menuModal.style.display = 'none';
        }
    });

    // Handle menu items
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            handleMenuAction(action);
            menuModal.style.display = 'none';
        });
    });

    // Initialize editor after ensuring elements exist
    const editorTextArea = document.getElementById("code-editor");
    if (editorTextArea) {
        initializeEditor();
    }

    // Single toggle view button logic
    const editorContainer = document.getElementById('editor-container');
    const previewContainer = document.getElementById('preview-container');
    const toggleViewBtn = document.getElementById('toggle-view-btn');

    function showEditor() {
        editorContainer.classList.add('active');
        previewContainer.classList.remove('active');
        toggleViewBtn.textContent = 'Preview';
        toggleViewBtn.title = 'Switch to Preview';
    }
    function showPreview() {
        editorContainer.classList.remove('active');
        previewContainer.classList.add('active');
        updatePreview();
        toggleViewBtn.textContent = 'Code View';
        toggleViewBtn.title = 'Switch to Code Editor';
    }

    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', () => {
            if (editorContainer.classList.contains('active')) {
                showPreview();
            } else {
                showEditor();
            }
        });
        // On load, always start in editor mode
        showEditor();
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
    function toggleTheme() {
        const current = localStorage.getItem('theme') || 'light';
        setTheme(current === 'light' ? 'dark' : 'light');
    }
    themeToggle.onclick = toggleTheme;
    setTheme(localStorage.getItem('theme') || 'light');

    // New Chat
    document.getElementById('new-chat-btn').onclick = () => {
        localStorage.removeItem('vibe_current_chat');
        document.getElementById('chat-messages').innerHTML = '';
    };

    // Autosave chat on every message change
    const chatMessages = document.getElementById('chat-messages');
    const observer = new MutationObserver(() => {
        const chat = Array.from(document.querySelectorAll('.chat-message')).map(m => ({
            role: m.classList.contains('user') ? 'user' : 'bot',
            content: m.textContent
        }));
        localStorage.setItem('vibe_current_chat', JSON.stringify(chat));
    });
    observer.observe(chatMessages, { childList: true, subtree: true });

    // Restore chat on load
    function loadCurrentChat() {
        const chat = JSON.parse(localStorage.getItem('vibe_current_chat') || '[]');
        document.getElementById('chat-messages').innerHTML = '';
        chat.forEach(msg => addChatMessage(msg.role, msg.content));
    }
    loadCurrentChat();
});

function initializeEditor() {
    // Initialize CodeMirror with advanced features
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        mode: "javascript",
        lineNumbers: true,
        theme: "default",
        autoCloseBrackets: true,
        matchBrackets: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        foldCode: true,
        indentUnit: 4,
        smartIndent: true,
        lineWrapping: true,
        autocomplete: true,
        styleActiveLine: true
    });

    // Add theme switcher
    const themes = ["dracula", "monokai", "default"];
    let currentTheme = 0;

    function toggleTheme() {
        currentTheme = (currentTheme + 1) % themes.length;
        editor.setOption("theme", themes[currentTheme]);
    }

    // Add font size control
    function changeFontSize(delta) {
        const editorElement = editor.getWrapperElement();
        const currentSize = parseInt(window.getComputedStyle(editorElement).fontSize);
        editorElement.style.fontSize = (currentSize + delta) + "px";
    }

    // Add these buttons to the header controls
    const headerControls = document.querySelector('.header-controls');
    headerControls.insertAdjacentHTML('beforeend', `

    `);

    // Auto-save functionality
    let autoSaveInterval = setInterval(() => {
        const content = editor.getValue();
        localStorage.setItem('editor-content', content);
    }, 30000); // Auto-save every 30 seconds

    // Load saved content
    const savedContent = localStorage.getItem('editor-content');
    if (savedContent) {
        editor.setValue(savedContent);
    }

    // Add keyboard shortcuts handler
    editor.on('keydown', (cm, event) => {
        // Ctrl+S to save
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            const content = editor.getValue();
            localStorage.setItem('editor-content', content);
        }
    });

    editor.on('change', debounce(() => {
        if (!isEditing) {
            startEditing();
        }
        updatePreview();
    }, 500));
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            switchTab(target);
        });
    });

    // Chat input handling
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    });
    
    // Adjust textarea height
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    document.getElementById('send-button').addEventListener('click', sendPrompt);
    document.getElementById('accept-changes').addEventListener('click', acceptChanges);

    // --- Editor Toolbar Functionality ---
    document.getElementById('copy-code-btn').onclick = function() {
        const code = editor.getValue();
        navigator.clipboard.writeText(code);
        this.textContent = '✅';
        setTimeout(() => { this.textContent = '📋'; }, 1200);
    };

    document.getElementById('run-code-btn').onclick = function() {
        // For HTML/JS/CSS, just update the preview
        updatePreview();
        this.textContent = '⏳';
        setTimeout(() => { this.textContent = '▶'; }, 800);
    };

    document.getElementById('clear-code-btn').onclick = function() {
        editor.setValue('');
        this.textContent = '🗑️';
        setTimeout(() => { this.textContent = '🗑️'; }, 800);
    };

    document.getElementById('format-code-btn').onclick = function() {
        // Simple formatting: auto-indent all lines (works for HTML/JS/CSS)
        editor.execCommand('selectAll');
        editor.execCommand('indentAuto');
        editor.execCommand('goDocEnd');
        this.textContent = '✨ Formatted!';
        setTimeout(() => { this.textContent = '🧹 Format'; }, 1200);
    };

    document.getElementById('theme-toggle-toolbar').onclick = function() {
        const cm = document.querySelector('.CodeMirror');
        if (cm.classList.contains('cm-s-dracula')) {
            cm.classList.remove('cm-s-dracula');
            editor.setOption('theme', 'default');
        } else {
            cm.classList.add('cm-s-dracula');
            editor.setOption('theme', 'dracula');
        }
    };
}

// Menu action handlers
function handleMenuAction(action) {
    if (!editor) return; // Guard clause if editor isn't initialized

    switch(action) {
        case 'save':
            const code = editor.getValue();
            localStorage.setItem('saved-code', code);
            alert('Project saved successfully!');
            break;
        case 'load':
            const savedCode = localStorage.getItem('saved-code');
            if (savedCode) {
                editor.setValue(savedCode);
                alert('Project loaded successfully!');
            } else {
                alert('No saved project found!');
            }
            break;
        case 'export':
            const exportCode = editor.getValue();
            const blob = new Blob([exportCode], {type: 'text/plain'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vibe-coding-project.txt';
            a.click();
            window.URL.revokeObjectURL(url);
            break;
        case 'settings':
            alert('Settings feature coming soon!');
            break;
        case 'about':
            alert('Vibe Coding Editor v1.0\nA modern code editor for the web.');
            break;
    }
}

function downloadCode() {
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Theme toggle
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}
function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    setTheme(current === 'light' ? 'dark' : 'light');
}
document.getElementById('theme-toggle').onclick = toggleTheme;
setTheme(localStorage.getItem('theme') || 'light');

// Menu dropdown
const menuBtn = document.getElementById('menu-btn');
const menu = menuBtn.parentElement;
menuBtn.onclick = () => menu.classList.toggle('open');
window.onclick = e => {
    if (!menu.contains(e.target)) menu.classList.remove('open');
};

// Chat persistence
function saveCurrentChat() {
    const chat = Array.from(document.querySelectorAll('.chat-message')).map(m => ({
        role: m.classList.contains('user') ? 'user' : 'bot',
        content: m.textContent
    }));
    localStorage.setItem('vibe_current_chat', JSON.stringify(chat));
}
function loadCurrentChat() {
    const chat = JSON.parse(localStorage.getItem('vibe_current_chat') || '[]');
    document.getElementById('chat-messages').innerHTML = '';
    chat.forEach(msg => addChatMessage(msg.role, msg.content));
}
function saveChatToHistory() {
    const all = JSON.parse(localStorage.getItem('vibe_saved_chats') || '[]');
    const chat = JSON.parse(localStorage.getItem('vibe_current_chat') || '[]');
    all.push({ id: Date.now(), chat });
    localStorage.setItem('vibe_saved_chats', JSON.stringify(all));
}
function newChat() {
    localStorage.removeItem('vibe_current_chat');
    document.getElementById('chat-messages').innerHTML = '';
}
document.getElementById('new-chat-btn').onclick = () => { newChat(); };

// On chat change, persist
const chatMessages = document.getElementById('chat-messages');
const observer = new MutationObserver(saveCurrentChat);
observer.observe(chatMessages, { childList: true, subtree: true });

// On load, restore chat
window.addEventListener('DOMContentLoaded', loadCurrentChat);

// Saved chats menu
document.getElementById('saved-chats-link').onclick = e => {
    e.preventDefault();
    const all = JSON.parse(localStorage.getItem('vibe_saved_chats') || '[]');
    let html = '<h3>Saved Chats</h3>';
    if (all.length === 0) html += '<p>No saved chats.</p>';
    all.forEach((c, i) => {
        html += `<button data-idx="${i}" class="load-chat-btn">Chat ${i+1}</button>`;
    });
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${html}<button id="close-modal">Close</button></div>`;
    document.body.appendChild(modal);
    modal.onclick = e => {
        if (e.target.id === 'close-modal') modal.remove();
        if (e.target.classList.contains('load-chat-btn')) {
            const idx = +e.target.dataset.idx;
            localStorage.setItem('vibe_current_chat', JSON.stringify(all[idx].chat));
            loadCurrentChat();
            modal.remove();
        }
    };
};

// Profile/logout (demo)
document.getElementById('profile-link').onclick = e => { e.preventDefault(); alert('Profile page coming soon!'); };
document.getElementById('logout-link').onclick = e => { e.preventDefault(); alert('Logged out!'); };

// --- Menu Chat History and Functions ---
function updateMenuChatHistory() {
    fetch('/chat_history?limit=20')
        .then(res => res.json())
        .then(history => {
            const list = document.getElementById('chat-history-list');
            list.innerHTML = '';
            if (!history.length) {
                list.innerHTML = '<li><em>No chat history.</em></li>';
                return;
            }
            history.forEach(msg => {
                const li = document.createElement('li');
                li.textContent = `[${msg.role}] ${msg.content}`;
                list.appendChild(li);
            });
        });
}

const menuModal = document.getElementById('menu-modal');
if (menuModal) {
    menuModal.addEventListener('show', updateMenuChatHistory);
    // Fallback: update when opened
    document.getElementById('toggle-menu-btn').addEventListener('click', updateMenuChatHistory);
}

const resetChatBtn = document.getElementById('reset-chat-btn');
if (resetChatBtn) {
    resetChatBtn.onclick = function() {
        fetch('/reset_chat', { method: 'POST' })
            .then(res => res.json())
            .then(() => {
                updateMenuChatHistory();
                document.getElementById('chat-messages').innerHTML = '';
            });
    };
}

function switchTab(target) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === target);
    });
    
    document.getElementById('editor-container').classList.toggle('active', target === 'editor');
    document.getElementById('preview-container').classList.toggle('active', target === 'preview');
    
    if (target === 'preview') {
        updatePreview();
    }
}

function updatePreview() {
    const preview = document.getElementById('preview');
    const code = editor.getValue();
    preview.srcdoc = code;
}

function startEditing() {
    isEditing = true;
    document.getElementById('accept-changes').classList.remove('hidden');
}

function acceptChanges() {
    const code = editor.getValue();
    
    fetch('/save_changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => response.json())
    .then(() => {
        isEditing = false;
        document.getElementById('accept-changes').classList.add('hidden');
        addChatMessage('bot', 'Changes saved successfully! ✨');
    })
    .catch(error => {
        console.error('Error saving changes:', error);
        addChatMessage('bot', 'Failed to save changes. Please try again.');
    });
}

function addChatMessage(role, content) {
    const messages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.textContent = content;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

async function sendPrompt() {
    const chatInput = document.getElementById('chat-input');
    const prompt = chatInput.value.trim();
    
    if (!prompt) return;
    
    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Add user message
    addChatMessage('user', prompt);

    // Add bot loading message with spinner
    const messages = document.getElementById('chat-messages');
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'chat-message bot loading';
    botMsgDiv.innerHTML = '<span class="spinner"></span> Generating code...';
    messages.appendChild(botMsgDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
        const response = await fetch('/generate_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            // Try to parse error message from backend
            let errorMsg = 'Sorry, something went wrong. Please try again.';
            try {
                const errData = await response.json();
                if (errData && errData.error) errorMsg = errData.error;
            } catch {}
            botMsgDiv.innerHTML = errorMsg;
            botMsgDiv.classList.remove('loading');
            return;
        }

        const reader = response.body.getReader();
        let code = '';
        let codeLines = [];
        let codeStarted = false;
        let gotFirstChat = false;
        let chatText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.replace('data: ', ''));
                    if (data.type === 'code_line') {
                        codeLines.push(data.line);
                        codeStarted = true;
                        // Show code in editor as it streams
                        editor.setValue(codeLines.join('\n'));
                        updatePreview();
                    } else if (data.type === 'chat') {
                        chatText = data.message.content;
                        // Replace loading message with actual chat (keep spinner if code is still streaming)
                        botMsgDiv.innerHTML = '<span class="spinner"></span> ' + chatText;
                        gotFirstChat = true;
                    } else if (data.type === 'complete') {
                        code = codeLines.join('\n');
                        editor.setValue(code);
                        updatePreview();
                        // Switch to preview mode automatically and update button
                        editorContainer.classList.remove('active');
                        previewContainer.classList.add('active');
                        toggleViewBtn.textContent = 'Code View';
                        toggleViewBtn.title = 'Switch to Code Editor';
                        // Remove spinner/loading from chat
                        botMsgDiv.innerHTML = chatText || 'Code generation complete.';
                        botMsgDiv.classList.remove('loading');
                    }
                }
            }
        }
        // If we never got a chat chunk, remove spinner at the end
        if (!gotFirstChat) {
            botMsgDiv.innerHTML = 'Code generating...';
            botMsgDiv.classList.remove('loading');
        }
    } catch (error) {
        console.error('Error:', error);
        botMsgDiv.innerHTML = 'Sorry, something went wrong. Please try again.';
        botMsgDiv.classList.remove('loading');
    }
}

// Add spinner CSS if not present
if (!document.getElementById('vibe-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'vibe-spinner-style';
        case 'chat':
            addChatMessage('bot', data.message.content);
            break;
        case 'code_line':
            code += data.line + '\n';
            editor.setValue(code);
            break;
        case 'complete':
            updatePreview();
            break;
    }
}

function loadChatHistory() {
    fetch('/chat_history')
        .then(response => response.json())
        .then(history => {
            history.forEach(msg => addChatMessage(msg.role, msg.content));
        })
        .catch(error => console.error('Error loading chat history:', error));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}