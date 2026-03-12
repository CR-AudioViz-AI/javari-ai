```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ethers } from 'ethers';
import crypto from 'crypto';

// Environment variables validation
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  WEB3_PROVIDER_URL: process.env.WEB3_PROVIDER_URL,
  BLOCKCHAIN_PRIVATE_KEY: process.env.BLOCKCHAIN_PRIVATE_KEY,
  GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN,
  AI_ASSESSMENT_API_KEY: process.env.AI_ASSESSMENT_API_KEY,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const supabase = createClient(
  requiredEnvVars.SUPABASE_URL!,
  requiredEnvVars.SUPABASE_ANON_KEY!
);

// Validation schemas
const initiateVerificationSchema = z.object({
  member_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  verification_type: z.enum(['peer_validation', 'portfolio_assessment', 'automated_test', 'combined']),
  portfolio_links: z.array(z.string().url()).optional(),
  test_preferences: z.object({
    difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']),
    test_duration_minutes: z.number().min(15).max(180),
  }).optional(),
  peer_validator_requirements: z.object({
    min_validators: z.number().min(3).max(10),
    required_skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    exclude_member_ids: z.array(z.string().uuid()).optional(),
  }).optional(),
});

const endorseSkillSchema = z.object({
  verification_id: z.string().uuid(),
  endorser_id: z.string().uuid(),
  endorsement_type: z.enum(['peer_review', 'mentor_validation', 'project_collaboration', 'code_review']),
  confidence_score: z.number().min(1).max(10),
  comments: z.string().min(10).max(500).optional(),
  evidence_links: z.array(z.string().url()).optional(),
});

const updateVerificationSchema = z.object({
  verification_id: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'peer_review', 'completed', 'rejected', 'expired']),
  test_results: z.object({
    score: z.number().min(0).max(100),
    passed: z.boolean(),
    detailed_results: z.record(z.any()),
  }).optional(),
  blockchain_hash: z.string().optional(),
});

// Types
interface SkillVerification {
  verification_id: string;
  member_id: string;
  skill_id: string;
  verification_type: string;
  status: string;
  peer_validators: string[];
  portfolio_links: string[];
  test_results: any;
  blockchain_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface SkillEndorsement {
  endorsement_id: string;
  skill_verification_id: string;
  endorser_id: string;
  endorsement_type: string;
  confidence_score: number;
  comments: string | null;
  evidence_links: string[];
  created_at: string;
}

// Services
class PeerValidationService {
  static async findQualifiedValidators(
    skillId: string,
    requirements: any,
    excludeIds: string[] = []
  ): Promise<string[]> {
    const { data: validators, error } = await supabase
      .from('community_members')
      .select(`
        member_id,
        verified_skills!inner(skill_id, proficiency_level),
        reputation_score
      `)
      .eq('verified_skills.skill_id', skillId)
      .gte('verified_skills.proficiency_level', requirements.required_skill_level)
      .gte('reputation_score', 7.0)
      .not('member_id', 'in', `(${excludeIds.join(',')})`)
      .limit(requirements.min_validators * 2);

    if (error) throw new Error(`Failed to find validators: ${error.message}`);
    
    return validators
      ?.sort((a, b) => b.reputation_score - a.reputation_score)
      .slice(0, requirements.min_validators)
      .map(v => v.member_id) || [];
  }

  static async notifyValidators(validatorIds: string[], verificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .insert(
        validatorIds.map(validatorId => ({
          recipient_id: validatorId,
          type: 'skill_validation_request',
          title: 'Skill Validation Request',
          message: `You've been selected to validate a community member's skill.`,
          metadata: { verification_id: verificationId },
        }))
      );
  }
}

class PortfolioAssessmentEngine {
  static async analyzeGitHubRepository(repoUrl: string): Promise<any> {
    try {
      const repoPath = repoUrl.replace('https://github.com/', '');
      const response = await fetch(`https://api.github.com/repos/${repoPath}`, {
        headers: {
          'Authorization': `token ${requiredEnvVars.GITHUB_API_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) throw new Error('Repository not accessible');

      const repoData = await response.json();
      
      // Analyze languages, commits, complexity
      const languagesResponse = await fetch(`https://api.github.com/repos/${repoPath}/languages`, {
        headers: { 'Authorization': `token ${requiredEnvVars.GITHUB_API_TOKEN}` },
      });
      
      const languages = await languagesResponse.json();
      
      return {
        repository_metrics: {
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          size: repoData.size,
          languages: languages,
          last_updated: repoData.updated_at,
        },
        code_quality_score: await this.assessCodeQuality(repoPath),
        complexity_analysis: await this.analyzeComplexity(repoPath),
      };
    } catch (error) {
      throw new Error(`Portfolio analysis failed: ${error}`);
    }
  }

  static async assessCodeQuality(repoPath: string): Promise<number> {
    // Simplified code quality assessment
    // In production, integrate with SonarQube, CodeClimate, etc.
    try {
      const response = await fetch(`https://api.github.com/repos/${repoPath}/contents`, {
        headers: { 'Authorization': `token ${requiredEnvVars.GITHUB_API_TOKEN}` },
      });
      
      const files = await response.json();
      
      // Basic heuristics for code quality
      const hasTests = files.some((file: any) => 
        file.name.includes('test') || file.name.includes('spec')
      );
      const hasReadme = files.some((file: any) => 
        file.name.toLowerCase().includes('readme')
      );
      const hasDocumentation = files.some((file: any) => 
        file.name.includes('doc') || file.path?.includes('docs')
      );
      
      let score = 5; // Base score
      if (hasTests) score += 2;
      if (hasReadme) score += 1;
      if (hasDocumentation) score += 2;
      
      return Math.min(score, 10);
    } catch (error) {
      return 5; // Default score on error
    }
  }

  static async analyzeComplexity(repoPath: string): Promise<any> {
    // Simplified complexity analysis
    return {
      estimated_complexity: 'medium',
      architectural_patterns: [],
      best_practices_score: 7.5,
    };
  }
}

