/**
 * JAVARI AI - PROVIDER STATUS API
 * Check provider health, list available models
 * FIXED: Removed call to non-existent getAllProviderStatus method
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/utils/error-utils';

// Health check function - tests if provider API key exists and is valid format
function checkProviderHealth(): Record<string, { status: string; available: boolean; reason?: string }> {
  const healthStatus: Record<string, { status: string; available: boolean; reason?: string }> = {};

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  healthStatus['openai'] = {
    status: openaiKey && openaiKey.startsWith('sk-') ? 'healthy' : 'unavailable',
    available: Boolean(openaiKey && openaiKey.startsWith('sk-')),
    reason: !openaiKey ? 'API key not configured' : undefined,
  };

  // Claude (Anthropic)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  healthStatus['claude'] = {
    status: anthropicKey && anthropicKey.startsWith('sk-ant-') ? 'healthy' : 'unavailable',
    available: Boolean(anthropicKey && anthropicKey.startsWith('sk-ant-')),
    reason: !anthropicKey ? 'API key not configured' : undefined,
  };

  // Gemini (Google)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  healthStatus['gemini'] = {
    status: geminiKey ? 'healthy' : 'unavailable',
    available: Boolean(geminiKey),
    reason: !geminiKey ? 'API key not configured' : undefined,
  };

  // Mistral
  const mistralKey = process.env.MISTRAL_API_KEY;
  healthStatus['mistral'] = {
    status: mistralKey ? 'healthy' : 'unavailable',
    available: Boolean(mistralKey),
    reason: !mistralKey ? 'API key not configured' : undefined,
  };

  // Perplexity
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  healthStatus['perplexity'] = {
    status: perplexityKey ? 'healthy' : 'unavailable',
    available: Boolean(perplexityKey),
    reason: !perplexityKey ? 'API key not configured' : undefined,
  };

  return healthStatus;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all providers from database
    const { data: providers, error: providersError } = await supabase
      .from('javari_providers')
      .select('*')
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    // Get all models from database
    const { data: models, error: modelsError } = await supabase
      .from('javari_provider_models')
      .select('*')
      .eq('is_enabled', true)
      .order('context_window', { ascending: false });

    // Get provider health status (local check, no external calls during build)
    const healthStatus = checkProviderHealth();

    // Get recent performance metrics
    const { data: performance } = await supabase
      .from('javari_provider_performance')
      .select('*')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    return NextResponse.json({
      providers: providers || [],
      models: models || [],
      healthStatus,
      performance: performance || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error: unknown) {
    logError('Provider status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch provider status',
        providers: [],
        models: [],
        healthStatus: {},
        performance: [],
      }, 
      { status: 500 }
    );
  }
}
