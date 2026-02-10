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
      const warnings = tests.filter((t: any) => t.status === 'pending').length;
      
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
    }
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Javari AI Phase 2 Testing
        </h1>
        <p className="text-xl text-gray-300 mb-8">Infrastructure Verification</p>
        
        <button 
          onClick={runTests} 
          disabled={testing}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold py-4 px-8 rounded-lg text-lg mb-8"
        >
          {testing ? '🔄 Running...' : '▶️ Run All Tests'}
        </button>

        {summary.total > 0 && (
          <div className="bg-slate-800 border border-purple-500/30 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-900/30 border border-green-500 rounded">
                <div className="text-3xl font-bold text-green-400">{summary.passed}</div>
                <div className="text-sm text-gray-400">Passed</div>
              </div>
              <div className="text-center p-4 bg-red-900/30 border border-red-500 rounded">
                <div className="text-3xl font-bold text-red-400">{summary.failed}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              <div className="text-center p-4 bg-yellow-900/30 border border-yellow-500 rounded">
                <div className="text-3xl font-bold text-yellow-400">{summary.warnings}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
              <div className="text-center p-4 bg-blue-900/30 border border-blue-500 rounded">
                <div className="text-3xl font-bold text-blue-400">{summary.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={`px-6 py-2 rounded-full font-bold ${
                summary.failed === 0 && summary.warnings === 0 ? 'bg-green-600' : 
                summary.failed > 0 ? 'bg-red-600' : 'bg-yellow-600'
              }`}>
                {summary.failed === 0 && summary.warnings === 0 ? '✅ ALL TESTS PASSED' :
                 summary.failed > 0 ? '❌ TESTS FAILED' : '⚠️ TESTS PENDING'}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {results.map((test: any, i: number) => (
            <div key={i} className="bg-slate-800 border border-purple-500/30 rounded-lg p-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-white">{test.name}</h3>
                <span className={`px-4 py-1 rounded-full font-bold ${
                  test.status === 'passed' ? 'bg-green-600' :
                  test.status === 'failed' ? 'bg-red-600' :
                  'bg-yellow-600'
                }`}>
                  {test.status.toUpperCase()}
                </span>
              </div>
              {test.details && (
                <p className="text-gray-300 text-sm">{test.details}</p>
              )}
              {test.endpoint && (
                <p className="text-gray-400 text-sm mt-2">Endpoint: {test.endpoint}</p>
              )}
              {test.required && (
                <div className="mt-2">
                  <p className="text-gray-400 text-sm">Required:</p>
                  <ul className="text-gray-500 text-xs ml-4 list-disc">
                    {test.required.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
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
