// lib/javari-tools-init.ts
// Initialize and register all Javari tools

import { toolRegistry } from './javari-tool-registry';
import { githubReadTool } from './javari-github-tool';

// Register all tools
export function initializeTools() {
  toolRegistry.registerTool(githubReadTool);
  
  console.log('[Javari Tools] Initialized:', toolRegistry.listTools());
}

// Auto-initialize on import
initializeTools();

export { toolRegistry };
