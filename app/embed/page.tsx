// =============================================================================
// JAVARI AI - EMBED PAGE
// =============================================================================
// Renders the embeddable widget - served as an iframe
// Production Ready - Sunday, December 14, 2025
// =============================================================================

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import JavariEmbed from '@/components/JavariEmbed';

function EmbedContent() {
  const searchParams = useSearchParams();
  
  const config = {
    position: (searchParams.get('position') as 'bottom-right' | 'bottom-left') || 'bottom-right',
    primaryColor: searchParams.get('color') || '#3B82F6',
    title: searchParams.get('title') || 'Javari AI',
    subtitle: searchParams.get('subtitle') || 'AI Assistant',
    placeholder: searchParams.get('placeholder') || 'Type a message...',
    welcomeMessage: searchParams.get('welcome') || "Hi! I'm Javari, your AI assistant. How can I help you today?",
  };

  return (
    <div className="fixed inset-0 bg-transparent">
      <JavariEmbed {...config} />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full animate-pulse" />}>
      <EmbedContent />
    </Suspense>
  );
}
