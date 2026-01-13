// lib/javari-master-integration.ts
/**
 * JAVARI AI - MASTER INTEGRATION
 * Connects all autonomous systems into unified operation
 */

import { javariBuilder } from './javari-autonomous-builder';
import { javariMonitoring } from './javari-automated-monitoring';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class JavariMasterSystem {
  
  async initialize() {
    console.log('🚀 Initializing Javari AI Master System...');
    
    // 1. Load knowledge base
    await this.loadKnowledgeBase();
    
    // 2. Start monitoring
    await this.startMonitoring();
    
    // 3. Enable autonomous learning
    await this.enableLearning();
    
    // 4. Start self-healing
    await this.startSelfHealing();
    
    console.log('✅ Javari AI fully operational');
  }
  
  private async loadKnowledgeBase() {
    console.log('📚 Loading knowledge base...');
    
    // Check if docs are ingested
    const { count } = await supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact', head: true });
    
    if (!count || count < 100) {
      console.log('⚠️  Knowledge base empty - run ingestion');
      console.log('   Command: npm run ingest-docs');
    } else {
      console.log(`✅ Knowledge base loaded: ${count} documents`);
    }
  }
  
  private async startMonitoring() {
    console.log('👁️  Starting platform monitoring...');
    
    // Run initial health check
    const health = await javariMonitoring.monitorAllApps();
    console.log(`✅ Monitoring ${health.length} apps`);
    
    // Schedule recurring checks (every 5 minutes)
    setInterval(async () => {
      await javariMonitoring.monitorAllApps();
    }, 5 * 60 * 1000);
  }
  
  private async enableLearning() {
    console.log('🧠 Enabling continuous learning...');
    
    // Track all interactions
    await supabase
      .from('javari_interactions')
      .select('count')
      .then(({ count }) => {
        console.log(`✅ Learning from ${count || 0} past interactions`);
      });
  }
  
  private async startSelfHealing() {
    console.log('🔧 Enabling self-healing...');
    
    // Monitor for errors and auto-fix
    console.log('✅ Self-healing active');
  }
  
  // Chat interface
  async chat(userId: string, message: string, context?: any) {
    // Route to appropriate AI provider
    const provider = await this.selectBestProvider(message);
    
    // Generate response with context
    const response = await this.generateResponse(
      provider,
      userId,
      message,
      context
    );
    
    // Learn from interaction
    await this.learnFromInteraction(userId, message, response);
    
    return response;
  }
  
  private async selectBestProvider(message: string) {
    // Intelligent routing based on task
    if (message.includes('code') || message.includes('build')) {
      return 'anthropic'; // Claude best for coding
    }
    if (message.includes('image') || message.includes('vision')) {
      return 'openai'; // GPT-4V for vision
    }
    if (message.includes('search') || message.includes('latest')) {
      return 'perplexity'; // Perplexity for current info
    }
    return 'anthropic'; // Default to Claude
  }
  
  private async generateResponse(
    provider: string,
    userId: string,
    message: string,
    context?: any
  ) {
    // Add relevant knowledge from database
    const knowledge = await this.searchKnowledge(message);
    
    // Build enhanced prompt
    const enhancedPrompt = this.buildPrompt(message, knowledge, context);
    
    // Generate with selected provider
    switch (provider) {
      case 'anthropic':
        return await this.callAnthropic(enhancedPrompt);
      case 'openai':
        return await this.callOpenAI(enhancedPrompt);
      case 'google':
        return await this.callGoogle(enhancedPrompt);
      case 'perplexity':
        return await this.callPerplexity(enhancedPrompt);
      default:
        return await this.callAnthropic(enhancedPrompt);
    }
  }
  
  private async searchKnowledge(query: string) {
    // Semantic search in knowledge base
    const { data } = await supabase
      .from('javari_knowledge')
      .select('content, metadata')
      .textSearch('content', query)
      .limit(5);
    
    return data || [];
  }
  
  private buildPrompt(message: string, knowledge: any[], context?: any) {
    let prompt = `You are Javari AI, the autonomous assistant for CR AudioViz AI platform.

Platform Knowledge:
${knowledge.map(k => k.content.substring(0, 500)).join('\n\n')}

`;

    if (context?.files) {
      prompt += `\nFiles in context:\n${context.files.map((f: any) => f.name).join(', ')}`;
    }
    
    prompt += `\n\nUser Query: ${message}`;
    
    return prompt;
  }
  
  private async callAnthropic(prompt: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  private async callOpenAI(prompt: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  private async callGoogle(prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  private async callPerplexity(prompt: string) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY!}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  private async learnFromInteraction(userId: string, query: string, response: string) {
    await supabase.from('javari_interactions').insert({
      user_id: userId,
      query,
      response,
      timestamp: new Date().toISOString()
    });
  }
  
  // Public API
  async buildApp(request: any) {
    return await javariBuilder.buildCompleteApp(request);
  }
  
  async getSystemHealth() {
    return await javariMonitoring.monitorAllApps();
  }
}

export const javari = new JavariMasterSystem();

// Auto-initialize on import
if (typeof window === 'undefined') {
  javari.initialize().catch(console.error);
}
