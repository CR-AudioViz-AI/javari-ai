```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useAccount, useConnect, useDisconnect, useSignMessage, useContractWrite, useContractRead } from 'wagmi'
import { toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Vote, 
  FileText, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Calendar,
  DollarSign,
  Shield,
  Eye,
  BarChart3,
  Play,
  Pause,
  Settings,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Copy,
  Zap,
  Target,
  Globe
} from 'lucide-react'

/**
 * Governance proposal status enum
 */
enum ProposalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PASSED = 'passed',
  FAILED = 'failed',
  EXECUTED = 'executed',
  EXPIRED = 'expired'
}

/**
 * Vote choice enum
 */
enum VoteChoice {
  FOR = 'for',
  AGAINST = 'against',
  ABSTAIN = 'abstain'
}

/**
 * Governance proposal interface
 */
interface GovernanceProposal {
  id: string
  title: string
  description: string
  proposer: string
  status: ProposalStatus
  category: string
  voting_starts_at: string
  voting_ends_at: string
  execution_delay: number
  quorum_threshold: number
  approval_threshold: number
  ipfs_hash: string
  vote_count_for: number
  vote_count_against: number
  vote_count_abstain: number
  total_voting_power: number
  created_at: string
  updated_at: string
  metadata?: {
    actions?: Array<{
      target: string
      calldata: string
      value: string
    }>
    discussion_url?: string
    tags?: string[]
  }
}

/**
 * Governance vote interface
 */
interface GovernanceVote {
  id: string
  proposal_id: string
  voter: string
  choice: VoteChoice
  voting_power: number
  reason?: string
  tx_hash?: string
  created_at: string
}

/**
 * Delegation interface
 */
interface Delegation {
  id: string
  delegator: string
  delegate: string
  voting_power: number
  expiry: string
  created_at: string
}

/**
 * Governance statistics interface
 */
interface GovernanceStats {
  total_proposals: number
  active_proposals: number
  total_votes: number
  total_voting_power: number
  participation_rate: number
  average_turnout: number
  top_delegates: Array<{
    address: string
    delegated_power: number
    votes_cast: number
  }>
}

/**
 * Governance proposal form data interface
 */
interface ProposalFormData {
  title: string
  description: string
  category: string
  voting_duration: number
  execution_delay: number
  actions: Array<{
    target: string
    calldata: string
    value: string
  }>
  discussion_url: string
  tags: string[]
}

/**
 * Governance Overview Component
 */
const GovernanceOverview: React.FC<{
  stats: GovernanceStats
  onCreateProposal: () => void
}> = ({ stats, onCreateProposal }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Total Proposals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_proposals}
            </p>
          </div>
          <FileText className="h-8 w-8 text-blue-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Active Proposals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.active_proposals}
            </p>
          </div>
          <Vote className="h-8 w-8 text-green-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Participation Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {(stats.participation_rate * 100).toFixed(1)}%
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-purple-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Total Voting Power</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {(stats.total_voting_power / 1e18).toFixed(0)}K
            </p>
          </div>
          <Shield className="h-8 w-8 text-orange-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="md:col-span-2 lg:col-span-4"
      >
        <button
          onClick={onCreateProposal}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <FileText className="h-5 w-5" />
          Create New Proposal
        </button>
      </motion.div>
    </div>
  )
}

/**
 * Proposal Creation Form Component
 */
const ProposalCreationForm: React.FC<{
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProposalFormData) => Promise<void>
}> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<ProposalFormData>({
    title: '',
    description: '',
    category: 'general',
    voting_duration: 7,
    execution_delay: 2,
    actions: [],
    discussion_url: '',
    tags: []
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      setIsSubmitting(true)
      await onSubmit(formData)
      setFormData({
        title: '',
        description: '',
        category: 'general',
        voting_duration: 7,
        execution_delay: 2,
        actions: [],
        discussion_url: '',
        tags: []
      })
      onClose()
    } catch (error) {
      console.error('Error creating proposal:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { target: '', calldata: '', value: '0' }]
    }))
  }

  const updateAction = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }))
  }

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create New Proposal
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="general">General</option>
                  <option value="protocol">Protocol</option>
                  <option value="treasury">Treasury</option>
                  <option value="governance">Governance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voting Duration (days)
                </label>
                <input
                  type="number"
                  value={formData.voting_duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, voting_duration: parseInt(e.target.value) }))}
                  min="1"
                  max="30"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Execution Delay (days)
                </label>
                <input
                  type="number"
                  value={formData.execution_delay}
                  onChange={(e) => setFormData(prev => ({ ...prev, execution_delay: parseInt(e.target.value) }))}
                  min="0"
                  max="14"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Discussion URL (optional)
              </label>
              <input
                type="url"
                value={formData.discussion_url}
                onChange={(e) => setFormData(prev => ({ ...prev, discussion_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actions (optional)
                </label>
                <button
                  type="button"
                  onClick={addAction}
                  className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                >
                  + Add Action
                </button>
              </div>

              {formData.actions.map((action, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Action {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Target contract address"
                      value={action.target}
                      onChange={(e) => updateAction(index, 'target', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Function calldata"
                      value={action.calldata}
                      onChange={(e) => updateAction(index, 'calldata', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="ETH value (0)"
                      value={action.value}
                      onChange={(e) => updateAction(index, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.title || !formData.description}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Create Proposal
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Proposal List Component
 */
const ProposalList: React.FC<{
  proposals: GovernanceProposal[]
  onProposalClick: (proposal: GovernanceProposal) => void
  filter: string
  onFilterChange: (filter: string) => void
}> = ({ proposals, onProposalClick, filter, onFilterChange }) => {
  const filteredProposals = useMemo(() => {
    return proposals.filter(proposal => {
      if (filter === 'all') return true
      return proposal.status === filter
    })
  }, [proposals, filter])

  const getStatusColor = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.ACTIVE: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case ProposalStatus.PASSED: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case ProposalStatus.FAILED: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case ProposalStatus.EXECUTED: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case ProposalStatus.EXPIRED: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    }
  }

  const getStatusIcon = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.ACTIVE: return <Clock className="h-4 w-4" />
      case ProposalStatus.PASSED: return <CheckCircle className="h-4 w-4" />
      case ProposalStatus.FAILED: return <XCircle className="h-4 w-4" />
      case ProposalStatus.EXECUTED: return <Zap className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {['all', 'active', 'passed', 'failed', 'executed'].map(status => (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filteredProposals.map((proposal, index) => (
            <motion.div
              key={proposal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onProposalClick(proposal)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-200 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center