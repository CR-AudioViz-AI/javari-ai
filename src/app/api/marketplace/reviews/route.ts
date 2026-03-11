```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth, sanitizeInput, logSecurityEvent } from '@/lib/security';

// Environment variables validation
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Validation schemas
const createReviewSchema = z.object({
  vendorId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  ratings: z.object({
    overall: z.number().min(1).max(5),
    quality: z.number().min(1).max(5),
    communication: z.number().min(1).max(5),
    shipping: z.number().min(1).max(5),
    value: z.number().min(1).max(5),
  }),
  photos: z.array(z.string().url()).optional(),
  isVerifiedPurchase: z.boolean().default(false),
});

const reviewQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  verified: z.boolean().optional(),
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
  sortBy: z.enum(['date', 'rating', 'helpfulness', 'sentiment']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const vendorResponseSchema = z.object({
  reviewId: z.string().uuid(),
  vendorId: z.string().uuid(),
  response: z.string().min(1).max(2000),
});

// Types
interface Review {
  id: string;
  vendor_id: string;
  product_id?: string;
  user_id: string;
  title: string;
  content: string;
  ratings: {
    overall: number;
    quality: number;
    communication: number;
    shipping: number;
    value: number;
  };
  photos?: string[];
  is_verified_purchase: boolean;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderation_flags?: string[];
  helpfulness_score: number;
  vendor_response?: {
    response: string;
    response_date: string;
    vendor_id: string;
  };
  created_at: string;
  updated_at: string;
}

interface SentimentAnalysis {
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
  aspects: {
    quality: number;
    service: number;
    value: number;
  };
}

interface ModerationResult {
  status: 'approved' | 'rejected' | 'flagged';
  flags: string[];
  confidence: number;
  reason?: string;
}

// Services
class ReviewAggregationService {
  static async getAggregatedReviews(vendorId: string, filters: any) {
    const cacheKey = `reviews:${vendorId}:${JSON.stringify(filters)}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let query = supabase
      .from('reviews')
      .select(`
        *,
        users(id, name, avatar_url, verified),
        products(id, name, image_url),
        review_photos(url, alt_text),
        review_helpfulness(helpful_count, unhelpful_count)
      `)
      .eq('vendor_id', vendorId)
      .eq('moderation_status', 'approved');

    if (filters.productId) {
      query = query.eq('product_id', filters.productId);
    }

    if (filters.sentiment) {
      query = query.eq('sentiment_label', filters.sentiment);
    }

    if (filters.verified !== undefined) {
      query = query.eq('is_verified_purchase', filters.verified);
    }

    if (filters.minRating) {
      query = query.gte('ratings->overall', filters.minRating);
    }

    if (filters.maxRating) {
      query = query.lte('ratings->overall', filters.maxRating);
    }

    const orderColumn = filters.sortBy === 'date' ? 'created_at' : 
                       filters.sortBy === 'rating' ? 'ratings->overall' :
                       filters.sortBy === 'helpfulness' ? 'helpfulness_score' :
                       'sentiment_score';

    query = query.order(orderColumn, { ascending: filters.order === 'asc' });

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;
    query = query.range(from, to);

    const { data: reviews, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    const result = {
      reviews: reviews || [],
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit),
      },
    };

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  static async getReviewAnalytics(vendorId: string) {
    const cacheKey = `analytics:${vendorId}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('ratings, sentiment_label, is_verified_purchase, created_at')
      .eq('vendor_id', vendorId)
      .eq('moderation_status', 'approved');

    if (error) {
      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }

    const analytics = this.calculateAnalytics(reviews || []);

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(analytics));

    return analytics;
  }

  private static calculateAnalytics(reviews: any[]) {
    const totalReviews = reviews.length;
    
    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        verifiedPurchasePercentage: 0,
        categoryAverages: {
          quality: 0,
          communication: 0,
          shipping: 0,
          value: 0,
        },
        monthlyTrends: [],
      };
    }

    const ratings = reviews.map(r => r.ratings.overall);
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / totalReviews;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      ratingDistribution[rating as keyof typeof ratingDistribution]++;
    });

    const sentimentDistribution = {
      positive: reviews.filter(r => r.sentiment_label === 'positive').length,
      neutral: reviews.filter(r => r.sentiment_label === 'neutral').length,
      negative: reviews.filter(r => r.sentiment_label === 'negative').length,
    };

    const verifiedCount = reviews.filter(r => r.is_verified_purchase).length;
    const verifiedPurchasePercentage = (verifiedCount / totalReviews) * 100;

    const categoryAverages = {
      quality: reviews.reduce((sum, r) => sum + r.ratings.quality, 0) / totalReviews,
      communication: reviews.reduce((sum, r) => sum + r.ratings.communication, 0) / totalReviews,
      shipping: reviews.reduce((sum, r) => sum + r.ratings.shipping, 0) / totalReviews,
      value: reviews.reduce((sum, r) => sum + r.ratings.value, 0) / totalReviews,
    };

    // Calculate monthly trends
    const monthlyData = new Map();
    reviews.forEach(review => {
      const month = new Date(review.created_at).toISOString().slice(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { count: 0, ratingSum: 0 });
      }
      const data = monthlyData.get(month);
      data.count++;
      data.ratingSum += review.ratings.overall;
    });

    const monthlyTrends = Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      count: data.count,
      averageRating: data.ratingSum / data.count,
    })).sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalReviews,
      averageRating: Number(averageRating.toFixed(2)),
      ratingDistribution,
      sentimentDistribution,
      verifiedPurchasePercentage: Number(verifiedPurchasePercentage.toFixed(1)),
      categoryAverages: Object.fromEntries(
        Object.entries(categoryAverages).map(([key, value]) => [key, Number(value.toFixed(2))])
      ),
      monthlyTrends,
    };
  }
}

class SentimentAnalysisEngine {
  static async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const prompt = `
        Analyze the sentiment of this review text and provide a detailed analysis.
        Text: "${text}"
        
        Return a JSON object with:
        - score: number between -1 (very negative) and 1 (very positive)
        - label: 'positive', 'neutral', or 'negative'
        - confidence: confidence level (0-1)
        - aspects: object with quality, service, and value scores (-1 to 1)
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Validate and normalize the response
      return {
        score: Math.max(-1, Math.min(1, analysis.score || 0)),
        label: analysis.label || 'neutral',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        aspects: {
          quality: Math.max(-1, Math.min(1, analysis.aspects?.quality || 0)),
          service: Math.max(-1, Math.min(1, analysis.aspects?.service || 0)),
          value: Math.max(-1, Math.min(1, analysis.aspects?.value || 0)),
        },
      };
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      // Fallback to simple sentiment
      return this.fallbackSentimentAnalysis(text);
    }
  }

  private static fallbackSentimentAnalysis(text: string): SentimentAnalysis {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'perfect', 'love', 'recommend'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointing', 'poor'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    let score = 0;
    let label: 'positive' | 'neutral' | 'negative' = 'neutral';
    
    if (totalSentimentWords > 0) {
      score = (positiveCount - negativeCount) / totalSentimentWords;
      if (score > 0.2) label = 'positive';
      else if (score < -0.2) label = 'negative';
    }
    
    return {
      score,
      label,
      confidence: Math.min(0.8, totalSentimentWords / 10),
      aspects: {
        quality: score,
        service: score,
        value: score,
      },
    };
  }
}

