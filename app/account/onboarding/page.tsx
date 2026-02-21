"use client";
// app/account/onboarding/page.tsx
// CR AudioViz AI — New User Onboarding Flow
// 2026-02-20 — STEP 6 Productization

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ArrowRight, Zap, Bot, Package, BarChart3 } from "lucide-react";

const STEPS = [
  {
    id:          "welcome",
    title:       "Welcome to CR AudioViz AI",
    description: "Your autonomous AI creative platform. Let's get you set up in 60 seconds.",
    icon:        Bot,
    action:      "Get Started",
  },
  {
    id:          "plan",
    title:       "Your Plan is Active",
    description: "You're on the Free plan with 100 credits/month. Credits never expire on paid plans.",
    icon:        Zap,
    action:      "Continue",
  },
  {
    id:          "javari",
    title:       "Meet Javari AI",
    description: "Your autonomous business partner. Ask questions, execute goals, generate modules, and more.",
    icon:        Bot,
    action:      "Try Javari",
    href:        "/javari",
  },
  {
    id:          "store",
    title:       "Install Your First Module",
    description: "Browse the Module Store to add pre-built features to your platform instantly.",
    icon:        Package,
    action:      "Browse Store",
    href:        "/store",
  },
  {
    id:          "usage",
    title:       "Track Your Usage",
    description: "Monitor credits, AI costs, and feature usage from your dashboard.",
    icon:        BarChart3,
    action:      "View Dashboard",
    href:        "/account/usage",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string[]>([]);

  const current = STEPS[step];
  const Icon    = current?.icon ?? Bot;
  const isLast  = step === STEPS.length - 1;

  function advance() {
    setDone((d) => [...d, current.id]);
    if (!isLast) {
      setStep((s) => s + 1);
    }
  }

  if (step >= STEPS.length || (isLast && done.includes(current.id))) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">You&apos;re all set!</h1>
          <p className="text-slate-400 mb-8">Welcome to CR AudioViz AI. Your platform is ready.</p>
          <Link
            href="/javari"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-8 py-4 transition-all"
          >
            Open Javari AI <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < step       ? "bg-blue-500 w-10" :
                i === step     ? "bg-blue-400 w-16" :
                                 "bg-slate-700 w-6"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-900/30 border border-blue-700/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icon className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{current.title}</h2>
          <p className="text-slate-400 mb-8">{current.description}</p>

          {/* Completed steps */}
          {done.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {done.map((d) => {
                const s = STEPS.find((x) => x.id === d);
                return s ? (
                  <span key={d} className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-700/30 px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> {s.title.split(" ")[0]}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {current.href ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={current.href}
                onClick={advance}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-6 py-3 transition-all"
              >
                {current.action} <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={advance}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <button
              onClick={advance}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl px-8 py-3 transition-all"
            >
              {current.action} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </main>
  );
}
