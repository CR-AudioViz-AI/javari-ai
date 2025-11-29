'use client';

import { Brain, BookOpen, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KnowledgeIndicatorProps {
  knowledgeCount: number;
  learningEnabled?: boolean;
}

export function KnowledgeIndicator({ knowledgeCount, learningEnabled = true }: KnowledgeIndicatorProps) {
  if (knowledgeCount === 0 && !learningEnabled) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {knowledgeCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs py-0">
                <Brain className="h-3 w-3" />
                {knowledgeCount} knowledge entries
              </Badge>
            )}
            {learningEnabled && (
              <Badge variant="outline" className="gap-1 text-xs py-0 border-green-200 text-green-700">
                <Sparkles className="h-3 w-3" />
                Learning
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            {knowledgeCount > 0 && (
              <p className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Using {knowledgeCount} knowledge entries for context
              </p>
            )}
            {learningEnabled && (
              <p className="flex items-center gap-1 mt-1">
                <Sparkles className="h-3 w-3" />
                Learning from this conversation
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
