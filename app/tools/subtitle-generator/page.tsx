'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type SubtitleGeneratorResponse = {
  subtitles: string;
  format: 'srt' | 'vtt';
};

export default function SubtitleGeneratorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<SubtitleGeneratorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleGenerateSubtitles = async () => {
    setStatus('processing');
    setError(null);
    try {
      const creditRes = await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: 4, reason: 'subtitle-generator' }),
      });
      if (!creditRes.ok) throw new Error('Failed to deduct credits');

      const processRes = await fetch('/api/tools/subtitle-generator/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!processRes.ok) throw new Error('Failed to generate subtitles');

      const data = await processRes.json() as SubtitleGeneratorResponse;
      setResult(data);
      setStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStatus('error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold">Subtitle Generator</h1>
      <p className="mt-2 text-white/70">
        Automatically generate accurate subtitles and captions for videos using AI speech recognition, with SRT and VTT export formats.
      </p>
      <div className="mt-4">
        <button
          type="button"
          onClick={handleGenerateSubtitles}
          disabled={status === 'processing'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Generate Subtitles"
        >
          {status === 'processing' ? 'Generating...' : 'Generate Subtitles'}
        </button>
        <span className="ml-4 text-sm text-white/40">4 credits per use</span>
      </div>
      <div className="mt-6" aria-live="polite">
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-white/60">
            <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true" />
            Generating subtitles...
          </div>
        )}
        {status === 'complete' && result && (
          <div className="mt-4 p-4 bg-white/[0.03] border border-white/10 rounded-xl">
            <h2 className="text-lg font-semibold">Generated Subtitles</h2>
            <pre className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{result.subtitles}</pre>
            <p className="mt-2 text-sm text-white/40">Format: {result.format.toUpperCase()}</p>
          </div>
        )}
        {status === 'error' && error && (
          <div role="alert" className="mt-4 p-4 bg-red-950/30 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
