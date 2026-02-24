// =============================================================================
// JAVARI AI - CENTRALIZED SUPPORT CLIENT
// =============================================================================
// Utility for Javari to submit tickets and enhancements to craudiovizai.com
// All support requests are centralized on the main platform
// Production Ready - Sunday, December 14, 2025
// =============================================================================

const CENTRAL_API_BASE = process.env.CENTRAL_SUPPORT_API || 'https://craudiovizai.com/api';

// ============ TYPES ============

export interface TicketSubmission {
  title: string;
  description: string;
  category: 'bug' | 'error' | 'question' | 'account' | 'billing' | 'feature' | 'performance' | 'security' | 'other';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  user_id?: string;
  user_email?: string;
  user_name?: string;
  error_logs?: any;
  browser_info?: any;
  source_url?: string;
}

export interface EnhancementSubmission {
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'integration' | 'ui_ux' | 'performance' | 'automation' | 'api' | 'other';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  use_case?: string;
  expected_benefit?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

export interface TicketResponse {
  success: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    status: string;
    message: string;
  };
  error?: string;
  timestamp: string;
}

export interface EnhancementResponse {
  success: boolean;
  enhancement?: {
    id: string;
    request_number: string;
    status: string;
    message: string;
  };
  error?: string;
  timestamp: string;
}

// ============ CENTRALIZED SUPPORT CLIENT ============

export class CentralizedSupportClient {
  private apiBase: string;
  private sourceApp: string;

  constructor(sourceApp: string = 'javari') {
    this.apiBase = CENTRAL_API_BASE;
    this.sourceApp = sourceApp;
  }

  /**
   * Submit a support ticket to the centralized system
   * Javari Auto-Fix Bot will automatically attempt to resolve
   */
  async submitTicket(ticket: TicketSubmission): Promise<TicketResponse> {
    try {
      const response = await fetch(`${this.apiBase}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ticket,
          source_app: this.sourceApp,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit ticket',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Submit an enhancement request to the centralized system
   * Javari AI will analyze and provide implementation writeup
   */
  async submitEnhancement(enhancement: EnhancementSubmission): Promise<EnhancementResponse> {
    try {
      const response = await fetch(`${this.apiBase}/enhancements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...enhancement,
          source_app: this.sourceApp,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit enhancement',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user's tickets from the centralized system
   */
  async getUserTickets(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/tickets?user_id=${userId}&source_app=${this.sourceApp}`);
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tickets',
      };
    }
  }

  /**
   * Get user's enhancement requests from the centralized system
   */
  async getUserEnhancements(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/enhancements?user_id=${userId}&source_app=${this.sourceApp}`);
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch enhancements',
      };
    }
  }

  /**
   * Get ticket details with comments
   */
  async getTicketDetails(ticketId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/tickets?id=${ticketId}&include_comments=true`);
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ticket details',
      };
    }
  }

  /**
   * Get enhancement details with comments
   */
  async getEnhancementDetails(enhancementId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/enhancements?id=${enhancementId}&include_comments=true`);
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch enhancement details',
      };
    }
  }

  /**
   * Add comment to a ticket
   */
  async addTicketComment(ticketId: string, content: string, authorInfo: { type: string; id?: string; name: string }): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/tickets`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          content,
          author_type: authorInfo.type,
          author_id: authorInfo.id,
          author_name: authorInfo.name,
        }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      };
    }
  }

  /**
   * Add comment to an enhancement
   */
  async addEnhancementComment(enhancementId: string, content: string, authorInfo: { type: string; id?: string; name: string }): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/enhancements`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enhancement_id: enhancementId,
          action: 'comment',
          content,
          author_type: authorInfo.type,
          author_id: authorInfo.id,
          author_name: authorInfo.name,
        }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      };
    }
  }

  /**
   * Vote on an enhancement
   */
  async voteEnhancement(enhancementId: string, userId: string, voteType: 'up' | 'down'): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/enhancements`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enhancement_id: enhancementId,
          action: 'vote',
          user_id: userId,
          vote_type: voteType,
        }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to vote',
      };
    }
  }
}

// ============ SINGLETON INSTANCE ============

let supportClientInstance: CentralizedSupportClient | null = null;

export function getSupportClient(sourceApp: string = 'javari'): CentralizedSupportClient {
  if (!supportClientInstance) {
    supportClientInstance = new CentralizedSupportClient(sourceApp);
  }
  return supportClientInstance;
}

// ============ QUICK HELPERS ============

/**
 * Quick helper to submit a bug report from Javari
 */
export async function reportBug(
  title: string,
  description: string,
  errorLogs?: any,
  userId?: string,
  userEmail?: string
): Promise<TicketResponse> {
  const client = getSupportClient('javari');
  return client.submitTicket({
    title,
    description,
    category: 'bug',
    priority: 'medium',
    error_logs: errorLogs,
    user_id: userId,
    user_email: userEmail,
  });
}

/**
 * Quick helper to submit a feature request from Javari
 */
export async function requestFeature(
  title: string,
  description: string,
  useCase?: string,
  userId?: string,
  userEmail?: string
): Promise<EnhancementResponse> {
  const client = getSupportClient('javari');
  return client.submitEnhancement({
    title,
    description,
    category: 'feature',
    use_case: useCase,
    user_id: userId,
    user_email: userEmail,
  });
}

/**
 * Auto-capture and report errors
 */
export async function captureError(
  error: Error,
  context: {
    userId?: string;
    userEmail?: string;
    url?: string;
    action?: string;
    additionalInfo?: any;
  } = {}
): Promise<TicketResponse> {
  const client = getSupportClient('javari');
  return client.submitTicket({
    title: `Auto-captured error: ${error.message.substring(0, 100)}`,
    description: `**Error:** ${error.message}\n\n**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n\n**Context:**\n${JSON.stringify(context.additionalInfo || {}, null, 2)}`,
    category: 'error',
    priority: 'high',
    error_logs: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
    },
    user_id: context.userId,
    user_email: context.userEmail,
    source_url: context.url,
  });
}
