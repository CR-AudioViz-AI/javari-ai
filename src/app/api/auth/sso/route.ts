import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { SSOProtocolHandler } from '@/lib/auth/sso/protocols/base-provider';
import { SAMLProvider } from '@/lib/auth/sso/protocols/saml';
import { OAuth2Provider } from '@/lib/auth/sso/protocols/oauth2';
import { OIDCProvider } from '@/lib/auth/sso/protocols/oidc';
import { LDAPProvider } from '@/lib/auth/sso/protocols/ldap';
import { UserProvisioning } from '@/lib/auth/sso/user-provisioning';
import { RoleMapper } from '@/lib/auth/sso/role-mapper';
import { SessionManager } from '@/lib/auth/sso/session-manager';
import { SSOConfig, SSOProtocol, SSOInitiateRequest, SSOCallbackRequest } from '@/types/sso';

// Validation schemas
const initiateSchema = z.object({
  protocol: z.enum(['saml', 'oauth2', 'oidc', 'ldap']),
  provider: z.string().min(1).max(100),
  returnUrl: z.string().url().optional(),
  domain: z.string().min(1).max(255).optional(),
});

const callbackSchema = z.object({
  protocol: z.enum(['saml', 'oauth2', 'oidc', 'ldap']),
  provider: z.string().min(1).max(100),
  code: z.string().optional(),
  state: z.string().optional(),
  samlResponse: z.string().optional(),
  relayState: z.string().optional(),
  id_token: z.string().optional(),
  access_token: z.string().optional(),
});

const userSyncSchema = z.object({
  provider: z.string().min(1).max(100),
  userIds: z.array(z.string()).optional(),
  fullSync: z.boolean().default(false),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize SSO components
const userProvisioning = new UserProvisioning(supabase);
const roleMapper = new RoleMapper(supabase);
const sessionManager = new SessionManager();

// Protocol handlers map
const protocolHandlers: Record<SSOProtocol, SSOProtocolHandler> = {
  saml: new SAMLProvider(),
  oauth2: new OAuth2Provider(),
  oidc: new OIDCProvider(),
  ldap: new LDAPProvider(),
};

// GET - SSO Metadata endpoint
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { limit: 60, window: 3600 });
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol') as SSOProtocol;
    const provider = searchParams.get('provider');
    const metadataType = searchParams.get('type') || 'sp'; // sp (Service Provider) or idp (Identity Provider)

    if (!protocol || !provider) {
      return NextResponse.json(
        { error: 'Missing protocol or provider parameter' },
        { status: 400 }
      );
    }

    // Validate protocol
    if (!protocolHandlers[protocol]) {
      return NextResponse.json(
        { error: 'Unsupported protocol' },
        { status: 400 }
      );
    }

    // Get SSO configuration
    const { data: ssoConfig, error: configError } = await supabase
      .from('sso_configurations')
      .select('*')
      .eq('protocol', protocol)
      .eq('provider', provider)
      .eq('enabled', true)
      .single();

    if (configError || !ssoConfig) {
      return NextResponse.json(
        { error: 'SSO configuration not found' },
        { status: 404 }
      );
    }

    // Generate metadata based on protocol
    const handler = protocolHandlers[protocol];
    const metadata = await handler.generateMetadata(ssoConfig, metadataType);

    // Set appropriate content type based on protocol
    const contentType = protocol === 'saml' ? 'application/samlmetadata+xml' : 'application/json';

    return new NextResponse(metadata, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('SSO metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to generate SSO metadata' },
      { status: 500 }
    );
  }
}

// POST - SSO Initiation endpoint
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { limit: 30, window: 900 });
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = initiateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validation.error.format()
        },
        { status: 400 }
      );
    }

    const { protocol, provider, returnUrl, domain } = validation.data;

    // Get SSO configuration
    const { data: ssoConfig, error: configError } = await supabase
      .from('sso_configurations')
      .select('*')
      .eq('protocol', protocol)
      .eq('provider', provider)
      .eq('enabled', true)
      .single();

    if (configError || !ssoConfig) {
      return NextResponse.json(
        { error: 'SSO configuration not found or disabled' },
        { status: 404 }
      );
    }

    // Domain validation for domain-restricted SSO
    if (ssoConfig.domain_restriction && domain && !ssoConfig.allowed_domains?.includes(domain)) {
      return NextResponse.json(
        { error: 'Domain not authorized for SSO' },
        { status: 403 }
      );
    }

    // Generate SSO initiation request
    const handler = protocolHandlers[protocol];
    const initiationResult = await handler.initiateAuth({
      config: ssoConfig,
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      domain,
    });

    // Store state for callback validation
    if (initiationResult.state) {
      await sessionManager.storeState(initiationResult.state, {
        protocol,
        provider,
        returnUrl,
        timestamp: Date.now(),
      });
    }

    // Log SSO initiation
    await supabase.from('sso_audit_logs').insert({
      event_type: 'sso_initiated',
      protocol,
      provider,
      user_id: null,
      metadata: {
        domain,
        returnUrl,
        state: initiationResult.state,
      },
    });

    return NextResponse.json({
      success: true,
      redirectUrl: initiationResult.redirectUrl,
      method: initiationResult.method || 'GET',
      formData: initiationResult.formData,
    });

  } catch (error) {
    console.error('SSO initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate SSO authentication' },
      { status: 500 }
    );
  }
}

