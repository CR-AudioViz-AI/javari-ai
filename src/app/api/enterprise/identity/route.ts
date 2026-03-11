import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { headers } from 'next/headers';
import Redis from 'ioredis';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const authenticateSchema = z.object({
  provider: z.enum(['active_directory', 'ldap', 'saml', 'oauth']),
  credentials: z.object({
    username: z.string().min(1),
    password: z.string().optional(),
    token: z.string().optional(),
    assertion: z.string().optional(),
  }),
  domain: z.string().optional(),
  mfa_token: z.string().optional(),
});

const provisionSchema = z.object({
  provider: z.string(),
  user_data: z.object({
    username: z.string(),
    email: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    groups: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional(),
  }),
});

const providerConfigSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['active_directory', 'ldap', 'saml', 'oauth']),
  config: z.object({
    server: z.string().optional(),
    port: z.number().optional(),
    base_dn: z.string().optional(),
    bind_dn: z.string().optional(),
    bind_password: z.string().optional(),
    certificate: z.string().optional(),
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
    redirect_uri: z.string().optional(),
    issuer: z.string().optional(),
  }),
  role_mappings: z.array(z.object({
    provider_group: z.string(),
    app_role: z.string(),
  })).optional(),
  mfa_required: z.boolean().default(false),
});

// Types
interface IdentityProvider {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  role_mappings: Array<{ provider_group: string; app_role: string }>;
  mfa_required: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    roles: string[];
  };
  mfa_required?: boolean;
  mfa_methods?: string[];
  session_token?: string;
  error?: string;
}

// Identity Provider implementations
class BaseIdentityProvider {
  protected config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  async authenticate(credentials: any): Promise<AuthResult> {
    throw new Error('Method not implemented');
  }

  async getUserInfo(username: string): Promise<any> {
    throw new Error('Method not implemented');
  }
}

class ActiveDirectoryProvider extends BaseIdentityProvider {
  async authenticate(credentials: { username: string; password: string; domain?: string }): Promise<AuthResult> {
    try {
      const ldap = require('ldapjs');
      const client = ldap.createClient({
        url: `ldap://${this.config.server}:${this.config.port || 389}`,
        timeout: 5000,
      });

      const userDN = `${credentials.username}@${credentials.domain || this.config.domain}`;
      
      return new Promise((resolve) => {
        client.bind(userDN, credentials.password, (err: any) => {
          if (err) {
            resolve({ success: false, error: 'Invalid credentials' });
            return;
          }

          client.search(this.config.base_dn, {
            filter: `(sAMAccountName=${credentials.username})`,
            scope: 'sub',
            attributes: ['cn', 'mail', 'givenName', 'sn', 'memberOf'],
          }, (err: any, res: any) => {
            if (err) {
              resolve({ success: false, error: 'User lookup failed' });
              return;
            }

            let userData: any = null;
            res.on('searchEntry', (entry: any) => {
              userData = entry.object;
            });

            res.on('end', () => {
              if (!userData) {
                resolve({ success: false, error: 'User not found' });
                return;
              }

              resolve({
                success: true,
                user: {
                  id: userData.objectGUID,
                  username: credentials.username,
                  email: userData.mail,
                  first_name: userData.givenName,
                  last_name: userData.sn,
                  roles: this.mapRoles(userData.memberOf || []),
                },
              });
            });
          });
        });
      });
    } catch (error) {
      return { success: false, error: 'Authentication service unavailable' };
    }
  }

  private mapRoles(groups: string[]): string[] {
    // Map AD groups to application roles
    const roleMap: Record<string, string> = {
      'CN=Administrators,DC=company,DC=com': 'admin',
      'CN=Users,DC=company,DC=com': 'user',
    };

    return groups.map(group => roleMap[group] || 'user').filter(Boolean);
  }
}

