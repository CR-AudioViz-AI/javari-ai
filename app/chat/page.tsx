'use client';

import ChatInterface from '@/components/chat/ChatInterface';

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="w-full h-screen bg-slate-900">
      <ChatInterface />
    </div>
  );
}
