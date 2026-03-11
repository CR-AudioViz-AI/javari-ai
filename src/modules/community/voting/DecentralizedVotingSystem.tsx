import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import { 
  Vote, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Wallet,
  BarChart3,
  MessageSquare,
  Lock,
  Unlock,
  PieChart,
  Activity
} from 'lucide-react';

/**
 * Proposal status enumeration
 */
export enum ProposalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  VOTING = 'voting',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * Vote choice enumeration
 */
export enum VoteChoice {
  FOR = 'for',
  AGAINST = 'against',
  ABSTAIN = 'abstain'
}

/**
 * Proposal interface
 */
export interface Proposal {
  id: string;
  title: string;
  description: string;
  creator: string;
  status: ProposalStatus;
  ipfsHash: string;
  contractAddress?: string;
  votingStartTime: Date;
  votingEndTime: Date;
  executionTime?: Date;
  quorumRequired: number;
  minimumVotingPower: number;
  totalVotesFor: number;
  totalVotesAgainst: number;
  totalVotesAbstain: number;
  totalVotingPower: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vote record interface
 */
export interface VoteRecord {
  id: string;
  proposalId: string;
  voter: string;
  choice: VoteChoice;
  votingPower: number;
  transactionHash: string;
  timestamp: Date;
}

/**
 * Governance token interface
 */
export interface GovernanceToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: number;
  stakingMultiplier: number;
}

/**
 * Voting power interface
 */
export interface VotingPower {
  address: string;
  tokenBalance: number;
  stakedBalance: number;
  stakingDuration: number;
  totalVotingPower: number;
  lastUpdated: Date;
}

/**
 * Props for DecentralizedVotingSystem component
 */
export interface DecentralizedVotingSystemProps {
  supabaseUrl: string;
  supabaseKey: string;
  web3Provider?: ethers.providers.Web3Provider;
  ipfsConfig?: {
    host: string;
    port: number;
    protocol: string;
  };
  governanceTokenAddress: string;
  votingContractAddress: string;
  className?: string;
}

/**
 * Custom hook for blockchain voting operations
 */
const useBlockchainVoting = (
  provider?: ethers.providers.Web3Provider,
  contractAddress?: string
) => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  const votingABI = [
    "function createProposal(string memory title, string memory ipfsHash, uint256 votingDuration, uint256 quorum) external returns (uint256)",
    "function vote(uint256 proposalId, uint8 choice) external",
    "function getProposal(uint256 proposalId) external view returns (tuple(string title, string ipfsHash, address creator, uint256 startTime, uint256 endTime, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint8 status))",
    "function getVotingPower(address voter) external view returns (uint256)",
    "function executeProposal(uint256 proposalId) external",
    "event ProposalCreated(uint256 indexed proposalId, address indexed creator, string title)",
    "event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 choice, uint256 votingPower)",
    "event ProposalExecuted(uint256 indexed proposalId)"
  ];

  useEffect(() => {
    if (provider && contractAddress) {
      const signer = provider.getSigner();
      const votingContract = new ethers.Contract(contractAddress, votingABI, signer);
      setContract(votingContract);

      provider.listAccounts().then(accounts => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      });
    }
  }, [provider, contractAddress]);

  const createProposal = useCallback(async (
    title: string,
    ipfsHash: string,
    votingDuration: number,
    quorum: number
  ): Promise<string | null> => {
    if (!contract || !account) return null;

    try {
      const tx = await contract.createProposal(title, ipfsHash, votingDuration, quorum);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error creating proposal:', error);
      return null;
    }
  }, [contract, account]);

  const castVote = useCallback(async (
    proposalId: string,
    choice: VoteChoice
  ): Promise<string | null> => {
    if (!contract || !account) return null;

    try {
      const choiceNumber = choice === VoteChoice.FOR ? 0 : choice === VoteChoice.AGAINST ? 1 : 2;
      const tx = await contract.vote(proposalId, choiceNumber);
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error casting vote:', error);
      return null;
    }
  }, [contract, account]);

  const getVotingPower = useCallback(async (address: string): Promise<number> => {
    if (!contract) return 0;

    try {
      const power = await contract.getVotingPower(address);
      return parseInt(power.toString());
    } catch (error) {
      console.error('Error getting voting power:', error);
      return 0;
    }
  }, [contract]);

  return { contract, account, createProposal, castVote, getVotingPower };
};

/**
 * Custom hook for IPFS operations
 */
const useIPFS = (config?: { host: string; port: number; protocol: string }) => {
  const [ipfs, setIpfs] = useState<any>(null);

  useEffect(() => {
    if (config) {
      const client = create(config);
      setIpfs(client);
    }
  }, [config]);

  const uploadToIPFS = useCallback(async (data: any): Promise<string | null> => {
    if (!ipfs) return null;

    try {
      const result = await ipfs.add(JSON.stringify(data));
      return result.path;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      return null;
    }
  }, [ipfs]);

  const getFromIPFS = useCallback(async (hash: string): Promise<any | null> => {
    if (!ipfs) return null;

    try {
      const stream = ipfs.cat(hash);
      const data = [];
      for await (const chunk of stream) {
        data.push(chunk);
      }
      const content = new TextDecoder().decode(new Uint8Array(data.flat()));
      return JSON.parse(content);
    } catch (error) {
      console.error('Error getting from IPFS:', error);
      return null;
    }
  }, [ipfs]);

  return { uploadToIPFS, getFromIPFS };
};

/**
 * Voting Power Calculator Component
 */
