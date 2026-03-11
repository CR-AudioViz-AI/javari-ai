'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Star, ThumbsUp, ThumbsDown, Flag, Shield, TrendingUp, Filter, Search, MessageSquare, Award, AlertTriangle, CheckCircle, Clock, Eye, MoreHorizontal } from 'lucide-react';

/**
 * Review data interface
 */
interface Review {
  id: string;
  agent_id: string;
  user_id: string;
  rating: number;
  content: string;
  sentiment_score: number;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  verified: boolean;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  agent: {
    id: string;
    name: string;
    category: string;
  };
}

/**
 * Agent rating statistics interface
 */
interface AgentStats {
  agent_id: string;
  total_reviews: number;
  average_rating: number;
  rating_distribution: { [key: number]: number };
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  verified_percentage: number;
}

/**
 * Review filter options interface
 */
interface ReviewFilters {
  rating?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  verified?: boolean;
  dateRange?: 'week' | 'month' | 'year' | 'all';
  sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful';
}

/**
 * Moderation action interface
 */
interface ModerationAction {
  id: string;
  review_id: string;
  moderator_id: string;
  action: 'approve' | 'reject' | 'flag' | 'verify';
  reason?: string;
  created_at: string;
}

/**
 * Rating display component with visual indicators
 */
const RatingDisplay: React.FC<{ 
  rating: number; 
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}> = ({ rating, size = 'md', showValue = true, interactive = false, onChange }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleStarClick = (starRating: number) => {
    if (interactive && onChange) {
      onChange(starRating);
    }
  };

  const handleStarHover = (starRating: number) => {
    if (interactive) {
      setHoverRating(starRating);
    }
  };

  const handleStarLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = (hoverRating || rating) >= star;
          return (
            <Star
              key={star}
              className={`${sizeClasses[size]} ${
                filled ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleStarHover(star)}
              onMouseLeave={handleStarLeave}
            />
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-gray-700 ml-1">
          {(hoverRating || rating).toFixed(1)}
        </span>
      )}
    </div>
  );
};

/**
 * Sentiment analysis indicator component
 */
const SentimentIndicator: React.FC<{ score: number; size?: 'sm' | 'md' }> = ({ score, size = 'md' }) => {
  const getSentimentData = (score: number) => {
    if (score >= 0.1) return { label: 'Positive', color: 'text-green-600 bg-green-100', icon: ThumbsUp };
    if (score <= -0.1) return { label: 'Negative', color: 'text-red-600 bg-red-100', icon: ThumbsDown };
    return { label: 'Neutral', color: 'text-gray-600 bg-gray-100', icon: MessageSquare };
  };

  const sentiment = getSentimentData(score);
  const Icon = sentiment.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1';

  return (
    <div className={`inline-flex items-center gap-1 rounded-full ${sentiment.color} ${sizeClasses}`}>
      <Icon className="w-3 h-3" />
      <span className="font-medium">{sentiment.label}</span>
    </div>
  );
};

/**
 * Authenticity badge component
 */
const AuthenticityBadge: React.FC<{ verified: boolean; size?: 'sm' | 'md' }> = ({ verified, size = 'md' }) => {
  if (!verified) return null;

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1';

  return (
    <div className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-600 ${sizeClasses}`}>
      <Shield className="w-3 h-3" />
      <span className="font-medium">Verified</span>
    </div>
  );
};

/**
 * Review card component
 */