// PUT - SSO Callback handling
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { limit: 60, window: 900 });
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = callbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid callback format',
          details: validation.error.format()
        },
        { status: 400 }
      );
    }

    const callbackData = validation.data;
    const { protocol, provider } = callbackData;

    // Get SSO configuration
    const { data: ssoConfig, error: configError } = await supabase
      .from('sso_configurations')
      .select('*')
      .eq('protocol', protocol)
      .eq('provider', provider)
      .eq('enabled', true)
      .single();

    if (configError || !ssoConfig) {
      return NextResponse.json(
        { error: 'SSO configuration not found' },
        { status: 404 }
      );
    }

    // Validate state parameter if present
    if (callbackData.state) {
      const storedState = await sessionManager.getState(callbackData.state);
      if (!storedState || storedState.protocol !== protocol || storedState.provider !== provider) {
        return NextResponse.json(
          { error: 'Invalid or expired state parameter' },
          { status: 400 }
        );
      }
    }

    // Process callback with appropriate handler
    const handler = protocolHandlers[protocol];
    const authResult = await handler.handleCallback(callbackData, ssoConfig);

    if (!authResult.success) {
      await supabase.from('sso_audit_logs').insert({
        event_type: 'sso_failed',
        protocol,
        provider,
        user_id: null,
        metadata: { error: authResult.error },
      });

      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Extract user information from auth result
    const userInfo = authResult.user!;

    // Check if user exists or needs provisioning
    let { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('sso_id', userInfo.id)
      .eq('sso_provider', provider)
      .single();

    let userId: string;

    if (!existingUser) {
      // Provision new user
      const provisionResult = await userProvisioning.provisionUser({
        ssoId: userInfo.id,
        provider,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        attributes: userInfo.attributes || {},
      });

      if (!provisionResult.success) {
        return NextResponse.json(
          { error: 'Failed to provision user' },
          { status: 500 }
        );
      }

      userId = provisionResult.userId!;
      existingUser = provisionResult.user!;
    } else {
      userId = existingUser.id;

      // Update user information if changed
      await userProvisioning.updateUser(userId, {
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        attributes: userInfo.attributes || {},
        lastSsoLogin: new Date().toISOString(),
      });
    }

    // Map and assign roles
    const roleMapping = await roleMapper.mapRoles(userInfo.groups || [], ssoConfig.role_mappings);
    if (roleMapping.length > 0) {
      await roleMapper.assignRoles(userId, roleMapping);
    }

    // Create session
    const sessionResult = await sessionManager.createSession({
      userId,
      provider,
      protocol,
      accessToken: authResult.tokens?.accessToken,
      refreshToken: authResult.tokens?.refreshToken,
      expiresAt: authResult.tokens?.expiresAt,
    });

    // Log successful authentication
    await supabase.from('sso_audit_logs').insert({
      event_type: 'sso_success',
      protocol,
      provider,
      user_id: userId,
      metadata: {
        email: userInfo.email,
        roles: roleMapping,
        sessionId: sessionResult.sessionId,
      },
    });

    // Clean up state
    if (callbackData.state) {
      await sessionManager.clearState(callbackData.state);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        roles: roleMapping,
      },
      session: {
        id: sessionResult.sessionId,
        token: sessionResult.sessionToken,
        expiresAt: sessionResult.expiresAt,
      },
      returnUrl: callbackData.state ? 
        (await sessionManager.getState(callbackData.state))?.returnUrl : 
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.json(
      { error: 'Failed to process SSO callback' },
      { status: 500 }
    );
  }
}

