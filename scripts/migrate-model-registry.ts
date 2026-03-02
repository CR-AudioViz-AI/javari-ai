/**
 * migrate-model-registry.ts
 * Database migration: Create and seed model_registry table
 * Execute via: npx tsx migrate-model-registry.ts
 * Date: 2025-03-01
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function migrate() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('🔧 Starting model_registry migration...');
  
  // Read SQL files
  const createSQL = fs.readFileSync(
    path.join(__dirname, 'create_model_registry.sql'),
    'utf8'
  );
  const seedSQL = fs.readFileSync(
    path.join(__dirname, 'seed_model_registry.sql'),
    'utf8'
  );
  
  try {
    // Step 1: Create table
    console.log('📋 Creating model_registry table...');
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_query: createSQL
    });
    
    if (createError) {
      console.error('✗ Table creation failed:', createError);
      process.exit(1);
    }
    console.log('✓ Table created');
    
    // Step 2: Seed data
    console.log('🌱 Seeding 11 models...');
    const { error: seedError } = await supabase.rpc('exec_sql', {
      sql_query: seedSQL
    });
    
    if (seedError) {
      console.error('✗ Seed failed:', seedError);
      process.exit(1);
    }
    console.log('✓ Models seeded');
    
    // Step 3: Verify
    const { data: models, error: verifyError } = await supabase
      .from('model_registry')
      .select('provider, model, enabled')
      .eq('enabled', true);
    
    if (verifyError) {
      console.error('✗ Verification failed:', verifyError);
      process.exit(1);
    }
    
    console.log(`✓ Verified ${models?.length || 0} enabled models`);
    console.log('Models:', models?.map(m => `${m.provider}/${m.model}`).join(', '));
    
    console.log('🎉 Migration complete');
  } catch (err) {
    console.error('✗ Migration exception:', err);
    process.exit(1);
  }
}

migrate();
