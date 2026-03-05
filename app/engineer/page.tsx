'use client';

import { useState } from 'react';

export default function EngineerPage() {
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

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1>Javari Engineering Console</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              runCommand();
            }
          }}
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
        overflowX: 'auto',
      }}>
        {output || 'Output will appear here...'}
      </div>
    </div>
  );
}
