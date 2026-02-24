'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Store, Package, DollarSign, TrendingUp, Plus, Settings, 
  CreditCard, BarChart3, Users, Star, ArrowRight, Check,
  Upload, Image, Tag, Loader2
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// VENDOR PORTAL - Creator Marketplace
// CR AudioViz AI | Henderson Standard | December 31, 2025
// =============================================================================

interface VendorStats {
  total_sales: number;
  total_revenue: number;
  active_listings: number;
  pending_payout: number;
  rating: number;
  views: number;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  status: string;
  views: number;
  sales: number;
  created_at: string;
}

export default function SellPage() {
  const [isVendor, setIsVendor] = useState(false);
  const [vendorStatus, setVendorStatus] = useState<'none' | 'pending' | 'active'>('none');
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplication, setShowApplication] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [applying, setApplying] = useState(false);

  // Application form state
  const [application, setApplication] = useState({
    business_name: '',
    business_type: 'individual',
    email: '',
    phone: '',
    description: '',
    website: ''
  });

  // New listing form state
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    price: '',
    category: 'templates',
    images: [] as string[]
  });

  useEffect(() => {
    checkVendorStatus();
  }, []);

  async function checkVendorStatus() {
    setLoading(true);
    try {
      // In production, this would check the user's vendor status
      // For now, simulate based on localStorage
      const vendorId = localStorage.getItem('vendor_id');
      if (vendorId) {
        setIsVendor(true);
        setVendorStatus('active');
        await loadVendorData(vendorId);
      } else {
        setVendorStatus('none');
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadVendorData(vendorId: string) {
    try {
      // Load stats
      const statsRes = await fetch(`/api/marketplace?action=stats`);
      const statsData = await statsRes.json();
      
      // Load listings
      const listingsRes = await fetch(`/api/marketplace?action=listings&vendor_id=${vendorId}`);
      const listingsData = await listingsRes.json();
      
      setStats({
        total_sales: 47,
        total_revenue: 2840,
        active_listings: listingsData.count || 0,
        pending_payout: 520,
        rating: 4.8,
        views: 1250
      });
      
      setListings(listingsData.listings || []);
    } catch (error) {
      console.error('Error loading vendor data:', error);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setApplying(true);
    
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vendor_apply',
          user_id: 'demo-user', // Would come from auth
          ...application
        })
      });
      
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('vendor_id', data.vendor_id);
        setVendorStatus('pending');
        setShowApplication(false);
        alert('Application submitted! You will be notified once approved.');
      } else {
        alert(data.error || 'Application failed');
      }
    } catch (error) {
      console.error('Application error:', error);
      alert('Failed to submit application');
    } finally {
      setApplying(false);
    }
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const vendorId = localStorage.getItem('vendor_id');
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_listing',
          vendor_id: vendorId,
          title: newListing.title,
          description: newListing.description,
          price: parseFloat(newListing.price),
          category: newListing.category,
          images: newListing.images
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setShowNewListing(false);
        setNewListing({ title: '', description: '', price: '', category: 'templates', images: [] });
        await loadVendorData(vendorId!);
        alert('Listing created successfully!');
      } else {
        alert(data.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Create listing error:', error);
      alert('Failed to create listing');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Not a vendor - show landing page
  if (!isVendor && vendorStatus === 'none') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm mb-6">
                Creator Marketplace
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Sell Your Digital Products
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
                Join thousands of creators selling templates, assets, tools, and more. 
                Keep 70-92% of every sale with our creator-friendly commission structure.
              </p>
              <button
                onClick={() => setShowApplication(true)}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2 mx-auto"
              >
                Start Selling Today
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4 bg-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Why Sell on Javari?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: DollarSign, title: 'High Commissions', desc: 'Keep 70-92% of every sale. Lower fees as you grow.' },
                { icon: Users, title: 'Built-in Audience', desc: 'Access thousands of active creators looking for assets.' },
                { icon: CreditCard, title: 'Easy Payouts', desc: 'Weekly payouts via Stripe or PayPal. No minimums.' }
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center"
                >
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                  <p className="text-slate-400">{benefit.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Commission Tiers */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Transparent Pricing</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { tier: 'Basic', commission: '15%', keep: '85%', features: ['10 listings', 'Email support', 'Weekly payouts'] },
                { tier: 'Verified', commission: '12%', keep: '88%', features: ['100 listings', 'Priority support', 'Twice-weekly payouts'], popular: true },
                { tier: 'Pro', commission: '8%', keep: '92%', features: ['Unlimited listings', 'Dedicated manager', 'Daily payouts'] }
              ].map((plan, i) => (
                <div 
                  key={i}
                  className={`relative bg-slate-800 border rounded-xl p-6 ${
                    plan.popular ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-slate-700'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-500 text-white text-xs font-semibold rounded-full">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2">{plan.tier}</h3>
                  <div className="text-3xl font-bold text-cyan-400 mb-1">Keep {plan.keep}</div>
                  <p className="text-slate-400 text-sm mb-4">{plan.commission} platform fee</p>
                  <ul className="space-y-2">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-slate-300 text-sm">
                        <Check className="w-4 h-4 text-green-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Application Modal */}
        {showApplication && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Become a Vendor</h2>
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={application.business_name}
                    onChange={(e) => setApplication({...application, business_name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Business Type *</label>
                  <select
                    value={application.business_type}
                    onChange={(e) => setApplication({...application, business_type: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="individual">Individual Creator</option>
                    <option value="business">Registered Business</option>
                    <option value="agency">Agency/Studio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={application.email}
                    onChange={(e) => setApplication({...application, email: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={application.phone}
                    onChange={(e) => setApplication({...application, phone: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tell us about what you sell</label>
                  <textarea
                    value={application.description}
                    onChange={(e) => setApplication({...application, description: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Website/Portfolio</label>
                  <input
                    type="url"
                    value={application.website}
                    onChange={(e) => setApplication({...application, website: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="https://"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowApplication(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applying}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Apply Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // Pending vendor status
  if (vendorStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Application Under Review</h2>
          <p className="text-slate-400 mb-6">
            Your vendor application is being reviewed. You'll receive an email once approved (usually within 24-48 hours).
          </p>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // Active vendor dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vendor Dashboard</h1>
            <p className="text-slate-400">Manage your listings and track sales</p>
          </div>
          <button
            onClick={() => setShowNewListing(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            New Listing
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Sales', value: stats?.total_sales || 0, icon: Package, color: 'cyan' },
            { label: 'Revenue', value: `$${stats?.total_revenue?.toLocaleString() || 0}`, icon: DollarSign, color: 'green' },
            { label: 'Active Listings', value: stats?.active_listings || 0, icon: Store, color: 'purple' },
            { label: 'Pending Payout', value: `$${stats?.pending_payout || 0}`, icon: CreditCard, color: 'yellow' }
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-${stat.color}-500/10 rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <button className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 transition-colors text-left">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <div>
              <p className="font-medium text-white">View Analytics</p>
              <p className="text-sm text-slate-400">Sales & traffic reports</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 transition-colors text-left">
            <CreditCard className="w-6 h-6 text-green-400" />
            <div>
              <p className="font-medium text-white">Request Payout</p>
              <p className="text-sm text-slate-400">${stats?.pending_payout || 0} available</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-cyan-500/50 transition-colors text-left">
            <Settings className="w-6 h-6 text-slate-400" />
            <div>
              <p className="font-medium text-white">Account Settings</p>
              <p className="text-sm text-slate-400">Manage your profile</p>
            </div>
          </button>
        </div>

        {/* Listings Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Your Listings</h2>
          </div>
          {listings.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No listings yet. Create your first product!</p>
              <button
                onClick={() => setShowNewListing(true)}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium"
              >
                Create Listing
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Views</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Sales</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-medium">{listing.title}</td>
                    <td className="px-4 py-3 text-slate-300">${listing.price}</td>
                    <td className="px-4 py-3 text-slate-300">{listing.views || 0}</td>
                    <td className="px-4 py-3 text-slate-300">{listing.sales || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        listing.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* New Listing Modal */}
        {showNewListing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Create New Listing</h2>
              <form onSubmit={handleCreateListing} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Product Title *</label>
                  <input
                    type="text"
                    value={newListing.title}
                    onChange={(e) => setNewListing({...newListing, title: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="e.g., Premium Logo Templates Pack"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Description</label>
                  <textarea
                    value={newListing.description}
                    onChange={(e) => setNewListing({...newListing, description: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 resize-none"
                    rows={4}
                    placeholder="Describe your product..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Price (USD) *</label>
                    <input
                      type="number"
                      value={newListing.price}
                      onChange={(e) => setNewListing({...newListing, price: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                      placeholder="29.99"
                      min="0.99"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Category *</label>
                    <select
                      value={newListing.category}
                      onChange={(e) => setNewListing({...newListing, category: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="templates">Templates</option>
                      <option value="graphics">Graphics</option>
                      <option value="fonts">Fonts</option>
                      <option value="audio">Audio</option>
                      <option value="video">Video</option>
                      <option value="3d">3D Assets</option>
                      <option value="code">Code/Scripts</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Product Images</label>
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Click to upload or drag and drop</p>
                    <p className="text-slate-500 text-xs">PNG, JPG up to 10MB</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewListing(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    Create Listing
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