class AutomatedModerationPipeline {
  static async moderateReview(reviewData: any): Promise<ModerationResult> {
    const flags: string[] = [];
    let confidence = 0;

    // Content moderation checks
    if (await this.containsProfanity(reviewData.content)) {
      flags.push('profanity');
    }

    if (await this.containsPersonalInfo(reviewData.content)) {
      flags.push('personal_info');
    }

    if (await this.isSpam(reviewData.content)) {
      flags.push('spam');
    }

    if (await this.containsOffensiveContent(reviewData.content)) {
      flags.push('offensive_content');
    }

    // Rating consistency check
    if (this.hasInconsistentRatings(reviewData.ratings, reviewData.content)) {
      flags.push('inconsistent_ratings');
    }

    // Determine final status
    const criticalFlags = ['offensive_content', 'personal_info'];
    const hasCriticalFlags = flags.some(flag => criticalFlags.includes(flag));
    
    confidence = Math.min(0.95, flags.length * 0.2 + 0.5);

    let status: 'approved' | 'rejected' | 'flagged' = 'approved';
    if (hasCriticalFlags) {
      status = 'rejected';
    } else if (flags.length > 0) {
      status = 'flagged';
    }

    return {
      status,
      flags,
      confidence,
      reason: flags.length > 0 ? `Review flagged for: ${flags.join(', ')}` : undefined,
    };
  }

