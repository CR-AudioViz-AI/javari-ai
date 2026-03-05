"use client";

import { useState, useEffect } from "react";

interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

interface ExecutionLog {
  id: string;
  task_id: string;
  title: string;
  status: string;
  estimated_cost: number;
  created_at: string;
}

interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  totalCost: number;
}

export default function CommandCenter() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autonomousLoading, setAutonomousLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch("/api/javari/run-next-task");
      const data = await res.json();
      setQueueStats(data.queueStats);
      setIsRunning(data.isRunning);
    } catch (error) {
      console.error("Failed to fetch queue status:", error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/javari/execution-history?limit=20");
      const data = await res.json();
      setHistory(data.history || []);
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const runNextTask = async () => {
    setLoading(true);
    setMessage("Executing next task...");
    
    try {
      const res = await fetch("/api/javari/run-next-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "command_center" }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMessage(`✅ Task completed: ${data.task?.title || "Unknown"}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
      
      await fetchQueueStatus();
      await fetchHistory();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runAutonomous = async () => {
    setAutonomousLoading(true);
    setMessage("🚀 Starting autonomous execution mode...");
    
    try {
      const res = await fetch("/api/javari/run-autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "command_center_auto" }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setMessage(`✅ Autonomous mode complete: ${data.tasksExecuted} tasks executed (${data.tasksSucceeded} succeeded, ${data.tasksFailed} failed)`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
      
      await fetchQueueStatus();
      await fetchHistory();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setAutonomousLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    fetchHistory();
    
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchHistory();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Javari Command Center</h1>
          <p className="text-gray-600 mt-2">Monitor and control autonomous AI execution</p>
        </div>

        <div className={`mb-6 p-4 rounded-lg ${isRunning ? "bg-green-100 border-green-300" : "bg-blue-100 border-blue-300"} border-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-blue-500"}`}></div>
              <span className="font-semibold text-gray-900">
                {isRunning ? "🚀 Task Executing" : "⏸️ System Idle"}
              </span>
            </div>
            <div className="text-sm text-gray-700">Auto-refresh: 5s</div>
          </div>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-white rounded-lg border-2 border-gray-200">
            <p className="text-gray-800">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Queue Status</h2>
            {queueStats && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Tasks</span>
                  <span className="font-bold text-gray-900">{queueStats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-bold text-yellow-600">{queueStats.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Running</span>
                  <span className="font-bold text-green-600">{queueStats.running}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-bold text-blue-600">{queueStats.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-bold text-red-600">{queueStats.failed}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Execution Stats</h2>
            {stats && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Executions</span>
                  <span className="font-bold text-gray-900">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-bold text-green-600">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Cost</span>
                  <span className="font-bold text-purple-600">${stats.totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Controls</h2>
            <div className="space-y-3">
              <button
                onClick={runNextTask}
                disabled={loading || isRunning || autonomousLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? "Executing..." : "▶️ Run Next Task"}
              </button>
              
              <button
                onClick={runAutonomous}
                disabled={autonomousLoading || isRunning || loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {autonomousLoading ? "Running..." : "🚀 Start Autonomous Mode"}
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                Max 5 tasks per run • 3s delay
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Recent Executions</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Task ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No execution history yet
                    </td>
                  </tr>
                )}
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.task_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        log.status === "completed" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-purple-600">
                      ${log.estimated_cost?.toFixed(4) || "0.0000"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Javari AI Autonomous Execution Engine • Version 1.0</p>
        </div>
      </div>
    </div>
  );
}
