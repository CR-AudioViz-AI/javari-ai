'use client';

import { useState, useEffect } from 'react';
import { getRandomPrompts, PromptExample } from '@/lib/prompts/promptLibrary';
import { SparklesIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

interface ScrollingPromptBarProps {
  onPromptClick?: (prompt: string) => void;
}

export function ScrollingPromptBar({ onPromptClick }: ScrollingPromptBarProps) {
  const [prompts, setPrompts] = useState<PromptExample[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    // Load random prompts on mount
    setPrompts(getRandomPrompts(20));
  }, []);
  
  useEffect(() => {
    if (prompts.length === 0) return;
    
    // Auto-scroll every 5 seconds
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % prompts.length);
        setIsAnimating(false);
      }, 500);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [prompts]);
  
  const handleNext = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % prompts.length);
      setIsAnimating(false);
    }, 500);
  };
  
  const handlePrevious = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + prompts.length) % prompts.length);
      setIsAnimating(false);
    }, 500);
  };
  
  const handlePromptClick = (prompt: string) => {
    if (onPromptClick) {
      onPromptClick(prompt);
    }
  };
  
  if (prompts.length === 0) return null;
  
  const currentPrompt = prompts[currentIndex];
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white shadow-2xl border-t-4 border-white/20 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Sparkles Icon + Label */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <SparklesIcon className="w-5 h-5 animate-pulse" />
            <span className="font-semibold text-sm hidden sm:inline">Try this:</span>
          </div>
          
          {/* Center: Prompt Content */}
          <div 
            className={`flex-1 min-w-0 transition-all duration-500 ${
              isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
            }`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              {/* Category Badge */}
              <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full whitespace-nowrap">
                {currentPrompt.subcategory}
              </span>
              
              {/* Difficulty Badge */}
              <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${difficultyColors[currentPrompt.difficulty]}`}>
                {currentPrompt.difficulty}
              </span>
              
              {/* Prompt Text */}
              <button
                onClick={() => handlePromptClick(currentPrompt.prompt)}
                className="text-sm font-medium hover:underline cursor-pointer text-left flex-1 min-w-0 truncate"
                title="Click to use this prompt"
              >
                "{currentPrompt.prompt}"
              </button>
            </div>
          </div>
          
          {/* Right: Navigation + Link */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Previous prompt"
            >
              <ChevronRightIcon className="w-4 h-4 transform rotate-180" />
            </button>
            
            {/* Next Button */}
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Next prompt"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            
            {/* Divider */}
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            {/* View All Link */}
            <Link
              href="/prompts"
              className="flex items-center gap-1 text-sm font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">View All</span>
              <span className="sm:hidden">Library</span>
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
        
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {prompts.slice(0, 10).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(idx);
                  setIsAnimating(false);
                }, 500);
              }}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex % 10
                  ? 'w-8 bg-white'
                  : 'w-1.5 bg-white/40 hover:bg-white/60'
              }`}
              title={`Jump to prompt ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
