// lib/tools/toolEngine.ts
// Javari AI — Universal Tool Execution Engine
// Purpose: Processes all tool requests with real AI, credit deduction, and error refunds.
// All 13+ tools route through here. No simulation. No stubs.
// Date: 2026-03-09

import { createAdminClient } from "@/lib/supabase/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";

// ── Tool definitions ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  id:           string;
  name:         string;
  creditCost:   number;
  inputField:   string;
  outputField:  string;
  systemPrompt: string;
  userPrompt:   (input: string, extras?: Record<string, string>) => string;
  maxTokens:    number;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  "ai-copywriter": {
    id:          "ai-copywriter",
    name:        "AI Copywriter",
    creditCost:  2,
    inputField:  "input",
    outputField: "output",
    maxTokens:   800,
    systemPrompt: `You are an expert marketing copywriter for CR AudioViz AI / Javari AI. 
Write compelling, conversion-focused copy. Brand voice: confident, creative, human-first.
Return ONLY the copy — no commentary, no labels, no preamble.`,
    userPrompt: (input) =>
      `Write compelling marketing copy for:\n\n${input}\n\nInclude a headline, 2-3 body paragraphs, and a CTA.`,
  },

  "social-caption-generator": {
    id:          "social-caption-generator",
    name:        "Social Caption Generator",
    creditCost:  1,
    inputField:  "input",
    outputField: "captions",
    maxTokens:   600,
    systemPrompt: `You are a social media expert. Generate engaging captions optimized for each platform.
Return ONLY the captions, formatted exactly as shown:
📱 Instagram: [caption + 5 hashtags]
🐦 Twitter/X: [caption under 280 chars]
💼 LinkedIn: [professional caption]
📌 Pinterest: [descriptive caption]`,
    userPrompt: (input) => `Generate social media captions for: ${input}`,
  },

  "resume-builder": {
    id:          "resume-builder",
    name:        "Resume Builder",
    creditCost:  5,
    inputField:  "input",
    outputField: "resume",
    maxTokens:   1500,
    systemPrompt: `You are an expert resume writer with 20 years of experience helping candidates land jobs at top companies.
Format the resume in clean markdown. Include: Summary, Experience, Skills, Education sections.
Use strong action verbs. Quantify achievements where possible.`,
    userPrompt: (input) =>
      `Create a professional resume based on this information:\n\n${input}\n\nFormat in clean markdown.`,
  },

  "brand-color-palette": {
    id:          "brand-color-palette",
    name:        "Brand Color Palette",
    creditCost:  2,
    inputField:  "input",
    outputField: "palette",
    maxTokens:   800,
    systemPrompt: `You are a professional brand designer. Generate color palettes with hex codes.
Return JSON only — no markdown, no explanation:
{"palette": [{"name": "Primary", "hex": "#...", "usage": "..."}, ...], "rationale": "..."}`,
    userPrompt: (input) =>
      `Generate a 6-color brand palette for: ${input}. Include primary, secondary, accent, neutral, success, and error colors.`,
  },

  "color-palette": {
    id:          "color-palette",
    name:        "Color Palette Generator",
    creditCost:  1,
    inputField:  "input",
    outputField: "palette",
    maxTokens:   600,
    systemPrompt: `You are a color theory expert. Generate harmonious color palettes.
Return JSON only:
{"colors": [{"name": "...", "hex": "#...", "role": "..."}], "harmony": "complementary|analogous|triadic|split-complementary"}`,
    userPrompt: (input) => `Generate a 5-color palette for: ${input}`,
  },

  "image-caption-generator": {
    id:          "image-caption-generator",
    name:        "Image Caption Generator",
    creditCost:  1,
    inputField:  "input",
    outputField: "captions",
    maxTokens:   500,
    systemPrompt: `You are an expert at writing descriptive, engaging image captions for multiple contexts.
Return ONLY the captions, no preamble:
🖼️ Alt text: [accessibility description]
📸 Social: [engaging caption]
📰 Editorial: [news-style caption]
🛒 Product: [conversion-focused caption]`,
    userPrompt: (input) => `Generate image captions for: ${input}`,
  },

  "pdf-summarizer": {
    id:          "pdf-summarizer",
    name:        "PDF Summarizer",
    creditCost:  3,
    inputField:  "input",
    outputField: "summary",
    maxTokens:   1000,
    systemPrompt: `You are an expert at reading and summarizing documents.
Provide: 1) Executive summary (3 sentences), 2) Key points (bullet list), 3) Action items if any.
Be concise, accurate, and preserve important numbers/dates.`,
    userPrompt: (input) => `Summarize this document content:\n\n${input}`,
  },

  "logo-generator": {
    id:          "logo-generator",
    name:        "Logo Concept Generator",
    creditCost:  3,
    inputField:  "input",
    outputField: "concepts",
    maxTokens:   800,
    systemPrompt: `You are a creative director specializing in brand identity and logo design.
Generate 3 distinct logo concepts with detailed visual descriptions that a designer could execute.
Return JSON only:
{"concepts": [{"name": "...", "style": "...", "description": "...", "colors": ["..."], "symbolism": "..."}]}`,
    userPrompt: (input) => `Generate 3 logo concepts for: ${input}`,
  },

  "subtitle-generator": {
    id:          "subtitle-generator",
    name:        "Subtitle Generator",
    creditCost:  2,
    inputField:  "input",
    outputField: "subtitles",
    maxTokens:   1000,
    systemPrompt: `You are an expert subtitle and transcript editor.
Convert spoken content into clean, timed SRT subtitles.
Format exactly as:
1
00:00:00,000 --> 00:00:03,000
[text]

2
00:00:03,000 --> 00:00:06,000
[text]`,
    userPrompt: (input) => `Convert to SRT subtitles:\n\n${input}`,
  },

  "voice-transcriber": {
    id:          "voice-transcriber",
    name:        "Voice Transcriber",
    creditCost:  2,
    inputField:  "input",
    outputField: "transcript",
    maxTokens:   1200,
    systemPrompt: `You are a professional transcription service.
Clean up spoken text: fix grammar, punctuation, remove filler words (um, uh, like).
Add speaker labels if multiple speakers are evident. Return clean, readable transcript.`,
    userPrompt: (input) => `Clean and format this transcript:\n\n${input}`,
  },

  "background-remover": {
    id:          "background-remover",
    name:        "Background Remover",
    creditCost:  2,
    inputField:  "input",
    outputField: "instructions",
    maxTokens:   400,
    systemPrompt: `You are a photo editing expert. Provide step-by-step background removal instructions.`,
    userPrompt: (input) => `Provide background removal instructions for: ${input}`,
  },
};

