// app/command/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Saturday, December 13, 2025 - 8:30 PM EST
// Version: 1.0 - SYSTEM OPERATIONS CONTROL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';

interface SystemStatus {
  name: string;
  endpoint: string;
  status: 'online' | 'offline' | 'checking';
  latency?: number;
  details?: string;
}

interface ProjectHealth {
  name: string;
  overall: string;
  github: { status: string; lastCommit: string };
  vercel?: { status: string; url?: string };
}

interface Plugin {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}

export default function CommandCenter() {
  const [systems, setSystems] = useState<SystemStatus[]>([
    { name: 'Chat Engine', endpoint: '/api/chat', status: 'checking' },
    { name: 'Streaming', endpoint: '/api/chat/stream', status: 'checking' },
    { name: 'Tools Engine', endpoint: '/api/tools/execute', status: 'checking' },
    { name: 'Self-Healing', endpoint: '/api/autonomous/heal', status: 'checking' },
    { name: 'Intelligence', endpoint: '/api/intelligence/proactive', status: 'checking' },
    { name: 'Agent Mode', endpoint: '/api/agent/execute', status: 'checking' },
    { name: 'Cron System', endpoint: '/api/cron', status: 'checking' },
    { name: 'GitHub Webhook', endpoint: '/api/webhooks/github', status: 'checking' },
    { name: 'Vercel Webhook', endpoint: '/api/webhooks/vercel', status: 'checking' },
    { name: 'Vision AI', endpoint: '/api/vision/analyze', status: 'checking' },
    { name: 'Voice Synth', endpoint: '/api/voice/synthesize', status: 'checking' },
    { name: 'Memory System', endpoint: '/api/memory', status: 'checking' },
    { name: 'Email Alerts', endpoint: '/api/notifications/email', status: 'checking' },
    { name: 'Analytics', endpoint: '/api/analytics/dashboard', status: 'checking' },
    { name: 'Plugins', endpoint: '/api/plugins', status: 'checking' },
    { name: 'Orchestrator', endpoint: '/api/projects/orchestrate', status: 'checking' },
  ]);

  const [projects, setProjects] = useState<ProjectHealth[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [healthScore, setHealthScore] = useState<number>(0);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const checkSystems = useCallback(async () => {
    setIsRefreshing(true);
    const updatedSystems = await Promise.all(
      systems.map(async (system) => {
        const start = Date.now();
        try {
          const res = await fetch(system.endpoint, { method: 'GET' });
          const latency = Date.now() - start;
          if (res.ok) {
            const data = await res.json();
            return {
              ...system,
              status: 'online' as const,
              latency,
              details: data.name || data.status || 'OK'
            };
          }
          return { ...system, status: 'offline' as const, latency };
        } catch {
          return { ...system, status: 'offline' as const, latency: Date.now() - start };
        }
      })
    );
    setSystems(updatedSystems);

    // Fetch health score
    try {
      const healthRes = await fetch('/api/analytics/dashboard?section=health');
      const healthData = await healthRes.json();
      setHealthScore(healthData.data?.score || 0);
    } catch {
      setHealthScore(0);
    }

    // Fetch projects
    try {
      const projRes = await fetch('/api/projects/orchestrate?action=health');
      const projData = await projRes.json();
      setProjects(projData.projects?.slice(0, 10) || []);
      setProjectCount(projData.summary?.total || 0);
    } catch {
      setProjects([]);
    }

    // Fetch plugins
    try {
      const plugRes = await fetch('/api/plugins');
      const plugData = await plugRes.json();
      setPlugins(plugData.plugins || []);
    } catch {
      setPlugins([]);
    }

    setLastRefresh(new Date());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    checkSystems();
    const interval = setInterval(checkSystems, 60000);
    return () => clearInterval(interval);
  }, [checkSystems]);

  const executeCommand = async (cmd: string) => {
    setIsExecuting(true);
    const log = (msg: string) => setCommandOutput(prev => [...prev, `> ${msg}`]);
    
    log(`Executing: ${cmd}`);
    
    try {
      if (cmd.startsWith('heal')) {
        log('Triggering self-healing scan...');
        const res = await fetch('/api/autonomous/heal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scanAll: true })
        });
        const data = await res.json();
        log(`Result: ${JSON.stringify(data, null, 2)}`);
      } else if (cmd.startsWith('chat ')) {
        const message = cmd.replace('chat ', '');
        log(`Sending to Javari: "${message}"`);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: message }] })
        });
        const data = await res.json();
        log(`Javari: ${data.content || data.error}`);
      } else if (cmd.startsWith('tool ')) {
        const parts = cmd.replace('tool ', '').split(' ');
        const toolName = parts[0];
        log(`Executing tool: ${toolName}`);
        const res = await fetch('/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, parameters: {} })
        });
        const data = await res.json();
        log(`Result: ${JSON.stringify(data, null, 2).slice(0, 500)}`);
      } else if (cmd === 'status') {
        log('Refreshing system status...');
        await checkSystems();
        log('Status refreshed.');
      } else if (cmd === 'help') {
        log('Available commands:');
        log('  heal          - Trigger self-healing scan');
        log('  chat <msg>    - Send message to Javari');
        log('  tool <name>   - Execute a tool');
        log('  status        - Refresh system status');
        log('  clear         - Clear command output');
        log('  help          - Show this help');
      } else if (cmd === 'clear') {
        setCommandOutput([]);
      } else {
        log(`Unknown command: ${cmd}. Type "help" for available commands.`);
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setIsExecuting(false);
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (commandInput.trim() && !isExecuting) {
      executeCommand(commandInput.trim().toLowerCase());
      setCommandInput('');
    }
  };

  const onlineCount = systems.filter(s => s.status === 'online').length;
  const totalSystems = systems.length;

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <header className="border-b border-green-900 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="text-2xl">⚡</div>
            <div>
              <h1 className="text-xl font-bold text-green-300">JAVARI COMMAND CENTER</h1>
              <p className="text-xs text-green-600">CR AudioViz AI • System Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-green-600">HEALTH:</span>
              <span className={`ml-2 ${healthScore >= 80 ? 'text-green-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {healthScore}/100
              </span>
            </div>
            <div>
              <span className="text-green-600">SYSTEMS:</span>
              <span className="ml-2">{onlineCount}/{totalSystems}</span>
            </div>
            <div>
              <span className="text-green-600">PROJECTS:</span>
              <span className="ml-2">{projectCount}</span>
            </div>
            <button
              onClick={checkSystems}
              disabled={isRefreshing}
              className="px-3 py-1 border border-green-700 hover:bg-green-900/50 transition disabled:opacity-50"
            >
              {isRefreshing ? '⟳ SCANNING...' : '⟳ REFRESH'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Systems Panel */}
        <div className="lg:col-span-2 border border-green-900 rounded">
          <div className="border-b border-green-900 p-3 flex justify-between items-center">
            <h2 className="text-green-300">█ SYSTEM STATUS</h2>
            <span className="text-xs text-green-600">Last: {lastRefresh.toLocaleTimeString()}</span>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
            {systems.map((system, i) => (
              <div
                key={i}
                className={`p-2 border rounded text-xs ${
                  system.status === 'online' ? 'border-green-700 bg-green-900/20' :
                  system.status === 'offline' ? 'border-red-700 bg-red-900/20' :
                  'border-yellow-700 bg-yellow-900/20'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    system.status === 'online' ? 'bg-green-400 animate-pulse' :
                    system.status === 'offline' ? 'bg-red-400' :
                    'bg-yellow-400 animate-pulse'
                  }`}></span>
                  <span className="font-bold truncate">{system.name}</span>
                </div>
                <div className="text-green-600 truncate">
                  {system.status === 'checking' ? 'Checking...' : 
                   system.latency ? `${system.latency}ms` : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="border border-green-900 rounded">
          <div className="border-b border-green-900 p-3">
            <h2 className="text-green-300">█ QUICK STATS</h2>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex justify-between border-b border-green-900/50 pb-2">
              <span className="text-green-600">Systems Online</span>
              <span>{onlineCount}/{totalSystems}</span>
            </div>
            <div className="flex justify-between border-b border-green-900/50 pb-2">
              <span className="text-green-600">Health Score</span>
              <span className={healthScore >= 80 ? 'text-green-400' : 'text-yellow-400'}>{healthScore}%</span>
            </div>
            <div className="flex justify-between border-b border-green-900/50 pb-2">
              <span className="text-green-600">Projects</span>
              <span>{projectCount}</span>
            </div>
            <div className="flex justify-between border-b border-green-900/50 pb-2">
              <span className="text-green-600">Plugins</span>
              <span>{plugins.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600">Uptime</span>
              <span className="text-green-400">OPERATIONAL</span>
            </div>
          </div>
        </div>

        {/* Projects Panel */}
        <div className="lg:col-span-2 border border-green-900 rounded">
          <div className="border-b border-green-900 p-3">
            <h2 className="text-green-300">█ PROJECT HEALTH ({projects.length} shown)</h2>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-green-600 border-b border-green-900">
                  <th className="text-left pb-2">PROJECT</th>
                  <th className="text-left pb-2">GITHUB</th>
                  <th className="text-left pb-2">VERCEL</th>
                  <th className="text-left pb-2">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj, i) => (
                  <tr key={i} className="border-b border-green-900/30">
                    <td className="py-1 truncate max-w-32">{proj.name}</td>
                    <td className={proj.github.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'}>
                      {proj.github.lastCommit || '---'}
                    </td>
                    <td className={proj.vercel?.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}>
                      {proj.vercel?.status || 'N/A'}
                    </td>
                    <td className={`font-bold ${
                      proj.overall === 'healthy' ? 'text-green-400' :
                      proj.overall === 'warning' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {proj.overall.toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plugins Panel */}
        <div className="border border-green-900 rounded">
          <div className="border-b border-green-900 p-3">
            <h2 className="text-green-300">█ PLUGINS</h2>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {plugins.map((plugin, i) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-green-900/30 pb-1">
                <div>
                  <span className="text-green-300">{plugin.name}</span>
                  <span className="ml-2 text-green-700">[{plugin.category}]</span>
                </div>
                <span className={plugin.enabled ? 'text-green-400' : 'text-red-400'}>
                  {plugin.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Command Terminal */}
        <div className="lg:col-span-3 border border-green-900 rounded">
          <div className="border-b border-green-900 p-3">
            <h2 className="text-green-300">█ COMMAND TERMINAL</h2>
          </div>
          <div className="p-3">
            <div className="bg-black border border-green-900 rounded p-3 h-48 overflow-y-auto mb-3 text-xs">
              <div className="text-green-600 mb-2">Javari Command Center v1.0 - Type "help" for commands</div>
              {commandOutput.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
              {isExecuting && <div className="animate-pulse">Processing...</div>}
            </div>
            <form onSubmit={handleCommand} className="flex gap-2">
              <span className="text-green-600 py-2">$</span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Enter command..."
                disabled={isExecuting}
                className="flex-1 bg-black border border-green-700 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isExecuting}
                className="px-4 py-2 border border-green-700 hover:bg-green-900/50 transition disabled:opacity-50"
              >
                EXEC
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-green-900 p-4 mt-4 text-center text-xs text-green-700">
        JAVARI AI v6.0 • ULTIMATE POWER MODE • © 2025 CR AudioViz AI LLC
      </footer>
    </div>
  );
}
