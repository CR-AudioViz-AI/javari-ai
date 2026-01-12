// lib/javari-providers.ts
// Unified provider adapters with identity enforcement

import { getJavariSystemPrompt } from './javari-system-prompt';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Generic provider responses that indicate identity failure
const GENERIC_PATTERNS = [
  /^I can help (you )?with/i,
  /^Tell me what you need/i,
  /^What (would you|do you) (like|want)/i,
  /^I('m| am) (an AI |a language model|here to assist)/i,
  /^How can I assist you/i,
];

function detectGenericResponse(content: string): boolean {
  return GENERIC_PATTERNS.some(pattern => pattern.test(content.trim()));
}

// OpenAI Provider
export async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  config: ProviderConfig
): Promise<ProviderResponse> {
  const systemPrompt = getJavariSystemPrompt();
  
  // Ensure system prompt is FIRST message
  const messagesWithSystem = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system'),
  ];
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: messagesWithSystem,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 4000,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // IDENTITY ENFORCEMENT
  if (detectGenericResponse(content)) {
    console.error('❌ IDENTITY VIOLATION: Generic assistant response detected');
    console.error('Response:', content.substring(0, 200));
    throw new Error('IDENTITY_VIOLATION: Model reverted to generic assistant behavior');
  }
  
  return {
    content,
    model: config.model,
    usage: data.usage,
  };
}

// Anthropic Provider  
export async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  config: ProviderConfig
): Promise<ProviderResponse> {
  const systemPrompt = getJavariSystemPrompt();
  
  // Claude uses system param, not system message
  const userMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt, // System prompt as parameter
      messages: userMessages,
      max_tokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.content[0].text;
  
  // IDENTITY ENFORCEMENT
  if (detectGenericResponse(content)) {
    console.error('❌ IDENTITY VIOLATION: Generic assistant response detected');
    throw new Error('IDENTITY_VIOLATION: Model reverted to generic assistant behavior');
  }
  
  return {
    content,
    model: config.model,
    usage: data.usage,
  };
}

// Perplexity Provider (OpenAI-compatible)
export async function callPerplexity(
  messages: Array<{ role: string; content: string }>,
  config: ProviderConfig
): Promise<ProviderResponse> {
  const systemPrompt = getJavariSystemPrompt();
  
  const messagesWithSystem = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system'),
  ];
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'llama-3.1-sonar-small-128k-online',
      messages: messagesWithSystem,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 4000,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // IDENTITY ENFORCEMENT
  if (detectGenericResponse(content)) {
    console.error('❌ IDENTITY VIOLATION: Generic assistant response detected');
    throw new Error('IDENTITY_VIOLATION: Model reverted to generic assistant behavior');
  }
  
  return {
    content,
    model: config.model,
    usage: data.usage,
  };
}

// Unified provider interface
export async function callProvider(
  provider: 'openai' | 'anthropic' | 'perplexity',
  messages: Array<{ role: string; content: string }>,
  config: ProviderConfig
): Promise<ProviderResponse> {
  switch (provider) {
    case 'openai':
      return await callOpenAI(messages, config);
    case 'anthropic':
      return await callAnthropic(messages, config);
    case 'perplexity':
      return await callPerplexity(messages, config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
