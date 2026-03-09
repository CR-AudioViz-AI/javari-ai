// app/javari/autonomy-graph/page.tsx
// Javari AI — Autonomy Graph Visualization
// Created: 2026-03-10

"use client"

import { useEffect, useState, useRef, useCallback } from "react"

interface TaskNode {
  id: string
  title: string
  status: "pending" | "running" | "completed" | "failed"
  depends_on: string[]
}

interface NodePosition {
  x: number
  y: number
}

// Deterministic layout engine — no physics lib needed
function computeLayout(tasks: TaskNode[], width: number, height: number): Record<string, NodePosition> {
  if (!tasks.length) return {}

  // Build dependency levels (topological sort)
  const levels: Record<string, number> = {}
  const inDegree: Record<string, number> = {}
  const children: Record<string, string[]> = {}

  tasks.forEach(t => {
    inDegree[t.id] = t.depends_on.length
    children[t.id] = []
  })
  tasks.forEach(t => {
    t.depends_on.forEach(dep => {
      if (children[dep]) children[dep].push(t.id)
    })
  })

  const queue = tasks.filter(t => inDegree[t.id] === 0).map(t => t.id)
  queue.forEach(id => { levels[id] = 0 })

  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    ;(children[id] || []).forEach(child => {
      levels[child] = Math.max(levels[child] ?? 0, (levels[id] ?? 0) + 1)
      inDegree[child]--
      if (inDegree[child] === 0) queue.push(child)
    })
  }

  // Any unresolved (cycles) go to level 0
  tasks.forEach(t => { if (levels[t.id] === undefined) levels[t.id] = 0 })

  const maxLevel = Math.max(...Object.values(levels), 0)
  const levelGroups: Record<number, string[]> = {}
  tasks.forEach(t => {
    const l = levels[t.id]
    if (!levelGroups[l]) levelGroups[l] = []
    levelGroups[l].push(t.id)
  })

  const positions: Record<string, NodePosition> = {}
  const padX = 120
  const padY = 100
  const usableW = width - padX * 2
  const usableH = height - padY * 2
  const levelCount = maxLevel + 1

  Object.entries(levelGroups).forEach(([lvlStr, ids]) => {
    const lvl = parseInt(lvlStr)
    const x = levelCount === 1 ? width / 2 : padX + (usableW / (levelCount - 1)) * lvl
    ids.forEach((id, i) => {
      const count = ids.length
      const y = count === 1 ? height / 2 : padY + (usableH / (count - 1)) * i
      positions[id] = { x, y }
    })
  })

  return positions
}

// Fallback simulated tasks for when API is unreachable
function getSimulatedTasks(): TaskNode[] {
  return [
    { id: "t1", title: "Bootstrap Platform Secrets", status: "completed", depends_on: [] },
    { id: "t2", title: "Initialize Supabase Schema", status: "completed", depends_on: ["t1"] },
    { id: "t3", title: "Deploy Javari Core API", status: "completed", depends_on: ["t2"] },
    { id: "t4", title: "Vector Memory Ingestion", status: "running", depends_on: ["t3"] },
    { id: "t5", title: "Planner Engine Activation", status: "running", depends_on: ["t3"] },
    { id: "t6", title: "R2 Cold Storage Sync", status: "pending", depends_on: ["t4"] },
    { id: "t7", title: "Repair Loop Calibration", status: "pending", depends_on: ["t5"] },
    { id: "t8", title: "Autonomy Self-Test Suite", status: "pending", depends_on: ["t6", "t7"] },
    { id: "t9", title: "OpenRouter Multi-Model Routing", status: "failed", depends_on: ["t3"] },
    { id: "t10", title: "Javari Consciousness Merge", status: "pending", depends_on: ["t8", "t9"] },
  ]
}

const STATUS_COLOR: Record<TaskNode["status"], string> = {
  completed: "#00ff88",
  running:   "#4488ff",
  pending:   "#444466",
  failed:    "#ff4444",
}