class LDAPProvider extends BaseIdentityProvider {
  async authenticate(credentials: { username: string; password: string }): Promise<AuthResult> {
    try {
      const ldap = require('ldapjs');
      const client = ldap.createClient({
        url: `ldap://${this.config.server}:${this.config.port || 389}`,
      });

      const userDN = `uid=${credentials.username},${this.config.base_dn}`;

      return new Promise((resolve) => {
        client.bind(userDN, credentials.password, (err: any) => {
          if (err) {
            resolve({ success: false, error: 'Invalid credentials' });
            return;
          }

          client.search(this.config.base_dn, {
            filter: `(uid=${credentials.username})`,
            scope: 'sub',
            attributes: ['cn', 'mail', 'givenName', 'sn', 'memberOf'],
          }, (err: any, res: any) => {
            if (err) {
              resolve({ success: false, error: 'User lookup failed' });
              return;
            }

            let userData: any = null;
            res.on('searchEntry', (entry: any) => {
              userData = entry.object;
            });

            res.on('end', () => {
              if (!userData) {
                resolve({ success: false, error: 'User not found' });
                return;
              }

              resolve({
                success: true,
                user: {
                  id: userData.uidNumber || credentials.username,
                  username: credentials.username,
                  email: userData.mail,
                  first_name: userData.givenName,
                  last_name: userData.sn,
                  roles: this.mapRoles(userData.memberOf || []),
                },
              });
            });
          });
        });
      });
    } catch (error) {
      return { success: false, error: 'Authentication service unavailable' };
    }
  }

  private mapRoles(groups: string[]): string[] {
    return groups.map(group => group.split(',')[0].replace('cn=', '')).filter(Boolean);
  }
}

class SAMLProvider extends BaseIdentityProvider {
  async authenticate(credentials: { assertion: string }): Promise<AuthResult> {
    try {
      const saml = require('@node-saml/node-saml');
      const samlStrategy = new saml.SAML({
        cert: this.config.certificate,
        entryPoint: this.config.entry_point,
        issuer: this.config.issuer,
      });

      return new Promise((resolve) => {
        samlStrategy.validatePostResponse(credentials.assertion, (err: any, profile: any) => {
          if (err) {
            resolve({ success: false, error: 'Invalid SAML assertion' });
            return;
          }

          resolve({
            success: true,
            user: {
              id: profile.nameID,
              username: profile.username || profile.nameID,
              email: profile.email,
              first_name: profile.firstName,
              last_name: profile.lastName,
              roles: this.mapRoles(profile.groups || []),
            },
          });
        });
      });
    } catch (error) {
      return { success: false, error: 'SAML authentication failed' };
    }
  }

  private mapRoles(groups: string[]): string[] {
    return groups.map(group => group.toLowerCase()).filter(Boolean);
  }
}

class OAuthProvider extends BaseIdentityProvider {
  async authenticate(credentials: { token: string }): Promise<AuthResult> {
    try {
      const { Issuer } = require('openid-client');
      const issuer = await Issuer.discover(this.config.issuer);
      const client = new issuer.Client({
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
      });

      const userInfo = await client.userinfo(credentials.token);

      return {
        success: true,
        user: {
          id: userInfo.sub,
          username: userInfo.preferred_username || userInfo.email,
          email: userInfo.email,
          first_name: userInfo.given_name,
          last_name: userInfo.family_name,
          roles: this.mapRoles(userInfo.groups || []),
        },
      };
    } catch (error) {
      return { success: false, error: 'OAuth token validation failed' };
    }
  }

  private mapRoles(groups: string[]): string[] {
    return groups.map(group => group.toLowerCase()).filter(Boolean);
  }
}

// Just-in-time provisioner
class JITProvisioner {
  static async provisionUser(userData: any, providerId: string): Promise<string> {
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', userData.email)
        .single();

      if (existingUser) {
        // Update existing user
        await supabase
          .from('users')
          .update({
            first_name: userData.first_name,
            last_name: userData.last_name,
            roles: userData.roles,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id);

        return existingUser.id;
      }

      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          roles: userData.roles,
          provider_id: providerId,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      return newUser.id;
    } catch (error) {
      throw new Error('User provisioning failed');
    }
  }
}

// MFA Handler
class MFAHandler {
  static async requiresMFA(userId: string, providerId: string): Promise<boolean> {
    const { data: provider } = await supabase
      .from('identity_providers')
      .select('mfa_required')
      .eq('id', providerId)
      .single();

    return provider?.mfa_required || false;
  }