const VotingPowerCalculator: React.FC<{
  tokenBalance: number;
  stakedBalance: number;
  stakingDuration: number;
  stakingMultiplier: number;
}> = ({ tokenBalance, stakedBalance, stakingDuration, stakingMultiplier }) => {
  const votingPower = useMemo(() => {
    const baseVotingPower = tokenBalance;
    const stakingBonus = stakedBalance * (1 + (stakingDuration / 365) * stakingMultiplier);
    return baseVotingPower + stakingBonus;
  }, [tokenBalance, stakedBalance, stakingDuration, stakingMultiplier]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Your Voting Power</h3>
        <BarChart3 className="w-5 h-5 text-blue-500" />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Token Balance:</span>
          <span className="font-medium">{tokenBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Staked Balance:</span>
          <span className="font-medium">{stakedBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Staking Duration:</span>
          <span className="font-medium">{stakingDuration} days</span>
        </div>
        <div className="border-t pt-2">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-800">Total Voting Power:</span>
            <span className="font-bold text-blue-600">{votingPower.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Quorum Indicator Component
 */
const QuorumIndicator: React.FC<{
  currentVotes: number;
  quorumRequired: number;
  totalSupply: number;
}> = ({ currentVotes, quorumRequired, totalSupply }) => {
  const quorumPercentage = (quorumRequired / totalSupply) * 100;
  const currentPercentage = (currentVotes / totalSupply) * 100;
  const quorumMet = currentVotes >= quorumRequired;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Quorum Status</h3>
        {quorumMet ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-500" />
        )}
      </div>
      <div className="space-y-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              quorumMet ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(currentPercentage, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            Current: {currentPercentage.toFixed(2)}%
          </span>
          <span className="text-gray-600">
            Required: {quorumPercentage.toFixed(2)}%
          </span>
        </div>
        <div className={`text-center font-medium ${quorumMet ? 'text-green-600' : 'text-yellow-600'}`}>
          {quorumMet ? 'Quorum Met' : 'Quorum Not Met'}
        </div>
      </div>
    </div>
  );
};

/**
 * Proposal Creation Form Component
 */
const ProposalCreationForm: React.FC<{
  onCreateProposal: (proposal: Partial<Proposal>) => Promise<void>;
  isCreating: boolean;
}> = ({ onCreateProposal, isCreating }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [votingDuration, setVotingDuration] = useState(7);
  const [quorumRequired, setQuorumRequired] = useState(10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    await onCreateProposal({
      title,
      description,
      votingStartTime: new Date(),
      votingEndTime: new Date(Date.now() + votingDuration * 24 * 60 * 60 * 1000),
      quorumRequired,
      status: ProposalStatus.DRAFT
    });

    setTitle('');
    setDescription('');
    setVotingDuration(7);
    setQuorumRequired(10);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Proposal</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter proposal title"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your proposal in detail"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voting Duration (days)
            </label>
            <input
              type="number"
              value={votingDuration}
              onChange={(e) => setVotingDuration(parseInt(e.target.value))}
              min="1"
              max="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quorum Required (%)
            </label>
            <input
              type="number"
              value={quorumRequired}
              onChange={(e) => setQuorumRequired(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isCreating || !title.trim() || !description.trim()}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Proposal'}
        </button>
      </form>
    </div>
  );
};

/**
 * Voting Results Component
 */
const VotingResults: React.FC<{
  proposal: Proposal;
  votes: VoteRecord[];
}> = ({ proposal, votes }) => {
  const totalVotes = proposal.totalVotesFor + proposal.totalVotesAgainst + proposal.totalVotesAbstain;
  const forPercentage = totalVotes > 0 ? (proposal.totalVotesFor / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (proposal.totalVotesAgainst / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (proposal.totalVotesAbstain / totalVotes) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Voting Results</h3>
        <PieChart className="w-5 h-5 text-blue-500" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Votes:</span>
          <span className="font-medium">{totalVotes.toLocaleString()}</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-green-600 font-medium">For</span>
              <span className="text-green-600 font-medium">
                {proposal.totalVotesFor.toLocaleString()} ({forPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${forPercentage}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-red-600 font-medium">Against</span>
              <span className="text-red-600 font-medium">
                {proposal.totalVotesAgainst.toLocaleString()} ({againstPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${againstPercentage}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-yellow-600 font-medium">Abstain</span>
              <span className="text-yellow-600 font-medium">
                {proposal.totalVotesAbstain.toLocaleString()} ({abstainPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${abstainPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Proposal Card Component
 */
const ProposalCard: React.FC<{
  proposal: Proposal;
  userVotingPower: number;
  userVote?: VoteRecord;
  onVote: (proposalId: string, choice: VoteChoice) => Promise<void>;
  isVoting: boolean;
}> = ({ proposal, userVotingPower, userVote, onVote, isVoting }) => {
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null);
  
  const isVotingActive = proposal.status === ProposalStatus.VOTING;
  const timeRemaining = proposal.votingEndTime.getTime() - Date.now();
  const hasVoted = !!userVote;
  
  const handleVote = async () => {
    if (!selectedChoice || !isVotingActive || hasVoted) return;
    await onVote(proposal.id, selectedChoice);
    setSelectedChoice(null);
  };

  const getStatusColor = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.ACTIVE:
      case ProposalStatus.VOTING:
        return 'bg-green-100 text-green-800';
      case ProposalStatus.EXECUTED:
        return 'bg-blue-100 text-blue-800';
      case ProposalStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case ProposalStatus.EXPIRED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return 'Voting ended';
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}d ${hours}h remaining`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-gray-800 flex-1 mr-4">
          {proposal.title}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
          {proposal.status.toUpperCase()}
        </span>
      </div>
      
      <p className="text-gray-600 mb-4 line-clamp-3">{proposal.description}</p>
      
      <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-1" />
          {formatTimeRem