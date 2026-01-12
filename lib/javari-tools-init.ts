// lib/javari-tools-init.ts
// Initialize and register all Javari tools (v3 with GitHub Write)

import { toolRegistry } from './javari-tool-registry';
import { githubReadTool } from './javari-github-tool';
import { githubWriteTool } from './javari-github-write-tool';
import { vercelReadTool } from './javari-vercel-tool';
import { supabaseReadTool } from './javari-supabase-tool';

// Register all tools
export function initializeTools() {
  toolRegistry.registerTool(githubReadTool);
  toolRegistry.registerTool(githubWriteTool);
  toolRegistry.registerTool(vercelReadTool);
  toolRegistry.registerTool(supabaseReadTool);
  
  console.log('[Javari Tools] Initialized:', toolRegistry.listTools());
}

// Auto-initialize on import
initializeTools();

export { toolRegistry };
