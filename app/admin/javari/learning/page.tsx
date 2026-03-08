// app/admin/javari/learning/page.tsx
// Purpose: Javari Learning Intelligence System dashboard — displays knowledge
//          growth, domain proficiency, technology experience, capability map,
//          and learning timeline. Auto-refreshes every 30 seconds.
//          Aesthetic: deep neural-dark, amber neural accents, data-dense precision.
// Date: 2026-03-07
"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface DomainScore {
  domain: string; label: string; score: number; grade: string;
  proficiency: string; issuesDetected: number; issuesRepaired: number;
  systemsAnalyzed: number; eventsCount: number; repairRate: number;
  trend: string; topTechnologies: string[];
}

interface TechExp {
  technology: string; occurrences: number; mastery: number;
  masteryLabel: string; category: string; issues_resolved: number;
  issues_detected: number; domains: string[];
}

interface Capability {
  capability: string; category: string; confidence: number;
  grade: string; status: string; evidenceCount: number; description: string;
}

interface WeeklyLearning {
  week: string; weekLabel: string; eventsCount: number;
  issuesDetected: number; issuesRepaired: number;
  improvements: string[]; repairRate: number; topDomain: string;
}

interface LearningData {
  generatedAt: string; durationMs: number;
  summary: {
    totalEvents: number; totalTechnologies: number; overallMaturity: number;
    overallConfidence: number; topDomain: string; topTechnology: string;
    topCapability: string; readyForAutonomy: boolean; eventsIngested: number;
    trajectory: string;
  };
  domains: { domainScores: DomainScore[]; overallMaturity: number; topDomain: string; weakestDomain: string };
  technologies: { technologies: TechExp[]; totalTechnologies: number; masteredCount: number; topTechnology: string };
  capabilities: { capabilities: Capability[]; overallConfidence: number; readyForAutonomy: boolean; autonomyBlockers: string[]; topCapability: string };
  timeline: { weeks: WeeklyLearning[]; overallTrajectory: string; activeWeeks: number; bestWeek: string };
}

// ── Color helpers ──────────────────────────────────────────────────────────

const A = "#ffb800";   // amber — primary accent
const B = "#00cfff";   // ice blue — secondary
const G = "#39ff14";   // neon green — success
const R = "#ff3a3a";   // red — critical

function scoreColor(s: number) {
  return s >= 80 ? G : s >= 60 ? A : s >= 40 ? "#ff8c00" : R;
}

