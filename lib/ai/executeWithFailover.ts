/**
 * Execute AI requests with automatic failover and JSON mode enforcement
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "anthropic" | "openai" | "google" | "openrouter";

export interface ExecuteResponse {
  output: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  provider?: AIProvider;
}

/**
 * Extract JSON from text that may contain markdown or other wrapping
 */
function extractJSON(text: string): any | null {
  console.log("[executeWithFailover] Attempting JSON extraction from text...");
  
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to extraction
  }
  
  // Remove markdown code fences
  let cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  
  // Extract JSON object or array
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  
  if (!match) {
    console.warn("[executeWithFailover] No JSON found in text");
    return null;
  }
  
  try {
    const parsed = JSON.parse(match[0]);
    console.log("[executeWithFailover] ✅ Successfully extracted JSON");
    return parsed;
  } catch (e) {
    console.error("[executeWithFailover] JSON extraction failed:", e);
    return null;
  }
}

export async function executeWithFailover(
  prompt: string,
  provider: AIProvider,
  enforceJSON: boolean = false
): Promise<ExecuteResponse> {
  console.log("[executeWithFailover] Provider:", provider, "| JSON mode:", enforceJSON);

  try {
    if (provider === "openai" || provider === "openrouter") {
      const apiKey = provider === "openai" 
        ? process.env.OPENAI_API_KEY 
        : process.env.OPENROUTER_API_KEY;
      
      const baseURL = provider === "openrouter" 
        ? "https://openrouter.ai/api/v1" 
        : undefined;

      if (!apiKey) {
        throw new Error(`${provider.toUpperCase()} API key not found`);
      }

      const client = new OpenAI({
        apiKey,
        baseURL,
      });

      const model = provider === "openai" ? "gpt-4o" : "gpt-4o-2024-11-20";

      // Build request options
      const requestOptions: any = {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      };

      // CRITICAL: Enable JSON mode for deterministic responses
      if (enforceJSON) {
        requestOptions.response_format = { type: "json_object" };
        console.log("[executeWithFailover] ✅ JSON mode enabled");
      }

      const completion = await client.chat.completions.create(requestOptions);

      const content = completion.choices[0]?.message?.content || "";
      
      // If JSON mode was requested, validate and extract
      let output = content;
      if (enforceJSON) {
        const extracted = extractJSON(content);
        if (extracted) {
          output = extracted;
          console.log("[executeWithFailover] ✅ JSON validated and extracted");
        } else {
          console.warn("[executeWithFailover] ⚠️ JSON mode enabled but extraction failed");
        }
      }

      return {
        output,
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens,
          total_tokens: completion.usage?.total_tokens,
        },
        provider,
      };
    }

    if (provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY not found");
      }

      const client = new Anthropic({ apiKey });

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      let output = content.type === "text" ? content.text : JSON.stringify(content);
      
      // If JSON mode was requested, validate and extract
      if (enforceJSON) {
        const extracted = extractJSON(output);
        if (extracted) {
          output = extracted;
          console.log("[executeWithFailover] ✅ JSON validated and extracted");
        } else {
          console.warn("[executeWithFailover] ⚠️ JSON extraction failed for Claude");
        }
      }

      return {
        output,
        usage: {
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
          total_tokens: message.usage.input_tokens + message.usage.output_tokens,
        },
        provider: "anthropic",
      };
    }

    if (provider === "google") {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY not found");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const result = await model.generateContent(prompt);
      const response = result.response;
      let output = response.text();
      
      // If JSON mode was requested, validate and extract
      if (enforceJSON) {
        const extracted = extractJSON(output);
        if (extracted) {
          output = extracted;
          console.log("[executeWithFailover] ✅ JSON validated and extracted");
        } else {
          console.warn("[executeWithFailover] ⚠️ JSON extraction failed for Gemini");
        }
      }

      return {
        output,
        usage: {
          total_tokens: 0,
        },
        provider: "google",
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error: any) {
    console.error(`[executeWithFailover] ${provider} failed:`, error.message);
    throw error;
  }
}
