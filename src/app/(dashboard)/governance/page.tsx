'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/auth-helpers-nextjs';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Badge,
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Progress,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription,
  ScrollArea,
  Avatar,
  AvatarImage,
  AvatarFallback
} from '@/components/ui';
import { 
  Vote,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Calendar,
  History,
  Upload,
  Eye,
  MessageSquare,
  Star,
  Trophy,
  Gavel
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Governance proposal interface
 */
interface Proposal {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'policy' | 'budget' | 'emergency';
  status: 'draft' | 'voting' | 'passed' | 'rejected' | 'implemented';
  author_id: string;
  author?: {
    username: string;
    avatar_url: string;
  };
  created_at: string;
  voting_start: string;
  voting_end: string;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  quorum_required: number;
  reputation_threshold: number;
  attachments?: string[];
  implementation_status?: string;
  tags: string[];
}

/**
 * Vote record interface
 */
interface VoteRecord {
  id: string;
  proposal_id: string;
  user_id: string;
  vote_type: 'for' | 'against' | 'abstain';
  reputation_weight: number;
  comment?: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

/**
 * User reputation interface
 */
interface UserReputation {
  user_id: string;
  reputation_score: number;
  participation_count: number;
  accuracy_rate: number;
  last_updated: string;
  rank: number;
  badges: string[];
}

/**
 * Audit trail entry interface
 */
interface AuditEntry {
  id: string;
  proposal_id: string;
  action: string;
  details: Record<string, any>;
  user_id: string;
  created_at: string;
  user?: {
    username: string;
  };
}

/**
 * Governance statistics interface
 */
interface GovernanceStats {
  total_proposals: number;
  active_votes: number;
  total_participants: number;
  average_participation: number;
  recent_decisions: number;
  implementation_rate: number;
}

/**
 * Proposal submission form component
 */
const ProposalSubmissionForm: React.FC<{
  onSubmit: (proposal: Partial<Proposal>) => void;
  isSubmitting: boolean;
}> = ({ onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature' as const,
    tags: '',
    attachments: [] as File[]
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    onSubmit({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  }, [formData, onSubmit]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({ ...prev, attachments: files }));
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter proposal title"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type *</label>
        <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feature">Feature Request</SelectItem>
            <SelectItem value="policy">Policy Change</SelectItem>
            <SelectItem value="budget">Budget Allocation</SelectItem>
            <SelectItem value="emergency">Emergency Decision</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Detailed description of the proposal..."
          rows={6}
          maxLength={2000}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <Input
          value={formData.tags}
          onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="tag1, tag2, tag3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Attachments</label>
        <div className="flex items-center space-x-2">
          <Input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleFileUpload}
            className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground"
          />
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
        {formData.attachments.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            {formData.attachments.length} file(s) selected
          </div>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
      </Button>
    </form>
  );
};

/**
 * Proposal card component
 */
const ProposalCard: React.FC<{
  proposal: Proposal;
  userVote?: VoteRecord;
  userReputation: number;
  onVote: (proposalId: string, voteType: 'for' | 'against' | 'abstain', comment?: string) => void;
  onViewDetails: (proposal: Proposal) => void;
}> = ({ proposal, userVote, userReputation, onVote, onViewDetails }) => {
  const [voteComment, setVoteComment] = useState('');
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [selectedVoteType, setSelectedVoteType] = useState<'for' | 'against' | 'abstain'>('for');

  const totalVotes = proposal.votes_for + proposal.votes_against + proposal.votes_abstain;
  const isVotingActive = proposal.status === 'voting' && new Date() < new Date(proposal.voting_end);
  const hasUserVoted = !!userVote;

  const handleVoteSubmit = useCallback(() => {
    onVote(proposal.id, selectedVoteType, voteComment);
    setShowVoteDialog(false);
    setVoteComment('');
  }, [proposal.id, selectedVoteType, voteComment, onVote]);

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-500',
      voting: 'bg-blue-500',
      passed: 'bg-green-500',
      rejected: 'bg-red-500',
      implemented: 'bg-purple-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      feature: <Star className="h-4 w-4" />,
      policy: <Gavel className="h-4 w-4" />,
      budget: <TrendingUp className="h-4 w-4" />,
      emergency: <AlertDescription className="h-4 w-4" />
    };
    return icons[type as keyof typeof icons] || <FileText className="h-4 w-4" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {getTypeIcon(proposal.type)}
              <CardTitle className="text-lg line-clamp-2">{proposal.title}</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={`${getStatusColor(proposal.status)} text-white`}>
                {proposal.status.toUpperCase()}
              </Badge>
              <Badge variant="outline">{proposal.type}</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={proposal.author?.avatar_url} />
              <AvatarFallback>{proposal.author?.username?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{proposal.author?.username}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {proposal.description}
        </p>

        {proposal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {proposal.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {totalVotes > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>For: {proposal.votes_for}</span>
              <span>Against: {proposal.votes_against}</span>
              <span>Abstain: {proposal.votes_abstain}</span>
            </div>
            <Progress 
              value={(proposal.votes_for / totalVotes) * 100}
              className="h-2"
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Created: {format(new Date(proposal.created_at), 'MMM dd, yyyy')}</span>
          {proposal.voting_end && (
            <span>Voting ends: {format(new Date(proposal.voting_end), 'MMM dd, yyyy')}</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(proposal)}
            className="flex items-center space-x-1"
          >
            <Eye className="h-3 w-3" />
            <span>View Details</span>
          </Button>

          {isVotingActive && !hasUserVoted && userReputation >= proposal.reputation_threshold && (
            <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center space-x-1">
                  <Vote className="h-3 w-3" />
                  <span>Vote</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cast Your Vote</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Your vote:</label>
                    <Select value={selectedVoteType} onValueChange={(value: any) => setSelectedVoteType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="for">For</SelectItem>
                        <SelectItem value="against">Against</SelectItem>
                        <SelectItem value="abstain">Abstain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Comment (optional):</label>
                    <Textarea
                      value={voteComment}
                      onChange={(e) => setVoteComment(e.target.value)}
                      placeholder="Explain your vote..."
                      rows={3}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Your reputation weight: {userReputation}
                  </div>
                  <Button onClick={handleVoteSubmit} className="w-full">
                    Submit Vote
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {hasUserVoted && (
            <Badge variant="outline" className="text-xs">
              Voted: {userVote.vote_type}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Reputation display component
 */
const ReputationDisplay: React.FC<{
  reputation: UserReputation;
}> = ({ reputation }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5" />
          <span>Your Reputation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">{reputation.reputation_score}</div>
          <div className="text-sm text-muted-foreground">Reputation Score</div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold">{reputation.participation_count}</div>
            <div className="text-muted-foreground">Votes Cast</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{(reputation.accuracy_rate * 100).toFixed(1)}%</div>
            <div className="text-muted-foreground">Accuracy</div>
          </div>
        </div>

        <div className="text-center">
          <Badge variant="outline">Rank #{reputation.rank}</Badge>
        </div>

        {reputation.badges.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Badges</div>
            <div className="flex flex-wrap gap-1">
              {reputation.badges.map(badge => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Governance statistics component
 */
const GovernanceStats: React.FC<{
  stats: GovernanceStats;
}> = ({ stats }) => {
  const statItems = [
    { label: 'Total Proposals', value: stats.total_proposals, icon: FileText },
    { label: 'Active Votes', value: stats.active_votes, icon: Vote },
    { label: 'Participants', value: stats.total_participants, icon: Users },
    { label: 'Avg Participation', value: `${stats.average_participation.toFixed(1)}%`, icon: TrendingUp },
    { label: 'Recent Decisions', value: stats.recent_decisions, icon: CheckCircle },
    { label: 'Implementation Rate', value: `${stats.implementation_rate.toFixed(1)}%`, icon: Clock }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statItems.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="p-4 text-center">
            <Icon className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/**
 * Audit trail component
 */
const AuditTrail: React.FC<{
  entries: AuditEntry[];
}> = ({ entries }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="h-5 w-5" />
          <span>Audit Trail</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-sm text-muted-foreground">
                      by {entry.user?.username}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                  {Object.keys(entry.details).length > 0 && (
                    <div className="text-xs bg-background p-2 rounded border">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No audit entries found
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

/**
 * Main governance page component
 */
export default function GovernancePage() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteRecord>>({});
  const [userReputation, setUserReputation] = useState<UserReputation | null>(null);
  const [governanceStats, setGovernanceStats] = useState<GovernanceStats | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [activeTab, setActiveTab] = useState('proposals');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Load user data
   */
  const loadUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }, [supabase]);

  /**
   * Load proposals
   */
  const loadProposals = useCallback(async () => {
    try {
      let query = supabase
        .from('proposals')
        .select(`
          *,
          author:profiles(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      setProposals(data || []);
    } catch (error) {
      console.error('Error loading proposals:', error);
      toast.error('Failed to load proposals');
    }
  }, [supabase, filterType, filterStatus]);

  /**
   * Load user votes
   */
  const loadUserVotes = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const votesMap = (data || []).reduce((acc, vote) => {
        acc[vote.proposal_id] = vote;
        return acc;
      }, {} as Record<string, VoteRecord>);

      setUserVotes(votesMap);
    } catch (error) {
      console.error('Error loading user votes:',