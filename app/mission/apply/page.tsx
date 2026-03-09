"use client";
// app/mission/apply/page.tsx
// Javari AI — Social Impact Application Form
// Purpose: Organizations apply for free/discounted access to Javari AI.
// Date: 2026-03-09

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ArrowLeft, Shield, Heart, Cross, PawPrint } from "lucide-react";

const MODULE_TYPES = [
  { value: "veteran",         label: "Veterans / Military Families",  icon: Shield   },
  { value: "first_responder", label: "First Responders",              icon: Heart    },
  { value: "faith",           label: "Faith Community",               icon: Cross    },
  { value: "animal_rescue",   label: "Animal Rescue / Shelter",       icon: PawPrint },
];

export default function MissionApplyPage() {
  const params   = useSearchParams();
  const initType = params.get("type") ?? "";

  const [form, setForm] = useState({
    module_type:   initType,
    org_name:      "",
    org_type:      "",
    contact_name:  "",
    contact_email: "",
    description:   "",
  });
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  function update(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/mission/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Application Submitted</h2>
          <p className="text-slate-400 mb-6">
            Thank you. We review every application within 48 hours.
            You&apos;ll receive an email at <strong className="text-white">{form.contact_email}</strong> with your decision and access instructions.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition text-center"
            >
              Create Your Free Account While You Wait
            </Link>
            <Link href="/mission" className="text-slate-400 hover:text-white text-sm transition">
              ← Back to Mission Page
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-16 px-4">
      <div className="max-w-xl mx-auto">
        <Link href="/mission" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Mission
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Apply for Impact Access</h1>
        <p className="text-slate-400 mb-8">
          Free or deeply discounted access for qualifying organizations. Review within 48 hours.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Module type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Organization Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("module_type", value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition text-left ${
                      form.module_type === value
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Org name */}
            <div className="space-y-1.5">
              <label htmlFor="org_name" className="block text-sm font-medium text-slate-300">Organization Name *</label>
              <input
                id="org_name" required
                value={form.org_name}
                onChange={e => update("org_name", e.target.value)}
                placeholder="Fort Myers Veterans Alliance"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Contact name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="contact_name" className="block text-sm font-medium text-slate-300">Your Name *</label>
                <input
                  id="contact_name" required
                  value={form.contact_name}
                  onChange={e => update("contact_name", e.target.value)}
                  placeholder="Roy Henderson"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact_email" className="block text-sm font-medium text-slate-300">Email *</label>
                <input
                  id="contact_email" type="email" required
                  value={form.contact_email}
                  onChange={e => update("contact_email", e.target.value)}
                  placeholder="you@org.org"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-slate-300">
                How will you use Javari AI? (optional)
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={e => update("description", e.target.value)}
                rows={3}
                placeholder="Tell us about your organization and how you plan to use the platform..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !form.module_type || !form.org_name || !form.contact_name || !form.contact_email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Submit Application"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
