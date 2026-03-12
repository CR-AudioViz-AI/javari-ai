// lib/javari/realtime/realtime-client.ts
// OpenAI Realtime API WebSocket client — text modality only
// Accepts an ephemeral rtKey from /api/javari/realtime-key (server-signed)
// Falls back gracefully if key is unavailable
export interface RealtimeClientOptions {
  // Public callback overrides (allow hot-swapping from JavariChatScreen)
    // Allow direct property assignment to override opts callbacks
    // Send user message then request response
    // OpenAI Realtime WS auth: pass ephemeral key as bearer in subprotocol
    // Correct format verified against OpenAI Realtime API spec
      // Session is pre-configured by the server at key creation time
      // No additional session.update needed for text-only mode
        // ignore malformed frames
        // Session ready — already signalled via onopen
export default {}
