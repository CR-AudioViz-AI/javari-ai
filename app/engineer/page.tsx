'use client';

import { useState } from 'react';

export default function EngineerConsole() {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    
    setLoading(true);
    setOutput('Running command...\n');

    try {
      const res = await fetch('/api/engineer/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      const data = await res.json();
      
      if (data.ok) {
        setOutput(`$ ${command}\n\n${data.stdout || ''}${data.stderr || ''}`);
      } else {
        setOutput(`Error: ${data.error}\n${data.stderr || ''}`);
      }
    } catch (err: any) {
      setOutput(`Failed to execute: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      runCommand();
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Javari Engineering Console</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter command (Ctrl+Enter to run)"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        onClick={runCommand}
        disabled={loading || !command.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        {loading ? 'Running...' : 'Run Command'}
      </button>

      <div style={{
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '20px',
        borderRadius: '4px',
        minHeight: '400px',
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: '1.5',
        overflowX: 'auto',
      }}>
        {output || 'Output will appear here...'}
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <strong>Quick commands:</strong>
        <ul style={{ marginTop: '5px' }}>
          <li>git status</li>
          <li>git log --oneline -5</li>
          <li>vercel ls</li>
          <li>node --version</li>
          <li>ls -la</li>
        </ul>
      </div>
    </div>
  );
}
