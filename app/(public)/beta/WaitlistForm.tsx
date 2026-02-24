"use client";
// app/(public)/beta/WaitlistForm.tsx
// CR AudioViz AI — Beta Waitlist / Signup Form
// 2026-02-20 — STEP 8 Go-Live

import { useState } from "react";
import { Loader2, CheckCircle, ArrowRight, Mail } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export default function BetaWaitlistForm() {
  const [email, setEmail]       = useState("");
  const [name,  setName]        = useState("");
  const [state, setState]       = useState<State>("idle");
  const [message, setMessage]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");

    try {
      const res = await fetch("/api/beta/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (data.success) {
        setState("success");
        setMessage(data.message ?? "You're on the list! Check your email for next steps.");
      } else {
        setState("error");
        setMessage(data.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="text-center py-10 px-6 rounded-2xl bg-green-900/20 border border-green-700/40">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">You're in!</h3>
        <p className="text-slate-300 mb-6">{message}</p>
        <a
          href="/auth/register"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                     bg-gradient-to-r from-blue-600 to-violet-600 text-white
                     font-semibold transition-all hover:scale-[1.02]"
        >
          Create Your Account
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-8 space-y-4"
      aria-label="Beta signup form"
    >
      <div>
        <label htmlFor="beta-name"
               className="block text-sm font-medium text-slate-300 mb-1.5">
          Your name
        </label>
        <input
          id="beta-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Johnson"
          autoComplete="name"
          className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700
                     text-white placeholder-slate-500 focus:outline-none
                     focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                     transition-all text-sm"
        />
      </div>

      <div>
        <label htmlFor="beta-email"
               className="block text-sm font-medium text-slate-300 mb-1.5">
          Email address <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="beta-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700
                       text-white placeholder-slate-500 focus:outline-none
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                       transition-all text-sm"
          />
        </div>
      </div>

      {state === "error" && (
        <p className="text-sm text-red-400 px-1">{message}</p>
      )}

      <button
        type="submit"
        disabled={state === "loading" || !email.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                   bg-gradient-to-r from-blue-600 to-violet-600
                   hover:from-blue-500 hover:to-violet-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-white font-bold text-base transition-all
                   hover:scale-[1.01] active:scale-[0.99]
                   shadow-lg shadow-blue-900/30"
      >
        {state === "loading" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</>
        ) : (
          <><ArrowRight className="w-4 h-4" /> Get Early Access</>
        )}
      </button>

      <p className="text-center text-xs text-slate-600">
        Free forever. No credit card required.{" "}
        <a href="/legal/privacy" className="text-slate-500 hover:text-slate-400 underline">
          Privacy Policy
        </a>
      </p>
    </form>
  );
}
