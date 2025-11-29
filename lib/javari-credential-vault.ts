// lib/javari-credential-vault.ts
// Secure credential management for Javari AI
// Timestamp: 2025-11-30 04:00 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CredentialTemplate {
  service_name: string;
  service_type: string;
  display_name: string;
  description: string;
  signup_url: string;
  api_keys_url: string;
  required_fields: {
    name: string;
    label: string;
    type: 'text' | 'secret';
    prefix?: string;
  }[];
  setup_steps: {
    step: number;
    title: string;
    description: string;
  }[];
}

export interface StoredCredential {
  id: string;
  service_name: string;
  service_type: string;
  environment: string;
  label: string;
  is_active: boolean;
  is_verified: boolean;
  last_used_at: string | null;
  use_count: number;
}

export class CredentialVault {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get all available credential templates
   */
  async getTemplates(): Promise<CredentialTemplate[]> {
    const { data, error } = await supabase
      .from('credential_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get setup instructions for a specific service
   */
  async getSetupGuide(serviceName: string): Promise<CredentialTemplate | null> {
    const { data, error } = await supabase
      .from('credential_templates')
      .select('*')
      .eq('service_name', serviceName)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Generate step-by-step setup instructions for a service
   */
  async generateSetupInstructions(serviceName: string): Promise<string> {
    const template = await this.getSetupGuide(serviceName);
    if (!template) {
      return `I don't have setup instructions for ${serviceName} yet. What service are you trying to connect?`;
    }

    let instructions = `## Setting up ${template.display_name}\n\n`;
    instructions += `${template.description}\n\n`;
    instructions += `### Steps:\n\n`;

    for (const step of template.setup_steps) {
      instructions += `**${step.step}. ${step.title}**\n`;
      instructions += `${step.description}\n\n`;
    }

    if (template.signup_url) {
      instructions += `📝 Sign up: ${template.signup_url}\n`;
    }
    if (template.api_keys_url) {
      instructions += `🔑 Get API keys: ${template.api_keys_url}\n`;
    }

    instructions += `\n### What I need from you:\n`;
    for (const field of template.required_fields) {
      instructions += `- **${field.label}**${field.prefix ? ` (starts with ${field.prefix})` : ''}\n`;
    }

    instructions += `\nOnce you have these, paste them here and I'll securely store them for you.`;

    return instructions;
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(
    serviceName: string,
    credentials: Record<string, string>,
    label?: string,
    environment: string = 'production'
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate against template
      const template = await this.getSetupGuide(serviceName);
      if (!template) {
        return { success: false, message: `Unknown service: ${serviceName}` };
      }

      // Check required fields
      for (const field of template.required_fields) {
        if (!credentials[field.name]) {
          return { success: false, message: `Missing required field: ${field.label}` };
        }
        // Validate prefix if specified
        if (field.prefix && !credentials[field.name].startsWith(field.prefix)) {
          return { 
            success: false, 
            message: `${field.label} should start with "${field.prefix}". Please check you copied the correct key.` 
          };
        }
      }

      // Store encrypted (Supabase handles encryption with pgcrypto)
      const { error } = await supabase
        .from('credential_vault')
        .upsert({
          user_id: this.userId,
          service_name: serviceName,
          service_type: template.service_type,
          environment,
          credential_data: credentials,
          label: label || `${template.display_name} (${environment})`,
          is_active: true,
          is_verified: false,
        }, {
          onConflict: 'user_id,service_name,environment'
        });

      if (error) throw error;

      return { 
        success: true, 
        message: `✅ ${template.display_name} credentials stored securely! Want me to test the connection?` 
      };
    } catch (error) {
      console.error('Error storing credentials:', error);
      return { success: false, message: 'Failed to store credentials. Please try again.' };
    }
  }

  /**
   * Retrieve credentials for a service (only for authorized API calls)
   */
  async getCredentials(serviceName: string, environment: string = 'production'): Promise<Record<string, string> | null> {
    const { data, error } = await supabase
      .from('credential_vault')
      .select('credential_data')
      .eq('user_id', this.userId)
      .eq('service_name', serviceName)
      .eq('environment', environment)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    // Log usage
    await this.logUsage(serviceName, environment, 'retrieved');

    return data.credential_data;
  }

  /**
   * List all stored credentials (without secrets)
   */
  async listCredentials(): Promise<StoredCredential[]> {
    const { data, error } = await supabase
      .rpc('get_credential_summary', { p_user_id: this.userId });

    if (error) throw error;
    return data || [];
  }

  /**
   * Verify credentials work
   */
  async verifyCredentials(serviceName: string): Promise<{ success: boolean; message: string }> {
    const credentials = await this.getCredentials(serviceName);
    if (!credentials) {
      return { success: false, message: `No ${serviceName} credentials found. Want me to help you set them up?` };
    }

    try {
      let verified = false;
      let message = '';

      switch (serviceName) {
        case 'stripe':
          verified = await this.verifyStripe(credentials);
          message = verified ? '✅ Stripe connected! I can now create invoices, subscriptions, and more.' : '❌ Stripe verification failed. Check your API key.';
          break;
        
        case 'openai':
          verified = await this.verifyOpenAI(credentials);
          message = verified ? '✅ OpenAI connected! AI capabilities are ready.' : '❌ OpenAI verification failed. Check your API key.';
          break;
        
        case 'github':
          verified = await this.verifyGitHub(credentials);
          message = verified ? '✅ GitHub connected! I can now manage repos and deployments.' : '❌ GitHub verification failed. Check your token.';
          break;
        
        case 'vercel':
          verified = await this.verifyVercel(credentials);
          message = verified ? '✅ Vercel connected! Ready to deploy.' : '❌ Vercel verification failed. Check your token.';
          break;

        default:
          return { success: false, message: `Verification not implemented for ${serviceName}` };
      }

      // Update verification status
      await supabase
        .from('credential_vault')
        .update({ 
          is_verified: verified, 
          last_verified_at: new Date().toISOString(),
          verification_error: verified ? null : message
        })
        .eq('user_id', this.userId)
        .eq('service_name', serviceName);

      return { success: verified, message };
    } catch (error) {
      console.error('Verification error:', error);
      return { success: false, message: 'Verification failed due to an error.' };
    }
  }

  /**
   * Delete credentials
   */
  async deleteCredentials(serviceName: string): Promise<boolean> {
    const { error } = await supabase
      .from('credential_vault')
      .delete()
      .eq('user_id', this.userId)
      .eq('service_name', serviceName);

    return !error;
  }

  // Private verification methods
  private async verifyStripe(credentials: Record<string, string>): Promise<boolean> {
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${credentials.secret_key}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async verifyOpenAI(credentials: Record<string, string>): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${credentials.api_key}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async verifyGitHub(credentials: Record<string, string>): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${credentials.token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async verifyVercel(credentials: Record<string, string>): Promise<boolean> {
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: { 'Authorization': `Bearer ${credentials.token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async logUsage(serviceName: string, environment: string, action: string): Promise<void> {
    // Log to credential_usage_log
    const { data: credential } = await supabase
      .from('credential_vault')
      .select('id')
      .eq('user_id', this.userId)
      .eq('service_name', serviceName)
      .eq('environment', environment)
      .single();

    if (credential) {
      await supabase.rpc('log_credential_usage', {
        p_credential_id: credential.id,
        p_action: action,
        p_endpoint: null,
        p_success: true
      });
    }
  }
}

// =====================================================
// CREDENTIAL DETECTION IN CONVERSATIONS
// =====================================================

export function detectCredentialInMessage(message: string): {
  detected: boolean;
  service?: string;
  credentials?: Record<string, string>;
} {
  const patterns = [
    { service: 'stripe', patterns: [/sk_(?:live|test)_[a-zA-Z0-9]{24,}/, /pk_(?:live|test)_[a-zA-Z0-9]{24,}/] },
    { service: 'openai', patterns: [/sk-[a-zA-Z0-9]{48,}/] },
    { service: 'github', patterns: [/ghp_[a-zA-Z0-9]{36,}/] },
    { service: 'vercel', patterns: [/[a-zA-Z0-9]{24}/] }, // Vercel tokens are less distinctive
    { service: 'anthropic', patterns: [/sk-ant-[a-zA-Z0-9-]{90,}/] },
    { service: 'supabase', patterns: [/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/] }, // JWT pattern
  ];

  for (const { service, patterns: servicePatterns } of patterns) {
    for (const pattern of servicePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          detected: true,
          service,
          credentials: { detected_key: match[0] }
        };
      }
    }
  }

  return { detected: false };
}

// =====================================================
// SMART CREDENTIAL REQUEST HANDLING
// =====================================================

export async function handleCredentialRequest(
  message: string,
  userId: string
): Promise<{ handled: boolean; response?: string }> {
  const vault = new CredentialVault(userId);
  const messageLower = message.toLowerCase();

  // Check if user is asking to connect/setup a service
  const setupPatterns = [
    { pattern: /connect(?:ing)?\s+(?:my\s+)?stripe/i, service: 'stripe' },
    { pattern: /set\s*up\s+(?:my\s+)?stripe/i, service: 'stripe' },
    { pattern: /add\s+(?:my\s+)?stripe/i, service: 'stripe' },
    { pattern: /connect(?:ing)?\s+(?:my\s+)?paypal/i, service: 'paypal' },
    { pattern: /connect(?:ing)?\s+(?:my\s+)?github/i, service: 'github' },
    { pattern: /connect(?:ing)?\s+(?:my\s+)?vercel/i, service: 'vercel' },
    { pattern: /connect(?:ing)?\s+(?:my\s+)?openai/i, service: 'openai' },
    { pattern: /connect(?:ing)?\s+(?:my\s+)?supabase/i, service: 'supabase' },
    { pattern: /accept\s+payments/i, service: 'stripe' },
    { pattern: /take\s+(?:credit\s+)?cards?/i, service: 'stripe' },
  ];

  for (const { pattern, service } of setupPatterns) {
    if (pattern.test(message)) {
      const instructions = await vault.generateSetupInstructions(service);
      return { handled: true, response: instructions };
    }
  }

  // Check if user pasted credentials
  const detected = detectCredentialInMessage(message);
  if (detected.detected && detected.service && detected.credentials) {
    // Don't echo back the credential!
    const result = await vault.storeCredentials(
      detected.service,
      detected.credentials
    );
    return { handled: true, response: result.message };
  }

  // Check if asking about connected services
  if (/what(?:'s|\s+is)\s+connected/i.test(message) || /my\s+connections/i.test(message)) {
    const creds = await vault.listCredentials();
    if (creds.length === 0) {
      return { 
        handled: true, 
        response: "You don't have any services connected yet. I can help you set up:\n\n- **Stripe** - Accept payments\n- **PayPal** - Alternative payments\n- **GitHub** - Code repositories\n- **Vercel** - Deployments\n- **OpenAI** - AI capabilities\n\nWhich would you like to connect?" 
      };
    }
    
    let response = "Here's what you have connected:\n\n";
    for (const cred of creds) {
      const status = cred.is_verified ? '✅' : '⚠️';
      response += `${status} **${cred.service_name}** (${cred.environment})`;
      if (cred.last_used_at) {
        response += ` - Last used: ${new Date(cred.last_used_at).toLocaleDateString()}`;
      }
      response += '\n';
    }
    return { handled: true, response };
  }

  return { handled: false };
}

export default CredentialVault;
