"use client";

import React from "react";

const PROVIDERS = {
  openai: { id: "openai", label: "OpenAI" },
  anthropic: { id: "anthropic", label: "Anthropic" },
  groq: { id: "groq", label: "Groq" },
  mistral: { id: "mistral", label: "Mistral" },
  xai: { id: "xai", label: "xAI" },
  perplexity: { id: "perplexity", label: "Perplexity" },
  together: { id: "together", label: "Together AI" },
  huggingface: { id: "huggingface", label: "HuggingFace" }
};

interface ProviderSelectorProps {
  provider: string;
  onChange: (provider: string) => void;
  disabled?: boolean;
}

export default function ProviderSelector({
  provider,
  onChange,
  disabled = false
}: ProviderSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-400">Provider</label>
      <select
        disabled={disabled}
        value={provider}
        onChange={(e) => onChange(e.target.value)}
        className={`
          bg-neutral-900 border border-neutral-700 rounded-md p-2 text-sm text-white
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        {Object.values(PROVIDERS).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
