```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { 
  User, 
  Users, 
  Target, 
  Brain, 
  Star, 
  MessageCircle, 
  TrendingUp, 
  Filter, 
  Search, 
  Clock, 
  Award, 
  BookOpen, 
  Heart, 
  Zap,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Settings,
  BarChart3,
  Calendar,
  MapPin,
  Globe,
  Send
} from 'lucide-react';

interface MentorshipProfile {
  id: string;
  userId: string;
  type: 'mentor' | 'mentee' | 'both';
  name: string;
  avatar: string;
  title: string;
  company: string;
  location: string;
  experience: number;
  skills: Skill[];
  goals: string[];
  availability: string;
  timezone: string;
  languages: string[];
  bio: string;
  preferences: UserPreferences;
  compatibility: CompatibilityScore;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  verified: boolean;
  yearsExperience: number;
}

interface UserPreferences {
  meetingFrequency: 'weekly' | 'biweekly' | 'monthly' | 'flexible';
  communicationStyle: 'formal' | 'casual' | 'mixed';
  sessionDuration: '30min' | '45min' | '60min' | '90min';
  focusAreas: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  mentorshipGoals: string[];
}

interface CompatibilityScore {
  overall: number;
  skillsAlignment: number;
  personalityMatch: number;
  goalsCompatibility: number;
  availabilityMatch: number;
  communicationStyle: number;
}

interface Match {
  id: string;
  mentorId: string;
  menteeId: string;
  mentor: MentorshipProfile;
  mentee: MentorshipProfile;
  compatibilityScore: CompatibilityScore;
  matchReason: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  aiInsights: string[];
}

interface ConnectionRequest {
  id: string;
  matchId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface MentorshipMatchingSystemProps {
  currentUser: {
    id: string;
    name: string;
    avatar: string;
  };
  onProfileUpdate?: (profile: Partial<MentorshipProfile>) => void;
  onConnectionRequest?: (request: ConnectionRequest) => void;
  onMatchFeedback?: (matchId: string, rating: number, feedback: string) => void;
  className?: string;
}

interface MatchingFilters {
  skills: string[];
  experience: [number, number];
  availability: string[];
  location: string;
  languages: string[];
  mentorshipType: 'mentor' | 'mentee' | 'both' | '';
}

const MentorshipMatchingSystem: React.FC<MentorshipMatchingSystemProps> = ({
  currentUser,
  onProfileUpdate,
  onConnectionRequest,
  onMatchFeedback,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState<MentorshipProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filters, setFilters] = useState<MatchingFilters>({
    skills: [],
    experience: [0, 20],
    availability: [],
    location: '',
    languages: [],
    mentorshipType: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('');

  // Mock data for development
  const mockProfile: MentorshipProfile = {
    id: '1',
    userId: currentUser.id,
    type: 'both',
    name: currentUser.name,
    avatar: currentUser.avatar,
    title: 'Senior Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    experience: 8,
    skills: [
      { id: '1', name: 'React', category: 'Frontend', level: 'expert', verified: true, yearsExperience: 5 },
      { id: '2', name: 'Node.js', category: 'Backend', level: 'advanced', verified: true, yearsExperience: 4 },
      { id: '3', name: 'Machine Learning', category: 'AI/ML', level: 'intermediate', verified: false, yearsExperience: 2 }
    ],
    goals: ['Leadership Development', 'System Architecture', 'Team Management'],
    availability: 'evenings-weekends',
    timezone: 'PST',
    languages: ['English', 'Spanish'],
    bio: 'Passionate about mentoring and helping others grow in their tech careers.',
    preferences: {
      meetingFrequency: 'biweekly',
      communicationStyle: 'casual',
      sessionDuration: '60min',
      focusAreas: ['Career Development', 'Technical Skills'],
      learningStyle: 'mixed',
      mentorshipGoals: ['Skill Development', 'Career Advancement']
    },
    compatibility: {
      overall: 0,
      skillsAlignment: 0,
      personalityMatch: 0,
      goalsCompatibility: 0,
      availabilityMatch: 0,
      communicationStyle: 0
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockMatches: Match[] = [
    {
      id: '1',
      mentorId: '2',
      menteeId: currentUser.id,
      mentor: {
        id: '2',
        userId: '2',
        type: 'mentor',
        name: 'Sarah Chen',
        avatar: '/avatars/sarah.jpg',
        title: 'Principal Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        experience: 12,
        skills: [
          { id: '1', name: 'System Design', category: 'Architecture', level: 'expert', verified: true, yearsExperience: 8 },
          { id: '2', name: 'Leadership', category: 'Management', level: 'expert', verified: true, yearsExperience: 6 }
        ],
        goals: ['Mentoring', 'Knowledge Sharing'],
        availability: 'weekends',
        timezone: 'PST',
        languages: ['English', 'Mandarin'],
        bio: 'Experienced tech leader passionate about developing the next generation of engineers.',
        preferences: mockProfile.preferences,
        compatibility: {
          overall: 92,
          skillsAlignment: 88,
          personalityMatch: 95,
          goalsCompatibility: 90,
          availabilityMatch: 85,
          communicationStyle: 98
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      mentee: mockProfile,
      compatibilityScore: {
        overall: 92,
        skillsAlignment: 88,
        personalityMatch: 95,
        goalsCompatibility: 90,
        availabilityMatch: 85,
        communicationStyle: 98
      },
      matchReason: 'High compatibility in leadership goals and technical expertise alignment',
      status: 'pending',
      createdAt: new Date().toISOString(),
      aiInsights: [
        'Strong alignment in leadership development goals',
        'Complementary skill sets for growth',
        'Compatible communication styles',
        'Similar availability preferences'
      ]
    }
  ];

  useEffect(() => {
    setProfile(mockProfile);
    setMatches(mockMatches);
  }, []);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      const targetProfile = match.mentor.userId === currentUser.id ? match.mentee : match.mentor;
      
      if (searchQuery && !targetProfile.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !targetProfile.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filters.mentorshipType && targetProfile.type !== filters.mentorshipType && targetProfile.type !== 'both') {
        return false;
      }
      
      if (filters.skills.length > 0) {
        const hasMatchingSkill = targetProfile.skills.some(skill => 
          filters.skills.includes(skill.name)
        );
        if (!hasMatchingSkill) return false;
      }
      
      if (targetProfile.experience < filters.experience[0] || targetProfile.experience > filters.experience[1]) {
        return false;
      }
      
      return true;
    });
  }, [matches, searchQuery, filters, currentUser.id]);

  const handleConnectionRequest = (match: Match) => {
    setSelectedMatch(match);
    setShowConnectionDialog(true);
  };

  const submitConnectionRequest = () => {
    if (!selectedMatch) return;

    const request: ConnectionRequest = {
      id: `req_${Date.now()}`,
      matchId: selectedMatch.id,
      fromUserId: currentUser.id,
      toUserId: selectedMatch.mentor.userId === currentUser.id ? selectedMatch.mentee.userId : selectedMatch.mentor.userId,
      message: connectionMessage,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    onConnectionRequest?.(request);
    setShowConnectionDialog(false);
    setConnectionMessage('');
    setSelectedMatch(null);
  };

  const MatchingDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Active Matches</p>
                <p className="text-2xl font-bold">{matches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Avg Compatibility</p>
                <p className="text-2xl font-bold">
                  {matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.compatibilityScore.overall, 0) / matches.length) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Pending Requests</p>
                <p className="text-2xl font-bold">
                  {matches.filter(m => m.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold">85%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Matches</CardTitle>
          <CardDescription>AI-powered mentorship recommendations based on your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMatches.slice(0, 3).map((match) => (
              <MatchCard key={match.id} match={match} onConnect={() => handleConnectionRequest(match)} />
            ))}
          </div>
          {filteredMatches.length > 3 && (
            <Button variant="outline" className="w-full mt-4" onClick={() => setActiveTab('matches')}>
              View All Matches
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const MatchCard: React.FC<{ match: Match; onConnect: () => void }> = ({ match, onConnect }) => {
    const targetProfile = match.mentor.userId === currentUser.id ? match.mentee : match.mentor;
    const isCurrentUserMentor = match.mentor.userId === currentUser.id;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={targetProfile.avatar} alt={targetProfile.name} />
              <AvatarFallback>{targetProfile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{targetProfile.name}</h3>
                  <p className="text-sm text-muted-foreground">{targetProfile.title} at {targetProfile.company}</p>
                </div>
                <Badge variant={isCurrentUserMentor ? "default" : "secondary"}>
                  {isCurrentUserMentor ? "Mentee" : "Mentor"}
                </Badge>
              </div>

              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>{targetProfile.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Award className="h-3 w-3" />
                  <span>{targetProfile.experience} years</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">{match.compatibilityScore.overall}% match</span>
                  <Progress value={match.compatibilityScore.overall} className="w-20 h-2" />
                </div>
                <Button size="sm" onClick={onConnect} disabled={match.status === 'pending'}>
                  {match.status === 'pending' ? 'Pending' : 'Connect'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-1">
                {targetProfile.skills.slice(0, 3).map((skill) => (
                  <Badge key={skill.id} variant="outline" className="text-xs">
                    {skill.name}
                  </Badge>
                ))}
                {targetProfile.skills.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{targetProfile.skills.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const MatchingFilters = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Advanced Filters</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mentorship Type</Label>
          <Select value={filters.mentorshipType} onValueChange={(value) => setFilters({...filters, mentorshipType: value as any})}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="mentor">Looking for Mentors</SelectItem>
              <SelectItem value="mentee">Looking for Mentees</SelectItem>
              <SelectItem value="both">Open to Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Experience Range: {filters.experience[0]} - {filters.experience[1]} years</Label>
          <Slider
            value={filters.experience}
            onValueChange={(value) => setFilters({...filters, experience: value as [number, number]})}
            max={20}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Skills</Label>
          <div className="grid grid-cols-2 gap-2">
            {['React', 'Node.js', 'Python', 'Machine Learning', 'Leadership', 'System Design'].map((skill) => (
              <div key={skill} className="flex items-center space-x-2">
                <Checkbox
                  id={skill}
                  checked={filters.skills.includes(skill)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFilters({...filters, skills: [...filters.skills, skill]});
                    } else {
                      setFilters({...filters, skills: filters.skills.filter(s => s !== skill)});
                    }
                  }}
                />
                <Label htmlFor={skill} className="text-sm">{skill}</Label>
              </div>
            ))}
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setFilters({
            skills: [],
            experience: [0, 20],
            availability: [],
            location: '',
            languages: [],
            mentorshipType: ''
          })}
        >
          Clear Filters
        </Button>
      </CardContent>
    </Card>
  );

  const ProfileSetup = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Setup</CardTitle>
          <CardDescription>Complete your profile to get better mentorship matches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mentorship-type">I want to be a:</Label>
              <Select defaultValue={profile?.type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mentorship type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="mentee">Mentee</SelectItem>
                  <SelectItem value="both">Both Mentor and Mentee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                placeholder="Enter years of experience"
                defaultValue={profile?.experience}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself, your experience, and what you're looking for in mentorship..."
              defaultValue={profile?.bio}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Goals</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Career Development',
                'Technical Skills',
                'Leadership',
                'Networking',
                '