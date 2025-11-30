// Javari AI Embed Script
// Add this script to any page to enable Javari AI chat widget
// Usage: <script src="https://javariai.com/embed.js"></script>

(function() {
  // Create widget container
  const container = document.createElement('div');
  container.id = 'javari-widget-root';
  document.body.appendChild(container);

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    #javari-widget-root {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .javari-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .javari-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(139, 92, 246, 0.5);
    }
    .javari-button svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    .javari-chat {
      display: none;
      width: 380px;
      height: 500px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      flex-direction: column;
      overflow: hidden;
    }
    .javari-chat.open {
      display: flex;
    }
    .javari-header {
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: white;
    }
    .javari-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .javari-avatar {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .javari-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 24px;
      opacity: 0.8;
    }
    .javari-close:hover { opacity: 1; }
    .javari-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .javari-message {
      margin-bottom: 12px;
      display: flex;
    }
    .javari-message.user { justify-content: flex-end; }
    .javari-message-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
    }
    .javari-message.user .javari-message-bubble {
      background: #8B5CF6;
      color: white;
      border-bottom-right-radius: 4px;
    }
    .javari-message.assistant .javari-message-bubble {
      background: #F3F4F6;
      color: #1F2937;
      border-bottom-left-radius: 4px;
    }
    .javari-input-area {
      padding: 16px;
      border-top: 1px solid #E5E7EB;
      display: flex;
      gap: 8px;
    }
    .javari-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #E5E7EB;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
    }
    .javari-input:focus { border-color: #8B5CF6; }
    .javari-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #8B5CF6;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .javari-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .javari-typing {
      color: #9CA3AF;
      font-size: 13px;
      padding: 8px 14px;
    }
  `;
  document.head.appendChild(styles);

  // Widget HTML
  container.innerHTML = `
    <button class="javari-button" id="javari-toggle">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
    </button>
    <div class="javari-chat" id="javari-chat">
      <div class="javari-header">
        <div class="javari-header-info">
          <div class="javari-avatar">🧠</div>
          <div>
            <div style="font-weight:600">Javari AI</div>
            <div style="font-size:12px;opacity:0.8">CR AudioViz AI Assistant</div>
          </div>
        </div>
        <button class="javari-close" id="javari-close">&times;</button>
      </div>
      <div class="javari-messages" id="javari-messages">
        <div class="javari-message assistant">
          <div class="javari-message-bubble">Hi! I'm Javari, your AI assistant. How can I help you today?</div>
        </div>
      </div>
      <div class="javari-input-area">
        <input type="text" class="javari-input" id="javari-input" placeholder="Type a message...">
        <button class="javari-send" id="javari-send">➤</button>
      </div>
    </div>
  `;

  // State
  let messages = [];
  let isOpen = false;
  let isLoading = false;

  // Elements
  const toggle = document.getElementById('javari-toggle');
  const chat = document.getElementById('javari-chat');
  const close = document.getElementById('javari-close');
  const messagesEl = document.getElementById('javari-messages');
  const input = document.getElementById('javari-input');
  const send = document.getElementById('javari-send');

  // Toggle chat
  toggle.addEventListener('click', () => {
    isOpen = true;
    toggle.style.display = 'none';
    chat.classList.add('open');
    input.focus();
  });

  close.addEventListener('click', () => {
    isOpen = false;
    chat.classList.remove('open');
    toggle.style.display = 'flex';
  });

  // Send message
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    messages.push({ role: 'user', content: text });
    
    // Add user message
    messagesEl.innerHTML += `<div class="javari-message user"><div class="javari-message-bubble">${escapeHtml(text)}</div></div>`;
    messagesEl.innerHTML += '<div class="javari-typing" id="typing">Javari is thinking...</div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    isLoading = true;
    send.disabled = true;

    try {
      const response = await fetch('https://javariai.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, provider: 'openai' })
      });
      
      const data = await response.json();
      const reply = data.message || 'Sorry, I could not process that request.';
      messages.push({ role: 'assistant', content: reply });
      
      document.getElementById('typing')?.remove();
      messagesEl.innerHTML += `<div class="javari-message assistant"><div class="javari-message-bubble">${escapeHtml(reply)}</div></div>`;
    } catch (e) {
      document.getElementById('typing')?.remove();
      messagesEl.innerHTML += '<div class="javari-message assistant"><div class="javari-message-bubble">Sorry, I couldn\'t connect. Please try again.</div></div>';
    }

    isLoading = false;
    send.disabled = false;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();