class AutomatedTestingService {
  static async generateTest(skillId: string, difficulty: string): Promise<any> {
    const { data: skill, error } = await supabase
      .from('skills')
      .select('name, category, test_templates')
      .eq('skill_id', skillId)
      .single();

    if (error) throw new Error(`Skill not found: ${error.message}`);

    // Generate test based on skill and difficulty
    const testConfig = {
      skill_name: skill.name,
      difficulty_level: difficulty,
      questions: await this.generateQuestions(skill, difficulty),
      time_limit_minutes: this.calculateTimeLimit(difficulty),
      passing_score: this.calculatePassingScore(difficulty),
    };

    return testConfig;
  }

  static async generateQuestions(skill: any, difficulty: string): Promise<any[]> {
    // Simplified question generation
    // In production, integrate with AI question generation service
    const questionCount = difficulty === 'beginner' ? 10 : difficulty === 'intermediate' ? 15 : 20;
    
    return Array.from({ length: questionCount }, (_, i) => ({
      question_id: crypto.randomUUID(),
      question_text: `${skill.name} question ${i + 1}`,
      question_type: 'multiple_choice',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 0,
      points: difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 2 : 3,
    }));
  }

  static calculateTimeLimit(difficulty: string): number {
    switch (difficulty) {
      case 'beginner': return 30;
      case 'intermediate': return 60;
      case 'advanced': return 90;
      default: return 45;
    }
  }

  static calculatePassingScore(difficulty: string): number {
    switch (difficulty) {
      case 'beginner': return 70;
      case 'intermediate': return 75;
      case 'advanced': return 80;
      default: return 75;
    }
  }

