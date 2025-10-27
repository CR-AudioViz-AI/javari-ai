/**
 * ModelSelector Component
 * Allows users to choose between different AI models for Javari
 * 
 * @version 4.0.0
 * @last-updated 2025-10-27
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, Zap, Brain, DollarSign, Check } from 'lucide-react';
import { AVAILABLE_MODELS, type AIModel } from '@/lib/javari-multi-model';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  showCosts?: boolean;
  className?: string;
}

export default function ModelSelector({
  selectedModel,
  onModelChange,
  showCosts = true,
  className = ''
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentModel = AVAILABLE_MODELS[selectedModel];
  const models = Object.values(AVAILABLE_MODELS);

  const getModelIcon = (features: string[]) => {
    if (features.includes('highest_intelligence')) return <Brain className="w-4 h-4" />;
    if (features.includes('large_context')) return <Zap className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected Model Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
      >
        <div className="flex items-center gap-3">
          {getModelIcon(currentModel.features)}
          <div className="text-left">
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              {currentModel.name}
            </div>
            {showCosts && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ${currentModel.costPer1kTokens.input.toFixed(4)}/1K input
              </div>
            )}
          </div>
          {currentModel.recommended && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
              Recommended
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Model Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-96 overflow-y-auto">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                  model.id === selectedModel ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Model Name & Provider */}
                    <div className="flex items-center gap-2 mb-1">
                      {getModelIcon(model.features)}
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {model.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {model.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                      </span>
                      {model.recommended && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {model.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {model.features.slice(0, 3).map((feature) => (
                        <span
                          key={feature}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {feature.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Specs */}
                    {showCosts && (
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          <span>
                            ${model.costPer1kTokens.input.toFixed(4)}/
                            ${model.costPer1kTokens.output.toFixed(4)}
                          </span>
                        </div>
                        <div>
                          {(model.contextWindow / 1000).toFixed(0)}K context
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Checkmark */}
                  {model.id === selectedModel && (
                    <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Help Text */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Choose the AI model that best fits your needs. Claude 3.5 Sonnet is recommended for most use cases.
      </p>
    </div>
  );
}

/**
 * Compact Model Selector (for embedding in chat interfaces)
 */
export function CompactModelSelector({
  selectedModel,
  onModelChange,
  className = ''
}: Omit<ModelSelectorProps, 'showCosts'>) {
  const [isOpen, setIsOpen] = useState(false);
  const currentModel = AVAILABLE_MODELS[selectedModel];
  const models = Object.values(AVAILABLE_MODELS);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        title={currentModel.description}
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">{currentModel.name}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                  model.id === selectedModel ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {model.name}
                  </span>
                  {model.id === selectedModel && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {model.provider === 'openai' ? 'OpenAI' : 'Anthropic'}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
