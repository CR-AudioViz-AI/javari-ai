/**
 * JAVARI VAULT AUTO-REGISTRATION SYSTEM
 * 
 * HOW IT WORKS:
 * 1. You set a new env var in ANY Vercel project OR paste a key in chat
 * 2. This system automatically:
 *    a. Adds it to the vault's known providers (PROVIDER_ENV_MAP)
 *    b. Syncs it to all relevant Vercel projects
 *    c. Logs it permanently to Supabase vault_registry table
 *    d. Never loses it again
 * 
 * USAGE:
 *   // Register a new key immediately
 *   import { autoRegister } from '@/lib/javari/secrets/auto-register'
 *   await autoRegister.add('DEEPSEEK_API_KEY', 'sk-abc123...')
 * 
 *   // Sync new key discovered in code to all projects
 *   await autoRegister.syncToAllProjects('NEW_PROVIDER_API_KEY', 'value')
 * 
 *   // Called automatically by /api/javari/credentials/register endpoint
 */

import { createClient } from '@supabase/supabase-js';
import { vault, PROVIDER_ENV_MAP } from './vault';

const VERCEL_TOKEN = () => vault.assert('vercel');
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// All 50 Vercel project IDs — auto-populated at build time
const ALL_PROJECT_IDS = [
  'prj_zxjzE2qvMWFWqV0AspGvago6aPV5', // javari-ai (PRIMARY)
  'prj_4rtSMvFf9vpjYYFwkVlODVwDsd9Z', // javariverse
  'prj_fmk3PLscIPrcAseKwhjCMBglH8C4', // craudiovizai
  'prj_3D7Br1WIln6vf8JwGVgA2Sx02564', // javari-omni-media
  'prj_nenwxAck4Yq7U5IeWt8ZhGATVo4i', // javari-tv
  'prj_nhIQWo7EeDxCXqbr6SaPUYLArlN4', // javari-verify
  'prj_o7wucpZchKDokDa9WgmCRz8lGDNS', // javari-lgbtq
  'prj_BF1scLPAvLjCcSiuTIf1X8Jnlny1', // javari-engineering-os
  'prj_EGzNrIWyAufIm9aj8PCA30CVkHeK', // javari-movie-audio
  'prj_FpCsUGkX81b8jGk3L5OgTjgyDxbR', // strategic-command
  'prj_cpevVpJnKRpPUIjBTX4jepGsNJ3f', // crav-asset-system-api
  'prj_QoJhMxDMTMB0yvbdZH2TeRGcg7sO', // javari-international
  'prj_6OclHw6l4YmRcMTYyAmVvrU9ME92', // javari-jewelry-journal
  'prj_BAK7HcXaD46F7wyuQ3iNSK025t2Q', // javari-luxury
  'prj_x1ExzOwyEK2KlBRO7mJLUMvD2lei', // javari-marvel-museum
  'prj_qloPP47g7EAMj3WHi2cpSziwz8aj', // javari-first-responders
  'prj_eUqf48ugLTei53xj7cJhyr7Riw5Q', // javari-merch
  'prj_VS6W7iDjddzwFOTf6EqGcluCPkps', // javari-doll-depot
  'prj_11mPHvRNzMt5LWpD5qC0SSTgd0ca', // javari-game-grotto
  'prj_xcbpraR6bUW2SSY4mgh2tMmMlgOD', // javari-gov-contracting
  'prj_orisXKkgd6umfexQTGi4UcbRvxAA', // javari-email-templates
  'prj_PqxvrfOJFl030dlK6kOMfQ1wegma', // javari-social-posts
  'prj_3Eesa2TX2Q57HeaAqTOOhvSCXDmf', // javari-resume-builder
  'prj_BzoeII6KL29X6hNa0rYbaKv2QBrx', // javari-presentation-maker
  'prj_miQYav10jTbh8owQKHs3STcOi95N', // javari-scraper
  'prj_v9baPC2LVlaig0qAilvanIYQqLJ4', // javari-instrument-inventory
  'prj_OxTUbeGO8QDtDLX5DJmwiwTtFg1T', // javari-hot-wheels-hub
  'prj_PGdwjvPR3q3HneNjYDnE5t9pCPNt', // javari-grants
  'prj_fMZ8HN20RAn1UhMmSGdYIV5ZjEhV', // javari-funko-files
  'prj_6lpLUKoO6Zs4ShKJN7SFc3HvM1tR', // javari-government
  'prj_bdDNUOBeLoaJRbflXrrGwNiv60qK', // javari-fossil-finder
  'prj_qoCLrts7H3QcLnos0hL5V9c2mkiH', // javari-energy
  'prj_8GnMlSQ0lq46L3ea0kneGcDMV7C7', // javari-legal
  'prj_mjt5BjoveAeU6BiW8rxKs1X0d5zL', // javari-hr-workforce
  'prj_qCtiWdLvSRANZqSS3hiCLb7oUuCp', // javari-home-services
  'prj_2A1d19pphVR1pnkSH8Dck5k3FV9d', // javari-faith-communities
  'prj_yhXYVl3mShY8CnbkYrHsduWumuvN', // javari-disability-access
  'prj_ZGoRBfDnZh5n4PF4FB0jvJkrXwUF', // javari-cybersecurity
  'prj_YEautyyTZIPItEFZp2PjuE0sGdIT', // javari-book-bunker
  'prj_QPVPjqDjb5Y1bZAdgWnUKDakg4Ef', // javari-antique-atlas
  'prj_qzOpqxWbjGaKO9WLyckzHZFQtuLS', // javari-manufacturing
  'prj_qh9sqvHrNbOvN031YHmE9l8lEk1S', // javari-insurance
  'prj_j7uAGxeSoOVeOWGcbCO4baABbkdQ', // javari-card-vault
  'prj_6uazkDGQrE1vSX1u0e0MKL0R1ZVD', // javari-animal-rescue
  'prj_3aZCemvkauDz5vrlCsn1SqPefUiP', // javari-sneaker-stash
  'prj_iyXHSWiBx2EXSF2213am1Hy2XXWL', // javari-sign-stash
  'prj_5eDQ8H7lPOKzmTn0B0WS9rYxgCfF', // javari-senior-living
  'prj_RfDgT1zzXt1HO6ArOvMhB6vb7kWV', // javari-pets
  'prj_6wKQ4PB5w5QsSqZTDFNEshnVunaD', // javari-pokemon-portfolio
  'prj_rgzy6jXs5war9D126ExB2jzIqWIZ', // javari-nonprofits
];

