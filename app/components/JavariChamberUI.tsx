/**
 * JAVARI CHAMBER UI
 * 
 * Real-time interface showing ChatGPT + Claude + Javari collaboration
 */

'use client';

import { useState } from 'react';
import { useJavariChamber } from '@/hooks/useJavariChamber';

export default function JavariChamberUI() {
  const [goal, setGoal] = useState('');
  const chamber = useJavariChamber();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    try {
      await chamber.sendGoal(goal);
    } catch (error) {
      console.error('Chamber error:', error);
    }
  };

  return (
    <div className="chamber-container">
      {/* Header */}
      <div className="chamber-header">
        <h1>Multi-AI Chamber</h1>
        <p>ChatGPT (Architect) + Claude (Builder) + Javari (Observer)</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="chamber-input">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe what you want to build..."
          rows={4}
          disabled={chamber.loading}
        />
        <button type="submit" disabled={chamber.loading || !goal.trim()}>
          {chamber.loading ? 'Executing...' : 'Execute Chamber'}
        </button>
      </form>

      {/* Progress */}
      {chamber.loading && (
        <div className="chamber-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(chamber.steps.length / 4) * 100}%` }} />
          </div>
          <p>
            Step {chamber.steps.length}/4:{' '}
            {chamber.steps[chamber.steps.length - 1]?.phase || 'Starting...'}
          </p>
        </div>
      )}

      {/* Results */}
      {chamber.result && (
        <div className="chamber-results">
          {/* Architect Output */}
          <div className="result-section architect">
            <h2>🏗️ Architect (ChatGPT)</h2>
            {chamber.architectOutput && (
              <>
                <div className="reasoning">
                  <strong>Reasoning:</strong>
                  <p>{chamber.architectOutput.reasoning}</p>
                </div>
                <div className="build-plan">
                  <strong>Build Plan:</strong>
                  <p>{chamber.architectOutput.buildPlan}</p>
                </div>
                <div className="commands">
                  <strong>Commands: {chamber.architectOutput.buildCommands.length}</strong>
                  <ul>
                    {chamber.architectOutput.buildCommands.map((cmd, i) => (
                      <li key={i}>
                        {cmd.type}: {cmd.target}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Builder Output */}
          <div className="result-section builder">
            <h2>🔨 Builder (Claude)</h2>
            {chamber.builderOutput && (
              <>
                <div className="build-status">
                  Status: {chamber.builderOutput.ok ? '✅ Success' : '❌ Failed'}
                </div>
                <div className="build-stats">
                  <div>Created: {chamber.builderOutput.createdFiles.length} files</div>
                  <div>Modified: {chamber.builderOutput.modifiedFiles.length} files</div>
                  <div>Deleted: {chamber.builderOutput.deletedFiles.length} files</div>
                  {chamber.commitId && <div>Commit: {chamber.commitId}</div>}
                </div>
                <div className="build-logs">
                  <strong>Build Logs:</strong>
                  <pre>
                    {chamber.builderOutput.buildLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </pre>
                </div>
              </>
            )}
          </div>

          {/* Javari Thoughts */}
          <div className="result-section observer">
            <h2>🧠 Javari Thoughts</h2>
            {chamber.javariThoughts && (
              <>
                <div className="patterns">
                  <strong>Patterns Learned: {chamber.javariThoughts.patternsLearned.length}</strong>
                  <ul>
                    {chamber.javariThoughts.patternsLearned.map((pattern, i) => (
                      <li key={i}>
                        {pattern.description} ({Math.round(pattern.confidence * 100)}% confidence)
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="automations">
                  <strong>Future Automations: {chamber.javariThoughts.futureAutomations.length}</strong>
                  <ul>
                    {chamber.javariThoughts.futureAutomations.map((auto, i) => (
                      <li key={i}>
                        {auto.trigger}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="insights">
                  <strong>Insights:</strong>
                  <ul>
                    {chamber.javariThoughts.insights.map((insight, i) => (
                      <li key={i}>
                        <strong>{insight.category}:</strong> {insight.observation}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {chamber.error && (
        <div className="chamber-error">
          <h3>Error</h3>
          <p>{chamber.error}</p>
        </div>
      )}

      <style jsx>{`
        .chamber-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        .chamber-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .chamber-header h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .chamber-input {
          margin-bottom: 24px;
        }

        .chamber-input textarea {
          width: 100%;
          padding: 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          margin-bottom: 12px;
        }

        .chamber-input button {
          width: 100%;
          padding: 16px;
          background: #635bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .chamber-input button:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        .chamber-progress {
          margin-bottom: 24px;
          text-align: center;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill {
          height: 100%;
          background: #635bff;
          transition: width 0.3s;
        }

        .chamber-results {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .result-section {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
        }

        .result-section h2 {
          margin-bottom: 16px;
          font-size: 20px;
          font-weight: 600;
        }

        .architect {
          border-color: #3b82f6;
        }

        .builder {
          border-color: #10b981;
        }

        .observer {
          border-color: #f59e0b;
        }

        .build-logs pre {
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 13px;
        }

        .chamber-error {
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 8px;
          padding: 16px;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}
