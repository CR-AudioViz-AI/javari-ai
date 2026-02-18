// lib/javari/realtime/realtime-client.ts
// OpenAI Realtime API client — text modality only (no mic required)
// Connects via WebSocket, sends user text, receives assistant text deltas

export interface RealtimeClientOptions {
  onTextDelta?: (chunk: string) => void;
  onResponseCompleted?: (fullText: string) => void;
  onError?: (err: Error) => void;
  onStateChange?: (state: "connecting" | "ready" | "closed" | "error") => void;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private opts: RealtimeClientOptions;
  private retryCount = 0;
  private maxRetries = 4;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private textBuffer = "";
  private stopped = false;

  constructor(apiKey: string, opts: RealtimeClientOptions = {}) {
    this.apiKey = apiKey;
    this.opts = opts;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.opts.onStateChange?.("closed");
  }

  private connect(): void {
    if (this.stopped) return;
    this.opts.onStateChange?.("connecting");

    try {
      this.ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
        ["realtime", `openai-insecure-api-key.${this.apiKey}`, "openai-beta.realtime-v1"]
      );
    } catch (err) {
      this.handleError(new Error("WebSocket construction failed"));
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.opts.onStateChange?.("ready");
      // Configure session for text-only modality
      this.send({
        type: "session.update",
        session: {
          modalities: ["text"],
          instructions:
            "You are Javari AI, an autonomous multi-AI operating system created by Roy Henderson for CRAudioVizAI. You ALWAYS speak as Javari. You NEVER identify as Claude, GPT, Gemini, or any underlying model. You follow the Henderson Standard: Fortune-50 quality, never break, never give up.",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
        },
      });
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
      this.handleError(new Error("WebSocket error"));
    };

    this.ws.onclose = () => {
      if (!this.stopped) {
        this.scheduleRetry();
      }
    };
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "response.text.delta": {
        const chunk = (msg.delta as string) ?? "";
        if (chunk) {
          this.textBuffer += chunk;
          this.opts.onTextDelta?.(chunk);
        }
        break;
      }
      case "response.text.done":
      case "response.done": {
        const full = this.textBuffer;
        this.textBuffer = "";
        if (full) this.opts.onResponseCompleted?.(full);
        break;
      }
      case "error": {
        const detail = (msg.error as Record<string, unknown>)?.message ?? "Realtime API error";
        this.opts.onError?.(new Error(String(detail)));
        break;
      }
    }
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue via REST fallback — caller handles this
      this.opts.onError?.(new Error("RealtimeClient: WebSocket not open"));
      return;
    }
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
    if (this.retryCount >= this.maxRetries || this.stopped) return;
    const delay = Math.min(1000 * 2 ** this.retryCount, 16000);
    this.retryCount++;
    this.retryTimeout = setTimeout(() => this.connect(), delay);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
