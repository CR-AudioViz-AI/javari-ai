// components/multi/CouncilPanel.tsx
'use client';

interface CouncilStep {
  step: number;
  role: 'architect' | 'builder' | 'validator' | 'summarizer';
  model: string;
  modelId: string;
  provider: string;
  duration?: number;
  success?: boolean;
  error?: string;
  responsePreview?: string;
}

interface CouncilPanelProps {
  steps: CouncilStep[];
  finalOutput: string;
  metrics: {
    totalDuration: number;
    totalCost: number;
    stepsCompleted: number;
    stepsFailed: number;
  };
}

const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  architect: { icon: '📐', color: 'text-blue-400', label: 'Architect' },
  builder: { icon: '🔨', color: 'text-orange-400', label: 'Builder' },
  validator: { icon: '✓', color: 'text-green-400', label: 'Validator' },
  summarizer: { icon: '📝', color: 'text-purple-400', label: 'Summarizer' }
};

export function CouncilPanel({ steps, finalOutput, metrics }: CouncilPanelProps) {
  return (
    <div className="space-y-4">
      {/* Metrics Bar */}
      <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Duration:</span>
          <span className="text-white font-medium">{(metrics.totalDuration / 1000).toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Cost:</span>
          <span className="text-white font-medium">${metrics.totalCost.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Steps:</span>
          <span className="text-green-400 font-medium">{metrics.stepsCompleted}</span>
          {metrics.stepsFailed > 0 && (
            <span className="text-red-400 font-medium">/ {metrics.stepsFailed} failed</span>
          )}
        </div>
      </div>

      {/* Council Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const config = ROLE_CONFIG[step.role] || ROLE_CONFIG.architect;
          
          return (
            <div
              key={step.step}
              className={`p-4 rounded-lg border ${
                step.success === false
                  ? 'bg-red-900/10 border-red-500/20'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-slate-500 text-sm">Step {step.step}</span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {step.model} <span className="text-slate-600">({step.provider})</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {step.duration && (
                    <span className="text-sm text-slate-400">
                      {(step.duration / 1000).toFixed(1)}s
                    </span>
                  )}
                  {step.success === true && (
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Success
                    </div>
                  )}
                  {step.success === false && (
                    <div className="flex items-center gap-1 text-red-400 text-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Failed
                    </div>
                  )}
                </div>
              </div>
              
              {step.error && (
                <div className="mt-2 p-2 bg-red-900/20 rounded text-sm text-red-400">
                  {step.error}
                </div>
              )}
              
              {step.responsePreview && !step.error && (
                <div className="mt-2 p-3 bg-slate-900 rounded text-sm text-slate-300">
                  {step.responsePreview}...
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final Output */}
      <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎯</span>
          <span className="font-medium text-white">Final Output</span>
        </div>
        <div className="text-slate-300 whitespace-pre-wrap">
          {finalOutput}
        </div>
      </div>
    </div>
  );
}