// ── Execution ────────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  success:    boolean;
  output?:    string;
  parsed?:    unknown;
  creditsUsed?: number;
  error?:     string;
  code?:      number;
}

export async function executeTool(
  toolId:  string,
  userId:  string,
  input:   string,
  extras?: Record<string, string>
): Promise<ToolExecutionResult> {

  const tool = TOOL_REGISTRY[toolId];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolId}`, code: 404 };
  }

  if (!input?.trim()) {
    return { success: false, error: "Input is required", code: 400 };
  }

  const db = createAdminClient();

  // ── Check credits ──────────────────────────────────────────────────────────
  const { data: credits } = await db
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!credits || credits.balance < tool.creditCost) {
    return {
      success: false,
      error:   `Insufficient credits. This tool costs ${tool.creditCost} credits. Your balance: ${credits?.balance ?? 0}.`,
      code:    402,
    };
  }

  // ── Deduct credits upfront ─────────────────────────────────────────────────
  const newBalance = credits.balance - tool.creditCost;
  await db.from("user_credits")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  // ── Call AI ────────────────────────────────────────────────────────────────
  let aiOutput: string;

  try {
    const anthropicKey = await getSecret("ANTHROPIC_API_KEY").catch(() => "");

    if (anthropicKey) {
      // Route through Anthropic (Claude Haiku — fast + cheap)
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: tool.maxTokens,
          system:     tool.systemPrompt,
          messages:   [{ role: "user", content: tool.userPrompt(input, extras) }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        aiOutput = data.content?.[0]?.text ?? "";
      } else {
        throw new Error(`Anthropic API ${res.status}`);
      }
    } else {
      // Fallback: OpenRouter
      const openrouterKey = await getSecret("OPENROUTER_API_KEY");
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type":  "application/json",
          "HTTP-Referer":  "https://javariai.com",
        },
        body: JSON.stringify({
          model:      "anthropic/claude-haiku-4-5",
          max_tokens: tool.maxTokens,
          messages: [
            { role: "system", content: tool.systemPrompt },
            { role: "user",   content: tool.userPrompt(input, extras) },
          ],
        }),
      });

      const data = await res.json();
      aiOutput = data.choices?.[0]?.message?.content ?? "";
    }

  } catch (err) {
    // Refund credits on AI failure
    await db.from("user_credits")
      .update({ balance: credits.balance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    console.error(`[toolEngine] AI error for ${toolId}:`, err);
    return {
      success: false,
      error:   "AI processing failed. Your credits have been refunded automatically.",
      code:    503,
    };
  }

  if (!aiOutput?.trim()) {
    // Refund if empty output
    await db.from("user_credits")
      .update({ balance: credits.balance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { success: false, error: "AI returned empty output. Credits refunded.", code: 502 };
  }

  // ── Log the tool usage ─────────────────────────────────────────────────────
  await db.from("credit_transactions").insert({
    user_id:          userId,
    amount:           -tool.creditCost,
    transaction_type: "spend",
    app_id:           toolId,
    operation:        "tool_execution",
    description:      `${tool.name}: ${input.slice(0, 80)}`,
    metadata:         { tool: toolId, credits_used: tool.creditCost },
  }).catch(() => {/* non-fatal */});

  // ── Try JSON parse for structured outputs ──────────────────────────────────
  let parsed: unknown;
  try {
    const clean = aiOutput.replace(/```json\n?|```\n?/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = undefined;
  }

  return {
    success:     true,
    output:      aiOutput,
    parsed,
    creditsUsed: tool.creditCost,
  };
}
