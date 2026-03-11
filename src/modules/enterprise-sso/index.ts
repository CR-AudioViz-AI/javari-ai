/**
 * CR AudioViz Enterprise SSO Identity Provider
 * Comprehensive single sign-on system supporting SAML 2.0, OAuth 2.0, and OpenID Connect
 * @fileoverview Main entry point for enterprise SSO module
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';

// Core SSO Types
export interface SSOConfiguration {
  id: string;
  tenantId: string;
  name: string;
  protocol: 'SAML' | 'OAuth2' | 'OIDC';
  enabled: boolean;
  metadata: SSOMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOMetadata {
  saml?: SAMLConfig;
  oauth?: OAuth2Config;
  oidc?: OIDCConfig;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  x509Certificate: string;
  signRequests: boolean;
  encryptAssertions: boolean;
  nameIdFormat: string;
  attributeMapping: Record<string, string>;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string[];
  redirectUri: string;
  responseType: 'code' | 'token';
}

export interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  issuer: string;
  discoveryUrl?: string;
  scope: string[];
  responseType: string;
  redirectUri: string;
  jwksUri?: string;
}

export interface SSOSession {
  id: string;
  userId: string;
  tenantId: string;
  providerId: string;
  protocol: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  attributes: Record<string, any>;
  createdAt: Date;
}

export interface SSOUser {
  id: string;
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roles: string[];
  groups: string[];
  tenantId: string;
  providerId: string;
  attributes: Record<string, any>;
  lastLogin: Date;
  isActive: boolean;
}

// Validation Schemas
const SSOConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  protocol: z.enum(['SAML', 'OAuth2', 'OIDC']),
  enabled: z.boolean(),
  metadata: z.object({
    saml: z.object({
      entityId: z.string().url(),
      ssoUrl: z.string().url(),
      x509Certificate: z.string(),
      signRequests: z.boolean(),
      encryptAssertions: z.boolean(),
      nameIdFormat: z.string(),
      attributeMapping: z.record(z.string())
    }).optional(),
    oauth: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      authorizationUrl: z.string().url(),
      tokenUrl: z.string().url(),
      scope: z.array(z.string()),
      redirectUri: z.string().url(),
      responseType: z.enum(['code', 'token'])
    }).optional(),
    oidc: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      issuer: z.string().url(),
      discoveryUrl: z.string().url().optional(),
      scope: z.array(z.string()),
      responseType: z.string(),
      redirectUri: z.string().url(),
      jwksUri: z.string().url().optional()
    }).optional()
  })
});

// SAML Handler
class SAMLHandler {
  private config: SAMLConfig;

  constructor(config: SAMLConfig) {
    this.config = config;
  }

  /**
   * Generate SAML authentication request
   */
  generateAuthRequest(relayState?: string): string {
    const requestId = `_${randomBytes(16).toString('hex')}`;
    const timestamp = new Date().toISOString();
    
    const request = `
      <samlp:AuthnRequest
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${timestamp}"
        Destination="${this.config.ssoUrl}"
        AssertionConsumerServiceURL="${this.config.entityId}/acs"
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Issuer>${this.config.entityId}</saml:Issuer>
        ${this.config.nameIdFormat ? `<samlp:NameIDPolicy Format="${this.config.nameIdFormat}" AllowCreate="true" />` : ''}
      </samlp:AuthnRequest>
    `;

    return Buffer.from(request).toString('base64');
  }

  /**
   * Process SAML response
   */
  async processResponse(samlResponse: string): Promise<SSOUser> {
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString();
      
      // Basic XML parsing for SAML assertion
      const emailMatch = decoded.match(/<saml:AttributeValue[^>]*>([^<]+@[^<]+)<\/saml:AttributeValue>/);
      const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
      
      if (!emailMatch || !nameIdMatch) {
        throw new Error('Invalid SAML response: missing required attributes');
      }

      const email = emailMatch[1];
      const externalId = nameIdMatch[1];

      // Extract attributes based on mapping
      const attributes: Record<string, any> = {};
      for (const [key, xpath] of Object.entries(this.config.attributeMapping)) {
        const attrMatch = decoded.match(new RegExp(`<saml:Attribute[^>]*Name="${xpath}"[^>]*>\\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>`, 'i'));
        if (attrMatch) {
          attributes[key] = attrMatch[1];
        }
      }

      return {
        id: createHash('sha256').update(`saml:${externalId}`).digest('hex'),
        externalId,
        email,
        firstName: attributes.firstName,
        lastName: attributes.lastName,
        displayName: attributes.displayName || email,
        roles: attributes.roles ? attributes.roles.split(',') : [],
        groups: attributes.groups ? attributes.groups.split(',') : [],
        tenantId: '', // Set by caller
        providerId: '', // Set by caller
        attributes,
        lastLogin: new Date(),
        isActive: true
      };
    } catch (error) {
      throw new Error(`SAML response processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// OAuth2 Handler
class OAuth2Handler {
  private config: OAuth2Config;

  constructor(config: OAuth2Config) {
    this.config = config;
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: this.config.responseType,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(' '),
      state
    });

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600
      };
    } catch (error) {
      throw new Error(`OAuth2 token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user info using access token
   */
  async getUserInfo(accessToken: string): Promise<SSOUser> {
    try {
      const response = await fetch(`${this.config.authorizationUrl.replace('/oauth/authorize', '/api/user')}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        id: createHash('sha256').update(`oauth:${data.id}`).digest('hex'),
        externalId: data.id.toString(),
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        displayName: data.name || data.email,
        roles: data.roles || [],
        groups: data.groups || [],
        tenantId: '', // Set by caller
        providerId: '', // Set by caller
        attributes: data,
        lastLogin: new Date(),
        isActive: true
      };
    } catch (error) {
      throw new Error(`OAuth2 user info failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// OpenID Connect Handler
class OIDCHandler {
  private config: OIDCConfig;

  constructor(config: OIDCConfig) {
    this.config = config;
  }

  /**
   * Generate OIDC authorization URL
   */
  getAuthorizationUrl(state: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: this.config.responseType,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(' '),
      state,
      nonce
    });

    return `${this.config.issuer}/auth?${params.toString()}`;
  }

  /**
   * Validate and decode ID token
   */
  async validateIdToken(idToken: string): Promise<SSOUser> {
    try {
      // Basic JWT parsing (in production, use proper JWT library with signature validation)
      const [, payload] = idToken.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

      // Validate issuer and audience
      if (decoded.iss !== this.config.issuer) {
        throw new Error('Invalid issuer');
      }

      if (decoded.aud !== this.config.clientId) {
        throw new Error('Invalid audience');
      }

      // Check expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return {
        id: createHash('sha256').update(`oidc:${decoded.sub}`).digest('hex'),
        externalId: decoded.sub,
        email: decoded.email,
        firstName: decoded.given_name,
        lastName: decoded.family_name,
        displayName: decoded.name || decoded.email,
        roles: decoded.roles || [],
        groups: decoded.groups || [],
        tenantId: '', // Set by caller
        providerId: '', // Set by caller
        attributes: decoded,
        lastLogin: new Date(),
        isActive: true
      };
    } catch (error) {
      throw new Error(`OIDC token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Session Store
class SessionStore {
  private sessions = new Map<string, SSOSession>();
  private sessionsByUser = new Map<string, Set<string>>();

  /**
   * Create new SSO session
   */
  createSession(sessionData: Omit<SSOSession, 'id' | 'createdAt'>): SSOSession {
    const session: SSOSession = {
      id: randomBytes(32).toString('hex'),
      ...sessionData,
      createdAt: new Date()
    };

    this.sessions.set(session.id, session);
    
    if (!this.sessionsByUser.has(session.userId)) {
      this.sessionsByUser.set(session.userId, new Set());
    }
    this.sessionsByUser.get(session.userId)!.add(session.id);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SSOSession | null {
    const session = this.sessions.get(sessionId);
    
    if (session && session.expiresAt < new Date()) {
      this.deleteSession(sessionId);
      return null;
    }

    return session || null;
  }

  /**
   * Update session
   */
  updateSession(sessionId: string, updates: Partial<SSOSession>): SSOSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    const userSessions = this.sessionsByUser.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.sessionsByUser.delete(session.userId);
      }
    }

    return true;
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): SSOSession[] {
    const sessionIds = this.sessionsByUser.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(Boolean) as SSOSession[];
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): number {
    let cleanedCount = 0;
    const now = new Date();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// Main Enterprise SSO Service
export class EnterpriseSSO extends EventEmitter {
  private configurations = new Map<string, SSOConfiguration>();
  private sessionStore = new SessionStore();
  private handlers = new Map<string, SAMLHandler | OAuth2Handler | OIDCHandler>();

  constructor() {
    super();
    
    // Cleanup expired sessions every hour
    setInterval(() => {
      const cleaned = this.sessionStore.cleanupExpiredSessions();
      if (cleaned > 0) {
        this.emit('sessionsCleanup', { cleanedCount: cleaned });
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Register SSO configuration
   */
  async registerConfiguration(config: SSOConfiguration): Promise<void> {
    try {
      // Validate configuration
      SSOConfigSchema.parse(config);

      // Create appropriate handler
      let handler: SAMLHandler | OAuth2Handler | OIDCHandler;
      
      switch (config.protocol) {
        case 'SAML':
          if (!config.metadata.saml) throw new Error('SAML configuration required');
          handler = new SAMLHandler(config.metadata.saml);
          break;
        case 'OAuth2':
          if (!config.metadata.oauth) throw new Error('OAuth2 configuration required');
          handler = new OAuth2Handler(config.metadata.oauth);
          break;
        case 'OIDC':
          if (!config.metadata.oidc) throw new Error('OIDC configuration required');
          handler = new OIDCHandler(config.metadata.oidc);
          break;
        default:
          throw new Error(`Unsupported protocol: ${config.protocol}`);
      }

      this.configurations.set(config.id, config);
      this.handlers.set(config.id, handler);

      this.emit('configurationRegistered', { configuration: config });
    } catch (error) {
      throw new Error(`Failed to register SSO configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get SSO configuration
   */
  getConfiguration(configId: string): SSOConfiguration | null {
    return this.configurations.get(configId) || null;
  }

  /**
   * Get configurations for tenant
   */
  getTenantConfigurations(tenantId: string): SSOConfiguration[] {
    return Array.from(this.configurations.values())
      .filter(config => config.tenantId === tenantId && config.enabled);
  }

  /**
   * Initiate SSO authentication
   */
  async initiateAuth(configId: string, options: { 
    relayState?: string; 
    state?: string; 
    nonce?: string; 
  } = {}): Promise<{ url: string; metadata?: any }> {
    const config = this.configurations.get(configId);
    if (!config || !config.enabled) {
      throw new Error('SSO configuration not found or disabled');
    }

    const handler = this.handlers.get(configId);
    if (!handler) {
      throw new Error('SSO handler not initialized');
    }

    try {
      switch (config.protocol) {
        case 'SAML': {
          const samlHandler = handler as SAMLHandler;
          const request = samlHandler.generateAuthRequest(options.relayState);
          return {
            url: `${config.metadata.saml!.ssoUrl}?SAMLRequest=${encodeURIComponent(request)}`,
            metadata: { request }
          };
        }
        case 'OAuth2': {
          const oauthHandler = handler as OAuth2Handler;
          const state = options.state || randomBytes(16).toString('hex');
          return {
            url: oauthHandler.getAuthorizationUrl(state),
            metadata: { state }
          };
        }
        case 'OIDC': {
          const oidcHandler = handler as OIDCHandler;
          const state = options.state || randomBytes(16).toString('hex');
          const nonce = options.nonce || randomBytes(16).toString('hex');
          return {
            url: oidcHandler.getAuthorizationUrl(state, nonce),
            metadata: { state, nonce }
          };
        }
        default:
          throw new Error(`Unsupported protocol: ${config.protocol}`);
      }
    } catch (error) {
      throw new Error(`Failed to initiate SSO auth: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process SSO callback/response
   */
  async processCallback(configId: string, data: {
    samlResponse?: string;
    code?: string;
    idToken?: string;
    accessToken?: string;
  }): Promise<{ user: SSOUser; session: SSOSession }> {
    const config = this.configurations.get(configId);
    if (!config || !config.enabled) {
      throw new Error('SSO configuration not found or disabled');
    }

    const handler = this.handlers.get(configId);
    if (!handler) {
      throw new Error('SSO handler not initialized');
    }

    let user: SSOUser;
    let tokens: { accessToken?: string; refreshToken?: string; idToken?: string } = {};

    try {
      switch (config.protocol) {
        case 'SAML': {
          if (!data.samlResponse) throw new Error('SAML response required');
          const samlHandler = handler as SAMLHandler;
          user = await samlHandler.processResponse(data.samlResponse);
          break;
        }
        case 'OAuth2': {
          if (!data.code) throw new Error('Authorization code required');
          const oauthHandler = handler as OAuth2Handler;
          const tokenData = await oauthHandler.exchangeCodeForTokens(data.code);
          tokens.accessToken = tokenData.accessToken;
          tokens.refreshToken = tokenData.refreshToken;
          user = await oauthHandler.getUserInfo(tokenData.accessToken);
          break;
        }
        case 'OIDC': {
          if (!data.idToken) throw new Error('ID token required');
          const oidcHandler = handler as OIDCHandler;
          user = await oidcHandler.validateIdToken(data.idToken);
          tokens.idToken = data.idToken;
          tokens.accessToken = data.accessToken;
          break;
        }
        default:
          throw new Error(`Unsupported protocol: ${config.protocol}`);
      }

      // Set user tenant and provider info
      user.tenantId = config.tenantId;
      user.providerId = config.id;

      // Create session
      const session = this.sessionStore.createSession({
        userId: user.id,
        tenantId: user.tenantId,
        providerId: config.id,
        protocol: config.protocol,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        attributes: user.attributes
      });

      this.emit('userAuthenticated', { user, session, configuration: config });

      return { user, session };
    } catch (error) {
      this.emit('authenticationFailed', { error, configId });
      throw new Error(`SSO callback processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): SSOSession | null {
    return this.sessionStore.getSession(sessionId);
  }

  /**
   * Refresh session
   */
  async refreshSession(sessionId: string): Promise<SSOSession | null> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return null;

    const config = this.configurations.get(session.providerId);
    if (!config) return null;