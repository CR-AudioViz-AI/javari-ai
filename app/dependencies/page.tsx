'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Shield,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';

interface Dependency {
  id: string;
  package_name: string;
  current_version: string;
  latest_version: string;
  package_type: 'npm' | 'pip' | 'other';
  has_vulnerabilities: boolean;
  cve_ids: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  is_outdated: boolean;
  update_available: boolean;
  breaking_changes_expected: boolean;
  auto_update_recommended: boolean;
  last_checked: string;
}

interface DependencyStats {
  total_dependencies: number;
  outdated_dependencies: number;
  vulnerable_dependencies: number;
  critical_vulnerabilities: number;
  high_vulnerabilities: number;
  auto_update_candidates: number;
}

export default function DependenciesPage() {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [stats, setStats] = useState<DependencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDependencies();
    fetchStats();
  }, []);

  const fetchDependencies = async () => {
    try {
      const response = await fetch('/api/dependencies');
      if (response.ok) {
        const data = await response.json();
        setDependencies(data.dependencies || []);
      }
    } catch (error: unknown) {
      console.error('Error fetching dependencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dependencies/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error: unknown) {
      console.error('Error fetching stats:', error);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'npm':
        return 'bg-red-500/10 text-red-400';
      case 'pip':
        return 'bg-blue-500/10 text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const filteredDependencies = dependencies.filter(dep => {
    if (filterType !== 'all' && dep.package_type !== filterType) return false;
    if (filterSeverity !== 'all' && dep.severity !== filterSeverity) return false;
    if (searchTerm && !dep.package_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#4FFFB0] animate-pulse">Loading dependencies...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#4FFFB0] to-[#00D9FF] bg-clip-text text-transparent">
                Dependency Tracking
              </h1>
              <p className="text-gray-400">Monitor package versions, vulnerabilities, and updates</p>
            </div>
            <Button
              onClick={() => { fetchDependencies(); fetchStats(); }}
              className="bg-[#4FFFB0]/20 hover:bg-[#4FFFB0]/30 border border-[#4FFFB0]/30"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Packages</p>
                  <p className="text-3xl font-bold text-[#4FFFB0]">{stats.total_dependencies}</p>
                </div>
                <Package className="w-8 h-8 text-[#4FFFB0]/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-yellow-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Outdated</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.outdated_dependencies}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-yellow-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-red-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Vulnerabilities</p>
                  <p className="text-3xl font-bold text-red-400">{stats.vulnerable_dependencies}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400/30" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {stats.critical_vulnerabilities} critical, {stats.high_vulnerabilities} high
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Auto-Update Ready</p>
                  <p className="text-3xl font-bold text-green-400">{stats.auto_update_candidates}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Types</option>
              <option value="npm">NPM</option>
              <option value="pip">Python (pip)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Dependencies List */}
        <div className="space-y-4">
          {filteredDependencies.length === 0 ? (
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-8 text-center">
              <p className="text-gray-400">No dependencies found</p>
            </Card>
          ) : (
            filteredDependencies.map((dep) => (
              <Card key={dep.id} className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6 hover:border-[#4FFFB0]/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-[#4FFFB0]/10 rounded-lg">
                      <Package className="w-5 h-5 text-[#4FFFB0]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">{dep.package_name}</h3>
                        <Badge className={getTypeColor(dep.package_type)}>
                          {dep.package_type.toUpperCase()}
                        </Badge>
                        {dep.has_vulnerabilities && (
                          <Badge className={getSeverityColor(dep.severity)}>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {dep.severity?.toUpperCase()}
                          </Badge>
                        )}
                        {dep.is_outdated && (
                          <Badge className="bg-yellow-500/10 text-yellow-400">
                            Outdated
                          </Badge>
                        )}
                        {dep.auto_update_recommended && (
                          <Badge className="bg-green-500/10 text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Safe to Update
                          </Badge>
                        )}
                        {dep.breaking_changes_expected && (
                          <Badge className="bg-red-500/10 text-red-400">
                            Breaking Changes
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-gray-400">Current Version</p>
                          <p className="text-white font-medium font-mono">{dep.current_version}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Latest Version</p>
                          <p className="text-[#4FFFB0] font-medium font-mono">{dep.latest_version}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Update Available</p>
                          <p className="text-white font-medium">
                            {dep.update_available ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Last Checked</p>
                          <p className="text-white font-medium">
                            {new Date(dep.last_checked).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {dep.cve_ids.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-semibold text-red-400">
                              Security Vulnerabilities
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {dep.cve_ids.map((cve, idx) => (
                              <Badge key={idx} className="bg-red-500/20 text-red-300 text-xs">
                                {cve}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {dep.update_available && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#4FFFB0]/20 hover:bg-[#4FFFB0]/10"
                      >
                        Update
                      </Button>
                    )}
                    {dep.has_vulnerabilities && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/20 hover:bg-red-500/10 text-red-400"
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Fix Security
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