  static async validateMFA(userId: string, token: string): Promise<boolean> {
    // Implementation would depend on MFA provider (TOTP, SMS, etc.)
    // For now, return a simple validation
    return token && token.length === 6 && /^\d+$/.test(token);
  }
}

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Helper functions
async function getIdentityProvider(id: string): Promise<IdentityProvider | null> {
  const { data, error } = await supabase
    .from('identity_providers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

async function createProvider(type: string, config: any): Promise<BaseIdentityProvider> {
  switch (type) {
    case 'active_directory':
      return new ActiveDirectoryProvider(config);
    case 'ldap':
      return new LDAPProvider(config);
    case 'saml':
      return new SAMLProvider(config);
    case 'oauth':
      return new OAuthProvider(config);
    default:
      throw new Error('Unsupported provider type');
  }
}

async function validateAPIKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return false;

  const { data } = await supabase
    .from('api_keys')
    .select('id')
    .eq('key', apiKey)
    .eq('active', true)
    .single();

  return !!data;
}

// API Routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');

    if (!await validateAPIKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    if (providerId) {
      // Get specific provider
      const provider = await getIdentityProvider(providerId);
      if (!provider) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ provider });
    }

    // Get all providers
    const { data: providers, error } = await supabase
      .from('identity_providers')
      .select('id, name, type, mfa_required, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch providers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('GET /api/enterprise/identity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (!await validateAPIKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'authenticate': {
        const validatedData = authenticateSchema.parse(body);
        
        // Get provider configuration
        const { data: providerConfig } = await supabase
          .from('identity_providers')
          .select('*')
          .eq('type', validatedData.provider)
          .single();

        if (!providerConfig) {
          return NextResponse.json(
            { error: 'Provider not configured' },
            { status: 400 }
          );
        }

        // Create provider instance and authenticate
        const provider = await createProvider(providerConfig.type, providerConfig.config);
        const authResult = await provider.authenticate(validatedData.credentials);

        if (!authResult.success) {
          return NextResponse.json(
            { error: authResult.error },
            { status: 401 }
          );
        }

        // Check MFA requirement
        if (await MFAHandler.requiresMFA(authResult.user!.id, providerConfig.id)) {
          if (!validatedData.mfa_token) {
            return NextResponse.json({
              mfa_required: true,
              mfa_methods: ['totp', 'sms'],
            });
          }

          if (!await MFAHandler.validateMFA(authResult.user!.id, validatedData.mfa_token)) {
            return NextResponse.json(
              { error: 'Invalid MFA token' },
              { status: 401 }
            );
          }
        }

        // Provision user
        const userId = await JITProvisioner.provisionUser(authResult.user!, providerConfig.id);

        // Generate session token
        const sessionToken = jwt.sign(
          { userId, username: authResult.user!.username },
          process.env.JWT_SECRET!,
          { expiresIn: '8h' }
        );

        // Store session in Redis
        await redis.setex(`session:${sessionToken}`, 28800, JSON.stringify({
          userId,
          username: authResult.user!.username,
          roles: authResult.user!.roles,
        }));

        return NextResponse.json({
          success: true,
          user: authResult.user,
          session_token: sessionToken,
        });
      }

      case 'provision': {
        const validatedData = provisionSchema.parse(body);
        
        const { data: provider } = await supabase
          .from('identity_providers')
          .select('id')
          .eq('name', validatedData.provider)
          .single();

        if (!provider) {
          return NextResponse.json(
            { error: 'Provider not found' },
            { status: 404 }
          );
        }

        const userId = await JITProvisioner.provisionUser(validatedData.user_data, provider.id);

        return NextResponse.json({
          success: true,
          user_id: userId,
        });
      }

      case 'configure_provider': {
        const validatedData = providerConfigSchema.parse(body);

        const { data: newProvider, error } = await supabase
          .from('identity_providers')
          .insert({
            name: validatedData.name,
            type: validatedData.type,
            config: validatedData.config,
            role_mappings: validatedData.role_mappings || [],
            mfa_required: validatedData.mfa_required,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json(
            { error: 'Failed to create provider' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          provider: newProvider,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('POST /api/enterprise/identity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    
    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID required' },
        { status: 400 }
      );
    }

    if (!await validateAPIKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = providerConfigSchema.partial().parse(body);

    const { data: updatedProvider, error } = await supabase
      .from('identity_providers')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', providerId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update provider' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: updatedProvider,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('PUT /api/enterprise/identity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    
    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID required' },
        { status: 400 }
      );
    }

    if (!await validateAPIKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('identity_providers')
      .delete()
      .eq('id', providerId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete provider' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Provider deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/enterprise/identity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}