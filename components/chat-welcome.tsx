'use client';

import { Sparkles, Code, FileText, Lightbulb, MessageSquare, Zap, Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SuggestionCard {
  icon: React.ElementType;
  title: string;
  description: string;
  prompt: string;
}

const suggestions: SuggestionCard[] = [
  {
    icon: Code,
    title: 'Build an App',
    description: 'Create a Next.js application with authentication',
    prompt: 'Help me build a Next.js app with Supabase authentication and a dashboard',
  },
  {
    icon: FileText,
    title: 'Write Content',
    description: 'Generate professional documents and copy',
    prompt: 'Write a professional business proposal template for a software development project',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorm Ideas',
    description: 'Generate creative solutions and concepts',
    prompt: 'Help me brainstorm innovative features for a social impact platform serving veterans',
  },
  {
    icon: Zap,
    title: 'Debug Code',
    description: 'Fix errors and optimize performance',
    prompt: 'Help me debug this TypeScript error and explain best practices',
  },
];

interface ChatWelcomeProps {
  onSelectSuggestion: (prompt: string) => void;
}

export function ChatWelcome({ onSelectSuggestion }: ChatWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-gradient-to-br from-purple-500 to-blue-600">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hello! I'm Javari</h1>
          <p className="text-muted-foreground">Your AI assistant powered by CR AudioViz AI</p>
        </div>
      </div>

      <div className="max-w-2xl text-center mb-8">
        <p className="text-muted-foreground">
          I can help you build applications, write content, debug code, and much more.
          I learn from our conversations to provide better assistance over time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        {suggestions.map((suggestion) => (
          <Card
            key={suggestion.title}
            className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
            onClick={() => onSelectSuggestion(suggestion.prompt)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <suggestion.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{suggestion.title}</h3>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>Powered by 100+ knowledge entries and continuous learning</span>
      </div>
    </div>
  );
}
