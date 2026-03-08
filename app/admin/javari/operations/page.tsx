// app/admin/javari/operations/page.tsx
// Purpose: Javari Operations Center admin dashboard — real-time monitoring of
//          the autonomous engineering platform. Auto-refreshes every 10 seconds.
//          Industrial-terminal aesthetic: dark, data-dense, precision-grade.
// Date: 2026-03-07
"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface HealthDimension {
  name  : string;
  score : number;
  weight: number;
  status: "healthy" | "degraded" | "critical";
  detail: string;
  metric?: string;
}

interface OpsData {
  collectedAt   : string;
  durationMs    : number;
  systemHealth  : {
    overallScore    : number;
    grade           : string;
    status          : string;
    dimensions      : HealthDimension[];
    activeTargets   : number;
    issuesDiscovered: number;
    repairsCreated  : number;
    repairsCompleted: number;
    verificationFails: number;
    deploySuccessRate: number;
    lastCycleAge    : number;
    todayCycles     : number;
    alerts          : string[];
  };
  scans: {
    totalScans      : number;
    avgDurationMs   : number;
    avgIssuesPerScan: number;
    totalIssuesFound: number;
    last7DaysScans  : number;
    last7DaysIssues : number;
    trend           : string;
  };
  repairs: {
    totalRepairs      : number;
    successfulRepairs : number;
    successRate       : number;
    avgRepairMs       : number;
    commitsCreated    : number;
    prsCreated        : number;
    last24hRepairs    : number;
    last24hSuccess    : number;
    trend             : string;
  };
  customers: {
    totalAudits        : number;
    uniqueDomains      : number;
    avgSecurityScore   : number;
    avgPerformanceScore: number;
    last24hAudits      : number;
    totalTasksCreated  : number;
    recentAudits       : Array<{ domain: string; security_score: number; performance_score: number; scan_date: string }>;
  };
  taskQueue: {
    pending : number;
    running : number;
    complete: number;
    failed  : number;
    blocked : number;
    retry   : number;
    total   : number;
    recentComplete: Array<{ id: string; title: string; updated_at: number }>;
    recentFailed  : Array<{ id: string; title: string; error?: string }>;
  };
  recentCycles: Array<{
    cycle_id          : string;
    started_at        : string;
    duration_ms       : number;
    targets_processed : number;
    total_issues      : number;
    total_repair_tasks: number;
  }>;
  activeTargets: Array<{
    id: string; name: string; type: string;
    status: string; last_scan?: string; location: string;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 80) return "#00ff9d";
  if (s >= 60) return "#ffd60a";
  if (s >= 40) return "#ff6b35";
  return "#ff2d55";
}

function statusDot(s: string) {
  const c = s === "healthy" ? "#00ff9d" : s === "degraded" ? "#ffd60a" : "#ff2d55";
  return <span style={{ display:"inline-block",width:8,height:8,borderRadius:"50%",background:c,marginRight:6,boxShadow:`0 0 6px ${c}` }} />;
}

function ago(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms/1000).toFixed(1)}s`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 4, padding: "14px 18px", minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "#e8e8e8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function HealthBar({ score, label, status, detail }: { score: number; label: string; status: string; detail: string }) {
  const c = scoreColor(score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 4 }}>
        <div style={{ display:"flex", alignItems:"center" }}>
          {statusDot(status)}
          <span style={{ fontSize: 12, color: "#ccc" }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "monospace" }}>{score}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${score}%`, background: c, transition:"width 0.5s ease", borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 10, color:"#444", marginTop: 3 }}>{detail}</div>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap: 10, marginBottom: 14, borderBottom:"1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#888" }}>{title}</span>
      {badge && <span style={{ fontSize: 10, padding:"2px 7px", background:"rgba(0,255,157,0.1)", color:"#00ff9d", borderRadius: 3, border:"1px solid rgba(0,255,157,0.2)" }}>{badge}</span>}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────

