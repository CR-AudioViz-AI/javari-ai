'use client';

import { useState } from 'react';

export function Settings() {
  const [settings, setSettings] = useState({
    githubToken: '••••••••••••••••••••',
    vercelToken: '••••••••••••••••••••',
    openaiKey: '••••••••••••••••••••',
    autoHealing: true,
    notifications: true,
    darkMode: true
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-gray-400 mt-1">Configure Javari AI preferences and integrations</p>
      </div>

      {/* API Keys */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">API Credentials</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={settings.githubToken}
              disabled
              className="w-full bg-slate-700/50 text-gray-400 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vercel API Token
            </label>
            <input
              type="password"
              value={settings.vercelToken}
              disabled
              className="w-full bg-slate-700/50 text-gray-400 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={settings.openaiKey}
              disabled
              className="w-full bg-slate-700/50 text-gray-400 rounded-lg px-4 py-2"
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-white font-medium">Auto-Healing Builds</div>
              <div className="text-sm text-gray-400">Automatically fix common build errors</div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoHealing}
              onChange={(e) => setSettings({...settings, autoHealing: e.target.checked})}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-white font-medium">Notifications</div>
              <div className="text-sm text-gray-400">Get notified about build failures</div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* Info */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Database</span>
            <span className="text-green-400 font-medium">Connected ✓</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">API Status</span>
            <span className="text-green-400 font-medium">Operational ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
