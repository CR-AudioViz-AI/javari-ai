'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  Search,
  Star,
  Sparkles,
  Code,
  FileText,
  Image as ImageIcon,
  Database,
  Globe,
  Mail,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const COLORS = {
  navy: '#002B5B',
  red: '#FD201D',
  cyan: '#00BCD4',
  javariCyan: '#00D4FF',
  javaribg: '#0A1628',
};

interface PromptCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  prompts: Prompt[];
}

interface Prompt {
  id: string;
  title: string;
  description: string;
  template: string;
  starred: boolean;
  uses: number;
}

export default function PromptsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [starredPrompts, setStarredPrompts] = useState<Set<string>>(new Set());

  const categories: PromptCategory[] = [
    {
      id: 'coding',
      name: 'Coding & Development',
      icon: <Code className="w-5 h-5" />,
      prompts: [
        {
          id: 'code-1',
          title: 'Debug Code',
          description: 'Help identify and fix bugs in your code',
          template: 'I have the following code that is not working as expected:\n\n[paste your code]\n\nThe error I am getting is: [describe error]\n\nCan you help me debug this and explain what is wrong?',
          starred: false,
          uses: 1245,
        },
        {
          id: 'code-2',
          title: 'Optimize Performance',
          description: 'Improve code efficiency and speed',
          template: 'I have this code that works but is slow:\n\n[paste your code]\n\nCan you help me optimize it for better performance? Please explain the improvements.',
          starred: false,
          uses: 892,
        },
        {
          id: 'code-3',
          title: 'Write Unit Tests',
          description: 'Generate comprehensive unit tests',
          template: 'I need unit tests for this function:\n\n[paste your code]\n\nPlease write comprehensive unit tests covering edge cases and normal scenarios.',
          starred: false,
          uses: 756,
        },
      ],
    },
    {
      id: 'writing',
      name: 'Writing & Content',
      icon: <FileText className="w-5 h-5" />,
      prompts: [
        {
          id: 'write-1',
          title: 'Blog Post',
          description: 'Create engaging blog content',
          template: 'Write a blog post about [topic] that:\n- Is [word count] words long\n- Targets [audience]\n- Has a [tone: professional/casual/friendly]\n- Includes practical examples',
          starred: false,
          uses: 2341,
        },
        {
          id: 'write-2',
          title: 'Email Template',
          description: 'Professional email drafts',
          template: 'Write a professional email to [recipient] about [subject]. The tone should be [formal/friendly/urgent]. Include:\n- Purpose of email\n- Key points to address\n- Call to action',
          starred: false,
          uses: 1876,
        },
        {
          id: 'write-3',
          title: 'Social Media Post',
          description: 'Engaging social media content',
          template: 'Create a [platform: Twitter/LinkedIn/Instagram] post about [topic] that:\n- Grabs attention\n- Is [character limit] characters\n- Includes relevant hashtags\n- Encourages engagement',
          starred: false,
          uses: 1432,
        },
      ],
    },
    {
      id: 'business',
      name: 'Business & Strategy',
      icon: <TrendingUp className="w-5 h-5" />,
      prompts: [
        {
          id: 'biz-1',
          title: 'Market Analysis',
          description: 'Comprehensive market research',
          template: 'Provide a market analysis for [product/service] including:\n- Target market size\n- Key competitors\n- Market trends\n- Opportunities and threats\n- Recommended strategy',
          starred: false,
          uses: 987,
        },
        {
          id: 'biz-2',
          title: 'Business Plan',
          description: 'Create detailed business plans',
          template: 'Help me create a business plan for [business idea] covering:\n- Executive summary\n- Market opportunity\n- Business model\n- Financial projections\n- Implementation timeline',
          starred: false,
          uses: 765,
        },
        {
          id: 'biz-3',
          title: 'SWOT Analysis',
          description: 'Strategic planning analysis',
          template: 'Conduct a SWOT analysis for [company/product]:\n- Strengths: [list current strengths]\n- Weaknesses: [list current weaknesses]\n- Provide detailed analysis and recommendations',
          starred: false,
          uses: 654,
        },
      ],
    },
    {
      id: 'creative',
      name: 'Creative & Design',
      icon: <ImageIcon className="w-5 h-5" />,
      prompts: [
        {
          id: 'creative-1',
          title: 'Design Concept',
          description: 'Generate creative design ideas',
          template: 'I need design concepts for [project type] that:\n- Target audience: [describe]\n- Style: [modern/vintage/minimalist/etc]\n- Color palette preferences: [colors]\n- Must convey: [message/feeling]\n\nProvide 3 distinct concepts with descriptions.',
          starred: false,
          uses: 1234,
        },
        {
          id: 'creative-2',
          title: 'Brand Identity',
          description: 'Develop brand personality',
          template: 'Help me develop a brand identity for [company/product]:\n- Industry: [industry]\n- Target market: [audience]\n- Values: [core values]\n- Differentiators: [what makes it unique]\n\nProvide brand personality, voice, and visual direction.',
          starred: false,
          uses: 876,
        },
      ],
    },
    {
      id: 'research',
      name: 'Research & Analysis',
      icon: <Database className="w-5 h-5" />,
      prompts: [
        {
          id: 'research-1',
          title: 'Literature Review',
          description: 'Comprehensive research summary',
          template: 'I need a literature review on [topic] that:\n- Covers key research from the past [time period]\n- Identifies major themes and trends\n- Highlights gaps in current research\n- Suggests future research directions',
          starred: false,
          uses: 543,
        },
        {
          id: 'research-2',
          title: 'Data Analysis',
          description: 'Interpret and analyze data',
          template: 'I have this dataset: [describe or paste data]\n\nPlease:\n- Identify key patterns and trends\n- Provide statistical insights\n- Create visualization recommendations\n- Suggest actionable conclusions',
          starred: false,
          uses: 432,
        },
      ],
    },
  ];

  const allPrompts = categories.flatMap((cat) => cat.prompts);

  const filteredPrompts =
    selectedCategory === 'all'
      ? allPrompts
      : categories.find((cat) => cat.id === selectedCategory)?.prompts || [];

  const searchedPrompts = filteredPrompts.filter(
    (prompt) =>
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStar = (promptId: string) => {
    setStarredPrompts((prev) => {
      const newStarred = new Set(prev);
      if (newStarred.has(promptId)) {
        newStarred.delete(promptId);
      } else {
        newStarred.add(promptId);
      }
      return newStarred;
    });
  };

  const usePrompt = (template: string) => {
    // In a real app, this would copy to clipboard and navigate back
    navigator.clipboard.writeText(template);
    router.push('/javari');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.javaribg }}>
      {/* Sticky Back Button - Always visible at top */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 p-4 border-b"
        style={{ 
          backgroundColor: COLORS.navy,
          borderColor: COLORS.cyan + '40'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            onClick={() => router.push('/javari')}
            variant="outline"
            style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Javari
          </Button>
          <h1 className="text-2xl font-bold text-white">Prompt Library</h1>
          <div className="w-32" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content - Offset by sticky header */}
      <div className="pt-24 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-2xl mx-auto">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: COLORS.cyan }}
              />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: COLORS.navy,
                  color: 'white',
                  border: `1px solid ${COLORS.cyan}40`,
                }}
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mb-8 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
                style={{
                  backgroundColor: selectedCategory === 'all' ? COLORS.red : 'transparent',
                  borderColor: COLORS.cyan,
                  color: selectedCategory === 'all' ? 'white' : COLORS.cyan,
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                All Prompts
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category.id)}
                  style={{
                    backgroundColor: selectedCategory === category.id ? COLORS.red : 'transparent',
                    borderColor: COLORS.cyan,
                    color: selectedCategory === category.id ? 'white' : COLORS.cyan,
                  }}
                >
                  {category.icon}
                  <span className="ml-2">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Prompts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchedPrompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="p-6 hover:shadow-lg transition-shadow"
                style={{
                  backgroundColor: COLORS.navy,
                  border: `1px solid ${COLORS.cyan}40`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold text-lg">{prompt.title}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleStar(prompt.id)}
                    className="ml-2 flex-shrink-0"
                  >
                    <Star
                      className="w-4 h-4"
                      style={{ color: COLORS.javariCyan }}
                      fill={starredPrompts.has(prompt.id) ? COLORS.javariCyan : 'none'}
                    />
                  </Button>
                </div>

                <p className="text-white/70 text-sm mb-4">{prompt.description}</p>

                <div
                  className="p-3 rounded mb-4 text-xs font-mono text-white/60 max-h-32 overflow-y-auto"
                  style={{ backgroundColor: COLORS.javaribg }}
                >
                  {prompt.template}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{prompt.uses.toLocaleString()} uses</span>
                  <Button
                    size="sm"
                    onClick={() => usePrompt(prompt.template)}
                    style={{ backgroundColor: COLORS.red, color: 'white' }}
                  >
                    Use Prompt
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {searchedPrompts.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: COLORS.cyan }} />
              <h3 className="text-white text-xl mb-2">No prompts found</h3>
              <p className="text-white/60">Try adjusting your search or category filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
