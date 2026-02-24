'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface MessageFeedbackProps {
  messageId: string;
  userMessage?: string;
  assistantResponse: string;
  onRegenerate?: () => void;
}

export function MessageFeedback({
  messageId,
  userMessage,
  assistantResponse,
  onRegenerate,
}: MessageFeedbackProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: 'up' | 'down') => {
    if (feedback === type) return; // Already submitted this feedback
    
    setIsSubmitting(true);
    setFeedback(type);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating: type === 'up' ? 'helpful' : 'not_helpful',
          userMessage,
          assistantResponse,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: type === 'up' ? 'Thanks for the feedback!' : 'Feedback noted',
          description: data.learningTriggered 
            ? 'This helped Javari learn something new!' 
            : 'Your feedback helps improve responses.',
        });
      }
    } catch (error) {
      console.error('Feedback error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(assistantResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Response copied to clipboard',
      });
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2 ${feedback === 'up' ? 'text-green-600 bg-green-50' : ''}`}
        onClick={() => handleFeedback('up')}
        disabled={isSubmitting}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 px-2 ${feedback === 'down' ? 'text-red-600 bg-red-50' : ''}`}
        onClick={() => handleFeedback('down')}
        disabled={isSubmitting}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      {onRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onRegenerate}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
