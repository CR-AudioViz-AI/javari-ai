// tests/javari-github-tool.test.ts
// Unit tests for GitHub Read Tool

import { GitHubReadTool } from '../lib/javari-github-tool';

describe('GitHubReadTool', () => {
  let tool: GitHubReadTool;

  beforeEach(() => {
    // Mock environment variables
    process.env.GITHUB_READ_TOKEN = 'test-token';
    process.env.GITHUB_DEFAULT_OWNER = 'test-owner';
    process.env.GITHUB_DEFAULT_REPO = 'test-repo';
    process.env.GITHUB_DEFAULT_BRANCH = 'main';
    process.env.FEATURE_GITHUB_READ = '1';

    tool = new GitHubReadTool();
  });

  test('Tool is enabled with token and feature flag', () => {
    expect(tool.enabled()).toBe(true);
  });

  test('Tool is disabled without feature flag', () => {
    process.env.FEATURE_GITHUB_READ = '0';
    const disabledTool = new GitHubReadTool();
    expect(disabledTool.enabled()).toBe(false);
  });

  test('Tool is disabled without token', () => {
    delete process.env.GITHUB_READ_TOKEN;
    const tokenlessTool = new GitHubReadTool();
    expect(tokenlessTool.enabled()).toBe(false);
  });

  test('Base64 decoding works correctly', () => {
    // Test that Buffer.from base64 decode works
    const testContent = 'Hello, Javari!';
    const base64 = Buffer.from(testContent).toString('base64');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    
    expect(decoded).toBe(testContent);
  });

  test('Unknown action returns error', async () => {
    const result = await tool.execute({ action: 'unknown' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});

export {};
