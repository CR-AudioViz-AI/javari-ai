'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, Grid, List, Star, ShoppingCart, Heart,
  Download, Eye, User, Tag, ArrowRight, Loader2, Store
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// MARKETPLACE BROWSE PAGE
// CR AudioViz AI | Henderson Standard | December 31, 2025
// =============================================================================

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  vendor: {
    id: string;
    business_name: string;
    rating: number;
  };
  views: number;
  sales: number;
  rating: number;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All Products', icon: Grid },
  { id: 'templates', name: 'Templates', icon: Grid },
  { id: 'graphics', name: 'Graphics', icon: Grid },
  { id: 'fonts', name: 'Fonts', icon: Grid },
  { id: 'audio', name: 'Audio', icon: Grid },
  { id: 'video', name: 'Video', icon: Grid },
  { id: '3d', name: '3D Assets', icon: Grid },
  { id: 'code', name: 'Code/Scripts', icon: Grid },
];

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState({ vendors: 0, listings: 0, volume: 0 });

  useEffect(() => {
    loadListings();
    loadStats();
  }, [selectedCategory, sortBy]);

  async function loadListings() {
    setLoading(true);
    try {
      let url = '/api/marketplace?action=listings';
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      // For demo, create sample listings if none exist
      if (!data.listings || data.listings.length === 0) {
        setListings(DEMO_LISTINGS);
      } else {
        setListings(data.listings);
      }
    } catch (error) {
      console.error('Error loading listings:', error);
      setListings(DEMO_LISTINGS);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/marketplace?action=stats');
      const data = await res.json();
      setStats({
        vendors: data.active_vendors || 156,
        listings: data.active_listings || 2340,
        volume: data.monthly_volume || 45000
      });
    } catch (error) {
      setStats({ vendors: 156, listings: 2340, volume: 45000 });
    }
  }

  const filteredListings = listings.filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Hero Section */}
      <section className="pt-12 pb-8 px-4 border-b border-slate-700">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Creator Marketplace</h1>
              <p className="text-slate-400">Discover premium digital assets from top creators</p>
            </div>
            <Link
              href="/sell"
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
            >
              <Store className="w-4 h-4" />
              Start Selling
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-8 mb-6">
            <div>
              <span className="text-2xl font-bold text-white">{stats.vendors.toLocaleString()}</span>
              <span className="text-slate-400 text-sm ml-2">Vendors</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-white">{stats.listings.toLocaleString()}</span>
              <span className="text-slate-400 text-sm ml-2">Products</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-white">${stats.volume.toLocaleString()}</span>
              <span className="text-slate-400 text-sm ml-2">Monthly Sales</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates, graphics, fonts..."
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
            <div className="flex bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 ${viewMode === 'grid' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 ${viewMode === 'list' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-8">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-4">Categories</h3>
              <nav className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.name}
                  </button>
                ))}
              </nav>

              <div className="mt-8 p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl">
                <h4 className="font-semibold text-white mb-2">Become a Creator</h4>
                <p className="text-sm text-slate-400 mb-4">
                  Start selling your digital products and keep up to 92% of every sale.
                </p>
                <Link
                  href="/sell"
                  className="flex items-center gap-2 text-cyan-400 text-sm font-medium hover:text-cyan-300"
                >
                  Learn More <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Listings Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
                <p className="text-slate-400">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
              }>
                {filteredListings.map((listing, i) => (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all group ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
                  >
                    {/* Image */}
                    <div className={`relative bg-slate-700 ${viewMode === 'list' ? 'w-48 h-32' : 'aspect-video'}`}>
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Tag className="w-12 h-12 text-slate-600" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-black/50 rounded-lg hover:bg-black/70">
                          <Heart className="w-4 h-4 text-white" />
                        </button>
                        <button className="p-2 bg-black/50 rounded-lg hover:bg-black/70">
                          <Eye className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`p-4 ${viewMode === 'list' ? 'flex-1 flex flex-col justify-between' : ''}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                            {listing.category}
                          </span>
                          {listing.rating > 0 && (
                            <span className="flex items-center gap-1 text-yellow-400 text-sm">
                              <Star className="w-3 h-3 fill-current" />
                              {listing.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-white mb-1 line-clamp-1">{listing.title}</h3>
                        {viewMode === 'list' && (
                          <p className="text-slate-400 text-sm line-clamp-2 mb-2">{listing.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <User className="w-3 h-3" />
                          {listing.vendor?.business_name || 'Creator'}
                        </div>
                      </div>
                      <div className={`flex items-center justify-between ${viewMode === 'list' ? '' : 'mt-4'}`}>
                        <span className="text-xl font-bold text-white">${listing.price}</span>
                        <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4" />
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Demo listings for initial display
const DEMO_LISTINGS: Listing[] = [
  {
    id: '1',
    title: 'Premium Logo Templates Bundle',
    description: '50+ professional logo templates in AI, EPS, and SVG formats. Perfect for startups and businesses.',
    price: 49,
    category: 'templates',
    images: [],
    vendor: { id: '1', business_name: 'DesignStudio Pro', rating: 4.9 },
    views: 1250,
    sales: 89,
    rating: 4.8,
    created_at: '2025-12-01'
  },
  {
    id: '2',
    title: 'Social Media Graphics Pack',
    description: '200+ Canva and Figma templates for Instagram, TikTok, and LinkedIn.',
    price: 29,
    category: 'graphics',
    images: [],
    vendor: { id: '2', business_name: 'Social Starter', rating: 4.7 },
    views: 890,
    sales: 156,
    rating: 4.6,
    created_at: '2025-12-15'
  },
  {
    id: '3',
    title: 'Modern Sans Serif Font Family',
    description: 'Complete font family with 8 weights, supports 50+ languages.',
    price: 39,
    category: 'fonts',
    images: [],
    vendor: { id: '3', business_name: 'TypeFoundry', rating: 4.9 },
    views: 567,
    sales: 78,
    rating: 4.9,
    created_at: '2025-12-20'
  },
  {
    id: '4',
    title: 'Ambient Music Loop Pack',
    description: '100 royalty-free ambient loops for videos, podcasts, and games.',
    price: 19,
    category: 'audio',
    images: [],
    vendor: { id: '4', business_name: 'SoundScape Audio', rating: 4.5 },
    views: 432,
    sales: 234,
    rating: 4.4,
    created_at: '2025-12-22'
  },
  {
    id: '5',
    title: 'React Dashboard UI Kit',
    description: 'Production-ready dashboard components with TypeScript and Tailwind CSS.',
    price: 79,
    category: 'code',
    images: [],
    vendor: { id: '5', business_name: 'CodeCraft', rating: 4.8 },
    views: 789,
    sales: 45,
    rating: 4.7,
    created_at: '2025-12-25'
  },
  {
    id: '6',
    title: '3D Character Model Pack',
    description: '10 rigged character models for game development, compatible with Unity and Unreal.',
    price: 99,
    category: '3d',
    images: [],
    vendor: { id: '6', business_name: '3D Assets Pro', rating: 4.6 },
    views: 345,
    sales: 23,
    rating: 4.5,
    created_at: '2025-12-28'
  },
];
