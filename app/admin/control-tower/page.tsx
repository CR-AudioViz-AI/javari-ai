// app/admin/control-tower/page.tsx
// Control Tower — Live system visibility dashboard
// 2026-03-01

"use client";

import { useState, useEffect, useCallback } from "react";

interface ProviderStatus {
  provider: string;
  status: "healthy" | "degraded" | "cooldown" | "quarantined" | "unknown";
  success_rate: number;
  total_successes: number;
  total_failures: number;
  consecutive_failures: number;
  avg_latency_ms: number;
  in_cooldown: boolean;
  cooldown_remaining_s: number;
  quarantined: boolean;
  quarantine_remaining_s: number;
  failure_burst_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
}

interface RoutingScore {
  provider: string;
  score: number;
  breakdown: {
    latency_component: number;
    failure_component: number;
    cost_component: number;
    primary_bonus: boolean;
    in_cooldown: boolean;
  };
  health?: {
    avg_latency_ms: number;
    success_rate: number;
    consecutive_failures: number;
  };
}

interface BudgetRow {
  scope: string;
  period: string;
  total_spend: number;
  request_count: number;
  spend_last_60s: number;
  spend_last_10m: number;
  requests_last_60s: number;
  anomaly_score: number;
  escalation_level: number;
  updated_at: string;
}

interface Execution {
  provider: string;
  model: string;
  tier: string;
  cost: number;
  latency_ms: number;
  success: boolean;
  error_type: string | null;
  created_at: string;
}

interface SystemStatus {
  timestamp: string;
  query_ms: number;
  system: {
    emergency_stop: boolean;
    system_paused: boolean;
    admin_mode: boolean;
    max_escalation_level: number;
    escalation_label: string;
  };
  providers: ProviderStatus[];
  routing_scores: RoutingScore[];
  budget: BudgetRow[];
  recent_executions: Execution[];
  summary: {
    total_providers: number;
    healthy_providers: number;
    degraded_providers: number;
    cooldown_providers: number;
    total_spend: number;
    spend_last_60s: number;
    spend_last_10m: number;
    requests_last_60s: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "#22c55e",
  degraded: "#f59e0b",
  cooldown: "#ef4444",
  quarantined: "#dc2626",
  unknown: "#6b7280",
};

const ESCALATION_COLORS: Record<string, string> = {
  normal: "#22c55e",
  elevated: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ControlTower() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/system-status", { cache: "no-store" });
      if (r.status === 403) {
        setError("Admin mode disabled (set ADMIN_MODE=1)");
        setLoading(false);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    if (!autoRefresh) return;
    const iv = setInterval(fetchStatus, 10_000);
    return () => clearInterval(iv);
  }, [fetchStatus, autoRefresh]);

  const s: React.CSSProperties = {
    fontFamily: "monospace",
    background: "#0a0a0a",
    color: "#e5e5e5",
    minHeight: "100vh",
    padding: "20px",
    fontSize: "13px",
  };

  if (loading) return <div style={s}>Loading Control Tower...</div>;
  if (error) return <div style={{ ...s, color: "#ef4444" }}>⚠ {error}</div>;
  if (!data) return <div style={s}>No data</div>;

