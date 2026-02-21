// components/Footer.tsx
// CR AudioViz AI — Global Footer
// 2026-02-21 — STEP 8 Go-Live

import Link from "next/link";
import { Zap } from "lucide-react";
import { BRAND_IDENTITY } from "@/lib/brand/tokens";

const FOOTER_LINKS = {
  Product: [
    { label: "Features",   href: "/features"  },
    { label: "Pricing",    href: "/pricing"   },
    { label: "Tiers",      href: "/tiers"     },
    { label: "Module Store", href: "/store"   },
    { label: "Beta Access", href: "/beta"     },
  ],
  Platform: [
    { label: "Javari AI",    href: "/javari"    },
    { label: "Dashboard",    href: "/dashboard" },
    { label: "Account",      href: "/account/billing" },
    { label: "Usage",        href: "/account/usage"   },
    { label: "API",          href: "/developer" },
  ],
  Company: [
    { label: "Press Kit",  href: "/press"  },
    { label: "Support",    href: "/support" },
    { label: "Enterprise", href: "/enterprise" },
    { label: "Partners",   href: "/partners"   },
  ],
  Legal: [
    { label: "Privacy Policy",   href: "/legal/privacy" },
    { label: "Terms of Service", href: "/legal/terms"   },
    { label: "Cookie Policy",    href: "/legal/cookies" },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800/60 bg-slate-950">

      {/* ── Main footer grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center
                              group-hover:bg-blue-500 transition-colors">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">CR AudioViz AI</p>
                <p className="text-xs text-slate-500 leading-none mt-0.5">by Javari AI</p>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-4 max-w-[200px]">
              {BRAND_IDENTITY.tagline}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                               bg-green-900/30 border border-green-700/40 text-green-400
                               text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Public Beta
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5
                        flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            © {year} CR AudioViz AI, LLC · Fort Myers, FL · EIN 39-3646201
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-600">
            <Link href="/legal/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/legal/terms"   className="hover:text-slate-400 transition-colors">Terms</Link>
            <Link href="/legal/cookies" className="hover:text-slate-400 transition-colors">Cookies</Link>
            <a href={`mailto:${BRAND_IDENTITY.support}`}
               className="hover:text-slate-400 transition-colors">
              {BRAND_IDENTITY.support}
            </a>
          </div>
        </div>
      </div>

    </footer>
  );
}
