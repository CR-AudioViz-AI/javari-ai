"use client";

// app/javari/roadmap/page.tsx
// Javari OS — Roadmap Dashboard (Mission Control)
// Full autonomous execution center with phase tracking, task management,
// milestone progress, critical path visualization, and live state sync
// 2026-02-19 — TASK-P0-006

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped" | "blocked";
  priority: "critical" | "high" | "medium" | "low";
  estimatedHours?: number;
  dependencies?: string[];
  tags?: string[];
  started_at?: string;
  completed_at?: string;
  result?: string;
}

interface Phase {
  id: string;
  name: string;
  status: "idle" | "active" | "complete" | "failed";
  order: number;
  exitCriteria?: string[];
  tasks: Task[];
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  achieved?: boolean;
}

interface RoadmapState {
  id: string;
  title: string;
  version: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks?: number;
  phases: Phase[];
  milestones: Milestone[];
  startedAt?: string;
  updatedAt?: string;
}

// ── Status colors / labels ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; glow: string; dot: string; label: string }> = {
  complete: { color: "text-emerald-400", glow: "shadow-emerald-500/30", dot: "bg-emerald-400", label: "COMPLETE" },
  running:  { color: "text-blue-400",    glow: "shadow-blue-500/30",    dot: "bg-blue-400",    label: "RUNNING"  },
  pending:  { color: "text-slate-400",   glow: "",                      dot: "bg-slate-600",   label: "PENDING"  },
  failed:   { color: "text-red-400",     glow: "shadow-red-500/30",     dot: "bg-red-400",     label: "FAILED"   },
  skipped:  { color: "text-slate-500",   glow: "",                      dot: "bg-slate-700",   label: "SKIPPED"  },
  blocked:  { color: "text-amber-400",   glow: "shadow-amber-500/30",   dot: "bg-amber-400",   label: "BLOCKED"  },
  active:   { color: "text-blue-400",    glow: "shadow-blue-500/30",    dot: "bg-blue-400",    label: "ACTIVE"   },
  idle:     { color: "text-slate-500",   glow: "",                      dot: "bg-slate-700",   label: "IDLE"     },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "text-red-400 border-red-800",    label: "CRIT" },
  high:     { color: "text-amber-400 border-amber-800", label: "HIGH" },
  medium:   { color: "text-blue-400 border-blue-800",  label: "MED"  },
  low:      { color: "text-slate-400 border-slate-700", label: "LOW"  },
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest ${cfg.color}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "running" ? "animate-pulse" : ""}`}
      />
      {cfg.label}
    </span>
  );
}

// ── PriorityBadge ─────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={`text-[9px] font-mono font-bold tracking-widest border px-1.5 py-0.5 rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max = 100,
  color = "bg-blue-500",
  animated = false,
  height = "h-1",
}: {
  value: number;
  max?: number;
  color?: string;
  animated?: boolean;
  height?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={`w-full ${height} bg-white/5 rounded-full overflow-hidden`}>
      <div
        className={`${height} ${color} rounded-full transition-all duration-700 ease-out ${animated ? "animate-pulse" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  updating,
}: {
  task: Task;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  updating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-all duration-200
        ${task.status === "running" ? "border-blue-500/50 bg-blue-950/20" : ""}
        ${task.status === "complete" ? "border-emerald-800/50 bg-emerald-950/10" : ""}
        ${task.status === "failed" ? "border-red-800/50 bg-red-950/10" : ""}
        ${task.status === "blocked" ? "border-amber-800/50 bg-amber-950/10" : ""}
        ${task.status === "pending" || task.status === "skipped" ? "border-white/5 bg-white/[0.02]" : ""}
      `}
    >
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Left: status dot */}
        <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${statusCfg.dot} ${task.status === "running" ? "animate-pulse" : ""}`} />

        {/* Middle: content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white/90 font-medium leading-snug">{task.title}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={task.status} />
            {task.estimatedHours && (
              <span className="text-[10px] font-mono text-white/30">{task.estimatedHours}h est.</span>
            )}
            {task.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[10px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: chevron */}
        <span className={`text-white/30 transition-transform text-xs flex-shrink-0 ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 mt-0 space-y-3">
          {task.description && (
            <p className="text-xs text-white/50 leading-relaxed pt-3">{task.description}</p>
          )}
          {task.result && (
            <div className="text-xs font-mono text-white/40 bg-white/5 rounded p-2">
              {task.result}
            </div>
          )}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Depends on</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.dependencies.map((dep) => (
                  <span key={dep} className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                    {dep.replace("task-", "")}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Status controls */}
          <div>
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Update Status</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(["pending", "running", "complete", "failed", "blocked", "skipped"] as Task["status"][]).map((s) => (
                <button
                  key={s}
                  disabled={updating || task.status === s}
                  onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, s); }}
                  className={`
                    text-[10px] font-mono px-2 py-1 rounded border transition-all
                    ${task.status === s
                      ? `${STATUS_CONFIG[s].color} border-current opacity-60 cursor-default`
                      : "text-white/40 border-white/10 hover:border-white/30 hover:text-white/70 cursor-pointer"
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed
                  `}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PhaseCard ─────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  isActive,
  onStatusChange,
  updatingTask,
}: {
  phase: Phase;
  isActive: boolean;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  updatingTask: string | null;
}) {
  const [open, setOpen] = useState(isActive);
  const completedTasks = phase.tasks.filter((t) => t.status === "complete").length;
  const totalTasks = phase.tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const phaseCfg = STATUS_CONFIG[phase.status] || STATUS_CONFIG.idle;

  const phaseColors = [
    "from-blue-900/20 to-transparent border-blue-800/30",
    "from-purple-900/20 to-transparent border-purple-800/30",
    "from-emerald-900/20 to-transparent border-emerald-800/30",
    "from-amber-900/20 to-transparent border-amber-800/30",
    "from-red-900/20 to-transparent border-red-800/30",
  ];

  const progressColors = [
    "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500",
  ];

  const colorIdx = phase.order - 1;
  const phaseColor = phaseColors[colorIdx] || phaseColors[0];
  const progressColor = progressColors[colorIdx] || progressColors[0];

  return (
    <div className={`border rounded-xl overflow-hidden bg-gradient-to-b ${phaseColor} transition-all`}>
      {/* Phase header */}
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-4"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Phase number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-xs font-mono font-bold text-white/60">{phase.order - 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{phase.name}</h3>
            <StatusBadge status={phase.status} />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <ProgressBar value={progress} color={progressColor} height="h-1" />
            <span className="text-[10px] font-mono text-white/40 flex-shrink-0">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        </div>

        <span className={`text-white/30 text-xs flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Expanded phase content */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5">
          {/* Exit criteria */}
          {phase.exitCriteria && phase.exitCriteria.length > 0 && (
            <div className="pt-4">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Exit Criteria</p>
              <ul className="space-y-1">
                {phase.exitCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-white/40 flex items-start gap-2">
                    <span className="text-white/20 mt-0.5">·</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Task list */}
          <div className="space-y-2">
            {phase.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                updating={updatingTask === task.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MilestoneTracker ──────────────────────────────────────────────────────────

function MilestoneTracker({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="space-y-3">
      {milestones.map((m, idx) => (
        <div key={m.id} className="flex items-start gap-3">
          {/* Connector line */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-mono
                ${m.achieved
                  ? "border-emerald-400 bg-emerald-950 text-emerald-400"
                  : "border-white/20 bg-white/5 text-white/30"
                }
              `}
            >
              {m.achieved ? "✓" : idx + 1}
            </div>
            {idx < milestones.length - 1 && (
              <div className={`w-px flex-1 mt-1 ${m.achieved ? "bg-emerald-800" : "bg-white/10"}`} style={{ minHeight: "16px" }} />
            )}
          </div>
          <div className="pb-4">
            <p className={`text-xs font-medium ${m.achieved ? "text-emerald-400" : "text-white/60"}`}>
              {m.name}
            </p>
            {m.description && (
              <p className="text-[11px] text-white/30 mt-0.5">{m.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CriticalPath ──────────────────────────────────────────────────────────────

const CRITICAL_PATH = [
  "task-p0-001", "task-p0-002", "task-p1-001", "task-p1-002", "task-p2-001", "task-p3-001",
];

function CriticalPathView({ phases }: { phases: Phase[] }) {
  const taskMap = new Map<string, Task>();
  phases.forEach((p) => p.tasks.forEach((t) => taskMap.set(t.id, t)));

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
        Critical Path — {CRITICAL_PATH.length} nodes
      </p>
      <div className="flex flex-col gap-0">
        {CRITICAL_PATH.map((id, idx) => {
          const task = taskMap.get(id);
          const cfg = STATUS_CONFIG[task?.status || "pending"];
          return (
            <div key={id} className="flex items-stretch gap-3">
              {/* Left connector */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-3 ${cfg.dot} ${task?.status === "running" ? "animate-pulse" : ""}`} />
                {idx < CRITICAL_PATH.length - 1 && (
                  <div className="w-px flex-1 bg-white/10" />
                )}
              </div>
              <div className="py-2 min-w-0 pb-3">
                <p className="text-xs text-white/70">{task?.title || id}</p>
                <StatusBadge status={task?.status || "pending"} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RoadmapTimeline (Gantt-style) ─────────────────────────────────────────────

function RoadmapTimeline({ phases }: { phases: Phase[] }) {
  const phaseColors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];

  return (
    <div className="space-y-3 overflow-x-auto">
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Phase Timeline</p>
      <div className="min-w-[320px]">
        {phases.map((phase, idx) => {
          const done = phase.tasks.filter((t) => t.status === "complete").length;
          const total = phase.tasks.length;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const barColor = phaseColors[idx] || phaseColors[0];

          // Visual weight: each phase gets proportional width based on task count
          const totalTasks = phases.reduce((s, p) => s + p.tasks.length, 0);
          const widthPct = totalTasks > 0 ? (total / totalTasks) * 100 : 20;

          return (
            <div key={phase.id} className="flex items-center gap-3 py-1.5">
              <span className="text-[10px] font-mono text-white/40 w-24 flex-shrink-0 truncate">
                P{phase.order - 1}: {phase.name.split("—")[0].trim()}
              </span>
              <div className="flex-1 relative">
                {/* Track */}
                <div className="h-4 bg-white/5 rounded-sm overflow-hidden relative">
                  {/* Progress fill */}
                  <div
                    className={`h-full ${barColor} opacity-80 transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                  {/* Task markers */}
                  {phase.tasks.map((task, ti) => {
                    const xPct = ((ti + 0.5) / total) * 100;
                    const dotColor =
                      task.status === "complete" ? "bg-white" :
                      task.status === "running" ? "bg-white animate-pulse" :
                      task.status === "failed" ? "bg-red-400" :
                      task.status === "blocked" ? "bg-amber-400" :
                      "bg-white/30";
                    return (
                      <div
                        key={task.id}
                        title={task.title}
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{ left: `${xPct}%` }}
                      >
                        <div className={`w-1 h-1 rounded-full ${dotColor}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/30 w-10 text-right flex-shrink-0">
                {Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ExecutionControls ─────────────────────────────────────────────────────────

function ExecutionControls({
  roadmap,
  onRefresh,
  refreshing,
}: {
  roadmap: RoadmapState;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white/90 hover:bg-white/10 transition-all disabled:opacity-40 font-mono"
      >
        <span className={refreshing ? "animate-spin inline-block" : ""}>⟳</span>
        {refreshing ? "SYNCING..." : "SYNC"}
      </button>

      <a
        href="/api/javari/roadmap/activate"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white/90 hover:bg-white/10 transition-all font-mono"
      >
        ↗ RAW STATE
      </a>

      <div className="flex items-center gap-2 ml-auto">
        <span className="text-[10px] font-mono text-white/25">
          v{roadmap.version} · updated {roadmap.updatedAt ? new Date(roadmap.updatedAt).toLocaleTimeString() : "—"}
        </span>
      </div>
    </div>
  );
}

// ── RoadmapSummary ────────────────────────────────────────────────────────────

function RoadmapSummary({ roadmap }: { roadmap: RoadmapState }) {
  const statusCfg = STATUS_CONFIG[roadmap.status] || STATUS_CONFIG.idle;

  const stats = [
    { label: "TOTAL TASKS", value: roadmap.totalTasks, color: "text-white/70" },
    { label: "COMPLETE", value: roadmap.completedTasks, color: "text-emerald-400" },
    { label: "FAILED", value: roadmap.failedTasks || 0, color: "text-red-400" },
    { label: "REMAINING", value: roadmap.totalTasks - roadmap.completedTasks - (roadmap.failedTasks || 0), color: "text-blue-400" },
  ];

  return (
    <div className="space-y-4">
      {/* OS header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot} ${roadmap.status === "executing" ? "animate-pulse" : ""}`} />
          {roadmap.status === "executing" && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-blue-400 animate-ping opacity-50" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Javari OS · Roadmap Engine</p>
          <h1 className="text-sm font-semibold text-white">{roadmap.title}</h1>
        </div>
        <span className={`ml-auto text-[10px] font-mono font-bold tracking-widest ${statusCfg.color}`}>
          {roadmap.status.toUpperCase()}
        </span>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Overall Progress</span>
          <span className="text-xs font-mono font-bold text-white/70">{Math.round(roadmap.progress)}%</span>
        </div>
        <ProgressBar value={roadmap.progress} color="bg-gradient-to-r from-blue-600 to-blue-400" height="h-2" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5 text-center">
            <p className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard Page ───────────────────────────────────────────────────────

export default function RoadmapDashboard() {
  const [roadmap, setRoadmap] = useState<RoadmapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<"phases" | "timeline" | "milestones" | "critical">("phases");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchState = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/javari/roadmap/state");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.roadmap) {
        setRoadmap(data.roadmap);
        setError(null);
      } else {
        throw new Error(data.error || "Load failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roadmap state");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Auto-refresh every 30s
    const interval = setInterval(() => fetchState(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleStatusChange = async (taskId: string, status: Task["status"]) => {
    setUpdatingTask(taskId);
    try {
      const res = await fetch("/api/javari/roadmap/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Task updated → ${status.toUpperCase()}`, true);
        await fetchState(true);
      } else {
        showToast(data.error || "Update failed", false);
      }
    } catch {
      showToast("Network error", false);
    } finally {
      setUpdatingTask(null);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-white/30 uppercase tracking-widest">Loading Roadmap State...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !roadmap) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <p className="text-sm text-white/70">Failed to load roadmap</p>
          <p className="text-xs font-mono text-red-400">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => fetchState()}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all font-mono"
            >
              RETRY
            </button>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/javari/roadmap/activate", { method: "POST" });
                  await fetchState();
                } catch {}
              }}
              className="px-4 py-2 rounded-lg bg-blue-900 border border-blue-700 text-xs text-blue-300 hover:bg-blue-800 transition-all font-mono"
            >
              INITIALIZE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active phase ───────────────────────────────────────────────────────────
  const activePhase = roadmap.phases.find((p) => p.status === "active") || roadmap.phases[0];

  return (
    <div className="flex-1 overflow-y-auto bg-black text-white">
      {/* Toast */}
      {toast && (
        <div
          className={`
            fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-xs font-mono border transition-all
            ${toast.ok
              ? "bg-emerald-950 border-emerald-700 text-emerald-300"
              : "bg-red-950 border-red-700 text-red-300"
            }
          `}
        >
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header / Summary ─────────────────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <RoadmapSummary roadmap={roadmap} />
          <div className="border-t border-white/5 pt-4">
            <ExecutionControls roadmap={roadmap} onRefresh={() => fetchState(true)} refreshing={refreshing} />
          </div>
        </div>

        {/* ── Tab Navigation ───────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
          {([
            ["phases", "Phases"],
            ["timeline", "Timeline"],
            ["milestones", "Milestones"],
            ["critical", "Critical Path"],
          ] as [typeof activeTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex-1 py-2 text-xs font-mono rounded-lg transition-all
                ${activeTab === tab
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/40 hover:text-white/60"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────────── */}

        {/* Phases Tab */}
        {activeTab === "phases" && (
          <div className="space-y-3">
            {roadmap.phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                isActive={phase.id === activePhase?.id}
                onStatusChange={handleStatusChange}
                updatingTask={updatingTask}
              />
            ))}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <RoadmapTimeline phases={roadmap.phases} />
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === "milestones" && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <MilestoneTracker milestones={roadmap.milestones} />
          </div>
        )}

        {/* Critical Path Tab */}
        {activeTab === "critical" && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <CriticalPathView phases={roadmap.phases} />
          </div>
        )}

        {/* ── Current Active Phase Spotlight ───────────────────────────────── */}
        {activePhase && (
          <div className="bg-blue-950/20 border border-blue-800/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Active Execution</p>
            </div>
            <h2 className="text-sm font-semibold text-white">{activePhase.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activePhase.tasks
                .filter((t) => t.status === "running" || t.status === "blocked")
                .map((task) => (
                  <div key={task.id} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[task.status].dot} ${task.status === "running" ? "animate-pulse" : ""}`} />
                    <span className="text-xs text-white/70 truncate">{task.title}</span>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              {activePhase.tasks.filter((t) => t.status === "running" || t.status === "blocked").length === 0 && (
                <p className="text-xs text-white/30 col-span-2">No active or blocked tasks in this phase</p>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="text-center pb-4">
          <p className="text-[10px] font-mono text-white/15">
            Javari OS · Master Roadmap V2.0 · {roadmap.phases.length} Phases · {roadmap.totalTasks} Tasks · Henderson Standard
          </p>
        </div>
      </div>
    </div>
  );
}
