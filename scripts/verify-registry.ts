#!/usr/bin/env node
/**
 * verify-registry.ts
 * Verify model registry externalization
 * Execute via: npx tsx scripts/verify-registry.ts
 * Date: 2025-03-01
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verify() {
  console.log('🔍 Verifying model registry externalization...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // 1. Check table exists
  console.log('1️⃣  Checking model_registry table...');
  const { data: tables, error: tableError } = await supabase
    .from('model_registry')
    .select('count')
    .limit(1);
  
  if (tableError) {
    console.error('❌ Table check failed:', tableError.message);
    console.log('   Run migration: npx tsx scripts/migrate-model-registry.ts');
    process.exit(1);
  }
  console.log('✅ Table exists\n');
  
  // 2. Count models
  console.log('2️⃣  Counting models...');
  const { count: totalCount } = await supabase
    .from('model_registry')
    .select('*', { count: 'exact', head: true });
  
  const { count: enabledCount } = await supabase
    .from('model_registry')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true);
  
  console.log(`   Total models: ${totalCount || 0}`);
  console.log(`   Enabled: ${enabledCount || 0}\n`);
  
  if ((enabledCount || 0) === 0) {
    console.error('❌ No enabled models found');
    console.log('   Run seed: npx tsx scripts/migrate-model-registry.ts');
    process.exit(1);
  }
  
  // 3. List providers
  console.log('3️⃣  Listing providers...');
  const { data: models } = await supabase
    .from('model_registry')
    .select('provider, model, reasoning, json_reliability, code_quality, cost_tier, enabled')
    .eq('enabled', true)
    .order('provider');
  
  if (!models || models.length === 0) {
    console.error('❌ Could not retrieve models');
    process.exit(1);
  }
  
  const providers = new Map<string, number>();
  models.forEach((m: any) => {
    providers.set(m.provider, (providers.get(m.provider) || 0) + 1);
  });
  
  console.log('   Providers:');
  Array.from(providers.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([provider, count]) => {
      console.log(`     - ${provider}: ${count} model${count > 1 ? 's' : ''}`);
    });
  console.log();
  
  // 4. Show capability distribution
  console.log('4️⃣  Capability distribution...');
  const reasoning5 = models.filter((m: any) => m.reasoning === 5).length;
  const reasoning4 = models.filter((m: any) => m.reasoning === 4).length;
  const json5 = models.filter((m: any) => m.json_reliability === 5).length;
  const json4 = models.filter((m: any) => m.json_reliability === 4).length;
  const code5 = models.filter((m: any) => m.code_quality === 5).length;
  const code4 = models.filter((m: any) => m.code_quality === 4).length;
  
  console.log(`   Reasoning (5): ${reasoning5}, (4): ${reasoning4}`);
  console.log(`   JSON (5): ${json5}, (4): ${json4}`);
  console.log(`   Code (5): ${code5}, (4): ${code4}\n`);
  
  // 5. Cost tier breakdown
  console.log('5️⃣  Cost tier breakdown...');
  const free = models.filter((m: any) => m.cost_tier === 'free').length;
  const low = models.filter((m: any) => m.cost_tier === 'low').length;
  const moderate = models.filter((m: any) => m.cost_tier === 'moderate').length;
  const expensive = models.filter((m: any) => m.cost_tier === 'expensive').length;
  
  console.log(`   Free: ${free}, Low: ${low}, Moderate: ${moderate}, Expensive: ${expensive}\n`);
  
  // 6. Sample telemetry
  console.log('6️⃣  Checking telemetry schema...');
  const { data: executions } = await supabase
    .from('ai_router_executions')
    .select('provider, model, success, registry_version, routing_version')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (executions && executions.length > 0) {
    const ex = executions[0];
    console.log('   Latest execution:');
    console.log(`     Provider: ${ex.provider}`);
    console.log(`     Model: ${ex.model || 'N/A'}`);
    console.log(`     Success: ${ex.success}`);
    console.log(`     Registry Version: ${ex.registry_version || 'N/A'}`);
    console.log(`     Routing Version: ${ex.routing_version || 'N/A'}`);
  } else {
    console.log('   No executions yet');
  }
  console.log();
  
  // 7. Model list
  console.log('7️⃣  Model registry:');
  models.forEach((m: any) => {
    const caps = `R${m.reasoning} J${m.json_reliability} C${m.code_quality}`;
    console.log(`   ${m.provider.padEnd(12)} ${m.model.padEnd(35)} ${caps} [${m.cost_tier}]`);
  });
  console.log();
  
  console.log('✅ Model registry verification complete!');
  console.log(`📊 ${enabledCount} models ready for routing`);
}

verify().catch((err) => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
