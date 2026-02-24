// =============================================================================
// JAVARI AI - EMBED SCRIPT
// =============================================================================
// Add to any website: <script src="https://javariai.com/embed.js"></script>
// Production Ready - Sunday, December 14, 2025
// =============================================================================

(function() {
  'use strict';

  // Configuration (can be overridden via data attributes on script tag)
  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var config = {
    position: script?.getAttribute('data-position') || 'bottom-right',
    color: script?.getAttribute('data-color') || '#3B82F6',
    title: script?.getAttribute('data-title') || 'Javari AI',
    subtitle: script?.getAttribute('data-subtitle') || 'AI Assistant',
    welcome: script?.getAttribute('data-welcome') || "Hi! I'm Javari, your AI assistant. How can I help you today?",
    autoOpen: script?.getAttribute('data-auto-open') === 'true'
  };

  // Create iframe container
  var container = document.createElement('div');
  container.id = 'javari-embed-container';
  container.style.cssText = 'position:fixed;bottom:0;' + 
    (config.position === 'bottom-left' ? 'left:0;' : 'right:0;') + 
    'width:420px;height:550px;max-height:90vh;max-width:calc(100vw - 20px);z-index:2147483647;pointer-events:none;';

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'javari-embed-iframe';
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;pointer-events:auto;';
  iframe.allow = 'clipboard-write';
  
  // Build URL with config
  var params = new URLSearchParams({
    position: config.position,
    color: config.color,
    title: config.title,
    subtitle: config.subtitle,
    welcome: config.welcome
  });
  
  iframe.src = 'https://javariai.com/embed?' + params.toString();

  // Append to document
  container.appendChild(iframe);
  
  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(container);
    });
  } else {
    document.body.appendChild(container);
  }

  // Expose API for programmatic control
  window.Javari = {
    open: function() {
      iframe.contentWindow?.postMessage({ action: 'open' }, '*');
    },
    close: function() {
      iframe.contentWindow?.postMessage({ action: 'close' }, '*');
    },
    toggle: function() {
      iframe.contentWindow?.postMessage({ action: 'toggle' }, '*');
    },
    sendMessage: function(message) {
      iframe.contentWindow?.postMessage({ action: 'send', message: message }, '*');
    }
  };

  // Listen for resize messages from iframe
  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://javariai.com') return;
    
    if (event.data.type === 'javari-resize') {
      container.style.width = event.data.width + 'px';
      container.style.height = event.data.height + 'px';
    }
  });

  console.log('✨ Javari AI Widget loaded successfully');
})();