const STATUS_GLOW: Record<TaskNode["status"], string> = {
  completed: "rgba(0,255,136,0.3)",
  running:   "rgba(68,136,255,0.4)",
  pending:   "rgba(60,60,80,0.2)",
  failed:    "rgba(255,68,68,0.35)",
}

const NODE_W = 160
const NODE_H = 48

export default function AutonomyGraph() {
  const [tasks, setTasks] = useState<TaskNode[]>([])
  const [positions, setPositions] = useState<Record<string, NodePosition>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [lastRefresh, setLastRefresh] = useState("—")
  const [tick, setTick] = useState(0)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 1200, h: 700 })

  // Measure container
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  // Recompute layout when tasks or dims change
  useEffect(() => {
    if (tasks.length) {
      setPositions(computeLayout(tasks, dims.w - 40, dims.h - 40))
    }
  }, [tasks, dims])

  // Fetch loop
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/javari/queue")
        if (!res.ok) throw new Error("not ok")
        const data = await res.json()
        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          setTasks(data.tasks)
        } else {
          setTasks(getSimulatedTasks())
        }
      } catch {
        setTasks(getSimulatedTasks())
      }
      setLastRefresh(new Date().toLocaleTimeString("en-US", { hour12: false }))
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  // Running node pulse tick
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 800)
    return () => clearInterval(t)
  }, [])

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest(".node-group")) return
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }, [dragging])

  const onMouseUp = useCallback(() => {
    setDragging(false)
    dragStart.current = null
  }, [])

  const selectedTask = tasks.find(t => t.id === selected)
  const counts = {
    completed: tasks.filter(t => t.status === "completed").length,
    running:   tasks.filter(t => t.status === "running").length,
    pending:   tasks.filter(t => t.status === "pending").length,
    failed:    tasks.filter(t => t.status === "failed").length,
  }

  // Build edge paths
  function edgePath(from: NodePosition, to: NodePosition): string {
    const fx = from.x + NODE_W / 2
    const fy = from.y + NODE_H / 2
    const tx = to.x + NODE_W / 2
    const ty = to.y + NODE_H / 2
    const cx = (fx + tx) / 2
    return `M ${fx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${tx} ${ty}`
  }

  const pulseOn = tick % 2 === 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ag-root {
          min-height: 100vh;
          background: #050505;
          display: flex;
          flex-direction: column;
          font-family: 'JetBrains Mono', monospace;
          color: #c0c0c0;
          position: relative;
          overflow: hidden;
        }

        .ag-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent, transparent 2px,
            rgba(0,255,136,0.010) 2px, rgba(0,255,136,0.010) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .ag-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 20% 50%, rgba(68,136,255,0.04) 0%, transparent 55%),
                      radial-gradient(ellipse at 80% 50%, rgba(0,255,136,0.03) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }

        .ag-header {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 2rem;
          border-bottom: 1px solid #111;
          background: rgba(5,5,5,0.95);
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }

        .ag-title {
          font-family: 'Syne', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.3em;
          color: #00ff88;
          text-transform: uppercase;
          text-shadow: 0 0 25px rgba(0,255,136,0.35);
        }

        .ag-subtitle {
          font-size: 0.58rem;
          letter-spacing: 0.18em;
          color: #2a2a2a;
          margin-top: 0.2rem;
          text-transform: uppercase;
        }

        .ag-stats {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .ag-stat {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
        }

        .ag-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .ag-meta {
          font-size: 0.6rem;
          color: #222;
          letter-spacing: 0.1em;
          text-align: right;
        }
        .ag-meta span { color: #00ff88; }

        .ag-canvas {
          flex: 1;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .ag-canvas svg {
          width: 100%;
          height: 100%;
          cursor: grab;
        }
        .ag-canvas svg.dragging {
          cursor: grabbing;
        }

        .ag-detail {
          position: absolute;
          z-index: 20;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          background: #080808;
          border: 1px solid #1a2a1a;
          padding: 1rem 1.5rem;
          min-width: 320px;
          max-width: 500px;
          font-size: 0.7rem;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .ag-detail-title {
          font-family: 'Syne', sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          letter-spacing: 0.08em;
        }

        .ag-legend {
          position: absolute;
          top: 1rem;
          right: 1.5rem;
          z-index: 10;
          background: rgba(8,8,8,0.9);
          border: 1px solid #111;
          padding: 0.75rem 1rem;
          font-size: 0.58rem;
          letter-spacing: 0.12em;
        }

        .ag-legend-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
          color: #444;
          text-transform: uppercase;
        }

        .ag-hint {
          position: absolute;
          bottom: 1rem;
          right: 1.5rem;
          font-size: 0.55rem;
          color: #1a1a1a;
          letter-spacing: 0.1em;
          z-index: 10;
        }

        @keyframes runningPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div className="ag-root">
        {/* Header */}
        <div className="ag-header">
          <div>
            <div className="ag-title">Javari Autonomy Graph</div>
            <div className="ag-subtitle">Task dependency map · live execution state</div>
          </div>

          <div className="ag-stats">
            {(["completed","running","pending","failed"] as const).map(s => (
              <div className="ag-stat" key={s}>
                <div className="ag-dot" style={{ background: STATUS_COLOR[s], boxShadow: `0 0 6px ${STATUS_COLOR[s]}` }} />
                <span style={{ color: STATUS_COLOR[s] }}>{counts[s]}</span>
                <span style={{ color: "#2a2a2a" }}>{s}</span>
              </div>
            ))}
          </div>

          <div className="ag-meta">
            <div>{tasks.length} nodes · {tasks.reduce((a,t) => a + t.depends_on.length, 0)} edges</div>
            <div style={{ marginTop: "0.2rem" }}>SYNC <span>{lastRefresh}</span></div>
          </div>
        </div>

        {/* Canvas */}
        <div className="ag-canvas" ref={containerRef}>
          <svg
            ref={svgRef}
            className={dragging ? "dragging" : ""}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <defs>
              {/* Arrow marker per status */}
              {(["completed","running","pending","failed"] as const).map(s => (
                <marker
                  key={s}
                  id={`arrow-${s}`}
                  markerWidth="8" markerHeight="8"
                  refX="6" refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill={STATUS_COLOR[s]} opacity="0.6" />
                </marker>
              ))}
              <filter id="glow-green">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-blue">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y})`}>

              {/* Edges */}
              {tasks.map(task =>
                task.depends_on.map(depId => {
                  const from = positions[depId]
                  const to   = positions[task.id]
                  if (!from || !to) return null
                  const depTask = tasks.find(t => t.id === depId)
                  const edgeStatus = depTask?.status ?? "pending"
                  const isActive = edgeStatus === "running" || edgeStatus === "completed"
                  return (
                    <path
                      key={`${depId}-${task.id}`}
                      d={edgePath(from, to)}
                      fill="none"
                      stroke={STATUS_COLOR[edgeStatus]}
                      strokeWidth={isActive ? 1.5 : 0.8}
                      strokeOpacity={isActive ? 0.5 : 0.18}
                      strokeDasharray={edgeStatus === "pending" ? "4 4" : "none"}
                      markerEnd={`url(#arrow-${edgeStatus})`}
                    />
                  )
                })
              )}

              {/* Nodes */}
              {tasks.map(task => {
                const pos = positions[task.id]
                if (!pos) return null
                const color = STATUS_COLOR[task.status]
                const glow  = STATUS_GLOW[task.status]
                const isSelected = selected === task.id
                const isRunning  = task.status === "running"

                return (
                  <g
                    key={task.id}
                    className="node-group"
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(selected === task.id ? null : task.id)}
                  >
                    {/* Outer glow ring for running */}
                    {isRunning && (
                      <rect
                        x={-6} y={-6}
                        width={NODE_W + 12} height={NODE_H + 12}
                        rx="4" ry="4"
                        fill="none"
                        stroke={color}
                        strokeWidth="1"
                        strokeOpacity={pulseOn ? 0.6 : 0.15}
                        style={{ transition: "stroke-opacity 0.4s ease" }}
                      />
                    )}

                    {/* Selection ring */}
                    {isSelected && (
                      <rect
                        x={-3} y={-3}
                        width={NODE_W + 6} height={NODE_H + 6}
                        rx="3" ry="3"
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeOpacity="0.9"
                      />
                    )}

                    {/* Node background */}
                    <rect
                      x="0" y="0"
                      width={NODE_W} height={NODE_H}
                      rx="2" ry="2"
                      fill="#0a0a0a"
                      stroke={color}
                      strokeWidth={isSelected ? 1.5 : 0.8}
                      strokeOpacity={isSelected ? 1 : 0.4}
                    />

                    {/* Top accent bar */}
                    <rect
                      x="0" y="0"
                      width={NODE_W} height="2"
                      rx="1" ry="1"
                      fill={color}
                      fillOpacity="0.7"
                    />

                    {/* Status dot */}
                    <circle
                      cx="14" cy={NODE_H / 2}
                      r="4"
                      fill={color}
                      fillOpacity={isRunning && pulseOn ? 1 : 0.8}
                      style={{ filter: isRunning ? `drop-shadow(0 0 4px ${color})` : "none" }}
                    />

                    {/* Task title */}
                    <text
                      x="26" y={NODE_H / 2 - 5}
                      fill={isSelected ? color : "#888"}
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight={isSelected ? "700" : "400"}
                      letterSpacing="0.03em"
                    >
                      {task.title.length > 18 ? task.title.slice(0, 17) + "…" : task.title}
                    </text>

                    {/* Task ID + status */}
                    <text
                      x="26" y={NODE_H / 2 + 8}
                      fill={color}
                      fontSize="7.5"
                      fontFamily="'JetBrains Mono', monospace"
                      opacity="0.6"
                      letterSpacing="0.08em"
                    >
                      {task.id} · {task.status.toUpperCase()}
                    </text>
                  </g>
                )
              })}

            </g>
          </svg>

          {/* Legend */}
          <div className="ag-legend">
            {(["completed","running","pending","failed"] as const).map(s => (
              <div className="ag-legend-row" key={s}>
                <div className="ag-dot" style={{ background: STATUS_COLOR[s] }} />
                {s}
              </div>
            ))}
            <div style={{ borderTop: "1px solid #111", marginTop: "0.5rem", paddingTop: "0.5rem", color: "#1e1e1e" }}>
              ── completed
            </div>
            <div style={{ color: "#1e1e1e" }}>╌╌ pending</div>
          </div>

          {/* Hint */}
          <div className="ag-hint">drag to pan · click node to inspect</div>

          {/* Detail panel */}
          {selected && selectedTask && (
            <div className="ag-detail">
              <div
                className="ag-detail-title"
                style={{ color: STATUS_COLOR[selectedTask.status] }}
              >
                {selectedTask.title}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 1rem", color: "#555" }}>
                <span>ID</span>
                <span style={{ color: "#888" }}>{selectedTask.id}</span>
                <span>STATUS</span>
                <span style={{ color: STATUS_COLOR[selectedTask.status] }}>
                  {selectedTask.status.toUpperCase()}
                </span>
                <span>DEPENDS ON</span>
                <span style={{ color: "#888" }}>
                  {selectedTask.depends_on.length
                    ? selectedTask.depends_on.join(", ")
                    : "none (root task)"}
                </span>
                <span>BLOCKED BY</span>
                <span style={{ color: "#888" }}>
                  {tasks
                    .filter(t => selectedTask.depends_on.includes(t.id) && t.status !== "completed")
                    .map(t => t.id)
                    .join(", ") || "—"}
                </span>
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.55rem",
                  color: "#1a1a1a",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textAlign: "right",
                }}
                onClick={() => setSelected(null)}
              >
                [ CLOSE ]
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
