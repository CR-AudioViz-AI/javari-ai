'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PROMPT_LIBRARY,
  PROMPT_CATEGORIES,
  PromptExample,
  searchPrompts,
  getPromptsByCategory,
} from '@/lib/prompts/promptLibrary';
import {
  SearchIcon,
  FilterIcon,
  CopyIcon,
  CheckIcon,
  SparklesIcon,
  BookOpenIcon,
  TagIcon,
  TrendingUpIcon,
  ArrowLeftIcon,
} from 'lucide-react';

export default function PromptsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Filter prompts
  const filteredPrompts = useMemo(() => {
    let results = searchQuery
      ? searchPrompts(searchQuery)
      : PROMPT_LIBRARY;
    
    if (selectedCategory !== 'All') {
      results = results.filter(p => p.category === selectedCategory);
    }
    
    if (selectedDifficulty !== 'all') {
      results = results.filter(p => p.difficulty === selectedDifficulty);
    }
    
    return results;
  }, [searchQuery, selectedCategory, selectedDifficulty]);
  
  const handleCopy = async (prompt: PromptExample) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const difficultyColors = {
    beginner: 'bg-green-50 text-green-700 border-green-200',
    intermediate: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    advanced: 'bg-red-50 text-red-700 border-red-200',
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-32">
      {/* Sticky Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Link 
          href="/javari"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white backdrop-blur rounded-lg transition-colors shadow-lg"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Back to Javari AI</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 pt-20">{/* Added pt-20 to account for sticky button */}

          <div className="flex items-center gap-3 mb-4">
            <BookOpenIcon className="w-10 h-10" />
            <h1 className="text-4xl font-bold">Javari AI Prompt Library</h1>
          </div>
          <p className="text-lg text-blue-100 max-w-3xl">
            Discover hundreds of expertly crafted prompts to help you get the most out of Javari AI.
            Learn how to phrase your requests for optimal results.
          </p>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">{PROMPT_LIBRARY.length}</div>
              <div className="text-sm text-blue-100">Total Prompts</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">{Object.keys(PROMPT_CATEGORIES).length}</div>
              <div className="text-sm text-blue-100">Categories</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">
                {PROMPT_LIBRARY.filter(p => p.difficulty === 'beginner').length}
              </div>
              <div className="text-sm text-blue-100">Beginner Friendly</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">
                {PROMPT_LIBRARY.filter(p => p.difficulty === 'advanced').length}
              </div>
              <div className="text-sm text-blue-100">Advanced</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 -mt-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <SearchIcon className="w-4 h-4 inline mr-2" />
                Search Prompts
              </label>
              <input
                type="text"
                placeholder="Search by keyword, tag, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
              />
            </div>
            
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FilterIcon className="w-4 h-4 inline mr-2" />
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
              >
                <option value="All">All Categories</option>
                {Object.entries(PROMPT_CATEGORIES).map(([key, value]) => (
                  <option key={key} value={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Difficulty Filter */}
          <div className="flex items-center gap-2 mt-4">
            <TrendingUpIcon className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700 mr-2">Difficulty:</span>
            {['all', 'beginner', 'intermediate', 'advanced'].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedDifficulty(level)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedDifficulty === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Results Count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing <span className="font-bold text-gray-900">{filteredPrompts.length}</span> prompts
            {searchQuery && ` for "${searchQuery}"`}
          </div>
        </div>
        
        {/* Empty State */}
        {filteredPrompts.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12 text-center">
            <SearchIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No prompts found</h3>
            <p className="text-gray-600">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        )}
        
        {/* Prompts Grid */}
        <div className="grid gap-6">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 hover:shadow-xl transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {prompt.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {prompt.subcategory}
                    </span>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full border-2 ${difficultyColors[prompt.difficulty]}`}>
                      {prompt.difficulty}
                    </span>
                  </div>
                </div>
                
                {/* Copy Button */}
                <button
                  onClick={() => handleCopy(prompt)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  {copiedId === prompt.id ? (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              
              {/* Prompt Text */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 mb-4 border-l-4 border-blue-600">
                <p className="text-gray-800 leading-relaxed font-mono text-sm">
                  "{prompt.prompt}"
                </p>
              </div>
              
              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <TagIcon className="w-4 h-4 text-gray-400" />
                {prompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              
              {/* Expected Output */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-start gap-2">
                  <SparklesIcon className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Expected Output: </span>
                    <span className="text-sm text-gray-600">{prompt.expectedOutput}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

