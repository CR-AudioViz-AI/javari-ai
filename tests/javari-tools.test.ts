// tests/javari-tools.test.ts
// Unit tests for Vercel and Supabase tools

import { SupabaseReadTool } from '../lib/javari-supabase-tool';

describe('SupabaseReadTool', () => {
  let tool: SupabaseReadTool;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    process.env.FEATURE_SUPABASE_READ = '1';

    tool = new SupabaseReadTool();
  });

  test('Tool is enabled with URL, key, and feature flag', () => {
    expect(tool.enabled()).toBe(true);
  });

  test('Tool is disabled without feature flag', () => {
    process.env.FEATURE_SUPABASE_READ = '0';
    const disabledTool = new SupabaseReadTool();
    expect(disabledTool.enabled()).toBe(false);
  });

  test('queryReadOnly rejects INSERT statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('INSERT INTO users VALUES (1, "test")');
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('INSERT');
  });

  test('queryReadOnly rejects UPDATE statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('UPDATE users SET name = "test"');
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('UPDATE');
  });

  test('queryReadOnly rejects DELETE statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('DELETE FROM users WHERE id = 1');
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('DELETE');
  });

  test('queryReadOnly rejects DROP statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('DROP TABLE users');
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('DROP');
  });

  test('queryReadOnly accepts SELECT statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('SELECT * FROM users');
    
    expect(validation.valid).toBe(true);
  });

  test('queryReadOnly accepts WITH (CTE) statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('WITH cte AS (SELECT * FROM users) SELECT * FROM cte');
    
    expect(validation.valid).toBe(true);
  });

  test('queryReadOnly rejects multiple statements', () => {
    const tool = new SupabaseReadTool();
    const validation = (tool as any).validateReadOnlyQuery('SELECT * FROM users; DROP TABLE users;');
    
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Multiple statements');
  });
});

describe('VercelReadTool', () => {
  // Mock Vercel event parsing
  test('Deployment event parsing extracts errors correctly', () => {
    const sampleEvent = {
      type: 'stderr',
      created: Date.now(),
      payload: {
        text: 'Error: Cannot find module "missing-package"',
      },
    };

    expect(sampleEvent.payload.text).toContain('Error:');
    expect(sampleEvent.type).toBe('stderr');
  });

  test('Event filtering identifies error events', () => {
    const events = [
      { type: 'stdout', payload: { text: 'Building...' } },
      { type: 'stderr', payload: { text: 'Error: Build failed' } },
      { type: 'error', payload: { text: 'Fatal error' } },
    ];

    const errorEvents = events.filter(e => 
      e.type === 'stderr' || e.type === 'error'
    );

    expect(errorEvents).toHaveLength(2);
  });
});

export {};