export default function OperationsCenter() {
  const [data, setData]         = useState<OpsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [tick, setTick]         = useState(10);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/javari/operations/status", { cache: "no-store" });
      const json = await res.json() as OpsData & { ok?: boolean; error?: string };
      if (!json.ok && json.error) { setError(json.error); return; }
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString("en-US", { timeZone:"America/New_York", hour12:true }));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setTick(10);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const score  = data?.systemHealth.overallScore ?? 0;
  const sColor = scoreColor(score);

  return (
    <div style={{
      background: "#080b0f", minHeight:"100vh", color:"#e0e0e0",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      padding: "0 0 40px",
    }}>
      {/* Top bar */}
      <div style={{
        background: "#0a0e14", borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding: "14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: 16 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#00ff9d", boxShadow:"0 0 8px #00ff9d", animation:"pulse 2s infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing:"0.15em", color:"#e8e8e8" }}>JAVARI OPERATIONS CENTER</span>
          <span style={{ fontSize: 10, color:"#444", letterSpacing:"0.08em" }}>CR AUDIOVIZ AI · AUTONOMOUS ENGINEERING PLATFORM</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap: 20 }}>
          {data && (
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize: 10, color:"#555" }}>LAST REFRESH</div>
              <div style={{ fontSize: 12, color:"#888" }}>{lastRefresh} ET</div>
            </div>
          )}
          <div style={{
            fontSize: 11, color: tick <= 3 ? "#ffd60a" : "#444",
            border:`1px solid ${tick <= 3 ? "#ffd60a33" : "#222"}`,
            borderRadius: 3, padding:"4px 10px", minWidth: 70, textAlign:"center",
          }}>↻ {tick}s</div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#0a0e14; }
        ::-webkit-scrollbar-thumb { background:#222; border-radius:2px; }
      `}</style>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap: 16 }}>
          <div style={{ width:32, height:32, border:"2px solid #1a1a1a", borderTop:"2px solid #00ff9d",
            borderRadius:"50%", animation:"spin 1s linear infinite" }} />
          <span style={{ fontSize: 12, color:"#444", letterSpacing:"0.1em" }}>INITIALIZING OPERATIONS CENTER...</span>
          <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
        </div>
      )}

      {error && (
        <div style={{ margin:"24px", padding:"16px", background:"rgba(255,45,85,0.08)", border:"1px solid rgba(255,45,85,0.3)", borderRadius:4, color:"#ff2d55", fontSize:12 }}>
          ⚠ {error}
        </div>
      )}

      {data && !loading && (
        <div style={{ padding:"20px 24px", animation:"fadeIn 0.3s ease" }}>

          {/* Alerts */}
          {data.systemHealth.alerts.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {data.systemHealth.alerts.map((a, i) => (
                <div key={i} style={{ padding:"8px 14px", background:"rgba(255,107,53,0.08)", border:"1px solid rgba(255,107,53,0.25)", borderRadius:4, fontSize:11, color:"#ff6b35", marginBottom:6 }}>
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Hero row */}
          <div style={{ display:"flex", gap: 16, marginBottom: 20, flexWrap:"wrap" }}>

            {/* Health score */}
            <div style={{
              background:"rgba(255,255,255,0.02)", border:`1px solid ${sColor}22`,
              borderRadius:4, padding:"20px 28px", minWidth: 180, textAlign:"center",
              boxShadow:`inset 0 0 30px ${sColor}08`,
            }}>
              <div style={{ fontSize:10, color:"#555", letterSpacing:"0.12em", marginBottom: 10 }}>SYSTEM HEALTH</div>
              <div style={{ fontSize:64, fontWeight:700, color:sColor, lineHeight:1, textShadow:`0 0 20px ${sColor}44` }}>
                {score}
              </div>
              <div style={{ fontSize:14, color:"#666", marginTop:4 }}>/ 100</div>
              <div style={{ marginTop:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {statusDot(data.systemHealth.status)}
                <span style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  {data.systemHealth.status}
                </span>
              </div>
              <div style={{ marginTop:8, fontSize:22, fontWeight:700, color:sColor }}>{data.systemHealth.grade}</div>
            </div>

            {/* Key metrics */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", flex:1 }}>
              <StatCard label="Active Targets"   value={data.systemHealth.activeTargets}    sub="registered targets" color="#00b4ff" />
              <StatCard label="Issues Found"     value={data.systemHealth.issuesDiscovered}  sub="since last reset" color="#ffd60a" />
              <StatCard label="Repairs Created"  value={data.systemHealth.repairsCreated}    sub="in queue" color="#c77dff" />
              <StatCard label="Repairs Done"     value={data.systemHealth.repairsCompleted}  sub="completed" color="#00ff9d" />
              <StatCard label="Today Cycles"     value={data.systemHealth.todayCycles}       sub={`last ${data.systemHealth.lastCycleAge}m ago`} color="#00b4ff" />
              <StatCard label="Deploy Success"   value={`${data.systemHealth.deploySuccessRate}%`} sub="execution success" color={scoreColor(data.systemHealth.deploySuccessRate)} />
            </div>
          </div>

          {/* Main grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:16 }}>

            {/* Health dimensions */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Health Dimensions" badge={`${data.systemHealth.grade}`} />
              {data.systemHealth.dimensions.map(d => (
                <HealthBar key={d.name} score={d.score} label={d.name} status={d.status} detail={d.detail} />
              ))}
            </div>

            {/* Task queue */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Task Queue" badge={`${data.taskQueue.total} total`} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                {[
                  { l:"Pending",  v: data.taskQueue.pending,  c:"#ffd60a" },
                  { l:"Running",  v: data.taskQueue.running,  c:"#00b4ff" },
                  { l:"Complete", v: data.taskQueue.complete, c:"#00ff9d" },
                  { l:"Failed",   v: data.taskQueue.failed,   c:"#ff2d55" },
                  { l:"Blocked",  v: data.taskQueue.blocked,  c:"#ff6b35" },
                  { l:"Retry",    v: data.taskQueue.retry,    c:"#c77dff" },
                ].map(item => (
                  <div key={item.l} style={{ textAlign:"center", padding:"8px 4px", background:"rgba(255,255,255,0.03)", borderRadius:3, border:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:item.c }}>{item.v}</div>
                    <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{item.l}</div>
                  </div>
                ))}
              </div>
              {data.taskQueue.recentComplete.length > 0 && (
                <>
                  <div style={{ fontSize:10, color:"#555", marginBottom:6, letterSpacing:"0.08em" }}>RECENTLY COMPLETED</div>
                  {data.taskQueue.recentComplete.slice(0,3).map(t => (
                    <div key={t.id} style={{ fontSize:10, color:"#00ff9d", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      ✓ {t.title.slice(0,55)}
                    </div>
                  ))}
                </>
              )}
              {data.taskQueue.recentFailed.length > 0 && (
                <>
                  <div style={{ fontSize:10, color:"#555", marginBottom:6, marginTop:10, letterSpacing:"0.08em" }}>RECENT FAILURES</div>
                  {data.taskQueue.recentFailed.slice(0,2).map(t => (
                    <div key={t.id} style={{ fontSize:10, color:"#ff2d55", padding:"4px 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      ✗ {t.title.slice(0,55)}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Scan metrics */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Scan Metrics" badge={`${data.scans.trend}`} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <StatCard label="Total Scans"   value={data.scans.totalScans}        color="#00b4ff" />
                <StatCard label="Issues Found"  value={data.scans.totalIssuesFound}  color="#ffd60a" />
                <StatCard label="7-Day Scans"   value={data.scans.last7DaysScans}    color="#888" />
                <StatCard label="7-Day Issues"  value={data.scans.last7DaysIssues}   color="#888" />
              </div>
              <div style={{ marginTop:12, fontSize:11, color:"#555" }}>
                Avg: {fmtMs(data.scans.avgDurationMs)} per scan · {data.scans.avgIssuesPerScan} issues/scan
              </div>
            </div>

            {/* Repair metrics */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Repair Engine" badge={`${data.repairs.trend}`} />
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#888" }}>Success Rate</span>
                  <span style={{ fontSize:14, fontWeight:700, color:scoreColor(data.repairs.successRate) }}>{data.repairs.successRate}%</span>
                </div>
                <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${data.repairs.successRate}%`, background:scoreColor(data.repairs.successRate), borderRadius:2, transition:"width 0.5s ease" }} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <StatCard label="Total"    value={data.repairs.totalRepairs}     color="#888" />
                <StatCard label="Success"  value={data.repairs.successfulRepairs} color="#00ff9d" />
                <StatCard label="24h"      value={data.repairs.last24hRepairs}   color="#888" />
                <StatCard label="Commits"  value={data.repairs.commitsCreated}   color="#c77dff" />
              </div>
            </div>

            {/* Autonomous cycles */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Autonomous Cycles" badge={`${data.recentCycles.length} recent`} />
              {data.recentCycles.length === 0 && (
                <div style={{ fontSize:11, color:"#444", textAlign:"center", padding:"20px 0" }}>No cycles recorded yet</div>
              )}
              <div style={{ maxHeight:220, overflowY:"auto" }}>
                {data.recentCycles.map((c, i) => (
                  <div key={c.cycle_id} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.04)",
                    opacity: i === 0 ? 1 : 0.7,
                  }}>
                    <div>
                      <div style={{ fontSize:11, color:"#aaa" }}>{ago(c.started_at)}</div>
                      <div style={{ fontSize:10, color:"#555", marginTop:1 }}>
                        {c.targets_processed} targets · {c.total_issues} issues · {c.total_repair_tasks} tasks
                      </div>
                    </div>
                    <span style={{ fontSize:10, color:"#555" }}>{fmtMs(c.duration_ms)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active targets */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Active Targets" badge={`${data.activeTargets.length}`} />
              {data.activeTargets.length === 0 && (
                <div style={{ fontSize:11, color:"#444", textAlign:"center", padding:"20px 0" }}>No targets registered</div>
              )}
              {data.activeTargets.map(t => (
                <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {statusDot(t.status)}
                    <div>
                      <div style={{ fontSize:11, color:"#ccc" }}>{t.name}</div>
                      <div style={{ fontSize:10, color:"#555" }}>{t.type} · {t.location?.slice(0, 40)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"#444", textAlign:"right" }}>
                    {t.last_scan ? ago(t.last_scan) : "never"}
                  </div>
                </div>
              ))}
            </div>

            {/* Customer audits */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18 }}>
              <SectionHeader title="Customer Audits" badge={`${data.customers.totalAudits} total`} />
              <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                <StatCard label="Domains"  value={data.customers.uniqueDomains}      color="#00b4ff" />
                <StatCard label="Avg Sec"  value={data.customers.avgSecurityScore}   color={scoreColor(data.customers.avgSecurityScore)} />
                <StatCard label="Avg Perf" value={data.customers.avgPerformanceScore} color={scoreColor(data.customers.avgPerformanceScore)} />
              </div>
              {data.customers.recentAudits.length === 0 && (
                <div style={{ fontSize:11, color:"#444", textAlign:"center", padding:"10px 0" }}>No customer audits yet</div>
              )}
              {data.customers.recentAudits.slice(0,4).map((a, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <div style={{ fontSize:11, color:"#ccc" }}>{a.domain}</div>
                    <div style={{ fontSize:10, color:"#555" }}>{ago(a.scan_date)}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <span style={{ fontSize:11, color:scoreColor(a.security_score) }}>S:{a.security_score}</span>
                    <span style={{ fontSize:11, color:scoreColor(a.performance_score) }}>P:{a.performance_score}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
          <div style={{ marginTop:20, textAlign:"center", fontSize:10, color:"#333", letterSpacing:"0.1em" }}>
            JAVARI OPERATIONS CENTER · CR AUDIOVIZ AI, LLC · COLLECTED IN {data.durationMs}ms · ET {lastRefresh}
          </div>
        </div>
      )}
    </div>
  );
}