function proficiencyColor(p: string) {
  return p === "expert" ? G : p === "proficient" ? A : p === "competent" ? B : p === "developing" ? "#ff8c00" : "#555";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function GlowValue({ value, color = A }: { value: string | number; color?: string }) {
  return (
    <span style={{ color, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace", textShadow: `0 0 12px ${color}66` }}>
      {value}
    </span>
  );
}

function NeuralBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", margin: "4px 0" }}>
      <div style={{
        height: "100%", width: `${score}%`, background: color,
        borderRadius: 2, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: `0 0 6px ${color}88`,
      }} />
    </div>
  );
}

function Card({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <div style={{
      background: "rgba(10,14,22,0.9)", border: `1px solid ${glow ? glow + "22" : "rgba(255,184,0,0.08)"}`,
      borderRadius: 6, padding: 18,
      boxShadow: glow ? `inset 0 0 40px ${glow}06, 0 0 0 1px ${glow}11` : "none",
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ text, badge }: { text: string; badge?: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: `1px solid rgba(255,184,0,0.08)`, paddingBottom: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#666", textTransform: "uppercase" }}>{text}</span>
      {badge !== undefined && (
        <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(255,184,0,0.08)", color: A, borderRadius: 3, border: `1px solid rgba(255,184,0,0.18)` }}>{badge}</span>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function LearningDashboard() {
  const [data, setData]       = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [tick, setTick]       = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch("/api/javari/learning/status?ingest=true", { cache: "no-store" });
      const json = await res.json() as LearningData & { ok?: boolean; error?: string };
      if (!json.ok && json.error) { setError(json.error); return; }
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York" }));
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); setTick(30); }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30_000); return () => clearInterval(t); }, [fetchData]);
  useEffect(() => { const t = setInterval(() => setTick(n => Math.max(0, n - 1)), 1000); return () => clearInterval(t); }, []);

  return (
    <div style={{ background: "#060810", minHeight: "100vh", color: "#d4d4d4", fontFamily: "'Share Tech Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;400;600;700&display=swap');
        @keyframes flicker { 0%,100%{opacity:1} 95%{opacity:0.97} 97%{opacity:0.93} }
        @keyframes scanline { from{transform:translateY(-100%)} to{transform:translateY(100vh)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #2a2a1a; }
      `}</style>

      {/* Scanline overlay */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 999,
        background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)" }} />

      {/* Header */}
      <div style={{
        borderBottom: `1px solid rgba(255,184,0,0.12)`, padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(6,8,16,0.97)", position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: A, boxShadow: `0 0 12px ${A}`, animation: "pulse 2s infinite" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "#e8e0c8" }}>JAVARI LEARNING INTELLIGENCE</div>
            <div style={{ fontSize: 9, color: "#3a3a2a", letterSpacing: "0.1em", marginTop: 1 }}>KNOWLEDGE GROWTH SYSTEM · CR AUDIOVIZ AI</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {data && <div style={{ textAlign: "right", fontSize: 10, color: "#555" }}>
            <div>GENERATED {lastRefresh} ET</div>
            <div style={{ color: "#333" }}>{data.durationMs}ms · {data.summary.eventsIngested} events ingested</div>
          </div>}
          <div style={{ fontSize: 10, padding: "4px 10px", border: `1px solid ${tick <= 5 ? A + "44" : "#1a1a0a"}`, borderRadius: 3, color: tick <= 5 ? A : "#333" }}>↻ {tick}s</div>
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: 16 }}>
          <div style={{ fontSize: 28, color: A, animation: "flicker 0.5s infinite" }}>◈</div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: "0.15em" }}>INITIALIZING NEURAL LEARNING MATRIX...</div>
        </div>
      )}

      {error && (
        <div style={{ margin: 24, padding: 16, background: "rgba(255,58,58,0.06)", border: "1px solid rgba(255,58,58,0.2)", borderRadius: 4, color: R, fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}

      {data && !loading && (() => {
        const s = data.summary;
        const domains = data.domains.domainScores;
        const techs = data.technologies.technologies.slice(0, 16);
        const caps = data.capabilities.capabilities;
        const weeks = data.timeline.weeks.slice(-8);

        return (
          <div style={{ padding: "20px 28px", animation: "fadeUp 0.4s ease" }}>

            {/* Hero metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginBottom: 20 }}>

              {/* Maturity orb */}
              <Card glow={A}>
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 8 }}>KNOWLEDGE MATURITY</div>
                  <div style={{ fontSize: 60, fontWeight: 700, color: A, lineHeight: 1, textShadow: `0 0 30px ${A}55`, fontFamily: "monospace" }}>
                    {s.overallMaturity}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>/ 100</div>
                  <div style={{ marginTop: 10, padding: "4px 12px", display: "inline-block",
                    background: s.readyForAutonomy ? "rgba(57,255,20,0.08)" : "rgba(255,140,0,0.08)",
                    border: `1px solid ${s.readyForAutonomy ? G + "33" : "#ff8c0033"}`,
                    borderRadius: 3, fontSize: 9, color: s.readyForAutonomy ? G : "#ff8c00",
                    letterSpacing: "0.1em" }}>
                    {s.readyForAutonomy ? "AUTONOMY READY" : "DEVELOPING"}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: A }}>
                    {s.trajectory.toUpperCase()} ↗
                  </div>
                </div>
              </Card>

              {/* Key stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                {[
                  { label: "TOTAL EVENTS",     value: s.totalEvents,         color: B },
                  { label: "TECHNOLOGIES",      value: s.totalTechnologies,   color: A },
                  { label: "MASTERED",          value: data.technologies.masteredCount, color: G },
                  { label: "CAPABILITY CONF",   value: `${s.overallConfidence}%`, color: A },
                  { label: "TOP DOMAIN",        value: s.topDomain.replace("_"," "), color: B },
                  { label: "TOP TECH",          value: s.topTechnology,       color: G },
                  { label: "TOP CAPABILITY",    value: s.topCapability.split(" ").slice(0,2).join(" "), color: A },
                  { label: "ACTIVE WEEKS",      value: data.timeline.activeWeeks, color: "#888" },
                ].map(item => (
                  <Card key={item.label}>
                    <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color, lineHeight: 1.2, fontFamily: "monospace", textShadow: `0 0 8px ${item.color}44` }}>
                      {item.value}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Autonomy blockers */}
            {!s.readyForAutonomy && data.capabilities.autonomyBlockers.length > 0 && (
              <div style={{ marginBottom: 16, padding: "10px 16px", background: "rgba(255,140,0,0.06)", border: "1px solid rgba(255,140,0,0.2)", borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: "#ff8c00", letterSpacing: "0.1em", marginBottom: 6 }}>AUTONOMY BLOCKERS</div>
                {data.capabilities.autonomyBlockers.map((b, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#886633", marginTop: 3 }}>⚑ {b}</div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>

              {/* Knowledge domains */}
              <Card glow={A}>
                <SectionLabel text="Knowledge Domains" badge={domains.length} />
                {domains.map(d => (
                  <div key={d.domain} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div>
                        <span style={{ fontSize: 11, color: "#ccc" }}>{d.label}</span>
                        <span style={{ fontSize: 9, color: proficiencyColor(d.proficiency), marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{d.proficiency}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, color: d.trend === "improving" ? G : d.trend === "declining" ? R : "#555" }}>
                          {d.trend === "improving" ? "↑" : d.trend === "declining" ? "↓" : "→"}
                        </span>
                        <GlowValue value={d.score} color={scoreColor(d.score)} />
                      </div>
                    </div>
                    <NeuralBar score={d.score} color={scoreColor(d.score)} />
                    <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 9, color: "#444" }}>
                      <span>↓{d.issuesDetected} detected</span>
                      <span style={{ color: d.issuesRepaired > 0 ? G + "99" : undefined }}>✓{d.issuesRepaired} repaired</span>
                      <span>{d.systemsAnalyzed} analyzed</span>
                      {d.topTechnologies.length > 0 && <span style={{ color: "#2a2a1a" }}>{d.topTechnologies.slice(0,2).join("·")}</span>}
                    </div>
                  </div>
                ))}
              </Card>

              {/* Capability map */}
              <Card glow={B}>
                <SectionLabel text="Capability Map" badge={`${caps.filter(c=>c.status==="active").length} active`} />
                {caps.map(c => {
                  const col = c.status === "active" ? scoreColor(c.confidence) : c.status === "developing" ? "#ff8c00" : "#333";
                  return (
                    <div key={c.id ?? c.capability} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <div>
                          <span style={{ fontSize: 11, color: c.status === "untested" ? "#333" : "#bbb" }}>{c.capability}</span>
                          {c.status === "untested" && <span style={{ fontSize: 9, color: "#333", marginLeft: 6 }}>[untested]</span>}
                        </div>
                        <GlowValue value={c.confidence} color={col} />
                      </div>
                      <NeuralBar score={c.confidence} color={col} />
                      <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>{c.evidenceCount} evidence events</div>
                    </div>
                  );
                })}
              </Card>

              {/* Technology experience */}
              <Card>
                <SectionLabel text="Technology Experience" badge={data.technologies.totalTechnologies} />
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {techs.map(t => (
                    <div key={t.technology} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.technology}</div>
                        <div style={{ fontSize: 9, color: "#444" }}>{t.category} · {t.occurrences} seen</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 80 }}>
                        <div style={{ fontSize: 9, color: proficiencyColor(t.masteryLabel), marginBottom: 2 }}>{t.masteryLabel}</div>
                        <NeuralBar score={t.mastery} color={scoreColor(t.mastery)} />
                        <div style={{ fontSize: 9, color: "#333" }}>{t.mastery}/100</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Learning timeline */}
              <Card>
                <SectionLabel text="Learning Timeline" badge={`${data.timeline.overallTrajectory}`} />
                {weeks.length === 0 && <div style={{ fontSize: 11, color: "#333", textAlign: "center", padding: "20px 0" }}>No timeline data yet</div>}
                {weeks.map((w, i) => {
                  const isLatest = i === weeks.length - 1;
                  const density  = Math.min(w.eventsCount / 20, 1);
                  return (
                    <div key={w.week} style={{
                      padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                      opacity: isLatest ? 1 : 0.5 + i / weeks.length * 0.5,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: isLatest ? A : "#555" }}>{w.weekLabel}</span>
                        <div style={{ display: "flex", gap: 12, fontSize: 9 }}>
                          <span style={{ color: "#444" }}>↓{w.issuesDetected}</span>
                          <span style={{ color: w.issuesRepaired > 0 ? G + "cc" : "#333" }}>✓{w.issuesRepaired}</span>
                          <span style={{ color: "#555" }}>{w.eventsCount} events</span>
                        </div>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${density * 100}%`, background: isLatest ? A : "#2a2a1a", borderRadius: 2, transition: "width 0.6s ease" }} />
                      </div>
                      {isLatest && w.improvements.slice(0, 2).map((imp, j) => (
                        <div key={j} style={{ fontSize: 9, color: "#3a3a2a", marginTop: 3 }}>+ {imp}</div>
                      ))}
                    </div>
                  );
                })}
              </Card>

            </div>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 9, color: "#1a1a12", letterSpacing: "0.1em" }}>
              JAVARI LEARNING INTELLIGENCE · CR AUDIOVIZ AI, LLC · {data.generatedAt} · {data.durationMs}ms
            </div>
          </div>
        );
      })()}
    </div>
  );
}
