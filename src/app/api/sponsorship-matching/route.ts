```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const matchingRequestSchema = z.object({
  creatorId: z.string().uuid(),
  includeInactive: z.boolean().optional().default(false),
  minBudget: z.number().optional(),
  maxBudget: z.number().optional(),
  contentCategories: z.array(z.string()).optional(),
  audienceAgeRange: z.object({
    min: z.number().min(13).max(65),
    max: z.number().min(13).max(65)
  }).optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'completed', 'cancelled']),
  notes: z.string().optional()
});

interface Creator {
  id: string;
  name: string;
  follower_count: number;
  engagement_rate: number;
  content_categories: string[];
  audience_demographics: {
    age_distribution: Record<string, number>;
    gender_distribution: Record<string, number>;
    location_distribution: Record<string, number>;
    interests: string[];
  };
}

interface Brand {
  id: string;
  name: string;
  industry: string;
  target_demographics: {
    age_range: { min: number; max: number };
    gender_preference: string[];
    locations: string[];
    interests: string[];
  };
  budget_range: { min: number; max: number };
  content_categories: string[];
  campaign_requirements: {
    min_followers: number;
    min_engagement_rate: number;
    content_type: string[];
  };
  active: boolean;
}

interface SponsorshipMatch {
  id: string;
  creator_id: string;
  brand_id: string;
  compatibility_score: number;
  audience_overlap_score: number;
  engagement_score: number;
  content_alignment_score: number;
  budget_fit_score: number;
  status: string;
  match_reasons: string[];
  estimated_budget: number;
  created_at: string;
}

// Matching algorithm implementation
class SponsorshipMatcher {
  calculateAudienceOverlap(creator: Creator, brand: Brand): number {
    let overlapScore = 0;
    let totalFactors = 0;

    // Age alignment
    const creatorAges = creator.audience_demographics.age_distribution;
    const brandAgeRange = brand.target_demographics.age_range;
    
    let ageOverlap = 0;
    Object.entries(creatorAges).forEach(([ageGroup, percentage]) => {
      const [minAge, maxAge] = ageGroup.split('-').map(Number);
      if (minAge >= brandAgeRange.min && maxAge <= brandAgeRange.max) {
        ageOverlap += percentage;
      }
    });
    overlapScore += Math.min(ageOverlap / 100, 1) * 40; // 40% weight
    totalFactors += 40;

    // Gender alignment
    const creatorGender = creator.audience_demographics.gender_distribution;
    const brandGenderPref = brand.target_demographics.gender_preference;
    
    if (brandGenderPref.length > 0) {
      let genderMatch = 0;
      brandGenderPref.forEach(gender => {
        genderMatch += creatorGender[gender] || 0;
      });
      overlapScore += Math.min(genderMatch / 100, 1) * 20; // 20% weight
      totalFactors += 20;
    }

    // Location alignment
    const creatorLocations = creator.audience_demographics.location_distribution;
    const brandLocations = brand.target_demographics.locations;
    
    if (brandLocations.length > 0) {
      let locationMatch = 0;
      brandLocations.forEach(location => {
        locationMatch += creatorLocations[location] || 0;
      });
      overlapScore += Math.min(locationMatch / 100, 1) * 20; // 20% weight
      totalFactors += 20;
    }

    // Interest alignment
    const creatorInterests = creator.audience_demographics.interests;
    const brandInterests = brand.target_demographics.interests;
    
    const commonInterests = creatorInterests.filter(interest => 
      brandInterests.includes(interest)
    );
    const interestScore = commonInterests.length / Math.max(brandInterests.length, 1);
    overlapScore += interestScore * 20; // 20% weight
    totalFactors += 20;

    return Math.min(overlapScore / Math.max(totalFactors, 100) * 100, 100);
  }

  calculateEngagementScore(creator: Creator, brand: Brand): number {
    const requiredRate = brand.campaign_requirements.min_engagement_rate;
    const creatorRate = creator.engagement_rate;
    
    if (creatorRate < requiredRate) return 0;
    
    // Scale score based on how much creator exceeds minimum
    const excess = (creatorRate - requiredRate) / requiredRate;
    return Math.min(80 + (excess * 20), 100);
  }

  calculateContentAlignment(creator: Creator, brand: Brand): number {
    const creatorCategories = creator.content_categories;
    const brandCategories = brand.content_categories;
    
    const commonCategories = creatorCategories.filter(category =>
      brandCategories.includes(category)
    );
    
    if (commonCategories.length === 0) return 0;
    
    return (commonCategories.length / brandCategories.length) * 100;
  }

  calculateBudgetFit(creator: Creator, brand: Brand): number {
    const followerTiers = [
      { min: 0, max: 10000, rate: 50 },
      { min: 10000, max: 100000, rate: 200 },
      { min: 100000, max: 1000000, rate: 1000 },
      { min: 1000000, max: Infinity, rate: 5000 }
    ];
    
    const tier = followerTiers.find(t => 
      creator.follower_count >= t.min && creator.follower_count < t.max
    );
    
    const estimatedCost = tier ? tier.rate * (1 + creator.engagement_rate / 100) : 0;
    const budgetMax = brand.budget_range.max;
    const budgetMin = brand.budget_range.min;
    
    if (estimatedCost > budgetMax) return 0;
    if (estimatedCost < budgetMin) return 60; // Lower budget fit for underpriced
    
    // Sweet spot scoring
    const budgetMid = (budgetMin + budgetMax) / 2;
    const deviation = Math.abs(estimatedCost - budgetMid) / budgetMid;
    return Math.max(100 - (deviation * 100), 0);
  }

  calculateCompatibilityScore(
    audienceScore: number,
    engagementScore: number,
    contentScore: number,
    budgetScore: number
  ): number {
    // Weighted average: audience (40%), engagement (25%), content (25%), budget (10%)
    return (
      audienceScore * 0.4 +
      engagementScore * 0.25 +
      contentScore * 0.25 +
      budgetScore * 0.1
    );
  }

  generateMatchReasons(
    audienceScore: number,
    engagementScore: number,
    contentScore: number,
    budgetScore: number,
    creator: Creator,
    brand: Brand
  ): string[] {
    const reasons: string[] = [];
    
    if (audienceScore > 70) {
      reasons.push(`Strong audience alignment (${Math.round(audienceScore)}% match)`);
    }
    
    if (engagementScore > 80) {
      reasons.push(`High engagement rate (${creator.engagement_rate}%)`);
    }
    
    if (contentScore > 60) {
      reasons.push('Content categories align with brand focus');
    }
    
    if (budgetScore > 70) {
      reasons.push('Budget requirements fit well');
    }
    
    if (creator.follower_count >= brand.campaign_requirements.min_followers * 1.5) {
      reasons.push('Exceeds minimum follower requirements');
    }
    
    return reasons;
  }

  async findMatches(creatorId: string, filters: any): Promise<SponsorshipMatch[]> {
    // Get creator data
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select(`
        *,
        audience_demographics (*)
      `)
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      throw new Error('Creator not found');
    }

    // Get active brands
    let brandsQuery = supabase
      .from('brands')
      .select('*')
      .eq('active', true);

    if (filters.minBudget) {
      brandsQuery = brandsQuery.gte('budget_range->max', filters.minBudget);
    }

    if (filters.maxBudget) {
      brandsQuery = brandsQuery.lte('budget_range->min', filters.maxBudget);
    }

    const { data: brands, error: brandsError } = await brandsQuery;

    if (brandsError) {
      throw new Error('Failed to fetch brands');
    }

    const matches: SponsorshipMatch[] = [];

    for (const brand of brands) {
      // Check basic requirements
      if (creator.follower_count < brand.campaign_requirements.min_followers) {
        continue;
      }
      
      if (creator.engagement_rate < brand.campaign_requirements.min_engagement_rate) {
        continue;
      }

      // Calculate scores
      const audienceScore = this.calculateAudienceOverlap(creator, brand);
      const engagementScore = this.calculateEngagementScore(creator, brand);
      const contentScore = this.calculateContentAlignment(creator, brand);
      const budgetScore = this.calculateBudgetFit(creator, brand);
      
      const compatibilityScore = this.calculateCompatibilityScore(
        audienceScore,
        engagementScore,
        contentScore,
        budgetScore
      );

      // Only include matches with reasonable compatibility
      if (compatibilityScore < 30) continue;

      const matchReasons = this.generateMatchReasons(
        audienceScore,
        engagementScore,
        contentScore,
        budgetScore,
        creator,
        brand
      );

      // Estimate budget
      const followerTiers = [
        { min: 0, max: 10000, rate: 50 },
        { min: 10000, max: 100000, rate: 200 },
        { min: 100000, max: 1000000, rate: 1000 },
        { min: 1000000, max: Infinity, rate: 5000 }
      ];
      
      const tier = followerTiers.find(t => 
        creator.follower_count >= t.min && creator.follower_count < t.max
      );
      
      const estimatedBudget = tier ? tier.rate * (1 + creator.engagement_rate / 100) : 0;

      matches.push({
        id: `${creatorId}-${brand.id}-${Date.now()}`,
        creator_id: creatorId,
        brand_id: brand.id,
        compatibility_score: Math.round(compatibilityScore),
        audience_overlap_score: Math.round(audienceScore),
        engagement_score: Math.round(engagementScore),
        content_alignment_score: Math.round(contentScore),
        budget_fit_score: Math.round(budgetScore),
        status: 'pending',
        match_reasons: matchReasons,
        estimated_budget: Math.round(estimatedBudget),
        created_at: new Date().toISOString()
      });
    }

    // Sort by compatibility score
    matches.sort((a, b) => b.compatibility_score - a.compatibility_score);

    return matches.slice(0, 50); // Limit to top 50 matches
  }
}

// GET /api/sponsorship-matching/[creatorId]
export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = new URL(request.url);
    const pathSegments = pathname.split('/');
    
    // Handle different GET endpoints
    if (pathSegments.includes('brands')) {
      // GET /api/sponsorship-matching/brands/[brandId]/creators
      const brandId = pathSegments[pathSegments.indexOf('brands') + 1];
      
      if (!brandId || brandId === 'creators') {
        return NextResponse.json(
          { error: 'Brand ID is required' },
          { status: 400 }
        );
      }

      const { data: matches, error } = await supabase
        .from('sponsorship_matches')
        .select(`
          *,
          creators (*),
          brands (*)
        `)
        .eq('brand_id', brandId)
        .order('compatibility_score', { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch creator matches' },
          { status: 500 }
        );
      }

      return NextResponse.json({ matches });
    } else {
      // GET /api/sponsorship-matching/[creatorId]
      const creatorId = pathSegments[pathSegments.length - 1];
      
      if (!creatorId) {
        return NextResponse.json(
          { error: 'Creator ID is required' },
          { status: 400 }
        );
      }

      // Validate creator ID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) {
        return NextResponse.json(
          { error: 'Invalid creator ID format' },
          { status: 400 }
        );
      }

      const includeInactive = searchParams.get('includeInactive') === 'true';
      const minBudget = searchParams.get('minBudget') ? Number(searchParams.get('minBudget')) : undefined;
      const maxBudget = searchParams.get('maxBudget') ? Number(searchParams.get('maxBudget')) : undefined;

      const matcher = new SponsorshipMatcher();
      const matches = await matcher.findMatches(creatorId, {
        includeInactive,
        minBudget,
        maxBudget
      });

      return NextResponse.json({ 
        matches,
        total: matches.length,
        creatorId
      });
    }
  } catch (error) {
    console.error('GET /api/sponsorship-matching error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sponsorship-matching
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = matchingRequestSchema.parse(body);

    const matcher = new SponsorshipMatcher();
    const matches = await matcher.findMatches(validatedData.creatorId, validatedData);

    // Store matches in database
    if (matches.length > 0) {
      const { error: insertError } = await supabase
        .from('sponsorship_matches')
        .upsert(matches, { 
          onConflict: 'creator_id,brand_id',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Failed to store matches:', insertError);
      }
    }

    return NextResponse.json({
      matches,
      total: matches.length,
      creatorId: validatedData.creatorId,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('POST /api/sponsorship-matching error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/sponsorship-matching/[matchId]/status
export async function PUT(request: NextRequest) {
  try {
    const { pathname } = new URL(request.url);
    const pathSegments = pathname.split('/');
    const matchId = pathSegments[pathSegments.indexOf('sponsorship-matching') + 1];

    if (!matchId || matchId === 'status') {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = statusUpdateSchema.parse(body);

    const { data: match, error: updateError } = await supabase
      .from('sponsorship_matches')
      .update({
        status: validatedData.status,
        notes: validatedData.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Match not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update match status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      match 
    });
  } catch (error) {
    console.error('PUT /api/sponsorship-matching error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```