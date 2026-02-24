// lib/javari-awareness.ts
// Conversational Awareness System - True Memory & Context
// Timestamp: 2025-11-30 04:05 AM EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// USER CONTEXT - Everything Javari knows about a user
// =====================================================

export interface UserContext {
  profile: UserProfile | null;
  recentConversations: ConversationSummary[];
  activeThreads: Thread[];
  importantMemories: Memory[];
  pendingCommitments: Commitment[];
  recentSentiment: string | null;
}

export interface UserProfile {
  display_name: string | null;
  timezone: string | null;
  role: string | null;
  company: string | null;
  skill_level: string;
  communication_style: string;
  prefers_brevity: boolean;
  prefers_code_first: boolean;
  active_projects: any[];
  total_interactions: number;
  important_notes: string[];
}

export interface ConversationSummary {
  id: string;
  topic: string;
  summary: string;
  updated_at: string;
}

export interface Thread {
  name: string;
  status: string;
  last_context: string;
  next_steps: string[];
}

export interface Memory {
  type: string;
  key: string;
  content: string;
}

export interface Commitment {
  description: string;
  due_at: string | null;
  type: string;
}

export class JavariAwareness {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // =====================================================
  // GET FULL USER CONTEXT
  // =====================================================

  async getFullContext(): Promise<UserContext> {
    const { data, error } = await supabase
      .rpc('get_user_context', { p_user_id: this.userId });

    if (error) {
      console.error('Error getting user context:', error);
      return {
        profile: null,
        recentConversations: [],
        activeThreads: [],
        importantMemories: [],
        pendingCommitments: [],
        recentSentiment: null
      };
    }

    return data || {
      profile: null,
      recentConversations: [],
      activeThreads: [],
      importantMemories: [],
      pendingCommitments: [],
      recentSentiment: null
    };
  }

  // =====================================================
  // MEMORY MANAGEMENT
  // =====================================================

  /**
   * Remember something about the user
   */
  async remember(
    type: 'fact' | 'preference' | 'project' | 'relationship' | 'commitment',
    key: string,
    content: string,
    importance: number = 5
  ): Promise<void> {
    await supabase.rpc('remember', {
      p_user_id: this.userId,
      p_memory_type: type,
      p_memory_key: key,
      p_memory_content: content,
      p_importance: importance
    });
  }

  /**
   * Recall memories by type or search term
   */
  async recall(type?: string, searchTerm?: string): Promise<Memory[]> {
    const { data, error } = await supabase.rpc('recall', {
      p_user_id: this.userId,
      p_memory_type: type || null,
      p_search_term: searchTerm || null
    });

    if (error) return [];
    return data || [];
  }

  /**
   * Get all memories for context injection
   */
  async getAllMemories(): Promise<Memory[]> {
    const { data } = await supabase
      .from('cross_conversation_memory')
      .select('memory_type, memory_key, memory_content')
      .eq('user_id', this.userId)
      .eq('is_active', true)
      .order('importance', { ascending: false })
      .limit(50);

    return (data || []).map(d => ({
      type: d.memory_type,
      key: d.memory_key,
      content: d.memory_content
    }));
  }

  // =====================================================
  // PROFILE MANAGEMENT
  // =====================================================

  /**
   * Update user profile from conversation
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: this.userId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) console.error('Error updating profile:', error);
  }

  /**
   * Increment interaction count
   */
  async recordInteraction(): Promise<void> {
    await supabase.rpc('record_user_interaction', { p_user_id: this.userId });
  }

  // =====================================================
  // CONVERSATION CONTEXT
  // =====================================================

