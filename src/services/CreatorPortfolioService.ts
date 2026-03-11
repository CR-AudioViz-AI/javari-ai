import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { Logger } from '../utils/Logger';

/**
 * Portfolio configuration and theme settings
 */
export interface PortfolioConfig {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  customUrl: string;
  theme: PortfolioTheme;
  layout: PortfolioLayout;
  sections: PortfolioSection[];
  seoSettings: SEOSettings;
  socialSettings: SocialSettings;
  isPublic: boolean;
  customDomain?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Portfolio theme customization options
 */
export interface PortfolioTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  layout: 'grid' | 'list' | 'masonry' | 'timeline';
  animations: boolean;
  customCSS?: string;
}

/**
 * Portfolio layout configuration
 */
export interface PortfolioLayout {
  header: HeaderConfig;
  navigation: NavigationConfig;
  footer: FooterConfig;
  sidebar?: SidebarConfig;
}

/**
 * Portfolio section types and configurations
 */
export interface PortfolioSection {
  id: string;
  type: 'hero' | 'agents' | 'services' | 'achievements' | 'testimonials' | 'contact' | 'custom';
  title: string;
  content: any;
  order: number;
  isVisible: boolean;
  settings: SectionSettings;
}

/**
 * Agent showcase configuration
 */
export interface AgentShowcase {
  agentId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string;
  demoUrl?: string;
  githubUrl?: string;
  featured: boolean;
  metrics: AgentMetrics;
}

/**
 * Service listing configuration
 */
export interface ServiceListing {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing: PricingTier[];
  features: string[];
  thumbnail: string;
  availability: 'available' | 'booked' | 'coming_soon';
  rating: number;
  reviewCount: number;
}

/**
 * Achievement display configuration
 */
export interface Achievement {
  id: string;
  type: 'badge' | 'certificate' | 'milestone' | 'award';
  title: string;
  description: string;
  icon: string;
  dateEarned: Date;
  verificationUrl?: string;
  category: string;
  level?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

/**
 * SEO settings and metadata
 */
export interface SEOSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImage?: string;
  twitterCard: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  structuredData: any;
  sitemap: boolean;
  robots: 'index,follow' | 'noindex,nofollow' | 'index,nofollow' | 'noindex,follow';
}

/**
 * Social sharing configuration
 */
export interface SocialSettings {
  platforms: SocialPlatform[];
  shareButtons: boolean;
  socialProfiles: SocialProfile[];
  ogImageTemplate: string;
  defaultShareText: string;
}

/**
 * Portfolio analytics data
 */
export interface PortfolioAnalytics {
  portfolioId: string;
  views: number;
  uniqueVisitors: number;
  shareCount: number;
  contactRequests: number;
  topReferrers: string[];
  popularSections: string[];
  conversionRate: number;
  averageTimeOnSite: number;
  bounceRate: number;
  deviceBreakdown: DeviceStats;
  geographicData: GeographicStats;
}

/**
 * Portfolio builder and management service
 */
