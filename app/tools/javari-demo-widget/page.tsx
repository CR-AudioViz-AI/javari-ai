'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function JavariDemoWidgetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return null;

  const handleProcess = async () => {
    setStatus('processing');
    try {
      const res = await fetch('/api/tools/javari-demo-widget/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Processing failed');
      const data = await res.json() as { result?: string };
      setResult(data.result ?? 'Complete');
      setStatus('complete');
      await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: 1, reason: 'javari-demo-widget' }),
      });
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Javari Demo Widget</h1>
      <p className="mb-6 text-white/70">
        A demonstration widget showing Javari AI Module Factory capabilities with real-time AI generation preview and credit tracking dashboard.
      </p>
      <div className="mb-4">
        <button
          type="button"
          onClick={handleProcess}
          disabled={status === 'processing'}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Start AI generation process"
        >
          {status === 'processing' ? 'Processing...' : 'Start AI Generation'}
        </button>
        <span className="ml-2 text-sm text-white/40">1 credit per use</span>
      </div>
      <div className="border border-white/10 rounded-xl p-4" aria-live="polite">
        <h2 className="text-xl font-semibold mb-2">Result Display</h2>
        {status === 'idle' && <p className="text-white/40">No generation started yet.</p>}
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-white/60">
            <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true" />
            Processing...
          </div>
        )}
        {status === 'complete' && result && <p className="text-white/90">{result}</p>}
        {status === 'error' && (
          <p role="alert" className="text-red-400">An error occurred during processing. Please try again.</p>
        )}
      </div>
    </div>
  );
}
