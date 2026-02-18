// lib/javari/realtime/realtime-client.ts
// OpenAI Realtime API WebSocket client — text modality only
// Accepts an ephemeral rtKey from /api/javari/realtime-key (server-signed)
// Falls back gracefully if key is unavailable

export interface RealtimeClientOptions {
  rtKey?: string;                        // ephemeral ek_... key from server
  onTextDelta?: (chunk: string) => void;
  onResponseCompleted?: (fullText: string) => void;
  onError?: (err: Error) => void;
  onStateChange?: (state: "connecting" | "ready" | "closed" | "error") => void;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private rtKey: string;
  private opts: RealtimeClientOptions;
  private retryCount = 0;
  private maxRetries = 3;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private textBuffer = "";
  private stopped = false;

  // Public callback overrides (allow hot-swapping from JavariChatScreen)
  onTextDelta?: (chunk: string) => void;
  onResponseCompleted?: (fullText: string) => void;

  constructor(rtKey: string, opts: RealtimeClientOptions = {}) {
    this.rtKey = rtKey;
    this.opts = opts;
    // Allow direct property assignment to override opts callbacks
    this.onTextDelta = opts.onTextDelta;
    this.onResponseCompleted = opts.onResponseCompleted;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.ws) {
      this.ws.close(1000, "Client stopped");
      this.ws = null;
    }
    this.opts.onStateChange?.("closed");
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendText(text: string): void {
    if (!this.isConnected()) {
      this.opts.onError?.(new Error("RealtimeClient: not connected"));
      return;
    }
    // Send user message then request response
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    this.send({ type: "response.create" });
  }

  private connect(): void {
    if (this.stopped) return;
    this.opts.onStateChange?.("connecting");

    // OpenAI Realtime WS auth: pass ephemeral key as bearer in subprotocol
    // Correct format verified against OpenAI Realtime API spec
    const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
    const protocols = [
      "realtime",
      `openai-insecure-api-key.${this.rtKey}`,
      "openai-beta.realtime-v1",
    ];

    try {
      this.ws = new WebSocket(url, protocols);
    } catch (err) {
      this.handleError(new Error("WebSocket construction failed"));
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      // Session is pre-configured by the server at key creation time
      // No additional session.update needed for text-only mode
      this.opts.onStateChange?.("ready");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onerror = () => {
      this.handleError(new Error("WebSocket connection error"));
    };

    this.ws.onclose = (ev) => {
      if (!this.stopped && ev.code !== 1000) {
        this.scheduleRetry();
      } else {
        this.opts.onStateChange?.("closed");
      }
    };
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "response.text.delta": {
        const chunk = (msg.delta as string) ?? "";
        if (chunk) {
          this.textBuffer += chunk;
          const cb = this.onTextDelta ?? this.opts.onTextDelta;
          cb?.(chunk);
        }
        break;
      }

      case "response.text.done":
      case "response.done": {
        const full = this.textBuffer;
        this.textBuffer = "";
        if (full) {
          const cb = this.onResponseCompleted ?? this.opts.onResponseCompleted;
          cb?.(full);
        }
        break;
      }

      case "session.created":
      case "session.updated": {
        // Session ready — already signalled via onopen
        break;
      }

      case "error": {
        const detail =
          (msg.error as Record<string, unknown>)?.message ?? "Realtime API error";
        this.opts.onError?.(new Error(String(detail)));
        break;
      }
    }
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private handleError(err: Error): void {
    this.opts.onError?.(err);
    this.opts.onStateChange?.("error");
    if (!this.stopped) this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryCount >= this.maxRetries || this.stopped) {
      this.opts.onStateChange?.("error");
      return;
    }
    const delay = Math.min(1000 * 2 ** this.retryCount, 16000);
    this.retryCount++;
    this.retryTimeout = setTimeout(() => this.connect(), delay);
  }
}