const ReviewCard: React.FC<{ 
  review: Review; 
  onHelpful?: (reviewId: string, helpful: boolean) => void;
  onFlag?: (reviewId: string) => void;
  showModerationActions?: boolean;
  onModerate?: (reviewId: string, action: string, reason?: string) => void;
}> = ({ review, onHelpful, onFlag, showModerationActions, onModerate }) => {
  const [showModerationMenu, setShowModerationMenu] = useState(false);
  const [moderationReason, setModerationReason] = useState('');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rejected': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'flagged': return <Flag className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {review.user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">{review.user.username}</h4>
              <AuthenticityBadge verified={review.verified} size="sm" />
            </div>
            <p className="text-sm text-gray-500">{formatDate(review.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showModerationActions && (
            <div className="relative">
              <button
                onClick={() => setShowModerationMenu(!showModerationMenu)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showModerationMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 min-w-48">
                  <button
                    onClick={() => onModerate?.(review.id, 'approve')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Approve
                  </button>
                  <button
                    onClick={() => onModerate?.(review.id, 'reject', moderationReason)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Reject
                  </button>
                  <button
                    onClick={() => onModerate?.(review.id, 'verify')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4 text-blue-500" />
                    Verify
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            {getStatusIcon(review.status)}
            <span className="text-sm text-gray-500 capitalize">{review.status}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <RatingDisplay rating={review.rating} size="sm" />
        <SentimentIndicator score={review.sentiment_score} size="sm" />
      </div>

      <p className="text-gray-700 mb-4 leading-relaxed">{review.content}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onHelpful?.(review.id, true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
          >
            <ThumbsUp className="w-4 h-4" />
            Helpful ({review.helpful_count})
          </button>
          <button
            onClick={() => onHelpful?.(review.id, false)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <ThumbsDown className="w-4 h-4" />
            Not helpful ({review.not_helpful_count})
          </button>
        </div>
        <button
          onClick={() => onFlag?.(review.id)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 transition-colors"
        >
          <Flag className="w-4 h-4" />
          Flag
        </button>
      </div>
    </div>
  );
};

/**
 * Review submission form component
 */
const ReviewSubmissionForm: React.FC<{ 
  agentId: string;
  onSubmit: (review: { rating: number; content: string }) => Promise<void>;
  onCancel: () => void;
}> = ({ agentId, onSubmit, onCancel }) => {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    if (content.trim().length < 10) {
      setError('Please provide at least 10 characters in your review');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({ rating, content: content.trim() });
      setRating(0);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Write a Review</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Rating
        </label>
        <RatingDisplay 
          rating={rating} 
          interactive 
          onChange={setRating}
          size="lg"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Review
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience with this agent..."
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          maxLength={1000}
        />
        <div className="flex justify-between mt-1">
          <span className="text-sm text-gray-500">
            {content.length}/1000 characters
          </span>
          {content.length >= 10 && (
            <span className="text-sm text-green-600">✓ Minimum length reached</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || rating === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
};

/**
 * Review filters component
 */
const ReviewFilters: React.FC<{
  filters: ReviewFilters;
  onFiltersChange: (filters: ReviewFilters) => void;
  totalReviews: number;
}> = ({ filters, onFiltersChange, totalReviews }) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <span className="text-sm text-gray-500">
            {totalReviews} reviews
          </span>
        </div>
        
        <select
          value={filters.sortBy || 'newest'}
          onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as any })}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="rating_high">Highest rated</option>
          <option value="rating_low">Lowest rated</option>
          <option value="helpful">Most helpful</option>
        </select>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select
              value={filters.rating || ''}
              onChange={(e) => onFiltersChange({ ...filters, rating: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4+ stars</option>
              <option value="3">3+ stars</option>
              <option value="2">2+ stars</option>
              <option value="1">1+ stars</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sentiment</label>
            <select
              value={filters.sentiment || ''}
              onChange={(e) => onFiltersChange({ ...filters, sentiment: e.target.value as any || undefined })}
              className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verification</label>
            <select
              value={filters.verified === undefined ? '' : filters.verified.toString()}
              onChange={(e) => onFiltersChange({ ...filters, verified: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All reviews</option>
              <option value="true">Verified only</option>
              <option value="false">Unverified only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={filters.dateRange || 'all'}
              onChange={(e) => onFiltersChange({ ...filters, dateRange: e.target.value as any })}
              className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All time</option>
              <option value="week">Past week</option>
              <option value="month">Past month</option>
              <option value="year">Past year</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Aggregate score card component
 */
const AggregateScoreCard: React.FC<{ stats: AgentStats }> = ({ stats }) => {
  const getRatingBarWidth = (count: number) => {
    const maxCount = Math.max(...Object.values(stats.rating_distribution));
    return maxCount > 0 ? (count / maxCount) * 100 : 0;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Rating */}
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {stats.average_rating.toFixed(1)}
          </div>
          <RatingDisplay rating={stats.average_rating} size="lg" showValue={false} />
          <p className="text-sm text-gray-600 mt-2">
            Based on {stats.total_reviews} reviews
          </p>
        </div>

        {/* Rating Distribution */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Rating Distribution</h4>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.rating_distribution[rating] || 0;
              const percentage = stats.total_reviews > 0 ? (count / stats.total_reviews) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-2 text-gray-600">{rating}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-