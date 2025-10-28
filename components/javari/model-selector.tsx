/**
 * Model Selector Component
 * Allows users to choose between different AI models
 * 
 * @component ModelSelector
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Sparkles, Zap, Brain, Clock, DollarSign } from 'lucide-react';

export type AIModel = 
  | 'gpt-4-turbo-preview' 
  | 'gpt-4' 
  | 'gpt-3.5-turbo'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514';

interface ModelInfo {
  id: AIModel;
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
  speed: 'fast' | 'medium' | 'slow';
  intelligence: 'high' | 'very-high' | 'extreme';
  costLevel: 'low' | 'medium' | 'high';
  recommended?: boolean;
}

const MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Best overall performance - Recommended for most tasks',
    icon: <Sparkles className="w-4 h-4" />,
    speed: 'fast',
    intelligence: 'extreme',
    costLevel: 'medium',
    recommended: true,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    description: 'Maximum intelligence for complex reasoning',
    icon: <Brain className="w-4 h-4" />,
    speed: 'medium',
    intelligence: 'extreme',
    costLevel: 'high',
  },
  {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Fast and capable for most development tasks',
    icon: <Zap className="w-4 h-4" />,
    speed: 'fast',
    intelligence: 'very-high',
    costLevel: 'medium',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Original GPT-4 with proven reliability',
    icon: <Brain className="w-4 h-4" />,
    speed: 'slow',
    intelligence: 'very-high',
    costLevel: 'high',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fastest and most economical option',
    icon: <Clock className="w-4 h-4" />,
    speed: 'fast',
    intelligence: 'high',
    costLevel: 'low',
  },
];

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
  showDetails?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
  showDetails = true,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  const getSpeedBadge = (speed: 'fast' | 'medium' | 'slow') => {
    const colors = {
      fast: 'bg-green-100 text-green-700 border-green-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      slow: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[speed]}`}>
        {speed}
      </span>
    );
  };

  const getCostBadge = (level: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700',
    };
    const labels = {
      low: '$',
      medium: '$$',
      high: '$$$',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${colors[level]} flex items-center gap-1`}>
        <DollarSign className="w-3 h-3" />
        {labels[level]}
      </span>
    );
  };

  return (
    <div className="relative">
      {/* Selected Model Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-3 px-4 py-3 
          bg-white border-2 border-gray-200 rounded-lg
          hover:border-blue-400 hover:bg-blue-50
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'border-blue-500 bg-blue-50' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            {currentModel.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {currentModel.name}
              </span>
              {currentModel.recommended && (
                <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full">
                  Recommended
                </span>
              )}
            </div>
            {showDetails && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{currentModel.provider}</span>
                <span className="text-xs text-gray-400">•</span>
                {getSpeedBadge(currentModel.speed)}
                {getCostBadge(currentModel.costLevel)}
              </div>
            )}
          </div>
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border-2 border-gray-200 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 space-y-1">
              {MODELS.map((model) => {
                const isSelected = model.id === selectedModel;
                
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-start gap-3 p-3 rounded-lg
                      transition-all duration-200
                      ${isSelected 
                        ? 'bg-blue-50 border-2 border-blue-500' 
                        : 'hover:bg-gray-50 border-2 border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex-shrink-0">
                      {model.icon}
                    </div>
                    
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {model.name}
                        </span>
                        {model.recommended && (
                          <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full">
                            ⭐ Best
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">
                            ✓ Active
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {model.description}
                      </p>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">{model.provider}</span>
                        <span className="text-xs text-gray-400">•</span>
                        {getSpeedBadge(model.speed)}
                        {getCostBadge(model.costLevel)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                Model selection affects response quality, speed, and cost
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export helper to get model info
export function getModelInfo(modelId: AIModel): ModelInfo | undefined {
  return MODELS.find(m => m.id === modelId);
}
