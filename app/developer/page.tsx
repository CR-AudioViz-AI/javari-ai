'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, Code2, GitCommit, Rocket, CheckCircle2, XCircle, Brain, Zap } from 'lucide-react';

interface Generation {
  id: string;
  description: string;
  code: string;
  fileName: string;
  status: 'generating' | 'generated' | 'committing' | 'committed' | 'deploying' | 'deployed' | 'error';
  commitUrl?: string;
  deploymentUrl?: string;
  error?: string;
  timestamp: string;
}

export default function DeveloperModePage() {
  const [description, setDescription] = useState('');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim() || isProcessing) return;

    setIsProcessing(true);

    const newGeneration: Generation = {
      id: Date.now().toString(),
      description: description.trim(),
      code: '',
      fileName: '',
      status: 'generating',
      timestamp: new Date().toISOString(),
    };

    setGenerations(prev => [newGeneration, ...prev]);

    try {
      // Step 1: Generate code using OpenAI
      const generateRes = await fetch('/api/developer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!generateRes.ok) {
        throw new Error('Code generation failed');
      }

      const { code, fileName } = await generateRes.json();

      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id
            ? { ...g, code, fileName, status: 'generated' }
            : g
        )
      );

      // Step 2: Commit to GitHub
      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id ? { ...g, status: 'committing' } : g
        )
      );

      const commitRes = await fetch('/api/developer/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          code,
          message: `🤖 Javari: ${description.substring(0, 50)}`,
        }),
      });

      if (!commitRes.ok) {
        throw new Error('GitHub commit failed');
      }

      const { commitUrl } = await commitRes.json();

      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id
            ? { ...g, commitUrl, status: 'committed' }
            : g
        )
      );

      // Step 3: Deploy to Vercel
      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id ? { ...g, status: 'deploying' } : g
        )
      );

      const deployRes = await fetch('/api/developer/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!deployRes.ok) {
        throw new Error('Vercel deployment failed');
      }

      const { deploymentUrl } = await deployRes.json();

      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id
            ? { ...g, deploymentUrl, status: 'deployed' }
            : g
        )
      );

      // Log success to learning system
      await fetch('/api/developer/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'success',
          description,
          fileName,
          code,
        }),
      });

      setDescription('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setGenerations(prev =>
        prev.map(g =>
          g.id === newGeneration.id
            ? { ...g, status: 'error', error: errorMessage }
            : g
        )
      );

      // Log error to learning system
      await fetch('/api/developer/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          description,
          error: errorMessage,
        }),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: Generation['status']) => {
    switch (status) {
      case 'generating':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'generated':
        return <Code2 className="w-5 h-5 text-green-500" />;
      case 'committing':
        return <Loader2 className="w-5 h-5 animate-spin text-purple-500" />;
      case 'committed':
        return <GitCommit className="w-5 h-5 text-purple-500" />;
      case 'deploying':
        return <Loader2 className="w-5 h-5 animate-spin text-orange-500" />;
      case 'deployed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status: Generation['status']) => {
    switch (status) {
      case 'generating':
        return 'Generating code...';
      case 'generated':
        return 'Code generated';
      case 'committing':
        return 'Committing to GitHub...';
      case 'committed':
        return 'Committed to GitHub';
      case 'deploying':
        return 'Deploying to Vercel...';
      case 'deployed':
        return '✅ Live on Vercel';
      case 'error':
        return '❌ Error';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Brain className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">
              Javari Developer Mode
            </h1>
            <Zap className="w-12 h-12 text-yellow-400" />
          </div>
          <p className="text-xl text-gray-300">
            Autonomous AI-Powered Code Generation & Deployment
          </p>
          <p className="text-sm text-gray-400">
            Describe what you want to build. Javari will generate, commit, and deploy it automatically.
          </p>
        </div>

        {/* Input Card */}
        <Card className="p-6 bg-slate-800/50 border-purple-500/30">
          <div className="space-y-4">
            <label className="text-white font-semibold text-lg">
              What should I build for you?
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Create a React component for a pricing table with 3 tiers, toggle for monthly/yearly billing, and highlight the middle tier..."
              className="min-h-[120px] bg-slate-900/50 border-purple-500/30 text-white placeholder:text-gray-500"
              disabled={isProcessing}
            />
            <Button
              onClick={handleGenerate}
              disabled={!description.trim() || isProcessing}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6 text-lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Building...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Build & Deploy
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Generations List */}
        {generations.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Build History</h2>
            {generations.map((gen) => (
              <Card
                key={gen.id}
                className="p-6 bg-slate-800/50 border-purple-500/30 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {gen.description}
                    </h3>
                    {gen.fileName && (
                      <p className="text-sm text-purple-400 mb-2">
                        File: {gen.fileName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      {getStatusIcon(gen.status)}
                      <span className="text-gray-300">{getStatusText(gen.status)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(gen.timestamp).toLocaleString()}
                  </div>
                </div>

                {gen.error && (
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm">
                    {gen.error}
                  </div>
                )}

                {gen.code && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-purple-400 hover:text-purple-300">
                      View Generated Code
                    </summary>
                    <pre className="mt-2 p-4 bg-slate-900 rounded overflow-x-auto text-gray-300 text-xs">
                      <code>{gen.code}</code>
                    </pre>
                  </details>
                )}

                <div className="flex gap-3">
                  {gen.commitUrl && (
                    <a
                      href={gen.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <GitCommit className="w-4 h-4" />
                      View Commit
                    </a>
                  )}
                  {gen.deploymentUrl && (
                    <a
                      href={gen.deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Rocket className="w-4 h-4" />
                      View Deployment
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
