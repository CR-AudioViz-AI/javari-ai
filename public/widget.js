// Embeddable Javari Chat Widget
// Usage: Add <script src="https://crav-javari.vercel.app/widget.js" data-app-id="YOUR_APP_ID"></script>

(function() {
  const WIDGET_URL = "https://crav-javari.vercel.app";
  const script = document.currentScript;
  const appId = script?.getAttribute("data-app-id") || "default";
  const position = script?.getAttribute("data-position") || "bottom-right";
  const primaryColor = script?.getAttribute("data-color") || "#6366f1";
  
  const styles = document.createElement("style");
  styles.textContent = `
    #javari-widget-container {
      position: fixed;
      ${position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
      ${position.includes("right") ? "right: 20px" : "left: 20px"};
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #javari-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${primaryColor} 0%, #8b5cf6 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #javari-widget-button:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
    }
    #javari-widget-button svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    #javari-widget-chat {
      display: none;
      position: absolute;
      ${position.includes("bottom") ? "bottom: 70px" : "top: 70px"};
      ${position.includes("right") ? "right: 0" : "left: 0"};
      width: 380px;
      height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }
    #javari-widget-chat.open { display: block; }
    #javari-widget-header {
      background: linear-gradient(135deg, ${primaryColor} 0%, #8b5cf6 100%);
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #javari-widget-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    #javari-widget-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
    }
    #javari-widget-iframe {
      width: 100%;
      height: calc(100% - 56px);
      border: none;
    }
    @media (max-width: 480px) {
      #javari-widget-chat {
        width: calc(100vw - 40px);
        height: calc(100vh - 100px);
        ${position.includes("right") ? "right: -10px" : "left: -10px"};
      }
    }
  `;
  document.head.appendChild(styles);

  const container = document.createElement("div");
  container.id = "javari-widget-container";
  container.innerHTML = \`
    <div id="javari-widget-chat">
      <div id="javari-widget-header">
        <h3>Javari AI Assistant</h3>
        <button id="javari-widget-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <iframe id="javari-widget-iframe" src="\${WIDGET_URL}/embed?app=\${appId}"></iframe>
    </div>
    <button id="javari-widget-button" aria-label="Chat with Javari">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.32L2 22l5.68-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.4 0-2.74-.33-3.93-.94l-.28-.14-2.89.49.49-2.89-.16-.3A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>
    </button>
  \`;
  document.body.appendChild(container);

  const button = document.getElementById("javari-widget-button");
  const chat = document.getElementById("javari-widget-chat");
  const closeBtn = document.getElementById("javari-widget-close");

  button.addEventListener("click", () => {
    chat.classList.toggle("open");
    button.style.display = chat.classList.contains("open") ? "none" : "flex";
  });

  closeBtn.addEventListener("click", () => {
    chat.classList.remove("open");
    button.style.display = "flex";
  });

  // Listen for messages from iframe
  window.addEventListener("message", (event) => {
    if (event.origin !== WIDGET_URL) return;
    if (event.data.type === "javari-close") {
      chat.classList.remove("open");
      button.style.display = "flex";
    }
    if (event.data.type === "javari-ticket") {
      console.log("Support ticket created:", event.data.ticketId);
    }
  });
})();