// PATCH - User synchronization endpoint
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting (more restrictive for sync operations)
    const rateLimitResult = await rateLimit(request, { limit: 10, window: 3600 });
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Verify admin or system access
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = userSyncSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid sync request format',
          details: validation.error.format()
        },
        { status: 400 }
      );
    }

    const { provider, userIds, fullSync } = validation.data;

    // Get provider configuration
    const { data: configs, error: configError } = await supabase
      .from('sso_configurations')
      .select('*')
      .eq('provider', provider)
      .eq('enabled', true);

    if (configError || !configs.length) {
      return NextResponse.json(
        { error: 'Provider configuration not found' },
        { status: 404 }
      );
    }

    // Find LDAP configuration for user sync (LDAP supports directory queries)
    const ldapConfig = configs.find(config => config.protocol === 'ldap');
    if (!ldapConfig) {
      return NextResponse.json(
        { error: 'LDAP configuration required for user synchronization' },
        { status: 400 }
      );
    }

    // Perform user synchronization
    const ldapHandler = protocolHandlers.ldap as LDAPProvider;
    const syncResult = await ldapHandler.syncUsers({
      config: ldapConfig,
      userIds,
      fullSync,
    });

    // Process synchronized users
    const provisioningResults = [];
    for (const ldapUser of syncResult.users) {
      try {
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('sso_id', ldapUser.id)
          .eq('sso_provider', provider)
          .single();

        if (existingUser) {
          // Update existing user
          await userProvisioning.updateUser(existingUser.id, {
            email: ldapUser.email,
            firstName: ldapUser.firstName,
            lastName: ldapUser.lastName,
            attributes: ldapUser.attributes || {},
            lastSsoSync: new Date().toISOString(),
          });

          // Update roles
          const roleMapping = await roleMapper.mapRoles(ldapUser.groups || [], ldapConfig.role_mappings);
          await roleMapper.assignRoles(existingUser.id, roleMapping);

          provisioningResults.push({
            ssoId: ldapUser.id,
            action: 'updated',
            userId: existingUser.id,
            roles: roleMapping,
          });
        } else {
          // Provision new user
          const provisionResult = await userProvisioning.provisionUser({
            ssoId: ldapUser.id,
            provider,
            email: ldapUser.email,
            firstName: ldapUser.firstName,
            lastName: ldapUser.lastName,
            attributes: ldapUser.attributes || {},
          });

          if (provisionResult.success) {
            // Assign roles
            const roleMapping = await roleMapper.mapRoles(ldapUser.groups || [], ldapConfig.role_mappings);
            await roleMapper.assignRoles(provisionResult.userId!, roleMapping);

            provisioningResults.push({
              ssoId: ldapUser.id,
              action: 'created',
              userId: provisionResult.userId,
              roles: roleMapping,
            });
          }
        }
      } catch (userError) {
        console.error(`Failed to sync user ${ldapUser.id}:`, userError);
        provisioningResults.push({
          ssoId: ldapUser.id,
          action: 'failed',
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }
    }

    // Log sync operation
    await supabase.from('sso_audit_logs').insert({
      event_type: 'user_sync',
      protocol: 'ldap',
      provider,
      user_id: user.id,
      metadata: {
        fullSync,
        userCount: syncResult.users.length,
        successCount: provisioningResults.filter(r => r.action !== 'failed').length,
        failureCount: provisioningResults.filter(r => r.action === 'failed').length,
      },
    });

    return NextResponse.json({
      success: true,
      syncedCount: syncResult.users.length,
      results: provisioningResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('SSO user sync error:', error);
    return NextResponse.json(
      { error: 'Failed to synchronize users' },
      { status: 500 }
    );
  }
}

// DELETE - SSO Session termination
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, { limit: 30, window: 900 });
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const provider = searchParams.get('provider');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Verify session ownership or admin privileges
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Get session details
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify session ownership or admin role
    if (session.userId !== user.id) {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!userRole) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Terminate SSO session
    await sessionManager.terminateSession(sessionId);

    // If provider supports SLO (Single Logout), initiate logout
    if (provider && session.protocol) {
      const { data: ssoConfig } = await supabase
        .from('sso_configurations')
        .select('*')
        .eq('protocol', session.protocol)
        .eq('provider', provider)
        .single();

      if (ssoConfig?.logout_url) {
        const handler = protocolHandlers[session.protocol];
        try {
          await handler.initiateLogout({
            config: ssoConfig,
            sessionId,
            userId: session.userId,
          });
        } catch (logoutError) {
          console.error('SSO logout error:', logoutError);
          // Don't fail the entire request if SLO fails
        }
      }
    }

    // Log session termination
    await supabase.from('sso_audit_logs').insert({
      event_type: 'session_terminated',
      protocol: session.protocol,
      provider: session.provider,
      user_id: session.userId,
      metadata: { sessionId, terminatedBy: user.id },