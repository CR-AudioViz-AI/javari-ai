/**
 * JAVARI AI - PROVIDER STATUS API
 * Check provider health, list available models
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProviderManager } from '@/lib/provider-manager';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all providers
    const { data: providers } = await supabase
      .from('javari_providers')
      .select('*')
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    // Get all models
    const { data: models } = await supabase
      .from('javari_provider_models')
      .select('*')
      .eq('is_enabled', true)
      .order('context_window', { ascending: false });

    // Get provider health
    const providerManager = getProviderManager();
    const healthStatus = await providerManager.getAllProviderStatus();

    // Get recent performance
    const { data: performance } = await supabase
      .from('javari_provider_performance')
      .select('*')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    return NextResponse.json({
      providers,
      models,
      healthStatus,
      performance,
    });

  } catch (error: unknown) {
    logError('Provider status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
