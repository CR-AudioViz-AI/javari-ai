'use client';
import { useState } from 'react';

export default function JavariPhase2() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    passed: 0,
    failed: 0,
    warnings: 0,
    total: 0
  });

  const runTests = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/test-phase2');
      const data = await res.json();
      
      const tests = data.tests || [];
      const passed = tests.filter((t: any) => t.status === 'passed').length;
      const failed = tests.filter((t: any) => t.status === 'failed').length;
      const warnings = tests.filter((t: any) => t.status === 'pending' || t.status === 'warning').length;
      
      setSummary({
        passed,
        failed,
        warnings,
        total: tests.length
      });
      
      setResults(tests);
    } catch (e) {
      console.error('Test error:', e);
      setResults([{ 
        name: 'System Error', 
        status: 'failed', 
        details: String(e) 
      }]);
      setSummary({ passed: 0, failed: 1, warnings: 0, total: 1 });
    }
    setTesting(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'passed') return 'bg-green-600';
    if (status === 'failed') return 'bg-red-600';
    return 'bg-yellow-600';
  };

  const getOverallStatus = () => {
    if (summary.failed > 0) return { text: '❌ TESTS FAILED', color: 'bg-red-600' };
    if (summary.warnings > 0) return { text: '⚠️ TESTS PENDING', color: 'bg-yellow-600' };
    if (summary.passed > 0) return { text: '✅ ALL TESTS PASSED', color: 'bg-green-600' };
    return { text: 'N/A', color: 'bg-gray-600' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Javari AI Phase 2 Testing
        </h1>
        <p className="text-xl text-gray-300 mb-8">Infrastructure Verification - Enhanced</p>
        
        <button 
          onClick={runTests} 
          disabled={testing}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold py-4 px-8 rounded-lg text-lg mb-8 transition-all"
        >
          {testing ? '🔄 Running Tests...' : '▶️ Run All Tests'}
        </button>

        {summary.total > 0 && (
          <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-900/30 border border-green-500 rounded">
                <div className="text-4xl font-bold text-green-400">{summary.passed}</div>
                <div className="text-sm text-gray-400">Passed</div>
              </div>
              <div className="text-center p-4 bg-red-900/30 border border-red-500 rounded">
                <div className="text-4xl font-bold text-red-400">{summary.failed}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              <div className="text-center p-4 bg-yellow-900/30 border border-yellow-500 rounded">
                <div className="text-4xl font-bold text-yellow-400">{summary.warnings}</div>
                <div className="text-sm text-gray-400">Warnings</div>
              </div>
              <div className="text-center p-4 bg-blue-900/30 border border-blue-500 rounded">
                <div className="text-4xl font-bold text-blue-400">{summary.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <span className={`px-8 py-3 rounded-full font-bold text-lg ${getOverallStatus().color}`}>
                {getOverallStatus().text}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {results.map((test: any, i: number) => (
            <div key={i} className="bg-slate-800 border border-purple-500/30 rounded-lg p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold text-white">{test.name}</h3>
                <span className={`px-4 py-2 rounded-full font-bold text-sm ${getStatusColor(test.status)}`}>
                  {test.status.toUpperCase()}
                </span>
              </div>
              
              {test.details && (
                <p className="text-gray-300 mb-2">{test.details}</p>
              )}
              
              {test.endpoint && (
                <p className="text-gray-400 text-sm">Endpoint: <code className="bg-slate-900 px-2 py-1 rounded">{test.endpoint}</code></p>
              )}
              
              {test.expectedStatus && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-400">Expected: </span>
                  <span className="text-blue-400">{test.expectedStatus}</span>
                  <span className="text-gray-400"> | Received: </span>
                  <span className={test.receivedStatus === test.expectedStatus ? 'text-green-400' : 'text-red-400'}>
                    {test.receivedStatus}
                  </span>
                </div>
              )}
              
              {test.found && (
                <div className="mt-2">
                  <p className="text-gray-400 text-sm mb-1">Environment Variables:</p>
                  <div className="bg-slate-900 p-3 rounded text-xs font-mono">
                    {Object.entries(test.found).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between py-1">
                        <span className="text-gray-400">{key}</span>
                        <span className={value ? 'text-green-400' : 'text-red-400'}>
                          {value ? '✅ Found' : '❌ Missing'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {results.length === 0 && !testing && (
          <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-12 text-center text-gray-400">
            Click "Run All Tests" to begin Phase 2 verification
          </div>
        )}
      </div>
    </div>
  );
}