  const { system, providers, routing_scores, budget, recent_executions, summary } = data;

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #333", paddingBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: "bold", margin: 0 }}>⚡ CONTROL TOWER</h1>
          <span style={{ color: "#888", fontSize: 11 }}>
            Updated: {new Date(data.timestamp).toLocaleTimeString()} ({data.query_ms}ms)
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ cursor: "pointer", fontSize: 12 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
              style={{ marginRight: 4 }}
            />
            Auto-refresh (10s)
          </label>
          <button onClick={fetchStatus} style={{ background: "#222", border: "1px solid #444", color: "#ccc", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* System Alerts */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <SystemBadge label="Emergency Stop" active={system.emergency_stop} color="#ef4444" />
        <SystemBadge label="System Paused" active={system.system_paused} color="#f59e0b" />
        <div style={{
          padding: "6px 14px", borderRadius: 4, fontSize: 12, fontWeight: "bold",
          background: ESCALATION_COLORS[system.escalation_label] + "22",
          border: `1px solid ${ESCALATION_COLORS[system.escalation_label]}`,
          color: ESCALATION_COLORS[system.escalation_label],
        }}>
          Escalation: {system.escalation_label.toUpperCase()} (L{system.max_escalation_level})
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
        <MetricCard label="Providers" value={`${summary.healthy_providers}/${summary.total_providers} healthy`} />
        <MetricCard label="Degraded" value={String(summary.degraded_providers)} alert={summary.degraded_providers > 0} />
        <MetricCard label="In Cooldown" value={String(summary.cooldown_providers)} alert={summary.cooldown_providers > 0} />
        <MetricCard label="Quarantined" value={String(summary.quarantined_providers ?? 0)} alert={(summary.quarantined_providers ?? 0) > 0} />
        <MetricCard label="Spend (60s)" value={`$${summary.spend_last_60s.toFixed(4)}`} />
        <MetricCard label="Spend (10m)" value={`$${summary.spend_last_10m.toFixed(4)}`} />
        <MetricCard label="Req/60s" value={String(summary.requests_last_60s)} />
        <MetricCard label="Total Spend" value={`$${summary.total_spend.toFixed(4)}`} />
      </div>

      {/* Provider Health Table */}
      <Section title="Provider Health">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
              {["Provider", "Status", "Rate", "Success", "Fail", "Consec", "Latency", "Cooldown", "Last OK", "Last Fail"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.provider} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "6px 8px", fontWeight: "bold" }}>{p.provider}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ color: STATUS_COLORS[p.status], fontWeight: "bold" }}>
                    {p.status === "quarantined" ? "🚫" : p.status === "cooldown" ? "🔴" : p.status === "degraded" ? "⚠️" : p.status === "healthy" ? "✅" : "⚪"} {p.status}
                  </span>
                </td>
                <td style={{ padding: "6px 8px", color: p.success_rate < 70 ? "#ef4444" : p.success_rate < 90 ? "#f59e0b" : "#22c55e" }}>
                  {p.success_rate}%
                </td>
                <td style={{ padding: "6px 8px", color: "#22c55e" }}>{p.total_successes}</td>
                <td style={{ padding: "6px 8px", color: p.total_failures > 0 ? "#ef4444" : "#888" }}>{p.total_failures}</td>
                <td style={{ padding: "6px 8px", color: p.consecutive_failures >= 3 ? "#ef4444" : "#888" }}>{p.consecutive_failures}</td>
                <td style={{ padding: "6px 8px" }}>{p.avg_latency_ms}ms</td>
                <td style={{ padding: "6px 8px", color: p.quarantined ? "#dc2626" : p.in_cooldown ? "#ef4444" : "#888" }}>
                  {p.quarantined ? `🚫 Q:${p.quarantine_remaining_s}s (burst:${p.failure_burst_count})` : p.in_cooldown ? `${p.cooldown_remaining_s}s` : "—"}
                </td>
                <td style={{ padding: "6px 8px", color: "#888", fontSize: 11 }}>{ago(p.last_success_at)}</td>
                <td style={{ padding: "6px 8px", color: "#888", fontSize: 11 }}>{ago(p.last_failure_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Adaptive Routing Scores */}
      <Section title="Adaptive Routing Scores (Default Chain)">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
              {["#", "Provider", "Score", "Latency", "Failure", "Cost", "Primary", "Cooldown", "Health"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routing_scores.map((r, i) => (
              <tr key={r.provider} style={{ borderBottom: "1px solid #1a1a1a", background: i === 0 ? "#0d2818" : undefined }}>
                <td style={{ padding: "6px 8px", color: "#888" }}>{i + 1}</td>
                <td style={{ padding: "6px 8px", fontWeight: i === 0 ? "bold" : "normal" }}>{r.provider}</td>
                <td style={{ padding: "6px 8px", color: r.score < 0.1 ? "#22c55e" : r.score < 0.5 ? "#f59e0b" : "#ef4444" }}>
                  {r.score >= 10 ? "BLOCKED" : r.score.toFixed(3)}
                </td>
                <td style={{ padding: "6px 8px" }}>{r.breakdown.latency_component.toFixed(3)}</td>
                <td style={{ padding: "6px 8px", color: r.breakdown.failure_component > 0.1 ? "#ef4444" : "#888" }}>
                  {r.breakdown.failure_component.toFixed(3)}
                </td>
                <td style={{ padding: "6px 8px" }}>{r.breakdown.cost_component.toFixed(3)}</td>
                <td style={{ padding: "6px 8px" }}>{r.breakdown.primary_bonus ? "★" : ""}</td>
                <td style={{ padding: "6px 8px", color: r.breakdown.in_quarantine ? "#dc2626" : r.breakdown.in_cooldown ? "#ef4444" : "#888" }}>
                  {r.breakdown.in_quarantine ? "🚫 QUARANTINED" : r.breakdown.in_cooldown ? "🔴 COOLDOWN" : "—"}
                </td>
                <td style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>
                  {r.health ? `${r.health.avg_latency_ms}ms / ${r.health.success_rate}%` : "no data"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Budget / Velocity */}
      <Section title="Budget & Velocity">
        {budget.length === 0 ? (
          <div style={{ color: "#888", padding: 8 }}>No budget data</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
                {["Scope", "Period", "Total Spend", "Requests", "$/60s", "$/10m", "Req/60s", "Anomaly", "Escalation"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budget.map((b, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "6px 8px" }}>{b.scope}</td>
                  <td style={{ padding: "6px 8px" }}>{b.period}</td>
                  <td style={{ padding: "6px 8px" }}>${b.total_spend?.toFixed(4) ?? "0"}</td>
                  <td style={{ padding: "6px 8px" }}>{b.request_count ?? 0}</td>
                  <td style={{ padding: "6px 8px" }}>${b.spend_last_60s?.toFixed(4) ?? "0"}</td>
                  <td style={{ padding: "6px 8px" }}>${b.spend_last_10m?.toFixed(4) ?? "0"}</td>
                  <td style={{ padding: "6px 8px" }}>{b.requests_last_60s ?? 0}</td>
                  <td style={{ padding: "6px 8px", color: (b.anomaly_score ?? 0) > 5 ? "#ef4444" : (b.anomaly_score ?? 0) > 2 ? "#f59e0b" : "#22c55e" }}>
                    {b.anomaly_score?.toFixed(1) ?? "0"}
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", color: (b.escalation_level ?? 0) > 0 ? "#ef4444" : "#22c55e" }}>
                    L{b.escalation_level ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Recent Executions */}
      <Section title="Recent Executions (Last 10)">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
              {["Time", "Provider", "Model", "Tier", "Cost", "Latency", "Status", "Error"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent_executions.map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>{ago(e.created_at)}</td>
                <td style={{ padding: "6px 8px" }}>{e.provider}</td>
                <td style={{ padding: "6px 8px", fontSize: 11 }}>{e.model ? (e.model.length > 20 ? e.model.slice(0, 20) + "…" : e.model) : "—"}</td>
                <td style={{ padding: "6px 8px" }}>{e.tier ?? "—"}</td>
                <td style={{ padding: "6px 8px" }}>${(e.cost ?? 0).toFixed(4)}</td>
                <td style={{ padding: "6px 8px" }}>{e.latency_ms ?? 0}ms</td>
                <td style={{ padding: "6px 8px", color: e.success ? "#22c55e" : "#ef4444" }}>
                  {e.success ? "✅" : "❌"}
                </td>
                <td style={{ padding: "6px 8px", color: "#ef4444", fontSize: 11 }}>{e.error_type ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function SystemBadge({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <div style={{
      padding: "6px 14px", borderRadius: 4, fontSize: 12, fontWeight: "bold",
      background: active ? color + "22" : "#11111188",
      border: `1px solid ${active ? color : "#333"}`,
      color: active ? color : "#666",
    }}>
      {active ? "🔴" : "⚪"} {label}: {active ? "ACTIVE" : "OFF"}
    </div>
  );
}

function MetricCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{
      background: "#111", border: `1px solid ${alert ? "#f59e0b" : "#222"}`,
      borderRadius: 6, padding: "10px 14px",
    }}>
      <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: "bold", color: alert ? "#f59e0b" : "#e5e5e5" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: "bold", color: "#aaa", marginBottom: 8, borderBottom: "1px solid #222", paddingBottom: 6 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
