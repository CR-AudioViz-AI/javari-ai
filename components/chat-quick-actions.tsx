'use client';

import { useState } from 'react';
import {
  Sparkles,
  Code,
  FileText,
  Image,
  Lightbulb,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  prompt: string;
  category: 'create' | 'code' | 'help' | 'analyze';
}

const quickActions: QuickAction[] = [
  {
    icon: Code,
    label: 'Write Code',
    prompt: 'Help me write code for ',
    category: 'code',
  },
  {
    icon: FileText,
    label: 'Create Document',
    prompt: 'Create a professional document about ',
    category: 'create',
  },
  {
    icon: Image,
    label: 'Design Ideas',
    prompt: 'Give me design ideas for ',
    category: 'create',
  },
  {
    icon: Lightbulb,
    label: 'Brainstorm',
    prompt: 'Help me brainstorm ideas for ',
    category: 'help',
  },
  {
    icon: Zap,
    label: 'Quick Fix',
    prompt: 'Help me fix this issue: ',
    category: 'code',
  },
  {
    icon: MessageSquare,
    label: 'Explain',
    prompt: 'Explain in simple terms: ',
    category: 'help',
  },
];

interface ChatQuickActionsProps {
  onSelectAction: (prompt: string) => void;
  disabled?: boolean;
}

export function ChatQuickActions({ onSelectAction, disabled }: ChatQuickActionsProps) {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2 p-4 border-b bg-muted/30">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
        <Sparkles className="h-4 w-4" />
        Quick actions:
      </div>
      {quickActions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-xs"
          onClick={() => onSelectAction(action.prompt)}
          onMouseEnter={() => setHoveredAction(action.label)}
          onMouseLeave={() => setHoveredAction(null)}
        >
          <action.icon className="h-3 w-3 mr-1" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
