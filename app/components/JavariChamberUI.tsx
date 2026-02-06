/**
 * MULTI-AI CHAMBER UI
 * 
 * Interactive interface for ChatGPT + Claude + Javari collaboration
 * Fixed: Enter key submission, JSON payload, loading states, error display
 */

'use client';

import { useState } from 'react';

export default function JavariChamberUI() {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!goal.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('sb-ocuaxglzgaswsjqlhlnc-auth-token');
      if (!token) {
        throw new Error('Please log in first');
      }

      const response = await fetch('/api/chamber/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(token).access_token}`,
        },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Chamber execution failed');
      }

      setResult(data);
      console.log('Chamber Result:', data);
      
    } catch (err: any) {
      console.error('Chamber Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '40px auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        Multi-AI Chamber
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        ChatGPT (Architect) + Claude (Builder) + Javari (Observer)
      </p>

      {/* Input Section */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ 
          display: 'block', 
          fontWeight: '600', 
          marginBottom: '8px' 
        }}>
          Build Goal
        </label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Example: Create a simple counter component with increment, decrement, and reset buttons"
          disabled={loading}
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            resize: 'vertical',
            fontFamily: 'inherit',
            opacity: loading ? 0.6 : 1,
          }}
        />
        <p style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginTop: '6px' 
        }}>
          Press Enter to submit, Shift+Enter for new line
        </p>

        <button
          onClick={handleSubmit}
          disabled={loading || !goal.trim()}
          style={{
            marginTop: '12px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: loading || !goal.trim() ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || !goal.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Executing Chamber...' : 'Execute Chamber'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0070f3',
          borderRadius: '6px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, color: '#0070f3' }}>
            🔄 Chamber executing... This may take 30-90 seconds.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '20px',
          backgroundColor: '#fff0f0',
          border: '1px solid #ff4444',
          borderRadius: '6px',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#ff4444' }}>
            ❌ Error
          </h3>
          <pre style={{ 
            margin: 0, 
            fontSize: '13px', 
            whiteSpace: 'pre-wrap',
            color: '#333',
          }}>
            {error}
          </pre>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
            ✅ Chamber Results
          </h2>

          {/* Architect Output */}
          {result.architect_output && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #0070f3',
              borderRadius: '6px',
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0070f3' }}>
                🏗️ Architect (ChatGPT)
              </h3>
              <div style={{ fontSize: '13px' }}>
                <p><strong>Reasoning:</strong> {result.architect_output.reasoning}</p>
                {result.architect_output.buildPlan && (
                  <div>
                    <strong>Build Plan:</strong>
                    <pre style={{ 
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                    }}>
                      {result.architect_output.buildPlan}
                    </pre>
                  </div>
                )}
                {result.architect_output.buildCommands && (
                  <p><strong>Commands:</strong> {result.architect_output.buildCommands.length} operations</p>
                )}
              </div>
            </div>
          )}

          {/* Builder Output */}
          {result.build_result && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f0fff4',
              border: '1px solid #10b981',
              borderRadius: '6px',
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#10b981' }}>
                🔨 Builder (Claude)
              </h3>
              <div style={{ fontSize: '13px' }}>
                <p><strong>Status:</strong> {result.build_result.ok ? '✅ Success' : '❌ Failed'}</p>
                {result.build_result.commitId && (
                  <p><strong>Commit ID:</strong> <code>{result.build_result.commitId}</code></p>
                )}
                {result.build_result.modifiedFiles && result.build_result.modifiedFiles.length > 0 && (
                  <p><strong>Modified:</strong> {result.build_result.modifiedFiles.join(', ')}</p>
                )}
                {result.build_result.createdFiles && result.build_result.createdFiles.length > 0 && (
                  <p><strong>Created:</strong> {result.build_result.createdFiles.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Javari Thoughts */}
          {result.observation_result && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#fff7ed',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#f59e0b' }}>
                🧠 Javari (Observer)
              </h3>
              <div style={{ fontSize: '13px' }}>
                {result.observation_result.patternsLearned && result.observation_result.patternsLearned.length > 0 && (
                  <div>
                    <strong>Patterns Learned:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      {result.observation_result.patternsLearned.map((p: any, i: number) => (
                        <li key={i}>{p.pattern_type}: {p.description}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.observation_result.futureAutomations && result.observation_result.futureAutomations.length > 0 && (
                  <div>
                    <strong>Future Automations:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      {result.observation_result.futureAutomations.map((a: any, i: number) => (
                        <li key={i}>{a.trigger}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Response (for debugging) */}
          <details style={{ marginTop: '20px' }}>
            <summary style={{ 
              cursor: 'pointer', 
              fontWeight: '600',
              padding: '8px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
            }}>
              🔍 Raw Response (Debug)
            </summary>
            <pre style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '11px',
              overflow: 'auto',
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
