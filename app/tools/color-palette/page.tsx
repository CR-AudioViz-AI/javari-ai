'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface PaletteResult {
  colors: string[];
  contrastCheck: boolean;
}

export default function ColorPalettePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<PaletteResult | null>(null);
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

  const handleGeneratePalette = async () => {
    setStatus('processing');
    setError(null);
    try {
      const response = await fetch('/api/tools/color-palette/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to generate palette');
      const data = await response.json() as PaletteResult;
      setResult(data);
      setStatus('complete');
      await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: 1, reason: 'color-palette' }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the color palette.');
      setStatus('error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Color Palette Generator</h1>
      <p className="mb-6 text-white/70">
        Generate beautiful AI color palettes from text descriptions or uploaded images with accessibility contrast checking.
      </p>
      <div className="mb-4">
        <button
          type="button"
          onClick={handleGeneratePalette}
          disabled={status === 'processing'}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Generate Color Palette"
        >
          {status === 'processing' ? 'Generating...' : 'Generate Palette'}
        </button>
        <span className="ml-2 text-sm text-white/40">1 credit per use</span>
      </div>
      <div className="mt-4">
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-white/60" aria-live="polite">
            <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true" />
            Generating palette...
          </div>
        )}
        {status === 'complete' && result && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Palette Result</h2>
            <div className="flex space-x-2">
              {result.colors.map((color, index) => (
                <div
                  key={index}
                  className="w-10 h-10 rounded"
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-white/60">
              WCAG Contrast Check: {result.contrastCheck ? '✅ Pass' : '❌ Fail'}
            </p>
          </div>
        )}
        {status === 'error' && error && (
          <div role="alert" className="text-red-400 bg-red-950/30 border border-red-500/30 rounded px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