// Keys that should be pushed to ALL projects (universal)
const UNIVERSAL_KEYS = new Set([
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY',
  'PERPLEXITY_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY',
  'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE',
  'VERCEL_TOKEN', 'VERCEL_API_TOKEN', 'VERCEL_TEAM_ID',
  'GITHUB_WRITE_TOKEN', 'GH_PAT', 'GITHUB_TOKEN',
  'NEXTAUTH_SECRET', 'JWT_SECRET',
  'ELEVENLABS_API_KEY', 'RESEND_API_KEY',
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET',
  'CLOUDINARY_URL', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_CLOUD_NAME',
]);

interface RegisterResult {
  key: string;
  projectsUpdated: number;
  projectsFailed: number;
  supabaseLogged: boolean;
  timestamp: string;
}

class AutoRegistrationSystem {
  /**
   * Register a new credential and push to all relevant Vercel projects
   * This is the single entry point for ALL new keys going forward
   */
  async add(
    envVarName: string,
    value: string,
    options?: {
      projectIds?: string[];     // specific projects, defaults to UNIVERSAL_KEYS logic
      type?: 'encrypted' | 'plain';
      note?: string;             // e.g. "New Gemini key Jan 2026"
    }
  ): Promise<RegisterResult> {
    const token = VERCEL_TOKEN();
    const type = options?.type ?? 'encrypted';
    const timestamp = new Date().toISOString();
    
    // Determine which projects to update
    const targetProjects = options?.projectIds ??
      (UNIVERSAL_KEYS.has(envVarName) ? ALL_PROJECT_IDS : [ALL_PROJECT_IDS[0]]);

    let updated = 0;
    let failed = 0;

    // Push to all target Vercel projects in parallel batches of 10
    const batches = [];
    for (let i = 0; i < targetProjects.length; i += 10) {
      batches.push(targetProjects.slice(i, i + 10));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(projectId => this.upsertVercelEnvVar(token, projectId, envVarName, value, type))
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) updated++;
        else failed++;
      });
      // Avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    // Log to Supabase vault_registry
    let supabaseLogged = false;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? vault.get('supabase_url');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? vault.get('supabase_service');
      
      if (supabaseUrl && supabaseKey) {
        const sb = createClient(supabaseUrl, supabaseKey);
        await sb.from('vault_registry').upsert({
          env_var_name: envVarName,
          key_hint: `...${value.slice(-4)}`,
          projects_count: updated,
          note: options?.note ?? '',
          registered_at: timestamp,
          registered_by: 'auto-register',
        }, { onConflict: 'env_var_name' });
        supabaseLogged = true;
      }
    } catch {
      // Non-fatal — Vercel is the source of truth
    }

    // Invalidate vault cache
    vault.invalidateCache();

    return { key: envVarName, projectsUpdated: updated, projectsFailed: failed, supabaseLogged, timestamp };
  }

  /**
   * Register multiple credentials at once
   */
  async addBatch(
    credentials: Array<{ key: string; value: string; note?: string }>
  ): Promise<RegisterResult[]> {
    const results: RegisterResult[] = [];
    for (const cred of credentials) {
      const result = await this.add(cred.key, cred.value, { note: cred.note });
      results.push(result);
      console.log(`[AutoRegister] ${cred.key}: ${result.projectsUpdated} projects updated`);
    }
    return results;
  }

  private async upsertVercelEnvVar(
    token: string,
    projectId: string,
    key: string,
    value: string,
    type: string
  ): Promise<boolean> {
    try {
      // Try to find existing
      const listRes = await fetch(
        `https://api.vercel.com/v9/projects/${projectId}/env?teamId=${TEAM_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!listRes.ok) return false;
      
      const listData = await listRes.json() as { envs: Array<{ id: string; key: string }> };
      const existing = listData.envs?.find(e => e.key === key);
      
      const body = JSON.stringify({
        key,
        value,
        type,
        target: ['production', 'preview', 'development'],
      });

      if (existing) {
        const r = await fetch(
          `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}?teamId=${TEAM_ID}`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }
        );
        return r.ok;
      } else {
        const r = await fetch(
          `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${TEAM_ID}`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }
        );
        return r.ok;
      }
    } catch {
      return false;
    }
  }
}

export const autoRegister = new AutoRegistrationSystem();
export { ALL_PROJECT_IDS, UNIVERSAL_KEYS };
