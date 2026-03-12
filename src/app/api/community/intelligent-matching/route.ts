```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

interface MatchRequest {
  userId: string;
  matchTypes: ('projects' | 'collaborators' | 'opportunities')[];
  filters?: {
    skillCategories?: string[];
    availabilityHours?: number;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
    location?: string;
    remote?: boolean;
  };
  preferences?: {
    skillWeight?: number;
    availabilityWeight?: number;
    interestWeight?: number;
    diversityBoost?: boolean;
  };
  limit?: number;
  page?: number;
}

interface UserProfile {
  id: string;
  skills: Skill[];
  interests: string[];
  availability_patterns: AvailabilityPattern[];
  experience_level: string;
  location?: string;
  remote_preference: boolean;
  collaboration_history: CollaborationRecord[];
}

interface Skill {
  name: string;
  level: number; // 1-5
  category: string;
  verified: boolean;
}

interface AvailabilityPattern {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  timezone: string;
}

interface CollaborationRecord {
  project_id: string;
  rating: number;
  skills_used: string[];
  duration_days: number;
}

interface MatchResult {
  id: string;
  type: 'project' | 'collaborator' | 'opportunity';
  title: string;
  description: string;
  confidence_score: number;
  match_reasons: MatchReason[];
  skills_match: SkillMatch[];
  availability_overlap?: number;
  estimated_commitment?: string;
  metadata?: Record<string, any>;
}

interface MatchReason {
  type: 'skill_compatibility' | 'interest_alignment' | 'availability_match' | 'experience_fit' | 'collaboration_history';
  score: number;
  explanation: string;
}

interface SkillMatch {
  skill: string;
  user_level: number;
  required_level: number;
  match_strength: number;
}

class SkillsAnalyzer {
  static calculateSkillCompatibility(userSkills: Skill[], requiredSkills: Skill[]): SkillMatch[] {
    return requiredSkills.map(required => {
      const userSkill = userSkills.find(s => s.name.toLowerCase() === required.name.toLowerCase());
      const userLevel = userSkill?.level || 0;
      const matchStrength = userLevel >= required.level ? 
        1.0 : Math.max(0, (userLevel / required.level) * 0.8);
      
      return {
        skill: required.name,
        user_level: userLevel,
        required_level: required.level,
        match_strength: matchStrength
      };
    });
  }

  static calculateOverallSkillScore(skillMatches: SkillMatch[]): number {
    if (skillMatches.length === 0) return 0;
    return skillMatches.reduce((sum, match) => sum + match.match_strength, 0) / skillMatches.length;
  }
}

class AvailabilityPredictor {
  static calculateOverlap(userPatterns: AvailabilityPattern[], targetPatterns: AvailabilityPattern[]): number {
    let totalOverlapHours = 0;
    let totalPossibleHours = 0;

    for (let day = 0; day < 7; day++) {
      const userDayPatterns = userPatterns.filter(p => p.day_of_week === day);
      const targetDayPatterns = targetPatterns.filter(p => p.day_of_week === day);

      if (userDayPatterns.length === 0 || targetDayPatterns.length === 0) continue;

      userDayPatterns.forEach(userPattern => {
        targetDayPatterns.forEach(targetPattern => {
          const overlapStart = Math.max(userPattern.start_hour, targetPattern.start_hour);
          const overlapEnd = Math.min(userPattern.end_hour, targetPattern.end_hour);
          
          if (overlapStart < overlapEnd) {
            totalOverlapHours += overlapEnd - overlapStart;
          }
          
          totalPossibleHours += Math.max(
            userPattern.end_hour - userPattern.start_hour,
            targetPattern.end_hour - targetPattern.start_hour
          );
        });
      });
    }

    return totalPossibleHours > 0 ? totalOverlapHours / totalPossibleHours : 0;
  }
}

class CollaborationScorer {
  static calculateHistoryScore(userHistory: CollaborationRecord[], targetContext: any): number {
    if (userHistory.length === 0) return 0.5; // Neutral score for new users

    const avgRating = userHistory.reduce((sum, record) => sum + record.rating, 0) / userHistory.length;
    const experienceBonus = Math.min(userHistory.length / 10, 0.2); // Max 20% bonus
    
    return Math.min((avgRating / 5) + experienceBonus, 1.0);
  }

  static calculateInterestAlignment(userInterests: string[], targetTags: string[]): number {
    if (userInterests.length === 0 || targetTags.length === 0) return 0;
    
    const intersection = userInterests.filter(interest => 
      targetTags.some(tag => tag.toLowerCase().includes(interest.toLowerCase()) || 
                             interest.toLowerCase().includes(tag.toLowerCase()))
    );
    
    return intersection.length / Math.max(userInterests.length, targetTags.length);
  }
}

class PreferenceWeighter {
  static calculateWeightedScore(
    skillScore: number,
    availabilityScore: number,
    interestScore: number,
    historyScore: number,
    preferences: MatchRequest['preferences'] = {}
  ): number {
    const weights = {
      skill: preferences.skillWeight || 0.4,
      availability: preferences.availabilityWeight || 0.25,
      interest: preferences.interestWeight || 0.25,
      history: 0.1
    };

    return (
      skillScore * weights.skill +
      availabilityScore * weights.availability +
      interestScore * weights.interest +
      historyScore * weights.history
    );
  }
}

class OpportunityRanker {
  static applyDiversityFilters(matches: MatchResult[], diversityBoost: boolean): MatchResult[] {
    if (!diversityBoost) return matches;

    // Boost matches from different categories/types to promote diversity
    const categoryCounts: Record<string, number> = {};
    
    return matches.map(match => {
      const category = match.metadata?.category || 'unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      
      // Apply diminishing returns for repeated categories
      const diversityMultiplier = 1 / Math.sqrt(categoryCounts[category]);
      
      return {
        ...match,
        confidence_score: match.confidence_score * diversityMultiplier
      };
    }).sort((a, b) => b.confidence_score - a.confidence_score);
  }
}

class MatchingEngine {
  static async findProjectMatches(user: UserProfile, filters: any): Promise<MatchResult[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id, title, description, required_skills, availability_requirements,
        tags, experience_level, location, remote_friendly, metadata
      `)
      .eq('status', 'open')
      .limit(50);

    if (error) throw error;

    const matches: MatchResult[] = [];

    for (const project of projects || []) {
      const skillMatches = SkillsAnalyzer.calculateSkillCompatibility(
        user.skills,
        project.required_skills || []
      );
      const skillScore = SkillsAnalyzer.calculateOverallSkillScore(skillMatches);
      
      const availabilityScore = project.availability_requirements ?
        AvailabilityPredictor.calculateOverlap(user.availability_patterns, project.availability_requirements) :
        0.8; // Assume flexible if not specified
      
      const interestScore = CollaborationScorer.calculateInterestAlignment(
        user.interests,
        project.tags || []
      );
      
      const historyScore = CollaborationScorer.calculateHistoryScore(
        user.collaboration_history,
        project
      );

      const confidenceScore = PreferenceWeighter.calculateWeightedScore(
        skillScore,
        availabilityScore,
        interestScore,
        historyScore,
        filters.preferences
      );

      if (confidenceScore >= 0.3) { // Minimum threshold
        const matchReasons: MatchReason[] = [
          {
            type: 'skill_compatibility',
            score: skillScore,
            explanation: `${Math.round(skillScore * 100)}% skill match based on required capabilities`
          },
          {
            type: 'availability_match',
            score: availabilityScore,
            explanation: `${Math.round(availabilityScore * 100)}% schedule compatibility`
          },
          {
            type: 'interest_alignment',
            score: interestScore,
            explanation: `${Math.round(interestScore * 100)}% interest overlap with project themes`
          }
        ];

        matches.push({
          id: project.id,
          type: 'project',
          title: project.title,
          description: project.description,
          confidence_score: confidenceScore,
          match_reasons: matchReasons,
          skills_match: skillMatches,
          availability_overlap: availabilityScore,
          estimated_commitment: project.metadata?.estimated_hours || 'Flexible',
          metadata: project.metadata
        });
      }
    }

    return matches.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  static async findCollaboratorMatches(user: UserProfile, filters: any): Promise<MatchResult[]> {
    const { data: collaborators, error } = await supabase
      .from('user_profiles')
      .select(`
        id, username, bio, skills, interests, availability_patterns,
        experience_level, location, remote_preference, collaboration_history
      `)
      .neq('id', user.id)
      .eq('seeking_collaboration', true)
      .limit(50);

    if (error) throw error;

    const matches: MatchResult[] = [];

    for (const collaborator of collaborators || []) {
      // Find complementary skills
      const complementarySkills = collaborator.skills?.filter((collabSkill: any) => 
        !user.skills.some(userSkill => userSkill.name === collabSkill.name)
      ) || [];

      const skillComplementarity = complementarySkills.length / (collaborator.skills?.length || 1);
      
      const availabilityScore = AvailabilityPredictor.calculateOverlap(
        user.availability_patterns,
        collaborator.availability_patterns || []
      );
      
      const interestScore = CollaborationScorer.calculateInterestAlignment(
        user.interests,
        collaborator.interests || []
      );
      
      const historyScore = (
        CollaborationScorer.calculateHistoryScore(user.collaboration_history, collaborator) +
        CollaborationScorer.calculateHistoryScore(collaborator.collaboration_history || [], user)
      ) / 2;

      const confidenceScore = PreferenceWeighter.calculateWeightedScore(
        skillComplementarity,
        availabilityScore,
        interestScore,
        historyScore,
        filters.preferences
      );

      if (confidenceScore >= 0.25) {
        matches.push({
          id: collaborator.id,
          type: 'collaborator',
          title: collaborator.username,
          description: collaborator.bio || 'Available for collaboration',
          confidence_score: confidenceScore,
          match_reasons: [
            {
              type: 'skill_compatibility',
              score: skillComplementarity,
              explanation: `Brings ${complementarySkills.length} complementary skills`
            },
            {
              type: 'availability_match',
              score: availabilityScore,
              explanation: `${Math.round(availabilityScore * 100)}% schedule overlap`
            }
          ],
          skills_match: [],
          availability_overlap: availabilityScore,
          metadata: {
            experience_level: collaborator.experience_level,
            location: collaborator.location,
            remote_preference: collaborator.remote_preference
          }
        });
      }
    }

    return matches.sort((a, b) => b.confidence_score - a.confidence_score);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: MatchRequest = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.matchTypes || body.matchTypes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, matchTypes' },
        { status: 400 }
      );
    }

    const limit = Math.min(body.limit || 20, 100);
    const page = Math.max(body.page || 1, 1);
    const offset = (page - 1) * limit;

    // Check cache first
    const cacheKey = `intelligent-matching:${body.userId}:${JSON.stringify(body)}`;
    const cachedResult = await redis.get(cacheKey);
    
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult);
      return NextResponse.json({
        matches: parsed.matches.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          total: parsed.matches.length,
          hasMore: offset + limit < parsed.matches.length
        },
        cached: true
      });
    }

    // Fetch user profile
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select(`
        id, skills, interests, availability_patterns, experience_level,
        location, remote_preference, collaboration_history
      `)
      .eq('id', body.userId)
      .single();

    if (userError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    let allMatches: MatchResult[] = [];

    // Find matches based on requested types
    if (body.matchTypes.includes('projects')) {
      const projectMatches = await MatchingEngine.findProjectMatches(userProfile, body);
      allMatches.push(...projectMatches);
    }

    if (body.matchTypes.includes('collaborators')) {
      const collaboratorMatches = await MatchingEngine.findCollaboratorMatches(userProfile, body);
      allMatches.push(...collaboratorMatches);
    }

    // Apply diversity filters if requested
    if (body.preferences?.diversityBoost) {
      allMatches = OpportunityRanker.applyDiversityFilters(allMatches, true);
    }

    // Sort by confidence score
    allMatches.sort((a, b) => b.confidence_score - a.confidence_score);

    // Cache results for 15 minutes
    await redis.setex(cacheKey, 900, JSON.stringify({ matches: allMatches }));

    const paginatedMatches = allMatches.slice(offset, offset + limit);

    return NextResponse.json({
      matches: paginatedMatches,
      pagination: {
        page,
        limit,
        total: allMatches.length,
        hasMore: offset + limit < allMatches.length
      },
      cached: false,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Intelligent matching error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
```