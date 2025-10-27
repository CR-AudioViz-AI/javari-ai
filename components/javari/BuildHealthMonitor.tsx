'use client';

import { useState, useEffect } from 'react';

interface BuildHealth {
  projectId: string;
  projectName: string;
  buildStatus: 'success' | 'failed' | 'pending';
  lastBuildTime: string;
  errorMessage?: string;
}

export function BuildHealthMonitor() {
  const [builds, setBuilds] = useState<BuildHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuildHealth();
    const interval = setInterval(fetchBuildHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchBuildHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setBuilds(data.builds || []);
      }
    } catch (error) {
      console.error('Failed to fetch build health:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white text-center py-12">Loading health data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Build Health Monitor</h2>
        <p className="text-gray-400 mt-1">Real-time monitoring of all build statuses</p>
      </div>

      {builds.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-blue-500/20 p-12 text-center">
          <div className="text-6xl mb-4">🏥</div>
          <h3 className="text-xl font-semibold text-white mb-2">No build data yet</h3>
          <p className="text-gray-400">Build health information will appear here once projects are active</p>
        </div>
      ) : (
        <div className="space-y-4">
          {builds.map((build, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    build.buildStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                    build.buildStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {build.buildStatus === 'success' ? '✓' :
                     build.buildStatus === 'failed' ? '✗' : '⟳'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{build.projectName}</h3>
                    <p className="text-sm text-gray-400">{new Date(build.lastBuildTime).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  build.buildStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                  build.buildStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {build.buildStatus.toUpperCase()}
                </span>
              </div>
              {build.errorMessage && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-300">{build.errorMessage}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