export class CreatorPortfolioService {
  private supabase: SupabaseClient<Database>;
  private logger: Logger;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.logger = new Logger('CreatorPortfolioService');
  }

  /**
   * Create a new portfolio for a creator
   */
  async createPortfolio(
    creatorId: string,
    config: Partial<PortfolioConfig>
  ): Promise<PortfolioConfig> {
    try {
      this.logger.info('Creating portfolio', { creatorId });

      // Check if custom URL is available
      if (config.customUrl) {
        const isAvailable = await this.isCustomUrlAvailable(config.customUrl);
        if (!isAvailable) {
          throw new Error('Custom URL is already taken');
        }
      }

      const portfolioData = {
        creator_id: creatorId,
        title: config.title || 'My Portfolio',
        description: config.description || '',
        custom_url: config.customUrl || this.generateCustomUrl(),
        theme: config.theme || this.getDefaultTheme(),
        layout: config.layout || this.getDefaultLayout(),
        sections: config.sections || this.getDefaultSections(),
        seo_settings: config.seoSettings || this.getDefaultSEO(),
        social_settings: config.socialSettings || this.getDefaultSocialSettings(),
        is_public: config.isPublic ?? false,
        custom_domain: config.customDomain,
      };

      const { data, error } = await this.supabase
        .from('creator_portfolios')
        .insert(portfolioData)
        .select()
        .single();

      if (error) throw error;

      // Initialize analytics
      await this.initializeAnalytics(data.id);

      // Generate initial SEO metadata
      await this.generateSEOMetadata(data.id);

      return this.mapPortfolioData(data);
    } catch (error) {
      this.logger.error('Failed to create portfolio', { error, creatorId });
      throw error;
    }
  }

  /**
   * Update portfolio configuration
   */
  async updatePortfolio(
    portfolioId: string,
    updates: Partial<PortfolioConfig>
  ): Promise<PortfolioConfig> {
    try {
      this.logger.info('Updating portfolio', { portfolioId });

      // Validate custom URL if being updated
      if (updates.customUrl) {
        const isAvailable = await this.isCustomUrlAvailable(updates.customUrl, portfolioId);
        if (!isAvailable) {
          throw new Error('Custom URL is already taken');
        }
      }

      const updateData = this.mapPortfolioUpdates(updates);

      const { data, error } = await this.supabase
        .from('creator_portfolios')
        .update(updateData)
        .eq('id', portfolioId)
        .select()
        .single();

      if (error) throw error;

      // Regenerate SEO metadata if relevant fields changed
      if (updates.title || updates.description || updates.seoSettings) {
        await this.generateSEOMetadata(portfolioId);
      }

      return this.mapPortfolioData(data);
    } catch (error) {
      this.logger.error('Failed to update portfolio', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Get portfolio by ID
   */
  async getPortfolio(portfolioId: string): Promise<PortfolioConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapPortfolioData(data);
    } catch (error) {
      this.logger.error('Failed to get portfolio', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Get portfolio by custom URL
   */
  async getPortfolioByUrl(customUrl: string): Promise<PortfolioConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_portfolios')
        .select('*')
        .eq('custom_url', customUrl)
        .eq('is_public', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      // Track portfolio view
      await this.trackPortfolioView(data.id);

      return this.mapPortfolioData(data);
    } catch (error) {
      this.logger.error('Failed to get portfolio by URL', { error, customUrl });
      throw error;
    }
  }

  /**
   * Get portfolios by creator
   */
  async getCreatorPortfolios(creatorId: string): Promise<PortfolioConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('creator_portfolios')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(this.mapPortfolioData);
    } catch (error) {
      this.logger.error('Failed to get creator portfolios', { error, creatorId });
      throw error;
    }
  }

  /**
   * Delete portfolio
   */
  async deletePortfolio(portfolioId: string): Promise<void> {
    try {
      this.logger.info('Deleting portfolio', { portfolioId });

      const { error } = await this.supabase
        .from('creator_portfolios')
        .delete()
        .eq('id', portfolioId);

      if (error) throw error;

      // Clean up related data
      await this.cleanupPortfolioData(portfolioId);
    } catch (error) {
      this.logger.error('Failed to delete portfolio', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Add agent to portfolio showcase
   */
  async addAgentShowcase(
    portfolioId: string,
    agentShowcase: AgentShowcase
  ): Promise<void> {
    try {
      this.logger.info('Adding agent showcase', { portfolioId, agentId: agentShowcase.agentId });

      const { error } = await this.supabase
        .from('portfolio_agents')
        .insert({
          portfolio_id: portfolioId,
          agent_id: agentShowcase.agentId,
          title: agentShowcase.title,
          description: agentShowcase.description,
          category: agentShowcase.category,
          tags: agentShowcase.tags,
          thumbnail: agentShowcase.thumbnail,
          demo_url: agentShowcase.demoUrl,
          github_url: agentShowcase.githubUrl,
          featured: agentShowcase.featured,
          metrics: agentShowcase.metrics,
        });

      if (error) throw error;
    } catch (error) {
      this.logger.error('Failed to add agent showcase', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Update service listing
   */
  async updateServiceListing(
    portfolioId: string,
    serviceId: string,
    service: Partial<ServiceListing>
  ): Promise<void> {
    try {
      this.logger.info('Updating service listing', { portfolioId, serviceId });

      const updateData = {
        name: service.name,
        description: service.description,
        category: service.category,
        pricing: service.pricing,
        features: service.features,
        thumbnail: service.thumbnail,
        availability: service.availability,
        rating: service.rating,
        review_count: service.reviewCount,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from('portfolio_services')
        .update(updateData)
        .eq('id', serviceId)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;
    } catch (error) {
      this.logger.error('Failed to update service listing', { error, portfolioId, serviceId });
      throw error;
    }
  }

  /**
   * Add achievement to portfolio
   */
  async addAchievement(portfolioId: string, achievement: Achievement): Promise<void> {
    try {
      this.logger.info('Adding achievement', { portfolioId, achievementId: achievement.id });

      const { error } = await this.supabase
        .from('portfolio_achievements')
        .insert({
          portfolio_id: portfolioId,
          type: achievement.type,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          date_earned: achievement.dateEarned.toISOString(),
          verification_url: achievement.verificationUrl,
          category: achievement.category,
          level: achievement.level,
        });

      if (error) throw error;
    } catch (error) {
      this.logger.error('Failed to add achievement', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Generate social share content
   */
  async generateSocialShare(
    portfolioId: string,
    platform: string,
    customText?: string
  ): Promise<{ url: string; text: string; imageUrl?: string }> {
    try {
      const portfolio = await this.getPortfolio(portfolioId);
      if (!portfolio) throw new Error('Portfolio not found');

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://craudioviz.ai';
      const portfolioUrl = `${baseUrl}/creator/${portfolio.customUrl}`;

      // Generate OG image
      const ogImageUrl = await this.generateOGImage(portfolio);

      const shareText = customText || 
        portfolio.socialSettings.defaultShareText ||
        `Check out my AI portfolio: ${portfolio.title}`;

      // Track social share
      await this.trackSocialShare(portfolioId, platform);

      return {
        url: portfolioUrl,
        text: shareText,
        imageUrl: ogImageUrl,
      };
    } catch (error) {
      this.logger.error('Failed to generate social share', { error, portfolioId, platform });
      throw error;
    }
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(
    portfolioId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<PortfolioAnalytics> {
    try {
      const { data, error } = await this.supabase
        .from('portfolio_analytics')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .single();

      if (error) throw error;

      return {
        portfolioId: data.portfolio_id,
        views: data.views,
        uniqueVisitors: data.unique_visitors,
        shareCount: data.share_count,
        contactRequests: data.contact_requests,
        topReferrers: data.top_referrers,
        popularSections: data.popular_sections,
        conversionRate: data.conversion_rate,
        averageTimeOnSite: data.average_time_on_site,
        bounceRate: data.bounce_rate,
        deviceBreakdown: data.device_breakdown,
        geographicData: data.geographic_data,
      };
    } catch (error) {
      this.logger.error('Failed to get portfolio analytics', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Update portfolio theme
   */
  async updatePortfolioTheme(
    portfolioId: string,
    theme: PortfolioTheme
  ): Promise<void> {
    try {
      this.logger.info('Updating portfolio theme', { portfolioId, themeId: theme.id });

      const { error } = await this.supabase
        .from('creator_portfolios')
        .update({ theme })
        .eq('id', portfolioId);

      if (error) throw error;

      // Regenerate OG image with new theme
      await this.regenerateOGImage(portfolioId);
    } catch (error) {
      this.logger.error('Failed to update portfolio theme', { error, portfolioId });
      throw error;
    }
  }

  /**
   * Search public portfolios
   */
  async searchPortfolios(
    query: string,
    filters?: {
      category?: string;
      tags?: string[];
      featured?: boolean;
    }
  ): Promise<PortfolioConfig[]> {
    try {
      let queryBuilder = this.supabase
        .from('creator_portfolios')
        .select('*')
        .eq('is_public', true);

      if (query) {
        queryBuilder = queryBuilder.or(
          `title.ilike.%${query}%,description.ilike.%${query}%`
        );
      }

      if (filters?.category) {
        queryBuilder = queryBuilder.contains('tags', [filters.category]);
      }

      if (filters?.tags?.length) {
        queryBuilder = queryBuilder.overlaps('tags', filters.tags);
      }

      const { data, error } = await queryBuilder
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return data.map(this.mapPortfolioData);
    } catch (error) {
      this.logger.error('Failed to search portfolios', { error, query });
      throw error;
    }
  }

  // Private helper methods

  private async isCustomUrlAvailable(
    customUrl: string,
    excludeId?: string
  ): Promise<boolean> {
    const query = this.supabase
      .from('creator_portfolios')
      .select('id')
      .eq('custom_url', customUrl);

    if (excludeId) {
      query.neq('id', excludeId);
    }

    const { data } = await query;
    return !data || data.length === 0;
  }

  private generateCustomUrl(): string {
    return `creator-${Date.now()}`;
  }

  private getDefaultTheme(): PortfolioTheme {
    return {
      id: 'default',
      name: 'Default',
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981',
      backgroundColor: '#FFFFFF',
      textColor: '#111827',
      fontFamily: 'Inter',
      layout: 'grid',
      animations: true,
    };
  }

  private getDefaultLayout(): PortfolioLayout {
    return {
      header: {
        logo: true,
        navigation: true,
        social: true,
      },
      navigation: {
        style: 'horizontal',
        items: ['agents', 'services', 'achievements', 'contact'],
      },
      footer: {
        copyright: true,
        social: true,
        links: [],
      },
    };
  }

  private getDefaultSections(): PortfolioSection[] {
    return [
      {
        id: 'hero',
        type: 'hero',
        title: 'Hero Section',
        content: {},
        order: 0,
        isVisible: true,
        settings: {},
      },
      {
        id: 'agents',
        type: 'agents',
        title: 'AI Agents',
        content: {},
        order: 1,
        isVisible: true,
        settings: {},
      },
    ];
  }

  private getDefaultSEO(): SEOSettings {
    return {
      metaTitle: 'AI Creator Portfolio',
      metaDescription: 'Showcase of AI agents and services',
      keywords: ['AI', 'portfolio', 'creator'],
      twitterCard: 'summary_large_image',
      structuredData: {},
      sitemap: true,
      robots: 'index,follow',
    };
  }

  private getDefaultSocialSettings(): SocialSettings {
    return {
      platforms: ['twitter', 'linkedin'],
      shareButtons: true,
      socialProfiles: [],
      ogImageTemplate: 'default',
      defaultShareText: 'Check out my AI portfolio!',
    };
  }

  private async initializeAnalytics(portfolioId: string): Promise<void> {
    const { error } = await this.supabase
      .from('portfolio_analytics')
      .insert({
        portfolio_id: portfolioId,
        views: 0,
        unique_visitors: 0,
        share_count: 0,
        contact_requests: 0,
        top_referrers: [],
        popular_sections: [],
        conversion_rate: 0,
        average_time_on_site: 0,
        bounce_rate: 0,
        device_breakdown: {},
        geographic_data: {},
      });

    if (error) {
      this.logger.warn('Failed to initialize analytics', { error, portfolioId });
    }
  }

  private async generateSEOMetadata(portfolioId: string): Promise<void> {
    // Implementation for SEO metadata generation
    this.logger.info('Generating SEO metadata', { portfolioId });
  }

  private async generateOGImage(portfolio: PortfolioConfig): Promise<string> {
    // Implementation for OG image generation
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/og?portfolio=${portfolio.id}`;
  }

  private async regenerateOGImage(portfolioId: string): Promise<void> {
    // Implementation for OG image regeneration
    this.logger.info('Regenerating OG image', { portfolioId });
  }

  private async trackPortfolioView(portfolioId: string): Promise<void> {
    await this.supabase.rpc('increment_portfolio_views', {
      portfolio_id: portfolioId,
    });
  }

  private async trackSocialShare(portfolioId: string, platform: string): Promise<void> {
    await this.supabase.rpc('increment_portfolio_shares', {
      portfolio_id: portfolioId,
      platform,
    });
  }

  private async cleanupPortfolioData(portfolioId: string): Promise<void> {
    // Clean up related data when portfolio is deleted
    const tables = [
      'portfolio_agents',
      'portfolio_services',
      'portfolio_achievements',
      'portfolio_analytics',
    ];

    for (const table of tables) {
      await this.supabase
        .from(table)
        .delete()
        .eq('portfolio_id', portfolioId);
    }
  }

  private mapPortfolioData(data: any): PortfolioConfig {
    return {
      id: data.id,
      creatorId: data.creator_id,
      title: data.title,
      description: data.description,
      customUrl: data.custom_