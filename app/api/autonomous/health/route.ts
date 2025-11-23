// app/api/autonomous/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL;
const VERCEL_MCP_URL = process.env.VERCEL_MCP_URL;
const FILESYSTEM_MCP_URL = process.env.FILESYSTEM_MCP_URL;
const MCP_API_KEY = process.env.MCP_API_KEY;

export async function GET(request: NextRequest) {
  const mcpHeaders = {
    'x-api-key': MCP_API_KEY,
  };

  const checkHealth = async (name: string, url: string) => {
    try {
      const response = await axios.get(`${url}/health`, {
        headers: mcpHeaders,
        timeout: 5000,
      });
      return {
        name,
        status: 'healthy',
        url,
        data: response.data,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const results = await Promise.all([
    checkHealth('GitHub MCP', GITHUB_MCP_URL!),
    checkHealth('Vercel MCP', VERCEL_MCP_URL!),
    checkHealth('File System MCP', FILESYSTEM_MCP_URL!),
  ]);

  const allHealthy = results.every(r => r.status === 'healthy');

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    servers: results,
    timestamp: new Date().toISOString(),
  });
}
