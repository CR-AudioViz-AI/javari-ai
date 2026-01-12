// lib/javari-tool-registry.ts
// Tool Registry and Interface for Javari autonomous capabilities

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  enabled: () => boolean;
  execute: (params: any) => Promise<ToolResult>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    if (!tool.enabled()) {
      return {
        success: false,
        error: `Tool '${name}' is disabled. Enable the feature flag or check configuration.`,
      };
    }

    // Check cache
    const cacheKey = `${name}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return {
        success: true,
        data: cached.data,
        cached: true,
      };
    }

    // Execute tool
    const result = await tool.execute(params);

    // Cache successful results
    if (result.success && result.data) {
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  listTools(): Array<{ name: string; description: string; enabled: boolean }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      enabled: tool.enabled(),
    }));
  }

  clearCache() {
    this.cache.clear();
  }
}

// Global tool registry
export const toolRegistry = new ToolRegistry();