  /**
   * Save context for current conversation
   */
  async saveConversationContext(
    conversationId: string,
    context: {
      primaryTopic?: string;
      topicsDiscussed?: string[];
      currentTask?: string;
      taskStatus?: string;
      openQuestions?: string[];
      todos?: string[];
      summary?: string;
      keyOutcomes?: string[];
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('conversation_context')
      .upsert({
        conversation_id: conversationId,
        user_id: this.userId,
        primary_topic: context.primaryTopic,
        topics_discussed: context.topicsDiscussed,
        current_task: context.currentTask,
        task_status: context.taskStatus,
        open_questions: context.openQuestions,
        todos: context.todos,
        conversation_summary: context.summary,
        key_outcomes: context.keyOutcomes,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      });

    if (error) console.error('Error saving conversation context:', error);
  }

  /**
   * Get context from previous conversation
   */
  async getPreviousConversationContext(limit: number = 3): Promise<ConversationSummary[]> {
    const { data } = await supabase
      .from('conversation_context')
      .select('conversation_id, primary_topic, conversation_summary, updated_at')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    return (data || []).map(d => ({
      id: d.conversation_id,
      topic: d.primary_topic,
      summary: d.conversation_summary,
      updated_at: d.updated_at
    }));
  }

  // =====================================================
  // THREAD MANAGEMENT
  // =====================================================

  /**
   * Create or update a thread (ongoing project/task)
   */
  async updateThread(
    threadName: string,
    updates: {
      type?: string;
      description?: string;
      status?: string;
      lastContext?: string;
      nextSteps?: string[];
      conversationId?: string;
    }
  ): Promise<void> {
    // Check if thread exists
    const { data: existing } = await supabase
      .from('conversation_threads')
      .select('id, conversation_ids')
      .eq('user_id', this.userId)
      .eq('thread_name', threadName)
      .single();

    if (existing) {
      // Update existing
      const conversationIds = existing.conversation_ids || [];
      if (updates.conversationId && !conversationIds.includes(updates.conversationId)) {
        conversationIds.push(updates.conversationId);
      }

      await supabase
        .from('conversation_threads')
        .update({
          status: updates.status,
          last_context: updates.lastContext,
          next_steps: updates.nextSteps,
          conversation_ids: conversationIds,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from('conversation_threads')
        .insert({
          user_id: this.userId,
          thread_name: threadName,
          thread_type: updates.type || 'project',
          description: updates.description,
          status: updates.status || 'active',
          last_context: updates.lastContext,
          next_steps: updates.nextSteps,
          conversation_ids: updates.conversationId ? [updates.conversationId] : []
        });
    }
  }

  /**
   * Get active threads
   */
  async getActiveThreads(): Promise<Thread[]> {
    const { data } = await supabase
      .from('conversation_threads')
      .select('thread_name, status, last_context, next_steps')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .order('last_activity_at', { ascending: false })
      .limit(5);

    return (data || []).map(d => ({
      name: d.thread_name,
      status: d.status,
      last_context: d.last_context,
      next_steps: d.next_steps
    }));
  }

  // =====================================================
  // COMMITMENTS
  // =====================================================

  /**
   * Record a commitment
   */
  async addCommitment(
    description: string,
    type: 'follow_up' | 'deliverable' | 'reminder' | 'check_in',
    dueAt?: Date,
    conversationId?: string
  ): Promise<void> {
    await supabase
      .from('commitments')
      .insert({
        user_id: this.userId,
        conversation_id: conversationId,
        commitment_type: type,
        description,
        due_at: dueAt?.toISOString()
      });
  }

  /**
   * Get pending commitments
   */
  async getPendingCommitments(): Promise<Commitment[]> {
    const { data } = await supabase
      .from('commitments')
      .select('description, due_at, commitment_type')
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .order('due_at', { ascending: true })
      .limit(10);

    return (data || []).map(d => ({
      description: d.description,
      due_at: d.due_at,
      type: d.commitment_type
    }));
  }

  /**
   * Complete a commitment
   */
  async completeCommitment(description: string): Promise<void> {
    await supabase
      .from('commitments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('user_id', this.userId)
      .ilike('description', `%${description}%`);
  }

  // =====================================================
  // SENTIMENT TRACKING
  // =====================================================

  /**
   * Log detected sentiment
   */
  async logSentiment(
    sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited' | 'confused',
    triggerPhrase?: string,
    conversationId?: string
  ): Promise<void> {
    await supabase
      .from('user_sentiment_log')
      .insert({
        user_id: this.userId,
        conversation_id: conversationId,
        sentiment,
        trigger_phrase: triggerPhrase,
        suggested_approach: this.getSuggestedApproach(sentiment)
      });
  }

  private getSuggestedApproach(sentiment: string): string {
    switch (sentiment) {
      case 'frustrated':
        return 'Be extra concise, acknowledge the difficulty, focus on solutions';
      case 'confused':
        return 'Slow down, provide step-by-step guidance, offer examples';
      case 'excited':
        return 'Match their energy, encourage, move fast';
      case 'negative':
        return 'Be empathetic, validate concerns, offer alternatives';
      default:
        return 'Standard approach';
    }
  }
}

// =====================================================
// CONTEXT EXTRACTION FROM MESSAGES
// =====================================================

export function extractContextFromMessage(message: string): {
  detectedTopic?: string;
  mentionedEntities: string[];
  detectedSentiment?: string;
  isQuestion: boolean;
  isRequest: boolean;
  isFollowUp: boolean;
  mentionedProject?: string;
} {
  const messageLower = message.toLowerCase();

  // Detect topic
  const topicPatterns = [
    { pattern: /stripe|payment|invoice|subscription/i, topic: 'payments' },
    { pattern: /deploy|vercel|hosting|domain/i, topic: 'deployment' },
    { pattern: /database|supabase|postgres|sql/i, topic: 'database' },
    { pattern: /react|next\.?js|typescript|code|bug|error/i, topic: 'development' },
    { pattern: /real\s*estate|property|listing|buyer|seller/i, topic: 'real_estate' },
    { pattern: /ai|gpt|claude|openai|model/i, topic: 'ai' },
  ];

  let detectedTopic: string | undefined;
  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(message)) {
      detectedTopic = topic;
      break;
    }
  }

  // Detect sentiment
  let detectedSentiment: string | undefined;
  if (/\!{2,}|urgent|asap|help|broken|not working|frustrated/i.test(message)) {
    detectedSentiment = 'frustrated';
  } else if (/\?{2,}|confused|don't understand|what do you mean/i.test(message)) {
    detectedSentiment = 'confused';
  } else if (/awesome|great|perfect|love|excited|amazing/i.test(message)) {
    detectedSentiment = 'excited';
  } else if (/thanks|thank you|appreciate/i.test(message)) {
    detectedSentiment = 'positive';
  }

  // Extract entities (simple pattern matching)
  const entities: string[] = [];
  const urlPattern = /https?:\/\/[^\s]+/g;
  const filePattern = /[\w-]+\.(ts|tsx|js|jsx|json|md|sql|css|html)/g;
  
  const urls = message.match(urlPattern);
  if (urls) entities.push(...urls);
  
  const files = message.match(filePattern);
  if (files) entities.push(...files);

  // Detect message type
  const isQuestion = /\?/.test(message) || /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does)/i.test(message.trim());
  const isRequest = /^(please|can you|could you|would you|build|create|make|write|fix|help|update|deploy)/i.test(message.trim());
  const isFollowUp = /^(continue|keep going|go on|next|and|also|what about|how about)/i.test(message.trim());

  // Detect project mention
  const projectPatterns = [
    /(?:working on|building|project|app called?)\s+["']?(\w[\w\s-]+)["']?/i,
    /(?:the|my|our)\s+(\w[\w\s-]+)\s+(?:project|app|site|platform)/i,
  ];
  
  let mentionedProject: string | undefined;
  for (const pattern of projectPatterns) {
    const match = message.match(pattern);
    if (match) {
      mentionedProject = match[1].trim();
      break;
    }
  }

  return {
    detectedTopic,
    mentionedEntities: entities,
    detectedSentiment,
    isQuestion,
    isRequest,
    isFollowUp,
    mentionedProject
  };
}

// =====================================================
// GENERATE CONTEXT STRING FOR SYSTEM PROMPT
// =====================================================

export async function generateContextForPrompt(userId: string): Promise<string> {
  const awareness = new JavariAwareness(userId);
  const context = await awareness.getFullContext();

  let contextString = '\n\n## USER CONTEXT (From Memory)\n';

  // Profile
  if (context.profile) {
    const p = context.profile;
    contextString += `\n### Who You're Talking To\n`;
    if (p.display_name) contextString += `- Name: ${p.display_name}\n`;
    if (p.role) contextString += `- Role: ${p.role}`;
    if (p.company) contextString += ` at ${p.company}`;
    contextString += '\n';
    if (p.skill_level) contextString += `- Skill Level: ${p.skill_level}\n`;
    if (p.communication_style) contextString += `- Communication Style: ${p.communication_style}\n`;
    if (p.prefers_brevity) contextString += `- Prefers: Brief, direct responses\n`;
    if (p.prefers_code_first) contextString += `- Prefers: Code first, explanations if asked\n`;
    if (p.total_interactions) contextString += `- Previous Interactions: ${p.total_interactions}\n`;
    
    if (p.important_notes?.length > 0) {
      contextString += `\n### Important Things to Remember\n`;
      for (const note of p.important_notes) {
        contextString += `- ${note}\n`;
      }
    }
  }

  // Recent conversations
  if (context.recentConversations?.length > 0) {
    contextString += `\n### Recent Conversations\n`;
    for (const conv of context.recentConversations) {
      contextString += `- ${conv.topic || 'Untitled'}: ${conv.summary || 'No summary'}\n`;
    }
  }

  // Active threads
  if (context.activeThreads?.length > 0) {
    contextString += `\n### Active Projects/Tasks\n`;
    for (const thread of context.activeThreads) {
      contextString += `- **${thread.name}**: ${thread.last_context || 'No context'}\n`;
      if (thread.next_steps?.length > 0) {
        contextString += `  Next: ${thread.next_steps[0]}\n`;
      }
    }
  }

  // Important memories
  if (context.importantMemories?.length > 0) {
    contextString += `\n### Things I Remember\n`;
    for (const mem of context.importantMemories) {
      contextString += `- ${mem.key}: ${mem.content}\n`;
    }
  }

  // Pending commitments
  if (context.pendingCommitments?.length > 0) {
    contextString += `\n### My Commitments to This User\n`;
    for (const commitment of context.pendingCommitments) {
      contextString += `- ${commitment.description}`;
      if (commitment.due_at) contextString += ` (due: ${new Date(commitment.due_at).toLocaleDateString()})`;
      contextString += '\n';
    }
  }

  // Sentiment
  if (context.recentSentiment) {
    contextString += `\n### Recent Mood\n`;
    contextString += `User seems ${context.recentSentiment}. Adjust approach accordingly.\n`;
  }

  return contextString;
}

export default JavariAwareness;
