'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Trash2,
  Star,
  Clock,
  ChevronRight,
  Archive,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Conversation {
  id: string;
  title: string;
  user_id: string | null;
  provider: string;
  model: string;
  message_count: number;
  rating: number | null;
  is_archived: boolean;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversations?limit=50');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      const response = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const archiveConversation = async (id: string, isArchived: boolean) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id, isArchived: !isArchived })
      });
      if (response.ok) {
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const startNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: 'New Conversation' })
      });
      if (response.ok) {
        const data = await response.json();
        router.push(`/chat?id=${data.conversation.id}`);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title.toLowerCase().includes(query) ||
      conv.last_message_preview?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const providerColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'bg-green-100 text-green-800';
      case 'anthropic': return 'bg-purple-100 text-purple-800';
      
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            Chat History
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} conversation{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchConversations} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={startNewConversation} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No conversations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start chatting with Javari to see your conversation history here.
              </p>
              <Button onClick={startNewConversation}>
                <Plus className="h-4 w-4 mr-2" />
                Start New Chat
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map(conv => (
            <Card
              key={conv.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                conv.is_archived ? 'opacity-60' : ''
              }`}
              onClick={() => router.push(`/chat?id=${conv.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{conv.title}</h3>
                      {conv.is_archived && (
                        <Badge variant="secondary" className="text-xs">
                          <Archive className="h-3 w-3 mr-1" />
                          Archived
                        </Badge>
                      )}
                    </div>
                    {conv.last_message_preview && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message_preview}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(conv.updated_at)}
                      </span>
                      <span>{conv.message_count} messages</span>
                      <Badge className={`text-xs ${providerColor(conv.provider)}`}>
                        {conv.provider}
                      </Badge>
                      {conv.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          {conv.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveConversation(conv.id, conv.is_archived);
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