  private static async containsProfanity(text: string): Promise<boolean> {
    const profanityList = ['fuck', 'shit', 'damn', 'bitch']; // Add more as needed
    const lowercaseText = text.toLowerCase();
    return profanityList.some(word => lowercaseText.includes(word));
  }

  private static async containsPersonalInfo(text: string): Promise<boolean> {
    const patterns = [
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone number
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, // Credit card
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  private static async isSpam(text: string): Promise<boolean> {
    const spamIndicators = [
      'buy now',
      'click here',
      'free money',
      'guaranteed',
      'no risk',
      'special offer',
    ];
    
    const lowercaseText = text.toLowerCase();
    const indicatorCount = spamIndicators.filter(indicator => 
      lowercaseText.includes(indicator)
    ).length;
    
    return indicatorCount >= 2 || text.length < 20;
  }

  private static async containsOffensiveContent(text: string): Promise<boolean> {
    try {
      const response = await openai.moderations.create({
        input: text,
      });
      
      return response.results[0]?.flagged || false;
    } catch (error) {
      console.error('Moderation API failed:', error);
      return false;
    }
  }

  private static hasInconsistentRatings(ratings: any, content: string): boolean {
    const averageRating = Object.values(ratings).reduce((sum: number, rating: any) => sum + rating, 0) / Object.keys(ratings).length;
    const contentSentiment = content.toLowerCase();
    
    const positiveWords = ['excellent', 'great', 'amazing', 'perfect', 'love'];
    const negativeWords = ['terrible', 'awful', 'hate', 'worst', 'horrible'];
    
    const hasPositiveWords = positiveWords.some(word => contentSentiment.includes(word));
    const hasNegativeWords = negativeWords.some(word => contentSentiment.includes(word));
    
    // High rating with negative words or low rating with positive words
    if ((averageRating >= 4 && hasNegativeWords) || (averageRating <= 2 && hasPositiveWords)) {
      return true;
    }
    
    return false;
  }
}

class PhotoUploadManager {
  static async generateUploadUrl(reviewId: string, fileName: string, fileType: string) {
    const key = `review-photos/${reviewId}/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: fileType,
      Metadata: {
        reviewId,
        uploadDate: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    return {
      uploadUrl,
      key,
      publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  static async deletePhoto(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    });

    await s3Client.send(command);
  }

  static async validatePhotoUpload(file: File): Promise<boolean> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    return true;
  }
}

// Request handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    
    const rateLimitResult = await rateLimit.check({
      key: `review-create:${ip}`,
      limit: 5,
      window: 900000, // 15 minutes
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      await logSecurityEvent('unauthorized_review_creation', { ip });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createReviewSchema.parse(body);

    // Sanitize inputs
    validatedData.title = sanitizeInput(validatedData.title);
    validatedData.content = sanitizeInput(validatedData.content);

    // Verify user can review this vendor (hasn't reviewed recently, has purchased, etc.)
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', validatedData.userId)
      .eq('vendor_id', validatedData.vendorId)
      .eq('