  static async evaluateTest(testResults: any, testConfig: any): Promise<any> {
    const correctAnswers = testResults.answers.filter(
      (answer: any, index: number) => 
        answer === testConfig.questions[index].correct_answer
    ).length;

    const totalQuestions = testConfig.questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = score >= testConfig.passing_score;

    return {
      score,
      passed,
      correct_answers: correctAnswers,
      total_questions: totalQuestions,
      time_taken: testResults.time_taken,
      detailed_results: testResults.answers.map((answer: any, index: number) => ({
        question_id: testConfig.questions[index].question_id,
        correct: answer === testConfig.questions[index].correct_answer,
        user_answer: answer,
        correct_answer: testConfig.questions[index].correct_answer,
      })),
    };
  }
}

class BlockchainCredentialManager {
  private static provider: ethers.JsonRpcProvider;
  private static wallet: ethers.Wallet;

  static async initialize(): Promise<void> {
    this.provider = new ethers.JsonRpcProvider(requiredEnvVars.WEB3_PROVIDER_URL);
    this.wallet = new ethers.Wallet(requiredEnvVars.BLOCKCHAIN_PRIVATE_KEY!, this.provider);
  }

  static async mintCredential(verificationData: any): Promise<string> {
    try {
      await this.initialize();
      
      // Create credential metadata
      const credentialMetadata = {
        member_id: verificationData.member_id,
        skill_id: verificationData.skill_id,
        verification_type: verificationData.verification_type,
        verification_date: new Date().toISOString(),
        endorsements_count: verificationData.endorsements?.length || 0,
        verification_score: verificationData.final_score,
      };

      // Hash the credential data
      const credentialHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(credentialMetadata))
      );

      // In production, interact with actual smart contract
      // For now, return the hash as a placeholder
      return credentialHash;
    } catch (error) {
      throw new Error(`Blockchain credential creation failed: ${error}`);
    }
  }

  static async verifyCredential(blockchainHash: string): Promise<boolean> {
    try {
      await this.initialize();
      
      // In production, verify against actual blockchain
      // For now, validate hash format
      return ethers.isHexString(blockchainHash, 32);
    } catch (error) {
      return false;
    }
  }
}

class CommunityReputationCalculator {
  static async calculateMemberReputation(memberId: string): Promise<number> {
    const { data: verifications } = await supabase
      .from('skills_verification')
      .select('status, verification_type')
      .eq('member_id', memberId)
      .eq('status', 'completed');

    const { data: endorsements } = await supabase
      .from('skill_endorsements')
      .select('confidence_score')
      .eq('endorser_id', memberId);

    const verificationScore = (verifications?.length || 0) * 2;
    const endorsementScore = endorsements?.reduce(
      (sum, e) => sum + e.confidence_score, 0
    ) || 0;

    return Math.min((verificationScore + endorsementScore) / 10, 10);
  }
}

class SkillBadgeGenerator {
  static async generateBadge(verification: SkillVerification): Promise<string> {
    // In production, generate actual badge image/SVG
    const badgeData = {
      skill_name: verification.skill_id,
      member_id: verification.member_id,
      verification_date: verification.created_at,
      verification_type: verification.verification_type,
      blockchain_hash: verification.blockchain_hash,
    };

    return Buffer.from(JSON.stringify(badgeData)).toString('base64');
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, skill_id, verification_type, ...otherData } = 
      initiateVerificationSchema.parse(body);

