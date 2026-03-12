```tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Flag, 
  Filter, 
  Search,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Calendar,
  User,
  Shield
} from 'lucide-react';

/**
 * Review data structure
 */
interface Review {
  id: string;
  agent_id: string;
  user_id: string;
  rating: number;
  title: string;
  content: string;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  usage_verified: boolean;
  usage_hours: number;
  helpful_count: number;
  flagged_count: number;
  status: 'published' | 'pending' | 'hidden' | 'removed';
  created_at: string;
  updated_at: string;
  user_profile?: {
    username: string;
    avatar_url?: string;
    is_verified: boolean;
  };
}

/**
 * Agent rating statistics
 */
interface AgentRating {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

/**
 * Review form data
 */
interface ReviewFormData {
  rating: number;
  title: string;
  content: string;
  usage_hours: number;
}

/**
 * Review filters
 */
interface ReviewFilters {
  rating?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  verified_only: boolean;
  sort_by: 'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful';
  search?: string;
}

/**
 * Component props
 */
interface AgentReviewSystemProps {
  agentId: string;
  className?: string;
}

/**
 * AgentReviewSystem Component
 * 
 * Comprehensive review and rating system for marketplace agents with sentiment analysis,
 * usage verification, and authenticated review collection.
 */
export const AgentReviewSystem: React.FC<AgentReviewSystemProps> = ({
  agentId,
  className = ''
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { trackEvent } = useAnalytics();

  // State management
  const [reviews, setReviews] = useState<Review[]>([]);
  const [agentRating, setAgentRating] = useState<AgentRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [filters, setFilters] = useState<ReviewFilters>({
    verified_only: false,
    sort_by: 'newest'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const REVIEWS_PER_PAGE = 10;

  /**
   * Load agent reviews and rating statistics
   */
  const loadAgentData = useCallback(async (page: number = 1, reset: boolean = true) => {
    try {
      const offset = (page - 1) * REVIEWS_PER_PAGE;
      
      // Build query with filters
      let query = supabase
        .from('agent_reviews')
        .select(`
          *,
          user_profile:user_profiles(username, avatar_url, is_verified)
        `)
        .eq('agent_id', agentId)
        .eq('status', 'published');

      // Apply filters
      if (filters.rating) {
        query = query.eq('rating', filters.rating);
      }
      if (filters.sentiment) {
        query = query.eq('sentiment_label', filters.sentiment);
      }
      if (filters.verified_only) {
        query = query.eq('usage_verified', true);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      // Apply sorting
      switch (filters.sort_by) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'rating_high':
          query = query.order('rating', { ascending: false });
          break;
        case 'rating_low':
          query = query.order('rating', { ascending: true });
          break;
        case 'helpful':
          query = query.order('helpful_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data: reviewsData, error: reviewsError } = await query
        .range(offset, offset + REVIEWS_PER_PAGE - 1);

      if (reviewsError) throw reviewsError;

      // Load rating statistics
      const { data: ratingData, error: ratingError } = await supabase
        .rpc('get_agent_rating_stats', { agent_id: agentId });

      if (ratingError) throw ratingError;

      // Check if user has existing review
      if (user) {
        const { data: userReviewData } = await supabase
          .from('agent_reviews')
          .select('*')
          .eq('agent_id', agentId)
          .eq('user_id', user.id)
          .single();
        
        setUserReview(userReviewData);
      }

      if (reset) {
        setReviews(reviewsData || []);
      } else {
        setReviews(prev => [...prev, ...(reviewsData || [])]);
      }
      
      setAgentRating(ratingData);
      setHasMore((reviewsData?.length || 0) === REVIEWS_PER_PAGE);
      
    } catch (error) {
      console.error('Error loading agent data:', error);
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [agentId, filters, user, showToast]);

  /**
   * Verify user has used the agent
   */
  const verifyAgentUsage = useCallback(async (): Promise<{ verified: boolean; hours: number }> => {
    if (!user) return { verified: false, hours: 0 };

    try {
      const { data, error } = await supabase
        .rpc('verify_agent_usage', {
          user_id: user.id,
          agent_id: agentId
        });

      if (error) throw error;
      return data || { verified: false, hours: 0 };
    } catch (error) {
      console.error('Error verifying usage:', error);
      return { verified: false, hours: 0 };
    }
  }, [user, agentId]);

  /**
   * Perform sentiment analysis on review content
   */
  const analyzeSentiment = async (content: string): Promise<{
    score: number;
    label: 'positive' | 'neutral' | 'negative';
  }> => {
    try {
      const response = await fetch('/api/analyze-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content })
      });

      if (!response.ok) throw new Error('Sentiment analysis failed');
      return await response.json();
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      // Fallback: simple keyword-based sentiment
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'helpful', 'useful'];
      const negativeWords = ['bad', 'terrible', 'awful', 'useless', 'horrible', 'disappointing'];
      
      const words = content.toLowerCase().split(/\s+/);
      const positiveCount = words.filter(word => positiveWords.includes(word)).length;
      const negativeCount = words.filter(word => negativeWords.includes(word)).length;
      
      const score = (positiveCount - negativeCount) / words.length;
      let label: 'positive' | 'neutral' | 'negative' = 'neutral';
      
      if (score > 0.1) label = 'positive';
      else if (score < -0.1) label = 'negative';
      
      return { score, label };
    }
  };

  /**
   * Submit a new review
   */
  const submitReview = async (formData: ReviewFormData) => {
    if (!user) {
      showToast('Please sign in to submit a review', 'error');
      return;
    }

    setSubmitting(true);
    
    try {
      // Verify usage
      const usageData = await verifyAgentUsage();
      
      // Analyze sentiment
      const sentiment = await analyzeSentiment(formData.content);
      
      // Submit review
      const { error } = await supabase
        .from('agent_reviews')
        .insert({
          agent_id: agentId,
          user_id: user.id,
          rating: formData.rating,
          title: formData.title,
          content: formData.content,
          sentiment_score: sentiment.score,
          sentiment_label: sentiment.label,
          usage_verified: usageData.verified,
          usage_hours: formData.usage_hours,
          status: 'published'
        });

      if (error) throw error;

      showToast('Review submitted successfully!', 'success');
      setShowReviewForm(false);
      trackEvent('review_submitted', {
        agent_id: agentId,
        rating: formData.rating,
        verified: usageData.verified
      });
      
      // Reload data
      await loadAgentData();
      
    } catch (error: any) {
      console.error('Error submitting review:', error);
      showToast(error.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Mark review as helpful
   */
  const markHelpful = async (reviewId: string) => {
    if (!user) {
      showToast('Please sign in to rate reviews', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .rpc('mark_review_helpful', {
          review_id: reviewId,
          user_id: user.id
        });

      if (error) throw error;

      // Update local state
      setReviews(prev => prev.map(review => 
        review.id === reviewId 
          ? { ...review, helpful_count: review.helpful_count + 1 }
          : review
      ));

      trackEvent('review_marked_helpful', { review_id: reviewId });
      
    } catch (error: any) {
      console.error('Error marking helpful:', error);
      showToast(error.message || 'Failed to mark as helpful', 'error');
    }
  };

  /**
   * Flag review for moderation
   */
  const flagReview = async (reviewId: string, reason: string) => {
    if (!user) {
      showToast('Please sign in to flag reviews', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('review_flags')
        .insert({
          review_id: reviewId,
          user_id: user.id,
          reason,
          status: 'pending'
        });

      if (error) throw error;

      showToast('Review flagged for moderation', 'success');
      trackEvent('review_flagged', { review_id: reviewId, reason });
      
    } catch (error: any) {
      console.error('Error flagging review:', error);
      showToast(error.message || 'Failed to flag review', 'error');
    }
  };

  // Load data on mount and filter changes
  useEffect(() => {
    setLoading(true);
    setCurrentPage(1);
    loadAgentData(1, true);
  }, [loadAgentData]);

  // Memoized components
  const ReviewForm = useMemo(() => {
    if (!showReviewForm || userReview) return null;

    return (
      <ReviewFormComponent
        onSubmit={submitReview}
        onCancel={() => setShowReviewForm(false)}
        isSubmitting={submitting}
      />
    );
  }, [showReviewForm, userReview, submitting]);

  const RatingDistribution = useMemo(() => {
    if (!agentRating) return null;

    return (
      <RatingDistributionComponent
        distribution={agentRating.rating_distribution}
        totalReviews={agentRating.total_reviews}
      />
    );
  }, [agentRating]);

  const SentimentAnalysis = useMemo(() => {
    if (!agentRating) return null;

    return (
      <SentimentAnalysisComponent
        distribution={agentRating.sentiment_distribution}
        totalReviews={agentRating.total_reviews}
      />
    );
  }, [agentRating]);

  return (
    <div className={`agent-review-system ${className}`}>
      {/* Header with rating overview */}
      <div className="review-header mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Reviews & Ratings</h2>
          {user && !userReview && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="btn btn-primary"
              disabled={submitting}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Write Review
            </button>
          )}
        </div>

        {agentRating && (
          <div className="rating-overview bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Average Rating */}
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  {agentRating.average_rating.toFixed(1)}
                </div>
                <div className="flex justify-center mb-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(agentRating.average_rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-gray-600">
                  {agentRating.total_reviews} reviews
                </div>
              </div>

              {/* Rating Distribution */}
              <div>
                <h3 className="font-semibold mb-3">Rating Distribution</h3>
                {RatingDistribution}
              </div>

              {/* Sentiment Analysis */}
              <div>
                <h3 className="font-semibold mb-3">Sentiment Analysis</h3>
                {SentimentAnalysis}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Form */}
      {ReviewForm}

      {/* Filters */}
      <ReviewFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Reviews List */}
      <div className="reviews-list">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reviews found</p>
            {user && !userReview && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="btn btn-primary mt-4"
              >
                Be the first to review
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={user?.id}
                  onMarkHelpful={markHelpful}
                  onFlag={flagReview}
                />
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => {
                    const nextPage = currentPage + 1;
                    setCurrentPage(nextPage);
                    loadAgentData(nextPage, false);
                  }}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Load More Reviews
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Review Form Component
 */
const ReviewFormComponent: React.FC<{
  onSubmit: (data: ReviewFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [formData, setFormData] = useState<ReviewFormData>({
    rating: 5,
    title: '',
    content: '',
    usage_hours: 0
  });
  const [errors, setErrors] = useState<Partial<ReviewFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ReviewFormData> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.content.trim() || formData.content.length < 10) {
      newErrors.content = 'Review must be at least 10 characters';
    }
    if (formData.rating < 1 || formData.rating > 5) {
      newErrors.rating = 'Rating must be between 1 and 5';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="review-form bg-white border rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">Rating</label>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                className={`text-2xl ${
                  star <= formData.rating
                    ? 'text-yellow-400'
                    : 'text-gray-300 hover:text-yellow-400'
                }`}
              >
                <Star className={`w-8 h-8 ${star <= formData.rating ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Summarize your experience"
            maxLength={100}
          />
          {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium mb-2">Review</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md h-32 ${
              errors.content ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Share your detailed experience with this agent..."
            maxLength={1000}
          />
          {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
          <div className="text-sm text-gray-500 mt-1">
            {formData.content.length}/1000 characters
          </div>
        </div>

        {/* Usage Hours */}
        <div>
          <label className="block text-sm font-medium mb-2">Hours of Usage</label>
          <input
            type="number"
            value={formData.usage_hours}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              usage_hours: Math.max(0, parseInt(e.target.value) || 0)
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="0"
            max="10000"
            placeholder="Approximate hours you've used this agent"
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
          <button
            type="button"
            onClick={onCan