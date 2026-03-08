// lib/learning/experienceLedger.ts
// Purpose: Tracks Javari's exposure to specific technologies — occurrences,
//          projects seen, issues detected and resolved. Persists to
//          javari_technology_experience for cross-session accumulation.
// Date: 2026-03-07

import { createClient }   from "@supabase/supabase-js";
import type { LearningEvent } from "./learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TechnologyExperience {
  technology      : string;
  occurrences     : number;
  projects_seen   : number;
  issues_resolved : number;
  issues_detected : number;
  first_seen      : string;
  last_seen       : string;
  domains         : string[];
  mastery         : number;    // 0–100
  masteryLabel    : "unfamiliar" | "familiar" | "experienced" | "advanced" | "mastered";
  category        : TechCategory;
}

export type TechCategory =
  | "framework" | "language" | "database" | "cloud" | "payment"
  | "auth" | "ai" | "styling" | "devops" | "monitoring" | "other";

export interface ExperienceLedgerReport {
  technologies       : TechnologyExperience[];
  totalTechnologies  : number;
  masteredCount      : number;
  familiarCount      : number;
  topTechnology      : string;
  categoryBreakdown  : Record<TechCategory, number>;
}

// ── Tech category map ──────────────────────────────────────────────────────

const TECH_CATEGORIES: Record<string, TechCategory> = {
  "Next.js"          : "framework", "React"       : "framework", "Vue.js"      : "framework",
  "Angular"          : "framework", "Svelte"      : "framework", "Astro"       : "framework",
  "Remix"            : "framework", "Gatsby"      : "framework", "Nuxt"        : "framework",
  "TypeScript"       : "language",  "JavaScript"  : "language",  "Python"      : "language",
  "Rust"             : "language",  "Go"          : "language",
  "Supabase"         : "database",  "PostgreSQL"  : "database",  "MySQL"       : "database",
  "Redis"            : "database",  "MongoDB"     : "database",  "Prisma"      : "database",
  "Vercel"           : "cloud",     "Cloudflare"  : "cloud",     "AWS"         : "cloud",
  "GCP"              : "cloud",     "Azure"       : "cloud",     "Netlify"     : "cloud",
  "Stripe"           : "payment",   "PayPal"      : "payment",   "Square"      : "payment",
  "NextAuth"         : "auth",      "Auth0"       : "auth",      "Clerk"       : "auth",
  "Supabase Auth"    : "auth",
  "OpenAI"           : "ai",        "Anthropic"   : "ai",        "Gemini"      : "ai",
  "Javari AI"        : "ai",        "OpenRouter"  : "ai",
  "Tailwind CSS"     : "styling",   "shadcn/ui"   : "styling",   "Bootstrap"   : "styling",
  "Framer Motion"    : "styling",
  "Docker"           : "devops",    "Kubernetes"  : "devops",    "GitHub Actions": "devops",
  "Brand Consistency": "other",     "UX Flows"    : "other",     "General"     : "other",
};

// ── Mastery calculator ─────────────────────────────────────────────────────

function calcMastery(t: Pick<TechnologyExperience, "occurrences" | "issues_resolved" | "issues_detected">): number {
  const exposureScore  = Math.min((t.occurrences / 10) * 30, 30);
  const resolveRate    = t.issues_detected > 0 ? t.issues_resolved / t.issues_detected : t.issues_resolved > 0 ? 0.5 : 0;
  const resolutionPts  = Math.min(resolveRate * 40, 40);
  const depthScore     = Math.min((t.issues_detected / 5) * 30, 30);
  return Math.round(Math.min(100, exposureScore + resolutionPts + depthScore));
}

function masteryLabel(score: number): TechnologyExperience["masteryLabel"] {
  return score >= 80 ? "mastered"
    : score >= 60 ? "advanced"
    : score >= 40 ? "experienced"
    : score >= 20 ? "familiar"
    : "unfamiliar";
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Aggregate from learning events ────────────────────────────────────────

export function buildExperienceLedger(events: LearningEvent[]): ExperienceLedgerReport {
  const techMap = new Map<string, {
    occurrences: number; issues_resolved: number; issues_detected: number;
    first_seen: string; last_seen: string; domains: Set<string>;
    projects: Set<string>;
  }>();

  for (const e of events) {
    const tech = e.technology ?? "General";
    if (!techMap.has(tech)) {
      techMap.set(tech, {
        occurrences: 0, issues_resolved: 0, issues_detected: 0,
        first_seen: e.timestamp, last_seen: e.timestamp,
        domains: new Set(), projects: new Set(),
      });
    }
    const t = techMap.get(tech)!;
    t.occurrences++;
    if (e.event_type === "issue_repaired" || e.event_type === "capability_proven") t.issues_resolved++;
    if (e.event_type === "issue_detected" || e.event_type === "failure_observed") t.issues_detected++;
    t.domains.add(e.domain);
    if (e.details?.["taskId"]) t.projects.add(String(e.details["taskId"]).slice(0, 20));
    if (e.timestamp < t.first_seen) t.first_seen = e.timestamp;
    if (e.timestamp > t.last_seen)  t.last_seen  = e.timestamp;
  }

  const technologies: TechnologyExperience[] = Array.from(techMap.entries())
    .map(([technology, data]) => {
      const mastery = calcMastery({ occurrences: data.occurrences, issues_resolved: data.issues_resolved, issues_detected: data.issues_detected });
      return {
        technology,
        occurrences    : data.occurrences,
        projects_seen  : data.projects.size,
        issues_resolved: data.issues_resolved,
        issues_detected: data.issues_detected,
        first_seen     : data.first_seen,
        last_seen      : data.last_seen,
        domains        : [...data.domains],
        mastery,
        masteryLabel   : masteryLabel(mastery),
        category       : TECH_CATEGORIES[technology] ?? "other",
      };
    })
    .sort((a, b) => b.mastery - a.mastery);

  const masteredCount = technologies.filter(t => t.mastery >= 80).length;
  const familiarCount = technologies.filter(t => t.mastery >= 40 && t.mastery < 80).length;
  const topTechnology = technologies[0]?.technology ?? "unknown";

  const categoryBreakdown = {} as Record<TechCategory, number>;
  for (const t of technologies) {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] ?? 0) + 1;
  }

  return { technologies, totalTechnologies: technologies.length, masteredCount, familiarCount, topTechnology, categoryBreakdown };
}

// ── Persist to DB ──────────────────────────────────────────────────────────

export async function persistExperience(ledger: ExperienceLedgerReport): Promise<void> {
  if (ledger.technologies.length === 0) return;

  const rows = ledger.technologies.map(t => ({
    technology      : t.technology,
    occurrences     : t.occurrences,
    projects_seen   : t.projects_seen,
    issues_resolved : t.issues_resolved,
    issues_detected : t.issues_detected,
    first_seen      : t.first_seen,
    last_seen       : t.last_seen,
    domains         : t.domains,
  }));

  const { error } = await db()
    .from("javari_technology_experience")
    .upsert(rows, { onConflict: "technology" });

  if (error) console.warn(`[learning] persistExperience: ${error.message}`);
}
