import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../lib/logger';
import { ActiveDirectoryProvider } from './providers/ActiveDirectoryProvider';
import { OktaProvider } from './providers/OktaProvider';
import { SAMLProvider } from './providers/SAMLProvider';
import { BaseProvider } from './providers/BaseProvider';
import { UserProvisioningService } from './UserProvisioningService';
import { SSOConfigService } from './SSOConfigService';
import {
  SSOProvider,
  SSOConfiguration,
  SSOAuthResult,
  SSOUser,
  ProviderType,
  SSOLoginRequest,
  SSOCallbackData,
  UserSyncResult,
  SSOError,
  SSOProviderConfig
} from '../../types/sso';
import Redis from 'ioredis';

/**
 * Multi-Provider Single Sign-On Service
 * 
 * Provides comprehensive SSO functionality supporting multiple enterprise identity providers
 * including Active Directory, Okta, and SAML-based systems with automated user provisioning.
 */
export class MultiProviderSSOService {
  private readonly logger: Logger;
  private readonly supabase: ReturnType<typeof createClient>;
  private readonly redis: Redis;
  private readonly providers: Map<ProviderType, BaseProvider>;
  private readonly userProvisioningService: UserProvisioningService;
  private readonly configService: SSOConfigService;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    redisUrl: string
  ) {
    this.logger = new Logger('MultiProviderSSOService');
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisUrl);
    this.providers = new Map();
    this.userProvisioningService = new UserProvisioningService(this.supabase);
    this.configService = new SSOConfigService(this.supabase);

    this.initializeProviders();
  }

  /**
   * Initialize all supported SSO providers
   */
  private initializeProviders(): void {
    this.providers.set('active_directory', new ActiveDirectoryProvider());
    this.providers.set('okta', new OktaProvider());
    this.providers.set('saml', new SAMLProvider());
  }

  /**
   * Get available SSO providers for an organization
   */
  async getAvailableProviders(organizationId: string): Promise<SSOProvider[]> {
    try {
      const configs = await this.configService.getOrganizationConfigs(organizationId);
      
      return configs
        .filter(config => config.enabled)
        .map(config => ({
          id: config.id,
          type: config.provider_type,
          name: config.display_name,
          enabled: config.enabled,
          description: config.description,
          iconUrl: config.icon_url,
          organizationId: config.organization_id
        }));
    } catch (error) {
      this.logger.error('Failed to get available providers', { organizationId, error });
      throw new SSOError('PROVIDER_FETCH_FAILED', 'Failed to retrieve available providers');
    }
  }

  /**
   * Initiate SSO login process
   */
  async initiateLogin(request: SSOLoginRequest): Promise<{ redirectUrl: string; state: string }> {
    try {
      const { organizationId, providerType, returnUrl } = request;

      // Get provider configuration
      const config = await this.configService.getProviderConfig(organizationId, providerType);
      if (!config || !config.enabled) {
        throw new SSOError('PROVIDER_NOT_ENABLED', 'SSO provider is not enabled for this organization');
      }

      // Get provider instance
      const provider = this.providers.get(providerType);
      if (!provider) {
        throw new SSOError('PROVIDER_NOT_SUPPORTED', `Provider ${providerType} is not supported`);
      }

      // Generate state for CSRF protection
      const state = this.generateState();
      
      // Cache state and return URL
      await this.cacheLoginState(state, {
        organizationId,
        providerType,
        returnUrl,
        timestamp: Date.now()
      });

      // Get authorization URL from provider
      const redirectUrl = await provider.getAuthorizationUrl(config, state);

      this.logger.info('SSO login initiated', {
        organizationId,
        providerType,
        state
      });

      return { redirectUrl, state };
    } catch (error) {
      this.logger.error('Failed to initiate SSO login', { request, error });
      if (error instanceof SSOError) throw error;
      throw new SSOError('LOGIN_INITIATION_FAILED', 'Failed to initiate SSO login');
    }
  }

  /**
   * Handle SSO callback and complete authentication
   */
  async handleCallback(providerType: ProviderType, callbackData: SSOCallbackData): Promise<SSOAuthResult> {
    try {
      const { code, state, error: authError } = callbackData;

      // Check for authentication error
      if (authError) {
        throw new SSOError('AUTHENTICATION_FAILED', `Authentication failed: ${authError}`);
      }

      // Validate state
      const cachedState = await this.getLoginState(state);
      if (!cachedState || cachedState.providerType !== providerType) {
        throw new SSOError('INVALID_STATE', 'Invalid or expired state parameter');
      }

      // Get provider and configuration
      const provider = this.providers.get(providerType);
      const config = await this.configService.getProviderConfig(
        cachedState.organizationId,
        providerType
      );

      if (!provider || !config) {
        throw new SSOError('PROVIDER_NOT_FOUND', 'Provider or configuration not found');
      }

      // Exchange authorization code for tokens
      const tokenResult = await provider.exchangeCodeForTokens(config, code, state);
      
      // Get user information from provider
      const userInfo = await provider.getUserInfo(config, tokenResult.accessToken);

      // Provision or update user
      const provisionResult = await this.userProvisioningService.provisionUser({
        externalId: userInfo.id,
        email: userInfo.email,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        organizationId: cachedState.organizationId,
        providerType,
        attributes: userInfo.attributes,
        groups: userInfo.groups,
        roles: userInfo.roles
      });

      // Create or update session
      const sessionToken = await this.createSession({
        userId: provisionResult.user.id,
        organizationId: cachedState.organizationId,
        providerType,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        expiresAt: tokenResult.expiresAt
      });

      // Clean up state
      await this.clearLoginState(state);

      this.logger.info('SSO authentication successful', {
        userId: provisionResult.user.id,
        organizationId: cachedState.organizationId,
        providerType
      });

      return {
        success: true,
        user: provisionResult.user,
        sessionToken,
        returnUrl: cachedState.returnUrl,
        isNewUser: provisionResult.isNewUser
      };
    } catch (error) {
      this.logger.error('Failed to handle SSO callback', { providerType, callbackData, error });
      if (error instanceof SSOError) throw error;
      throw new SSOError('CALLBACK_PROCESSING_FAILED', 'Failed to process SSO callback');
    }
  }

  /**
   * Logout user from SSO session
   */
  async logout(sessionToken: string): Promise<{ logoutUrl?: string }> {
    try {
      // Get session information
      const session = await this.getSession(sessionToken);
      if (!session) {
        throw new SSOError('SESSION_NOT_FOUND', 'Session not found');
      }

      // Get provider configuration
      const config = await this.configService.getProviderConfig(
        session.organizationId,
        session.providerType
      );
      
      if (config) {
        const provider = this.providers.get(session.providerType);
        if (provider) {
          // Get logout URL from provider if supported
          const logoutUrl = await provider.getLogoutUrl(config, session.accessToken);
          
          // Revoke tokens if supported
          await provider.revokeTokens(config, session.accessToken, session.refreshToken);
          
          // Clear session
          await this.clearSession(sessionToken);

          this.logger.info('SSO logout completed', {
            userId: session.userId,
            providerType: session.providerType
          });

          return { logoutUrl };
        }
      }

      // Clear session even if provider logout fails
      await this.clearSession(sessionToken);
      return {};
    } catch (error) {
      this.logger.error('Failed to logout SSO session', { sessionToken, error });
      throw new SSOError('LOGOUT_FAILED', 'Failed to logout SSO session');
    }
  }

  /**
   * Sync users from all enabled providers
   */
  async syncUsers(organizationId: string): Promise<UserSyncResult[]> {
    try {
      const configs = await this.configService.getOrganizationConfigs(organizationId);
      const enabledConfigs = configs.filter(config => config.enabled && config.auto_sync);

      const syncResults: UserSyncResult[] = [];

      for (const config of enabledConfigs) {
        try {
          const provider = this.providers.get(config.provider_type);
          if (!provider) continue;

          // Get users from provider
          const users = await provider.getUsers(config);

          // Sync each user
          for (const user of users) {
            try {
              const result = await this.userProvisioningService.syncUser({
                externalId: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                organizationId,
                providerType: config.provider_type,
                attributes: user.attributes,
                groups: user.groups,
                roles: user.roles,
                active: user.active
              });

              syncResults.push({
                providerId: config.id,
                providerType: config.provider_type,
                userId: user.id,
                email: user.email,
                action: result.action,
                success: true,
                timestamp: new Date()
              });
            } catch (userError) {
              this.logger.error('Failed to sync individual user', { user, userError });
              syncResults.push({
                providerId: config.id,
                providerType: config.provider_type,
                userId: user.id,
                email: user.email,
                action: 'failed',
                success: false,
                error: userError instanceof Error ? userError.message : 'Unknown error',
                timestamp: new Date()
              });
            }
          }
        } catch (providerError) {
          this.logger.error('Failed to sync users from provider', {
            providerId: config.id,
            providerType: config.provider_type,
            providerError
          });
        }
      }

      // Update last sync timestamp
      await this.configService.updateLastSyncTime(organizationId);

      this.logger.info('User sync completed', {
        organizationId,
        totalResults: syncResults.length,
        successful: syncResults.filter(r => r.success).length
      });

      return syncResults;
    } catch (error) {
      this.logger.error('Failed to sync users', { organizationId, error });
      throw new SSOError('USER_SYNC_FAILED', 'Failed to sync users from providers');
    }
  }

  /**
   * Configure SSO provider for organization
   */
  async configureProvider(
    organizationId: string,
    providerType: ProviderType,
    config: SSOProviderConfig
  ): Promise<SSOConfiguration> {
    try {
      const provider = this.providers.get(providerType);
      if (!provider) {
        throw new SSOError('PROVIDER_NOT_SUPPORTED', `Provider ${providerType} is not supported`);
      }

      // Validate configuration
      await provider.validateConfiguration(config);

      // Save configuration
      const savedConfig = await this.configService.saveConfiguration({
        organization_id: organizationId,
        provider_type: providerType,
        config,
        enabled: true,
        display_name: config.displayName || providerType,
        description: config.description,
        icon_url: config.iconUrl,
        auto_sync: config.autoSync || false,
        sync_interval: config.syncInterval || 3600
      });

      this.logger.info('SSO provider configured', {
        organizationId,
        providerType,
        configId: savedConfig.id
      });

      return savedConfig;
    } catch (error) {
      this.logger.error('Failed to configure SSO provider', {
        organizationId,
        providerType,
        error
      });
      if (error instanceof SSOError) throw error;
      throw new SSOError('CONFIGURATION_FAILED', 'Failed to configure SSO provider');
    }
  }

  /**
   * Test SSO provider connection
   */
  async testConnection(
    organizationId: string,
    providerType: ProviderType
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.configService.getProviderConfig(organizationId, providerType);
      if (!config) {
        throw new SSOError('PROVIDER_NOT_CONFIGURED', 'Provider is not configured');
      }

      const provider = this.providers.get(providerType);
      if (!provider) {
        throw new SSOError('PROVIDER_NOT_SUPPORTED', `Provider ${providerType} is not supported`);
      }

      await provider.testConnection(config);

      return {
        success: true,
        message: 'Connection test successful'
      };
    } catch (error) {
      this.logger.error('SSO connection test failed', {
        organizationId,
        providerType,
        error
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Generate secure state parameter
   */
  private generateState(): string {
    return Buffer.from(Math.random().toString(36) + Date.now().toString()).toString('base64');
  }

  /**
   * Cache login state for CSRF protection
   */
  private async cacheLoginState(state: string, data: any): Promise<void> {
    await this.redis.setex(`sso:state:${state}`, 600, JSON.stringify(data)); // 10 minutes
  }

  /**
   * Get cached login state
   */
  private async getLoginState(state: string): Promise<any | null> {
    const data = await this.redis.get(`sso:state:${state}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear login state
   */
  private async clearLoginState(state: string): Promise<void> {
    await this.redis.del(`sso:state:${state}`);
  }

  /**
   * Create session token
   */
  private async createSession(sessionData: any): Promise<string> {
    const sessionId = this.generateState();
    await this.redis.setex(`sso:session:${sessionId}`, 86400, JSON.stringify(sessionData)); // 24 hours
    return sessionId;
  }

  /**
   * Get session data
   */
  private async getSession(sessionToken: string): Promise<any | null> {
    const data = await this.redis.get(`sso:session:${sessionToken}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear session
   */
  private async clearSession(sessionToken: string): Promise<void> {
    await this.redis.del(`sso:session:${sessionToken}`);
  }

  /**
   * Clean up expired sessions and states
   */
  async cleanup(): Promise<void> {
    try {
      // Redis TTL handles cleanup automatically, but we can add additional cleanup logic here
      this.logger.info('SSO service cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup SSO service', { error });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    providers: Record<string, boolean>;
    redis: boolean;
    database: boolean;
  }> {
    const status = {
      healthy: true,
      providers: {} as Record<string, boolean>,
      redis: false,
      database: false
    };

    try {
      // Test Redis connection
      await this.redis.ping();
      status.redis = true;
    } catch (error) {
      status.healthy = false;
      this.logger.error('Redis health check failed', { error });
    }

    try {
      // Test database connection
      await this.supabase.from('sso_configurations').select('count').limit(1);
      status.database = true;
    } catch (error) {
      status.healthy = false;
      this.logger.error('Database health check failed', { error });
    }

    // Test provider availability
    for (const [type, provider] of this.providers) {
      try {
        status.providers[type] = await provider.isHealthy();
      } catch (error) {
        status.providers[type] = false;
        status.healthy = false;
      }
    }

    return status;
  }
}

export default MultiProviderSSOService;