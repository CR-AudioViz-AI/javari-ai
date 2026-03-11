```python
"""
Agent Recommendation Engine Microservice

ML-powered microservice that provides personalized agent recommendations
using collaborative filtering, behavioral analysis, and project history matching.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import json
import hashlib

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis.asyncio as redis
from supabase import create_client, Client
import mlflow
import mlflow.sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import NMF
from sklearn.preprocessing import StandardScaler
import joblib
import uvicorn
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi.responses import Response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Metrics
REQUEST_COUNT = Counter('recommendation_requests_total', 'Total recommendation requests')
REQUEST_DURATION = Histogram('recommendation_duration_seconds', 'Request duration')
MODEL_ACCURACY = Gauge('model_accuracy_score', 'Current model accuracy')
CACHE_HIT_RATE = Gauge('cache_hit_rate', 'Cache hit rate percentage')

class UserContext(BaseModel):
    """User context for recommendations."""
    user_id: str
    current_project_type: Optional[str] = None
    skill_level: Optional[str] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    recent_agents: List[str] = Field(default_factory=list)

class RecommendationRequest(BaseModel):
    """Request model for agent recommendations."""
    user_context: UserContext
    limit: int = Field(default=10, ge=1, le=50)
    exclude_agents: List[str] = Field(default_factory=list)
    category_filter: Optional[str] = None

class AgentRecommendation(BaseModel):
    """Individual agent recommendation."""
    agent_id: str
    agent_name: str
    category: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    reasoning: List[str]
    usage_stats: Dict[str, Any]

class RecommendationResponse(BaseModel):
    """Response model for recommendations."""
    recommendations: List[AgentRecommendation]
    total_agents: int
    cache_hit: bool
    processing_time_ms: int
    model_version: str

class HealthCheck(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    models_loaded: bool
    redis_connected: bool
    supabase_connected: bool
    
class RecommendationEngine:
    """Core recommendation engine with multiple algorithms."""
    
    def __init__(self):
        self.collaborative_model = None
        self.content_vectorizer = None
        self.agent_features = None
        self.user_agent_matrix = None
        self.model_version = "1.0.0"
        self.last_training = None
        
    async def initialize(self):
        """Initialize the recommendation engine."""
        try:
            await self._load_models()
            await self._prepare_data()
            logger.info("Recommendation engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize recommendation engine: {e}")
            raise
    
    async def _load_models(self):
        """Load ML models from MLflow."""
        try:
            # Try to load the latest production model
            client = mlflow.tracking.MlflowTrackingClient()
            try:
                model_version = client.get_latest_versions(
                    "agent-recommendation-model", 
                    stages=["Production"]
                )[0]
                self.collaborative_model = mlflow.sklearn.load_model(
                    f"models:/agent-recommendation-model/Production"
                )
                self.model_version = model_version.version
                logger.info(f"Loaded production model version {self.model_version}")
            except Exception:
                # Fallback to staging if production not available
                model_version = client.get_latest_versions(
                    "agent-recommendation-model", 
                    stages=["Staging"]
                )[0]
                self.collaborative_model = mlflow.sklearn.load_model(
                    f"models:/agent-recommendation-model/Staging"
                )
                self.model_version = model_version.version
                logger.info(f"Loaded staging model version {self.model_version}")
                
        except Exception as e:
            logger.warning(f"Could not load MLflow model: {e}, using fallback")
            # Initialize a basic NMF model as fallback
            self.collaborative_model = NMF(n_components=50, random_state=42)
            self.model_version = "fallback-1.0.0"
    
    async def _prepare_data(self):
        """Prepare data for recommendations."""
        try:
            # Load agent metadata and user interaction data
            agents_df = await self._load_agent_data()
            interactions_df = await self._load_interaction_data()
            
            # Prepare content-based features
            if not agents_df.empty:
                agent_descriptions = agents_df['description'].fillna('')
                self.content_vectorizer = TfidfVectorizer(
                    max_features=1000,
                    stop_words='english',
                    ngram_range=(1, 2)
                )
                self.agent_features = self.content_vectorizer.fit_transform(agent_descriptions)
            
            # Prepare collaborative filtering matrix
            if not interactions_df.empty:
                self.user_agent_matrix = interactions_df.pivot_table(
                    index='user_id',
                    columns='agent_id',
                    values='rating',
                    fill_value=0
                )
                
                # Fit collaborative model if we have a fallback
                if hasattr(self.collaborative_model, 'fit'):
                    self.collaborative_model.fit(self.user_agent_matrix.values)
            
            logger.info("Data preparation completed")
            
        except Exception as e:
            logger.error(f"Failed to prepare data: {e}")
            # Initialize with empty data structures
            self.agent_features = None
            self.user_agent_matrix = pd.DataFrame()
    
    async def _load_agent_data(self) -> pd.DataFrame:
        """Load agent metadata from Supabase."""
        try:
            response = supabase.table('agents').select(
                'id, name, category, description, tags, usage_count, avg_rating'
            ).execute()
            
            if response.data:
                return pd.DataFrame(response.data)
            return pd.DataFrame()
            
        except Exception as e:
            logger.error(f"Failed to load agent data: {e}")
            return pd.DataFrame()
    
    async def _load_interaction_data(self) -> pd.DataFrame:
        """Load user-agent interaction data."""
        try:
            # Load recent interactions (last 30 days)
            cutoff_date = (datetime.now() - timedelta(days=30)).isoformat()
            
            response = supabase.table('agent_interactions').select(
                'user_id, agent_id, interaction_type, rating, created_at'
            ).gte('created_at', cutoff_date).execute()
            
            if response.data:
                df = pd.DataFrame(response.data)
                # Convert interaction types to numeric ratings
                rating_map = {
                    'used': 3.0,
                    'liked': 4.0,
                    'bookmarked': 3.5,
                    'shared': 4.5,
                    'rated': None  # Use actual rating
                }
                
                for idx, row in df.iterrows():
                    if row['rating'] is None:
                        df.at[idx, 'rating'] = rating_map.get(row['interaction_type'], 2.0)
                
                return df[['user_id', 'agent_id', 'rating']]
            
            return pd.DataFrame()
            
        except Exception as e:
            logger.error(f"Failed to load interaction data: {e}")
            return pd.DataFrame()
    
    async def get_recommendations(
        self, 
        user_context: UserContext, 
        limit: int = 10,
        exclude_agents: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate personalized recommendations."""
        exclude_agents = exclude_agents or []
        
        try:
            # Get hybrid recommendations
            collaborative_recs = await self._get_collaborative_recommendations(
                user_context, limit * 2
            )
            content_recs = await self._get_content_recommendations(
                user_context, limit * 2
            )
            behavioral_recs = await self._get_behavioral_recommendations(
                user_context, limit * 2
            )
            
            # Combine and rank recommendations
            combined_recs = self._combine_recommendations(
                collaborative_recs, content_recs, behavioral_recs
            )
            
            # Filter and limit results
            filtered_recs = [
                rec for rec in combined_recs 
                if rec['agent_id'] not in exclude_agents
            ]
            
            return filtered_recs[:limit]
            
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}")
            # Fallback to popular agents
            return await self._get_popular_agents(limit, exclude_agents)
    
    async def _get_collaborative_recommendations(
        self, 
        user_context: UserContext, 
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get collaborative filtering recommendations."""
        if self.user_agent_matrix.empty:
            return []
        
        try:
            user_id = user_context.user_id
            
            if user_id not in self.user_agent_matrix.index:
                # New user - use popular items
                return await self._get_popular_agents(limit)
            
            user_idx = self.user_agent_matrix.index.get_loc(user_id)
            user_vector = self.user_agent_matrix.iloc[user_idx].values.reshape(1, -1)
            
            # Get similar users
            user_similarities = cosine_similarity(
                user_vector, 
                self.user_agent_matrix.values
            )[0]
            
            # Get top similar users
            similar_users = np.argsort(user_similarities)[-10:][::-1]
            
            # Aggregate recommendations from similar users
            agent_scores = {}
            for similar_user_idx in similar_users:
                if similar_user_idx == user_idx:
                    continue
                
                similar_user_ratings = self.user_agent_matrix.iloc[similar_user_idx]
                for agent_id, rating in similar_user_ratings.items():
                    if rating > 0 and self.user_agent_matrix.iloc[user_idx][agent_id] == 0:
                        if agent_id not in agent_scores:
                            agent_scores[agent_id] = 0
                        agent_scores[agent_id] += rating * user_similarities[similar_user_idx]
            
            # Sort and format recommendations
            sorted_agents = sorted(
                agent_scores.items(), 
                key=lambda x: x[1], 
                reverse=True
            )
            
            recommendations = []
            for agent_id, score in sorted_agents[:limit]:
                recommendations.append({
                    'agent_id': agent_id,
                    'score': min(score, 1.0),
                    'algorithm': 'collaborative'
                })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Collaborative filtering error: {e}")
            return []
    
    async def _get_content_recommendations(
        self, 
        user_context: UserContext, 
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get content-based recommendations."""
        if self.agent_features is None:
            return []
        
        try:
            # Build user profile from preferences and project type
            user_query = []
            if user_context.current_project_type:
                user_query.append(user_context.current_project_type)
            
            user_query.extend(user_context.preferences.get('categories', []))
            user_query.extend(user_context.preferences.get('keywords', []))
            
            if not user_query:
                return []
            
            user_profile = ' '.join(user_query)
            user_vector = self.content_vectorizer.transform([user_profile])
            
            # Calculate similarities
            similarities = cosine_similarity(user_vector, self.agent_features)[0]
            
            # Get top recommendations
            top_indices = np.argsort(similarities)[-limit:][::-1]
            
            recommendations = []
            agents_df = await self._load_agent_data()
            
            for idx in top_indices:
                if similarities[idx] > 0.1:  # Minimum similarity threshold
                    agent_row = agents_df.iloc[idx]
                    recommendations.append({
                        'agent_id': agent_row['id'],
                        'score': float(similarities[idx]),
                        'algorithm': 'content'
                    })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Content-based filtering error: {e}")
            return []
    
    async def _get_behavioral_recommendations(
        self, 
        user_context: UserContext, 
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get behavioral pattern recommendations."""
        try:
            # Analyze recent agent usage patterns
            recent_agents = user_context.recent_agents
            if not recent_agents:
                return []
            
            # Find agents commonly used together
            response = supabase.table('agent_interactions').select(
                'agent_id, user_id'
            ).in_('user_id', 
                supabase.table('agent_interactions').select('user_id')
                .in_('agent_id', recent_agents)
                .execute().data
            ).execute()
            
            if not response.data:
                return []
            
            # Count co-occurrences
            interaction_df = pd.DataFrame(response.data)
            co_occurrence = {}
            
            for user_id in interaction_df['user_id'].unique():
                user_agents = interaction_df[
                    interaction_df['user_id'] == user_id
                ]['agent_id'].tolist()
                
                for agent in user_agents:
                    if agent not in recent_agents:
                        if agent not in co_occurrence:
                            co_occurrence[agent] = 0
                        co_occurrence[agent] += 1
            
            # Calculate scores
            total_users = len(interaction_df['user_id'].unique())
            recommendations = []
            
            for agent_id, count in sorted(
                co_occurrence.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:limit]:
                score = count / total_users
                recommendations.append({
                    'agent_id': agent_id,
                    'score': min(score, 1.0),
                    'algorithm': 'behavioral'
                })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Behavioral recommendations error: {e}")
            return []
    
    def _combine_recommendations(
        self, 
        collaborative: List[Dict], 
        content: List[Dict], 
        behavioral: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Combine recommendations from different algorithms."""
        combined = {}
        weights = {
            'collaborative': 0.5,
            'content': 0.3,
            'behavioral': 0.2
        }
        
        # Combine scores
        for recs, weight in [(collaborative, 'collaborative'), 
                           (content, 'content'), 
                           (behavioral, 'behavioral')]:
            for rec in recs:
                agent_id = rec['agent_id']
                if agent_id not in combined:
                    combined[agent_id] = {
                        'agent_id': agent_id,
                        'score': 0.0,
                        'algorithms': []
                    }
                
                combined[agent_id]['score'] += rec['score'] * weights[weight]
                combined[agent_id]['algorithms'].append(rec['algorithm'])
        
        # Sort by combined score
        return sorted(combined.values(), key=lambda x: x['score'], reverse=True)
    
    async def _get_popular_agents(
        self, 
        limit: int, 
        exclude_agents: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Fallback to popular agents."""
        exclude_agents = exclude_agents or []
        
        try:
            response = supabase.table('agents').select(
                'id, usage_count, avg_rating'
            ).not_.in_('id', exclude_agents).order(
                'usage_count', desc=True
            ).limit(limit).execute()
            
            recommendations = []
            for agent in response.data:
                score = min((agent['usage_count'] * agent['avg_rating']) / 1000, 1.0)
                recommendations.append({
                    'agent_id': agent['id'],
                    'score': score,
                    'algorithm': 'popular'
                })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Popular agents fallback error: {e}")
            return []

class RecommendationService:
    """Main service class managing the recommendation system."""
    
    def __init__(self):
        self.engine = RecommendationEngine()
        self.redis_client = None
        self.cache_ttl = 300  # 5 minutes
        
    async def initialize(self):
        """Initialize the recommendation service."""
        # Initialize Redis
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Initialize recommendation engine
        await self.engine.initialize()
        
        # Start background tasks
        asyncio.create_task(self._schedule_model_retraining())
        
        logger.info("Recommendation service initialized")
    
    async def get_recommendations(
        self, 
        request: RecommendationRequest
    ) -> RecommendationResponse:
        """Get personalized agent recommendations."""
        start_time = datetime.now()
        cache_hit = False
        
        try:
            # Check cache first
            cache_key = self._generate_cache_key(request)
            cached_result = await self._get_from_cache(cache_key)
            
            if cached_result:
                cache_hit = True
                recommendations_data = cached_result['recommendations']
            else:
                # Generate recommendations
                recommendations_data = await self.engine.get_recommendations(
                    request.user_context,
                    request.limit,
                    request.exclude_agents
                )
                
                # Cache the results
                await self._cache_recommendations(cache_key, recommendations_data)
            
            # Enrich with agent metadata
            enriched_recommendations = await self._enrich_recommendations(
                recommendations_data,
                request.category_filter
            )
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return RecommendationResponse(
                recommendations=enriched_recommendations,
                total_agents=len(enriched_recommendations),
                cache_hit=cache_hit,
                processing_time_ms=int(processing_time),
                model_version=self.engine.model_version
            )
            
        except Exception as e:
            logger.error(f"Recommendation error: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    def _generate_cache_key(self, request: RecommendationRequest) -> str:
        """Generate cache key for request."""
        key_data = {
            'user_id': request.user_context.user_id,
            'project_type': request.user_context.current_project_type,
            'limit': request.limit,
            'exclude': sorted(request.exclude_agents),
            'category': request.category_filter
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return f"rec:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    async def _get_from_cache(self, cache_key: str) -> Optional[Dict]:
        """Get recommendations from cache."""
        try:
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
        return None
    
    async def _cache_recommendations(
        self, 
        cache_key: str, 
        recommendations: List[Dict]
    ):
        """Cache recommendations."""
        try:
            cache_data = {
                'recommendations': recommendations,
                'timestamp': datetime.now().isoformat()
            }
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(cache_data)
            )
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    async def _enrich_recommendations(
        self, 
        recommendations: List[Dict],
        category_filter: Optional[str] = None
    ) -> List[AgentRecommendation]:
        """Enrich recommendations with agent metadata."""
        if not recommendations:
            return []
        
        try:
            agent_ids = [rec['agent_id'] for rec in recommendations]
            
            # Get agent metadata
            query = supabase.table('agents').select(
                'id, name, category, description, tags, usage_count, avg_rating'
            ).in_('id', agent_ids)
            
            if category_filter:
                query = query.eq('category', category_filter)
            
            response = query.execute()
            
            if not response.data:
                return []
            
            # Create agent lookup
            agents_lookup = {agent['id']: agent for agent in response.data}
            
            enriched = []
            for rec in recommendations:
                agent_id = rec['agent_id']
                if agent_id in agents_lookup:
                    agent_data = agents_lookup[agent_id]
                    
                    reasoning = []
                    if 'collaborative' in rec.get('algorithms', []):
                        reasoning.append("Similar users liked this agent")
                    if 'content' in rec.get('algorithms', []):
                        reasoning.append("Matches your project requirements")
                    if 'behavioral' in rec.get('algorithms', []):
                        reasoning.append("Often used with your recent agents")
                    if 'popular' in rec.get('algorithms', []):
                        reasoning.append("Popular among users")
                    
                    enriched.append(AgentRecommendation(
                        agent_id=agent_id,
                        agent_name=agent_data['name'],
                        category=agent_data['category'],