"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from "@/components/AuthProvider";

interface PaletteResult {
  colors: string[];
  contrastCheck: boolean;
}

const ColorPalettePage: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<PaletteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const user = useUser();

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleGeneratePalette = async () => {
    setStatus('processing');
    setError(null);

    try {
      const response = await fetch('/api/tools/color-palette/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to generate palette');
      }

      const data: PaletteResult = await response.json();
      setResult(data);
      setStatus('complete');

      await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits: 1, reason: "color-palette" }),
      });
    } catch (err) {
      setError('An error occurred while generating the color palette.');
      setStatus('error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 dark:bg-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-4">Color Palette Generator</h1>
      <p className="mb-6">Generate beautiful AI color palettes from text descriptions or uploaded images with accessibility contrast checking.</p>
      <div className="mb-4">
        <button
          onClick={handleGeneratePalette}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800"
          aria-label="Generate Color Palette"
        >
          Generate Palette
        </button>
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Credits per use: 1</span>
      </div>
      <div className="mt-4">
        {status === 'processing' && <div className="spinner">Loading...</div>}
        {status === 'complete' && result && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Palette Result</h2>
            <div className="flex space-x-2">
              {result.colors.map((color, index) => (
                <div key={index} className="w-8 h-8" style={{ backgroundColor: color }} aria-label={`Color ${color}`}></div>
              ))}
            </div>
            <p className="mt-2">WCAG Contrast Check: {result.contrastCheck ? 'Pass' : 'Fail'}</p>
          </div>
        )}
        {status === 'error' && <div className="text-red-500">{error}</div>}
      </div>
    </div>
  );
};

export default ColorPalettePage;