    // Check if member exists and is active
    const { data: member, error: memberError } = await supabase
      .from('community_members')
      .select('member_id, status')
      .eq('member_id', member_id)
      .eq('status', 'active')
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found or inactive' },
        { status: 404 }
      );
    }

    // Check if skill exists
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .select('skill_id, name, category')
      .eq('skill_id', skill_id)
      .single();

    if (skillError || !skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Check for existing active verification
    const { data: existingVerification } = await supabase
      .from('skills_verification')
      .select('verification_id')
      .eq('member_id', member_id)
      .eq('skill_id', skill_id)
      .in('status', ['pending', 'in_progress', 'peer_review'])
      .single();

    if (existingVerification) {
      return NextResponse.json(
        { error: 'Active verification already exists for this skill' },
        { status: 409 }
      );
    }

    const verificationId = crypto.randomUUID();
    let peerValidators: string[] = [];
    let testConfig: any = null;

    // Handle verification type specific setup
    switch (verification_type) {
      case 'peer_validation':
      case 'combined':
        if (otherData.peer_validator_requirements) {
          peerValidators = await PeerValidationService.findQualifiedValidators(
            skill_id,
            otherData.peer_validator_requirements,
            [member_id, ...(otherData.peer_validator_requirements.exclude_member_ids || [])]
          );

          if (peerValidators.length < otherData.peer_validator_requirements.min_validators) {
            return NextResponse.json(
              { error: 'Insufficient qualified validators available' },
              { status: 400 }
            );
          }
        }
        break;

      case 'automated_test':
        if (otherData.test_preferences) {
          testConfig = await AutomatedTestingService.generateTest(
            skill_id,
            otherData.test_preferences.difficulty_level
          );
        }
        break;
    }

    // Create verification record
    const { data: verification, error: verificationError } = await supabase
      .from('skills_verification')
      .insert({
        verification_id: verificationId,
        member_id,
        skill_id,
        verification_type,
        status: 'pending',
        peer_validators: peerValidators,
        portfolio_links: otherData.portfolio_links || [],
        test_config: testConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (verificationError) {
      return NextResponse.json(
        { error: `Failed to create verification: ${verificationError.message}` },
        { status: 500 }
      );
    }

    // Notify peer validators if applicable
    if (peerValidators.length > 0) {
      await PeerValidationService.notifyValidators(peerValidators, verificationId);
    }

    // Start portfolio assessment if applicable
    if (otherData.portfolio_links?.length) {
      // Trigger async portfolio analysis
      Promise.all(
        otherData.portfolio_links.map(async (link: string) => {
          try {
            if (link.includes('github.com')) {
              return await PortfolioAssessmentEngine.analyzeGitHubRepository(link);
            }
            return null;
          } catch (error) {
            console.error(`Portfolio analysis failed for ${link}:`, error);
            return null;
          }
        })
      ).then(async (analyses) => {
        const portfolioResults = analyses.filter(Boolean);
        
        await supabase
          .from('skills_verification')
          .update({
            portfolio_analysis: portfolioResults,
            status: peerValidators.length > 0 ? 'peer_review' : 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('verification_id', verificationId);
      });
    }

    return NextResponse.json({
      verification_id: verificationId,
      status: verification.status,
      verification_type,
      peer_validators: peerValidators,
      test_config: testConfig,
      created_at: verification.created_at,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Verification initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    const skillId = searchParams.get('skill_id');
    const status = searchParams.get('status');
    const verificationId = searchParams.get('verification_id');

    let query = supabase
      .from('skills_verification')
      .select(`
        *,
        skills(name, category),
        community_members(username, avatar_url),
        skill_endorsements(*)
      `);

    if (verificationId) {
      query = query.eq('verification_id', verificationId);
    } else {
      if (memberId) query = query.eq('member_id', memberId);
      if (skillId) query = query.eq('skill_id', skillId);
      if (status) query = query.eq('status', status);
    }

    const { data: verifications, error } = await query
      .order('created_at', { ascending: false })
      .limit(verificationId ? 1 : 50);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch verifications: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      verifications: verifications || [],
      total: verifications?.length || 0,
    });

  } catch (error) {
    console.error('Verification fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { verification_id, status, test_results, blockchain_hash } = 
      updateVerificationSchema.parse(body);

    // Get existing verification
    const { data: verification, error: fetchError } = await supabase
      .from('skills_verification')
      .select('*')
      .eq('verification_id', verification_id)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (test_results) {
      updateData.test_results = test_results;
      
      // Generate blockchain credential if test passed and verification is completed
      if (status === 'completed' && test_results.passed) {
        try {
          const credentialHash = await BlockchainCredentialManager.mintCredential({
            ...verification,
            final_score: test_results.score,
          });
          updateData.blockchain_hash = credentialHash;
        } catch (error) {
          console.error('Blockchain credential creation failed:', error);
        }
      }
    }