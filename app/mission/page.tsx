// app/mission/page.tsx
// Javari AI — Social Impact / Mission Landing Page
// Purpose: Grant-eligible social impact modules. Veteran, first responder,
//          faith community, and animal rescue free/discounted access.
// Date: 2026-03-09

import { Metadata } from "next";
import Link from "next/link";
import {
  Shield, Heart, Cross, PawPrint, Star, ArrowRight,
  CheckCircle2, Users, Globe, Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Mission & Social Impact — Javari AI",
  description:
    "CR AudioViz AI serves veterans, first responders, faith communities, and animal rescues — free and discounted access to Javari AI.",
  openGraph: {
    title: "Javari AI — Technology in Service of People",
    description:
      "Javari AI makes professional-grade creative tools accessible to the communities that need them most.",
  },
};

const IMPACT_MODULES = [
  {
    id:       "veteran",
    icon:     Shield,
    color:    "blue",
    gradient: "from-blue-600 to-blue-800",
    bg:       "bg-blue-500/10 border-blue-500/20",
    title:    "Veterans & Military Families",
    tagline:  "Honoring service. Rebuilding careers.",
    description:
      "From VA claim documentation to resume writing, Javari AI helps veterans transition back to civilian life with tools built for their unique journey.",
    benefits: [
      "Resume Builder pre-loaded with military skill translation",
      "Business plan creator for veteran entrepreneurs",
      "Grant application assistance for veteran-owned businesses",
      "Community hub connecting veteran-owned companies",
      "Free tier upgraded to Creator level — no cost",
    ],
    cta:   "Apply for Veteran Access",
    href:  "/mission/apply?type=veteran",
    stats: "3.5M veterans transition annually",
  },
  {
    id:       "first_responder",
    icon:     Heart,
    color:    "red",
    gradient: "from-red-600 to-red-800",
    bg:       "bg-red-500/10 border-red-500/20",
    title:    "First Responders",
    tagline:  "They run toward danger. We build tools for them.",
    description:
      "Police, firefighters, EMTs, and dispatch teams get free access to documentation tools, training resources, and wellness content generation.",
    benefits: [
      "Incident report and documentation tools",
      "Training material generators",
      "Wellness content and mental health resources",
      "Team communication tools",
      "Free Creator access for verified departments",
    ],
    cta:   "Apply for First Responder Access",
    href:  "/mission/apply?type=first_responder",
    stats: "3M+ first responders across the US",
  },
  {
    id:       "faith",
    icon:     Cross,
    color:    "purple",
    gradient: "from-purple-600 to-purple-800",
    bg:       "bg-purple-500/10 border-purple-500/20",
    title:    "Faith Communities",
    tagline:  "Amplifying message. Stretching every dollar.",
    description:
      "Churches, synagogues, mosques, and faith organizations use Javari AI to create sermons, newsletters, social content, and outreach materials on tight budgets.",
    benefits: [
      "Sermon and message writing assistance",
      "Event flyers, bulletins, and social content",
      "Volunteer coordination tools",
      "Donation campaign copywriting",
      "75% discount on all paid plans",
    ],
    cta:   "Apply for Faith Community Access",
    href:  "/mission/apply?type=faith",
    stats: "380,000+ congregations in the US",
  },
  {
    id:       "animal_rescue",
    icon:     PawPrint,
    color:    "amber",
    gradient: "from-amber-600 to-amber-800",
    bg:       "bg-amber-500/10 border-amber-500/20",
    title:    "Animal Rescues & Shelters",
    tagline:  "Every animal deserves a story that gets them adopted.",
    description:
      "Animal rescues use Javari AI to write adoption profiles, create social posts, manage volunteer communications, and run fundraising campaigns that actually work.",
    benefits: [
      "AI-generated adoption bio writer",
      "Social media content for fundraisers",
      "Volunteer onboarding materials",
      "Event promotion tools",
      "Free access for registered 501(c)(3) rescues",
    ],
    cta:   "Apply for Rescue Access",
    href:  "/mission/apply?type=animal_rescue",
    stats: "10,000+ shelters, 6.5M animals/year",
  },
];

const IMPACT_STATS = [
  { value: "$600M+", label: "Federal grant opportunities targeted" },
  { value: "Free",   label: "Access for all qualifying organizations" },
  { value: "4",      label: "Social impact modules launching" },
  { value: "100%",   label: "Credits that never expire on paid plans" },
];

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-24 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-purple-950/30 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Your Story. Our Design. Everyone Wins.
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Technology in Service of{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              People
            </span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            CR AudioViz AI exists to help every person and organization tell their story.
            That mission starts with the communities who need us most — and can afford the least.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#modules"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition"
            >
              See All Programs <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/mission/apply"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-3 rounded-xl transition"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {IMPACT_STATS.map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-white mb-1">{value}</div>
              <div className="text-sm text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Impact Modules ───────────────────────────────────────────────── */}
      <section id="modules" className="px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Four Communities. One Platform.
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Each module is purpose-built for its community with tools, templates,
              and workflows designed around their specific needs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {IMPACT_MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  className={`bg-slate-900 border ${module.bg} rounded-2xl p-8 flex flex-col`}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} mb-5`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <div className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {module.stats}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{module.title}</h3>
                  <p className="text-sm font-medium text-slate-400 mb-4 italic">{module.tagline}</p>
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">{module.description}</p>

                  <ul className="space-y-2 mb-8 flex-1">
                    {module.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={module.href}
                    className={`w-full text-center font-semibold py-3 px-6 rounded-xl bg-gradient-to-r ${module.gradient} hover:opacity-90 transition text-white text-sm`}
                  >
                    {module.cta} <ArrowRight className="inline w-4 h-4 ml-1" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Grant Funding ────────────────────────────────────────────────── */}
      <section className="px-4 py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <Globe className="w-8 h-8 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Backed by Federal Grant Funding</h2>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            CR AudioViz AI is actively pursuing $600M+ in federal and private foundation grants
            to fund free access for qualifying organizations. Our social impact modules are designed
            to meet grant compliance requirements.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            {[
              { label: "SBIR/STTR", desc: "Small business innovation grants" },
              { label: "SAMHSA",    desc: "First responder mental health" },
              { label: "VA Grants", desc: "Veteran service organizations" },
              { label: "FEMA",      desc: "Emergency responder training" },
              { label: "HHS",       desc: "Community health & outreach" },
              { label: "Private",   desc: "Foundation & corporate partners" },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="font-semibold text-white text-sm">{label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <Star className="w-8 h-8 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Leave Nobody Behind</h2>
          <p className="text-slate-400 mb-8">
            If your organization serves others, we want to serve you. Apply today — 
            approval within 48 hours, access granted immediately.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/mission/apply"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition"
            >
              <Users className="w-4 h-4" />
              Apply for Your Organization
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-8 py-3 rounded-xl transition"
            >
              Start Free — No Application Needed
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
