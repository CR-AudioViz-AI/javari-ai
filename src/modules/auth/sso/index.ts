import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import * as saml2 from 'saml2-js';
import crypto from 'crypto';
import Redis from 'ioredis';

/**
 * Enterprise Single Sign-On Module
 * Provides comprehensive SSO authentication supporting SAML 2.0, OAuth 2.0, and OpenID Connect
 * with automated user provisioning and role mapping for seamless enterprise integration
 */

/**
 * SSO Provider types
 */
export enum SSOProviderType {
  SAML = 'saml',
  OAUTH2 = 'oauth2',
  OPENID_CONNECT = 'openid_connect'
}

/**
 * SSO Configuration interface
 */
export interface SSOConfiguration {
  id: string;
  name: string;
  type: SSOProviderType;
  domain: string;
  isEnabled: boolean;
  settings: SSOProviderSettings;
  userProvisioning: UserProvisioningConfig;
  roleMappings: RoleMapping[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider-specific settings
 */
export interface SSOProviderSettings {
  // SAML Settings
  samlSettings?: {
    entityId: string;
    ssoUrl: string;
    x509Certificate: string;
    signatureAlgorithm: string;
    nameIdFormat: string;
    attributeMapping: Record<string, string>;
  };
  
  // OAuth2 Settings
  oauth2Settings?: {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
    redirectUri: string;
  };
  
  // OpenID Connect Settings
  oidcSettings?: {
    clientId: string;
    clientSecret: string;
    discoveryUrl: string;
    redirectUri: string;
    scopes: string[];
    responseType: string;
    responseMode: string;
  };
}

/**
 * User provisioning configuration
 */
export interface UserProvisioningConfig {
  autoCreateUsers: boolean;
  updateExistingUsers: boolean;
  defaultRole: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    jobTitle?: string;
  };
  groupMapping?: Record<string, string[]>;
}

/**
 * Role mapping configuration
 */
export interface RoleMapping {
  providerRole: string;
  applicationRole: string;
  isDefault: boolean;
}

/**
 * SSO User information
 */
export interface SSOUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  roles: string[];
  groups: string[];
  attributes: Record<string, any>;
  providerId: string;
  providerUserId: string;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  user?: SSOUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Session information
 */
export interface SSOSession {
  sessionId: string;
  userId: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  attributes: Record<string, any>;
}

/**
 * SAML Provider implementation
 */
class SAMLProvider {
  private serviceProvider: saml2.ServiceProvider;
  private identityProvider: saml2.IdentityProvider;

  constructor(private config: SSOConfiguration) {
    if (!config.settings.samlSettings) {
      throw new Error('SAML settings are required');
    }

    const settings = config.settings.samlSettings;
    
    this.serviceProvider = new saml2.ServiceProvider({
      entity_id: settings.entityId,
      private_key: process.env.SAML_PRIVATE_KEY!,
      certificate: process.env.SAML_CERTIFICATE!,
      assert_endpoint: `${process.env.APP_URL}/api/auth/sso/saml/assert/${config.id}`,
      force_authn: false,
      auth_context: {
        comparison: 'exact',
        class_refs: ['urn:oasis:names:tc:SAML:1.0:am:password']
      },
      nameid_format: settings.nameIdFormat,
      sign_get_request: false,
      allow_unencrypted_assertion: false
    });

    this.identityProvider = new saml2.IdentityProvider({
      sso_login_url: settings.ssoUrl,
      sso_logout_url: settings.ssoUrl,
      certificates: [settings.x509Certificate]
    });
  }

  /**
   * Generate SAML authentication request URL
   */
  getAuthUrl(relayState?: string): string {
    return this.serviceProvider.create_login_request_url(
      this.identityProvider,
      { relay_state: relayState }
    );
  }

  /**
   * Process SAML assertion response
   */
  async processAssertion(samlResponse: string): Promise<SSOUser> {
    return new Promise((resolve, reject) => {
      this.serviceProvider.post_assert(
        this.identityProvider,
        { request_body: { SAMLResponse: samlResponse } },
        (err, samlResponse) => {
          if (err) {
            reject(new Error(`SAML assertion failed: ${err.message}`));
            return;
          }

          if (!samlResponse.user) {
            reject(new Error('No user information in SAML response'));
            return;
          }

          const user = this.mapSAMLUser(samlResponse.user);
          resolve(user);
        }
      );
    });
  }

  /**
   * Map SAML user attributes to SSO user
   */
  private mapSAMLUser(samlUser: any): SSOUser {
    const settings = this.config.settings.samlSettings!;
    const mapping = settings.attributeMapping;

    return {
      id: crypto.randomUUID(),
      email: samlUser.attributes[mapping.email] || samlUser.name_id,
      firstName: samlUser.attributes[mapping.firstName] || '',
      lastName: samlUser.attributes[mapping.lastName] || '',
      department: samlUser.attributes[mapping.department],
      jobTitle: samlUser.attributes[mapping.jobTitle],
      roles: this.mapUserRoles(samlUser.attributes.roles || []),
      groups: samlUser.attributes.groups || [],
      attributes: samlUser.attributes,
      providerId: this.config.id,
      providerUserId: samlUser.name_id
    };
  }

