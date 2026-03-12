```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { XMLParser } from 'fast-xml-parser';
import Redis from 'ioredis';

// Types
interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth' | 'oidc';
  config: SAMLConfig | OAuthConfig | OIDCConfig;
  enabled: boolean;
  domain_mapping: string[];
  role_mappings: RoleMapping[];
}

interface SAMLConfig {
  sso_url: string;
  slo_url?: string;
  certificate: string;
  entity_id: string;
  name_id_format: string;
  attribute_mapping: AttributeMapping;
}

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  scope: string[];
  redirect_uri: string;
}

interface OIDCConfig {
  client_id: string;
  client_secret: string;
  discovery_url: string;
  scope: string[];
  redirect_uri: string;
}

interface RoleMapping {
  idp_role: string;
  app_role: string;
  permissions: string[];
}

interface AttributeMapping {
  email: string;
  first_name: string;
  last_name: string;
  groups: string;
  department?: string;
  title?: string;
}

interface SSOSession {
  session_id: string;
  user_id: string;
  provider_id: string;
  created_at: string;
  expires_at: string;
  metadata: Record<string, any>;
}

interface AuditLog {
  event_type: string;
  user_id?: string;
  provider_id: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message?: string;
  metadata: Record<string, any>;
}

// Validation schemas
const initiateSchema = z.object({
  provider_id: z.string().uuid(),
  relay_state: z.string().optional(),
  domain_hint: z.string().optional()
});

const callbackSchema = z.object({
  provider_id: z.string().uuid(),
  code: z.string().optional(),
  state: z.string().optional(),
  saml_response: z.string().optional(),
  relay_state: z.string().optional()
});

const provisionSchema = z.object({
  provider_id: z.string().uuid(),
  user_data: z.object({
    email: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    groups: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional()
  })
});

// Redis client
const redis = new Redis(process.env.REDIS_URL!);

// Utility functions
function createSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

async function getSSOProvider(providerId: string): Promise<SSOProvider | null> {
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('sso_providers')
    .select('*')
    .eq('id', providerId)
    .eq('enabled', true)
    .single();

  if (error || !data) return null;
  return data as SSOProvider;
}

async function createAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
  const supabase = createSupabaseClient();
  
  await supabase.from('sso_audit_logs').insert({
    ...log,
    created_at: new Date().toISOString()
  });
}

async function generateSAMLRequest(provider: SSOProvider): Promise<{ url: string; state: string }> {
  const config = provider.config as SAMLConfig;
  const state = crypto.randomBytes(32).toString('hex');
  
  const authnRequest = `
    <samlp:AuthnRequest
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="_${crypto.randomBytes(16).toString('hex')}"
      Version="2.0"
      IssueInstant="${new Date().toISOString()}"
      Destination="${config.sso_url}"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      AssertionConsumerServiceURL="${process.env.NEXT_PUBLIC_BASE_URL}/api/sso/callback">
      <saml:Issuer>${config.entity_id}</saml:Issuer>
      <samlp:NameIDPolicy Format="${config.name_id_format}" AllowCreate="true"/>
    </samlp:AuthnRequest>
  `;

  const encodedRequest = Buffer.from(authnRequest).toString('base64');
  await redis.setex(`saml_state:${state}`, 600, provider.id);

  const url = `${config.sso_url}?SAMLRequest=${encodeURIComponent(encodedRequest)}&RelayState=${state}`;
  
  return { url, state };
}

async function generateOAuthURL(provider: SSOProvider): Promise<{ url: string; state: string }> {
  const config = provider.config as OAuthConfig;
  const state = crypto.randomBytes(32).toString('hex');
  
  await redis.setex(`oauth_state:${state}`, 600, provider.id);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    scope: config.scope.join(' '),
    state
  });

  return { url: `${config.authorization_url}?${params.toString()}`, state };
}

async function generateOIDCURL(provider: SSOProvider): Promise<{ url: string; state: string }> {
  const config = provider.config as OIDCConfig;
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  
  await redis.setex(`oidc_state:${state}`, 600, JSON.stringify({ provider_id: provider.id, nonce }));

  // Fetch OIDC discovery document
  const discoveryResponse = await fetch(config.discovery_url);
  const discovery = await discoveryResponse.json();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    scope: config.scope.join(' '),
    state,
    nonce
  });

  return { url: `${discovery.authorization_endpoint}?${params.toString()}`, state };
}

async function validateSAMLResponse(samlResponse: string, providerId: string): Promise<any> {
  const provider = await getSSOProvider(providerId);
  if (!provider || provider.type !== 'saml') {
    throw new Error('Invalid SAML provider');
  }

  const config = provider.config as SAMLConfig;
  const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');
  
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(decodedResponse);

  // Verify certificate signature (simplified - use proper SAML library in production)
  const assertion = parsed.Response?.Assertion;
  if (!assertion) {
    throw new Error('Invalid SAML assertion');
  }

  // Extract user attributes
  const attributes = assertion.AttributeStatement?.Attribute || [];
  const userAttributes: Record<string, any> = {};
  
  attributes.forEach((attr: any) => {
    if (attr['@_Name']) {
      userAttributes[attr['@_Name']] = attr.AttributeValue || '';
    }
  });

  return {
    nameId: assertion.Subject?.NameID || '',
    attributes: userAttributes,
    sessionIndex: assertion.AuthnStatement?.['@_SessionIndex'] || ''
  };
}

async function exchangeOAuthCode(code: string, provider: SSOProvider): Promise<any> {
  const config = provider.config as OAuthConfig;
  
  const tokenResponse = await fetch(config.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirect_uri
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange OAuth code');
  }

  return await tokenResponse.json();
}

async function exchangeOIDCCode(code: string, provider: SSOProvider, nonce: string): Promise<any> {
  const config = provider.config as OIDCConfig;
  
  // Get discovery document
  const discoveryResponse = await fetch(config.discovery_url);
  const discovery = await discoveryResponse.json();

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: config.redirect_uri
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange OIDC code');
  }

  const tokens = await tokenResponse.json();
  
  // Verify ID token
  const idToken = jwt.decode(tokens.id_token, { complete: true });
  if (!idToken || typeof idToken === 'string' || idToken.payload.nonce !== nonce) {
    throw new Error('Invalid ID token');
  }

  return { tokens, userInfo: idToken.payload };
}

async function provisionUser(userData: any, provider: SSOProvider): Promise<string> {
  const supabase = createSupabaseClient();
  
  // Check if user exists
  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(userData.email);

  let userId: string;

  if (existingUser.user) {
    userId = existingUser.user.id;
    // Update user metadata
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingUser.user.user_metadata,
        sso_provider: provider.id,
        last_sso_login: new Date().toISOString(),
        ...userData.attributes
      }
    });
  } else {
    // Create new user
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name,
        sso_provider: provider.id,
        created_via_sso: true,
        ...userData.attributes
      },
      email_confirm: true
    });

    if (error || !newUser.user) {
      throw new Error('Failed to create user');
    }

    userId = newUser.user.id;
  }

  // Map roles
  if (userData.groups) {
    await mapUserRoles(userId, userData.groups, provider.role_mappings);
  }

  return userId;
}

async function mapUserRoles(userId: string, groups: string[], roleMappings: RoleMapping[]): Promise<void> {
  const supabase = createSupabaseClient();
  
  // Clear existing role mappings
  await supabase.from('user_roles').delete().eq('user_id', userId);

  // Apply new role mappings
  const rolesToInsert = [];
  
  for (const group of groups) {
    const mapping = roleMappings.find(rm => rm.idp_role === group);
    if (mapping) {
      rolesToInsert.push({
        user_id: userId,
        role: mapping.app_role,
        permissions: mapping.permissions,
        assigned_at: new Date().toISOString()
      });
    }
  }

  if (rolesToInsert.length > 0) {
    await supabase.from('user_roles').insert(rolesToInsert);
  }
}

async function createSSOSession(userId: string, providerId: string, metadata: Record<string, any>): Promise<string> {
  const supabase = createSupabaseClient();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const session: SSOSession = {
    session_id: sessionId,
    user_id: userId,
    provider_id: providerId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    metadata
  };

  await supabase.from('sso_sessions').insert(session);
  await redis.setex(`sso_session:${sessionId}`, 86400, JSON.stringify(session));

  return sessionId;
}

function getClientInfo(request: NextRequest) {
  return {
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown'
  };
}

// Route handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const clientInfo = getClientInfo(request);

    if (action === 'initiate') {
      const providerId = searchParams.get('provider_id');
      const relayState = searchParams.get('relay_state');

      if (!providerId) {
        return NextResponse.json({ error: 'Missing provider_id' }, { status: 400 });
      }

      const provider = await getSSOProvider(providerId);
      if (!provider) {
        await createAuditLog({
          event_type: 'sso_initiate_failed',
          provider_id: providerId,
          success: false,
          error_message: 'Provider not found',
          metadata: {},
          ...clientInfo
        });
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }

      let redirectUrl: string;
      let state: string;

      switch (provider.type) {
        case 'saml':
          ({ url: redirectUrl, state } = await generateSAMLRequest(provider));
          break;
        case 'oauth':
          ({ url: redirectUrl, state } = await generateOAuthURL(provider));
          break;
        case 'oidc':
          ({ url: redirectUrl, state } = await generateOIDCURL(provider));
          break;
        default:
          return NextResponse.json({ error: 'Unsupported provider type' }, { status: 400 });
      }

      await createAuditLog({
        event_type: 'sso_initiate_success',
        provider_id: providerId,
        success: true,
        metadata: { state, relay_state: relayState },
        ...clientInfo
      });

      return NextResponse.json({ redirect_url: redirectUrl, state });

    } else if (action === 'callback') {
      const providerId = searchParams.get('provider_id');
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const samlResponse = searchParams.get('SAMLResponse');

      if (!providerId || !state) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
      }

      const provider = await getSSOProvider(providerId);
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }

      let userData: any;
      let sessionMetadata: Record<string, any> = {};

      try {
        switch (provider.type) {
          case 'saml':
            if (!samlResponse) {
              throw new Error('Missing SAML response');
            }
            const cachedProviderId = await redis.get(`saml_state:${state}`);
            if (cachedProviderId !== providerId) {
              throw new Error('Invalid state parameter');
            }
            const samlData = await validateSAMLResponse(samlResponse, providerId);
            const config = provider.config as SAMLConfig;
            userData = {
              email: samlData.attributes[config.attribute_mapping.email],
              first_name: samlData.attributes[config.attribute_mapping.first_name],
              last_name: samlData.attributes[config.attribute_mapping.last_name],
              groups: samlData.attributes[config.attribute_mapping.groups]?.split(',') || [],
              attributes: samlData.attributes
            };
            sessionMetadata = { session_index: samlData.sessionIndex };
            break;

          case 'oauth':
            if (!code) {
              throw new Error('Missing OAuth code');
            }
            const cachedOAuthProviderId = await redis.get(`oauth_state:${state}`);
            if (cachedOAuthProviderId !== providerId) {
              throw new Error('Invalid state parameter');
            }
            const oauthTokens = await exchangeOAuthCode(code, provider);
            // Fetch user info from OAuth provider
            sessionMetadata = { access_token: oauthTokens.access_token };
            break;

          case 'oidc':
            if (!code) {
              throw new Error('Missing OIDC code');
            }
            const cachedOIDCData = await redis.get(`oidc_state:${state}`);
            if (!cachedOIDCData) {
              throw new Error('Invalid state parameter');
            }
            const { provider_id: cachedProviderId2, nonce } = JSON.parse(cachedOIDCData);
            if (cachedProviderId2 !== providerId) {
              throw new Error('Invalid state parameter');
            }
            const oidcData = await exchangeOIDCCode(code, provider, nonce);
            userData = {
              email: oidcData.userInfo.email,
              first_name: oidcData.userInfo.given_name,
              last_name: oidcData.userInfo.family_name,
              groups: oidcData.userInfo.groups || [],
              attributes: oidcData.userInfo
            };
            sessionMetadata = { id_token: oidcData.tokens.id_token };
            break;
        }

        const userId = await provisionUser(userData, provider);
        const sessionId = await createSSOSession(userId, providerId, sessionMetadata);

        // Create Supabase auth session
        const supabase = createSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: userData.email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
          }
        });

        if (sessionError) {
          throw new Error('Failed to create auth session');
        }

        await createAuditLog({
          event_type: 'sso_login_success',
          user_id: userId,
          provider_id: providerId,
          success: true,
          metadata: { session_id: sessionId },
          ...clientInfo
        });

        return NextResponse.json({
          success: true,
          session_id: sessionId,
          redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
        });

      } catch (error) {
        await createAuditLog({
          event_type: 'sso_login_failed',
          provider_id: providerId,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          metadata: { state },
          ...clientInfo
        });

        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Authentication failed' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('SSO API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientInfo = getClientInfo(request);

    // Handle user provisioning
    const validation = provisionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { provider_id, user_data } = validation.data;

    const provider = await getSSOProvider(provider_id);
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    try {
      const userId = await provisionUser(user_data, provider);

      await createAuditLog({
        event_type: 'user_provision_success',
        user_id: userId,
        provider_id: provider_id,
        success: true,
        metadata: { email: user_data.email },
        ...clientInfo
      });

      return NextResponse.json({ success: true, user_id: userId });

    } catch (error) {
      await createAuditLog({
        event_type: 'user_provision_failed',
        provider_id: provider_id,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        metadata: { email: user_data.email },
        ...clientInfo
      });

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Provisioning failed' },
        { status: 500 }
      );