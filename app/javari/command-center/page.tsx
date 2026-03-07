"use client";
// app/javari/command-center/page.tsx
// Purpose: Javari Command Console — chat interface with system command controls.
//          Modes: "chat" (conversation) | "multi" (multi-AI collaboration)
//          Command buttons: run_next_task, start_roadmap, pause_execution, resume_execution
// Date: 2026-03-07

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = "chat" | "multi";
type MsgRole = "user" | "assistant" | "system" | "command";
type MsgStatus = "sending" | "done" | "error";

interface Message {
  id      : string;
  role    : MsgRole;
  content : string;
  mode?   : Mode;
  model?  : string;
  cost?   : number;
  status  : MsgStatus;
  ts      : number;
}

interface QueueStats {
  completed : number;
  pending   : number;
  failed    : number;
  total     : number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Command button config ──────────────────────────────────────────────────
const COMMANDS = [
  { id: "run_next_task",      label: "Run Next Task",      icon: "▶",  color: "from-emerald-600/70 to-teal-600/70",   border: "border-emerald-400/30"  },
  { id: "start_roadmap",      label: "Start Roadmap",      icon: "🚀", color: "from-blue-600/70 to-indigo-600/70",    border: "border-blue-400/30"     },
  { id: "pause_execution",    label: "Pause Execution",    icon: "⏸",  color: "from-amber-600/70 to-orange-600/70",   border: "border-amber-400/30"    },
  { id: "resume_execution",   label: "Resume Execution",   icon: "▶▶", color: "from-purple-600/70 to-violet-600/70",  border: "border-purple-400/30"   },
  { id: "queue_status",       label: "Queue Status",       icon: "📊", color: "from-slate-600/70 to-zinc-600/70",     border: "border-slate-400/30"    },
  { id: "memory_status",      label: "Memory Status",      icon: "🧠", color: "from-rose-600/70 to-pink-600/70",      border: "border-rose-400/30"     },
] as const;

// ── Main component ─────────────────────────────────────────────────────────
export default function CommandCenter() {
  const [mode, setMode]       = useState<Mode>("chat");
  const [messages, setMessages] = useState<Message[]>([{
    id     : "welcome",
    role   : "system",
    content: "Javari Command Console online. Type a message or use the command buttons below. Switch to **Multi** mode for multi-AI collaboration.",
    status : "done",
    ts     : Date.now(),
  }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Poll queue stats ───────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/javari/queue");
        const d = await r.json();
        if (d.stats) setQueueStats(d.stats);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Send message or command ────────────────────────────────────────────
  const send = useCallback(async (text: string, isCommand = false, commandId?: string) => {
    if (!text.trim() && !commandId) return;
    const content = commandId ? text : text.trim();

    // Add user / command message
    const userMsg: Message = {
      id     : uid(),
      role   : isCommand ? "command" : "user",
      content: isCommand ? `/${commandId ?? content}` : content,
      mode,
      status : "done",
      ts     : Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    if (!isCommand) setInput("");
    setLoading(true);

    // Placeholder assistant message
    const assistantId = uid();
    setMessages(prev => [...prev, {
      id     : assistantId,
      role   : "assistant",
      content: "…",
      status : "sending",
      ts     : Date.now(),
    }]);

    try {
      const body: Record<string, unknown> = {
        userId: "system",
        mode  : isCommand ? "command" : mode,
      };
      if (isCommand && commandId) {
        body.command = commandId;
        body.message = commandId;
      } else {
        body.message = content;
      }

      const res = await fetch("/api/javari/execute", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(body),
      });
      const data = await res.json();

      const reply  = data.reply ?? data.error ?? "No response.";
      const model  = data.model ?? data.models ?? undefined;
      const cost   = data.cost  ?? undefined;

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: reply, model, cost, status: data.ok ? "done" : "error" }
          : m
      ));

      // Refresh queue stats after commands
      if (isCommand) {
        const r = await fetch("/api/javari/queue");
        const d = await r.json();
        if (d.stats) setQueueStats(d.stats);
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Connection error. Check network.", status: "error" }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // ── Render message bubble ──────────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isUser    = msg.role === "user";
    const isCmd     = msg.role === "command";
    const isSys     = msg.role === "system";
    const isAssist  = msg.role === "assistant";

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`flex gap-3 ${isUser || isCmd ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar dot */}
        {!isSys && (
          <div className={`
            w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1
            ${isUser  ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white" : ""}
            ${isCmd   ? "bg-gradient-to-br from-amber-600 to-orange-600 text-white" : ""}
            ${isAssist ? "bg-gradient-to-br from-emerald-700 to-teal-700 text-white" : ""}
          `}>
            {isUser ? "R" : isCmd ? "/" : "J"}
          </div>
        )}

        <div className={`max-w-[78%] ${isSys ? "w-full" : ""}`}>
          {/* Bubble */}
          <div className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
            ${isUser  ? "bg-gradient-to-br from-purple-900/60 to-blue-900/60 border border-purple-500/20 text-white ml-auto" : ""}
            ${isCmd   ? "bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/20 text-amber-100 font-mono text-xs ml-auto" : ""}
            ${isAssist && msg.status === "sending" ? "bg-black/40 border border-white/5 text-white/30 italic" : ""}
            ${isAssist && msg.status === "done"    ? "bg-black/40 border border-white/10 text-white" : ""}
            ${isAssist && msg.status === "error"   ? "bg-red-950/40 border border-red-500/20 text-red-300" : ""}
            ${isSys   ? "bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 text-xs w-full text-center rounded-xl" : ""}
          `}>
            {msg.status === "sending" ? (
              <span className="inline-flex gap-1">
                <span className="animate-bounce delay-0">●</span>
                <span className="animate-bounce delay-75">●</span>
                <span className="animate-bounce delay-150">●</span>
              </span>
            ) : (
              // Simple markdown-lite: **bold**
              msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={i} className="font-semibold text-white">{part.slice(2,-2)}</strong>
                  : <span key={i}>{part}</span>
              )
            )}
          </div>

          {/* Meta row */}
          {isAssist && msg.status === "done" && (
            <div className="flex gap-3 mt-1 px-1 text-[10px] text-white/25 font-mono">
              <span>{fmtTime(msg.ts)}</span>
              {msg.model && <span>{typeof msg.model === "string" ? msg.model : "multi"}</span>}
              {msg.cost   && <span>${typeof msg.cost === "number" ? msg.cost.toFixed(4) : msg.cost}</span>}
              {msg.mode   && <span className="uppercase tracking-widest">{msg.mode}</span>}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col w-full h-screen bg-[#020206] text-white font-mono overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="text-xs tracking-[0.2em] text-white/60 uppercase">Javari</span>
          <span className="text-white/20 text-xs">|</span>
          <span className="text-xs text-white/40">Command Console</span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-1">
          {(["chat", "multi"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`
                px-3 py-1 rounded-md text-[10px] uppercase tracking-widest transition-all duration-200
                ${mode === m
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-white/30 hover:text-white/60"
                }
              `}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Queue badge */}
        {queueStats && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/30">
            <span className="text-emerald-400/70">✓{queueStats.completed}</span>
            <span className="text-amber-400/70">◎{queueStats.pending}</span>
            {queueStats.failed > 0 && <span className="text-red-400/70">✗{queueStats.failed}</span>}
            <span className="text-white/20">/{queueStats.total}</span>
          </div>
        )}
      </div>

      {/* ── Mode indicator pill ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex-shrink-0 flex justify-center py-2"
        >
          <span className={`
            px-3 py-0.5 rounded-full text-[9px] uppercase tracking-[0.25em] border
            ${mode === "chat"
              ? "bg-purple-950/40 border-purple-500/20 text-purple-300/70"
              : "bg-blue-950/40 border-blue-500/20 text-blue-300/70"
            }
          `}>
            {mode === "chat" ? "Single AI · Conversation" : "Multi-AI · Collaboration"}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* ── Message feed ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* ── Command buttons ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.04]">
        <div className="text-[9px] uppercase tracking-[0.2em] text-white/20 mb-2">System Commands</div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {COMMANDS.map(cmd => (
            <motion.button
              key={cmd.id}
              whileTap={{ scale: 0.94 }}
              disabled={loading}
              onClick={() => send(cmd.label, true, cmd.id)}
              className={`
                px-2 py-2 rounded-lg bg-gradient-to-br ${cmd.color}
                border ${cmd.border} text-white text-[10px] font-medium
                flex flex-col items-center gap-1
                hover:brightness-125 transition-all duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <span className="text-base leading-none">{cmd.icon}</span>
              <span className="leading-tight text-center">{cmd.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.06] bg-black/60 backdrop-blur-xl">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            disabled={loading}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={mode === "chat" ? "Message Javari…" : "Multi-AI prompt…"}
            className="
              flex-1 bg-white/[0.04] text-white border border-white/[0.08]
              rounded-xl px-4 py-3 resize-none outline-none text-sm
              focus:border-purple-400/30 transition-all
              placeholder:text-white/20 font-mono
              disabled:opacity-50
            "
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            disabled={loading || !input.trim()}
            onClick={() => send(input)}
            className="
              px-5 py-3 rounded-xl
              bg-gradient-to-br from-purple-600/70 to-blue-600/70
              border border-purple-400/20 text-white text-sm font-medium
              hover:brightness-110 transition-all
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {loading ? (
              <span className="inline-flex gap-1 items-center">
                <span className="w-1 h-1 rounded-full bg-white animate-bounce" />
                <span className="w-1 h-1 rounded-full bg-white animate-bounce delay-75" />
              </span>
            ) : (
              <span>Send</span>
            )}
          </motion.button>
        </div>
        <div className="mt-2 text-[9px] text-white/15 text-center tracking-widest uppercase">
          {mode} mode · enter to send · shift+enter for newline
        </div>
      </div>
    </div>
  );
}
