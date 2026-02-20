"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from "@/components/AuthProvider";
import { NextPage } from 'next';
import axios from 'axios';

const JavariDemoWidgetPage: NextPage = () => {
  const { user } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleProcess = async () => {
    setStatus('processing');
    try {
      const response = await axios.post('/api/tools/javari-demo-widget/process');
      setResult(response.data.result);
      setStatus('complete');
      await axios.post('/api/credits/deduct', { credits: 1, reason: "javari-demo-widget" });
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 dark:bg-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-4">Javari Demo Widget</h1>
      <p className="mb-6">A demonstration widget showing Javari AI Module Factory capabilities with real-time AI generation preview and credit tracking dashboard.</p>
      <div className="mb-4">
        <button 
          onClick={handleProcess} 
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Start AI generation process"
          disabled={status === 'processing'}
        >
          {status === 'processing' ? 'Processing...' : 'Start AI Generation'}
        </button>
      </div>
      <div className="mb-4">
        <span className="text-sm">Credit Cost: 1 per use</span>
      </div>
      <div className="border rounded p-4 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-2">Result Display</h2>
        {status === 'idle' && <p className="text-gray-500">No generation started yet.</p>}
        {status === 'processing' && <p className="text-gray-500">Processing...</p>}
        {status === 'complete' && result && <p>{result}</p>}
        {status === 'error' && <p className="text-red-500">An error occurred during processing. Please try again.</p>}
      </div>
    </div>
  );
};

export default JavariDemoWidgetPage;