  private mapUserRoles(providerRoles: string[]): string[] {
    return this.config.roleMappings
      .filter(mapping => providerRoles.includes(mapping.providerRole))
      .map(mapping => mapping.applicationRole);
  }
}

/**
 * OAuth2 Provider implementation
 */
class OAuth2Provider {
  constructor(private config: SSOConfiguration) {
    if (!config.settings.oauth2Settings) {
      throw new Error('OAuth2 settings are required');
    }
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(state: string): string {
    const settings = this.config.settings.oauth2Settings!;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      scope: settings.scopes.join(' '),
      state
    });

    return `${settings.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; tokenType: string }> {
    const settings = this.config.settings.oauth2Settings!;
    
    const response = await fetch(settings.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: settings.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type
    };
  }

  /**
   * Fetch user information using access token
   */
  async getUserInfo(accessToken: string): Promise<SSOUser> {
    const settings = this.config.settings.oauth2Settings!;
    
    const response = await fetch(settings.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    const userInfo = await response.json();
    return this.mapOAuth2User(userInfo);
  }

  private mapOAuth2User(userInfo: any): SSOUser {
    return {
      id: crypto.randomUUID(),
      email: userInfo.email,
      firstName: userInfo.given_name || userInfo.first_name || '',
      lastName: userInfo.family_name || userInfo.last_name || '',
      department: userInfo.department,
      jobTitle: userInfo.job_title,
      roles: this.mapUserRoles(userInfo.roles || []),
      groups: userInfo.groups || [],
      attributes: userInfo,
      providerId: this.config.id,
      providerUserId: userInfo.sub || userInfo.id
    };
  }

  private mapUserRoles(providerRoles: string[]): string[] {
    return this.config.roleMappings
      .filter(mapping => providerRoles.includes(mapping.providerRole))
      .map(mapping => mapping.applicationRole);
  }
}

/**
 * OpenID Connect Provider implementation
 */
class OpenIDConnectProvider {
  private discoveryDocument: any;

  constructor(private config: SSOConfiguration) {
    if (!config.settings.oidcSettings) {
      throw new Error('OpenID Connect settings are required');
    }
  }

  /**
   * Initialize provider by fetching discovery document
   */
  async initialize(): Promise<void> {
    const settings = this.config.settings.oidcSettings!;
    
    try {
      const response = await fetch(settings.discoveryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.statusText}`);
      }
      this.discoveryDocument = await response.json();
    } catch (error) {
      throw new Error(`OIDC initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate OIDC authorization URL
   */
  getAuthUrl(state: string, nonce: string): string {
    const settings = this.config.settings.oidcSettings!;
    const params = new URLSearchParams({
      response_type: settings.responseType,
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      scope: settings.scopes.join(' '),
      state,
      nonce,
      response_mode: settings.responseMode
    });

    return `${this.discoveryDocument.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; idToken: string }> {
    const settings = this.config.settings.oidcSettings!;
    
    const response = await fetch(this.discoveryDocument.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: settings.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    return {
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token
    };
  }

  /**
   * Validate and decode ID token
   */
  async validateIdToken(idToken: string, nonce: string): Promise<SSOUser> {
    // In production, implement proper JWT validation with JWKS
    const decoded = jwt.decode(idToken, { complete: true });
    
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid ID token');
    }

    const payload = decoded.payload as any;
    
    // Validate nonce
    if (payload.nonce !== nonce) {
      throw new Error('Invalid nonce');
    }

    return this.mapOIDCUser(payload);
  }

  private mapOIDCUser(payload: any): SSOUser {
    return {
      id: crypto.randomUUID(),
      email: payload.email,
      firstName: payload.given_name || payload.first_name || '',
      lastName: payload.family_name || payload.last_name || '',
      department: payload.department,
      jobTitle: payload.job_title,
      roles: this.mapUserRoles(payload.roles || []),
      groups: payload.groups || [],
      attributes: payload,
      providerId: this.config.id,
      providerUserId: payload.sub
    };
  }

  private mapUserRoles(providerRoles: string[]): string[] {
    return this.config.roleMappings
      .filter(mapping => providerRoles.includes(mapping.providerRole))
      .map(mapping => mapping.applicationRole);
  }
}

/**
 * User Provisioning Service
 */
class UserProvisioningService {
  constructor(private supabase: any, private config: SSOConfiguration) {}

  /**
   * Provision user based on SSO authentication
   */
  async provisionUser(ssoUser: SSOUser): Promise<any> {
    const provisioning = this.config.userProvisioning;
    
    try {
      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', ssoUser.email)
        .single();

      if (existingUser) {
        if (provisioning.updateExistingUsers) {
          return await this.updateUser(existingUser.id, ssoUser);
        }
        return existingUser;
      }

      if (provisioning.autoCreateUsers) {
        return await this.createUser(ssoUser);
      }

      throw new Error('User provisioning is disabled and user does not exist');
    } catch (error) {
      throw new Error(`User provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createUser(ssoUser: SSOUser): Promise<any> {
    const provisioning = this.config.userProvisioning;
    
    const userData = {
      email: ssoUser.email,
      first_name: ssoUser.firstName,
      last_name: ssoUser.lastName,
      department: ssoUser.department,
      job_title: ssoUser.jobTitle,
      roles: ssoUser.roles.length > 0 ? ssoUser.roles : [provisioning.defaultRole],
      sso_provider_id: ssoUser.providerId,
      sso_provider_user_id: ssoUser.providerUserId,
      sso_attributes: ssoUser.attributes
    };

    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Create SSO user mapping
    await this.createSSOMapping(data.id, ssoUser);

    return data;
  }

  private async updateUser(userId: string, ssoUser: SSOUser): Promise<any> {
    const updateData = {
      first_name: ssoUser.firstName,
      last_name: ssoUser.lastName,
      department: ssoUser.department,
      job_title: ssoUser.jobTitle,
      roles: ssoUser.roles,
      sso_attributes: ssoUser.attributes,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    // Update SSO user mapping
    await this.updateSSOMapping(userId, ssoUser);

    return data;
  }

  private async createSSOMapping(userId: string, ssoUser: SSOUser): Promise<void> {
    const { error } = await this.supabase
      .from('sso_user_mappings')
      .insert({
        user_id: userId,
        provider_id: ssoUser.providerId,
        provider_user_id: ssoUser.providerUserId,
        attributes: ssoUser.attributes
      });

    if (error) {
      throw new Error(`Failed to create SSO mapping: ${error.message}`);
    }
  }

  private async updateSSOMapping(userId: string, ssoUser: SSOUser): Promise<void> {
    const { error } = await this.supabase
      .from('sso_user_mappings')
      .update({
        attributes: ssoUser.attributes,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('provider_id', ssoUser.providerId);

    if (error) {
      throw new Error(`Failed to update SSO mapping: ${error.message}`);
    }
  }
}

/**
 * Role Mapping Service
 */
class RoleMappingService {
  constructor(private supabase: any) {}

  /**
   * Create role mapping for SSO configuration
   */
  async createRoleMapping(configId: string, mapping: RoleMapping): Promise<RoleMapping> {
    const { data, error } = await this.supabase
      .from('sso_role_mappings')
      .insert({
        config_id: configId,
        provider_role: mapping.providerRole,
        application_role: mapping.applicationRole,
        is_default: mapping.isDefault
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create role mapping: ${error.message}`);
    }

    return data;
  }

  /**
   * Get role mappings for SSO configuration
   */
  async getRoleMappings(configId: string): Promise<RoleMapping[]> {
    const { data, error } = await this.supabase
      .from('sso_role_mappings')
      .select('*')
      .eq('config_id', configId);

    if (error) {
      throw new Error(`Failed to fetch role mappings: ${error.message}`);
    }

    return data;
  }

  /**
   * Update role mapping
   */
  async updateRoleMapping(mappingId: string, updates: Partial<RoleMapping>): Promise<RoleMapping> {
    const { data, error } = await this.supabase
      .from('sso_role_mappings')
      .update(updates)
      .eq('id', mappingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update role mapping: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete role mapping
   */
  async deleteRoleMapping(mappingId: string): Promise<void> {
    const { error } = await this.supabase
      .from('sso_role_mappings')
      .delete()
      .eq('id', mappingId);

    if (error) {
      throw new Error(`Failed to delete role mapping: ${error.message}`);
    }
  }
}

/**
 * Session Management Service
 */
class SessionManagementService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Create SSO session
   */
  async createSession(session: SSOSession): Promise<void> {
    const sessionKey = `sso:session:${session.sessionId}`;
    const userSessionKey = `sso:user:${session.userId}`;

    await Promise.all([
      this.redis.setex(sessionKey, 86400, JSON.stringify(session)), // 24 hours
      this.redis.sadd(userSessionKey, session.sessionId),
      this.redis.expire(userSessionKey, 86400)
    ]);
  }

  /**
   * Get SSO session
   */
  async getSession(sessionId: string): Promise<SSOSession | null> {
    const sessionKey = `sso:session:${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData);
  }

  /**
   * Refresh session expiration
   */
  async refreshSession(sessionId: string): Promise<void> {
    const sessionKey = `sso:session:${sessionId}`;
    await this.redis.expire(sessionKey, 86400);
  }

  /**
   * Destroy SSO session
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const sessionKey = `sso:session:${sessionId}`;
    const userSessionKey = `sso:user:${session.userId}`;

    await Promise.all([
      this.redis.del(sessionKey),
      this.redis.srem(userSessionKey, sessionId)
    ]);
  }

  /**
   * Destroy all user sessions
   */
  async destroyUserSessions(userId: string): Promise<void> {
    const userSessionKey = `sso:user:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionKey);

    if (sessionIds.length > 0) {
      const sessionKeys = sessionIds.map(id => `sso:session:${id}`);
      await Promise.all([
        this.redis.del(...sessionKeys),
        this.redis.del(userSessionKey)
      ]);
    }
  }
}

/**
 * Main SSO Service
 */
export class SSO