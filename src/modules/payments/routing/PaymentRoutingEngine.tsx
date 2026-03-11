```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  DollarSign, 
  Clock, 
  Zap,
  Shield,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react';

/**
 * Payment processor configuration interface
 */
interface PaymentProcessor {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'adyen' | 'square' | 'custom';
  priority: number;
  isActive: boolean;
  supportedCurrencies: string[];
  supportedCountries: string[];
  supportedMethods: string[];
  fees: ProcessorFees;
  capabilities: ProcessorCapabilities;
  healthStatus: ProcessorHealthStatus;
  complianceLevel: 'basic' | 'enhanced' | 'enterprise';
  apiEndpoint?: string;
  apiKey?: string;
  webhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Processor fee structure interface
 */
interface ProcessorFees {
  fixedFee: number;
  percentageFee: number;
  currencyConversionFee?: number;
  internationalFee?: number;
  chargebackFee?: number;
  refundFee?: number;
}

/**
 * Processor capabilities interface
 */
interface ProcessorCapabilities {
  maxTransactionAmount: number;
  minTransactionAmount: number;
  supportsRecurring: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsPreauth: boolean;
  supports3DS: boolean;
  supportsFraudDetection: boolean;
  processingTime: 'instant' | 'minutes' | 'hours' | 'days';
}

/**
 * Processor health status interface
 */
interface ProcessorHealthStatus {
  isOnline: boolean;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  lastHealthCheck: Date;
  incidentCount: number;
}

/**
 * Routing rule configuration interface
 */
interface RoutingRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  fallbackProcessors: string[];
  maxRetries: number;
  retryDelay: number;
  validFrom: Date;
  validTo: Date;
}

/**
 * Routing condition interface
 */
interface RoutingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'contains';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Routing action interface
 */
interface RoutingAction {
  type: 'route_to_processor' | 'apply_fee' | 'require_verification' | 'block_transaction';
  value: any;
  metadata?: Record<string, any>;
}

/**
 * Payment request interface
 */
interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  customerCountry: string;
  paymentMethod: string;
  riskScore?: number;
  isRecurring: boolean;
  customerId?: string;
  merchantId: string;
  metadata: Record<string, any>;
  preferences?: PaymentPreferences;
}

/**
 * Payment preferences interface
 */
interface PaymentPreferences {
  preferredProcessors?: string[];
  excludedProcessors?: string[];
  maxFee?: number;
  requiresInstantProcessing?: boolean;
  requires3DS?: boolean;
  allowsInternational?: boolean;
}

/**
 * Routing decision interface
 */
interface RoutingDecision {
  primaryProcessor: string;
  fallbackProcessors: string[];
  estimatedCost: number;
  expectedSuccessRate: number;
  processingTime: string;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string[];
  metadata: Record<string, any>;
}

/**
 * Payment attempt interface
 */
interface PaymentAttempt {
  id: string;
  paymentRequestId: string;
  processorId: string;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  amount: number;
  fees: number;
  responseTime: number;
  errorCode?: string;
  errorMessage?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Routing analytics interface
 */
interface RoutingAnalytics {
  totalTransactions: number;
  successRate: number;
  averageCost: number;
  averageResponseTime: number;
  processorDistribution: Record<string, number>;
  costSavings: number;
  fallbackUsage: number;
  complianceScore: number;
  lastUpdated: Date;
}

/**
 * Processor selector component
 */
interface ProcessorSelectorProps {
  processors: PaymentProcessor[];
  paymentRequest: PaymentRequest;
  onProcessorSelected: (decision: RoutingDecision) => void;
  onAnalyticsUpdate: (analytics: Partial<RoutingAnalytics>) => void;
}

const ProcessorSelector: React.FC<ProcessorSelectorProps> = ({
  processors,
  paymentRequest,
  onProcessorSelected,
  onAnalyticsUpdate
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [decision, setDecision] = useState<RoutingDecision | null>(null);

  /**
   * Analyze and select optimal processor
   */
  const analyzeProcessors = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      // Filter processors based on capabilities
      const eligibleProcessors = processors.filter(processor => 
        processor.isActive &&
        processor.supportedCurrencies.includes(paymentRequest.currency) &&
        processor.supportedCountries.includes(paymentRequest.customerCountry) &&
        processor.supportedMethods.includes(paymentRequest.paymentMethod) &&
        processor.capabilities.maxTransactionAmount >= paymentRequest.amount &&
        processor.capabilities.minTransactionAmount <= paymentRequest.amount
      );

      // Calculate scores for each processor
      const scoredProcessors = eligibleProcessors.map(processor => {
        const costScore = calculateCostScore(processor, paymentRequest);
        const successScore = processor.healthStatus.successRate;
        const speedScore = calculateSpeedScore(processor);
        const complianceScore = calculateComplianceScore(processor, paymentRequest);
        
        const totalScore = (costScore * 0.3) + (successScore * 0.4) + (speedScore * 0.2) + (complianceScore * 0.1);
        
        return {
          processor,
          score: totalScore,
          costScore,
          successScore,
          speedScore,
          complianceScore
        };
      });

      // Sort by score (highest first)
      scoredProcessors.sort((a, b) => b.score - a.score);

      if (scoredProcessors.length === 0) {
        throw new Error('No eligible processors found for this payment request');
      }

      const primaryProcessor = scoredProcessors[0];
      const fallbackProcessors = scoredProcessors.slice(1, 4).map(sp => sp.processor.id);

      const routingDecision: RoutingDecision = {
        primaryProcessor: primaryProcessor.processor.id,
        fallbackProcessors,
        estimatedCost: calculateEstimatedCost(primaryProcessor.processor, paymentRequest),
        expectedSuccessRate: primaryProcessor.successScore,
        processingTime: primaryProcessor.processor.capabilities.processingTime,
        complianceScore: primaryProcessor.complianceScore,
        riskLevel: calculateRiskLevel(paymentRequest),
        reasoning: generateReasoning(primaryProcessor, paymentRequest),
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          processorsConsidered: eligibleProcessors.length,
          topScore: primaryProcessor.score
        }
      };

      setDecision(routingDecision);
      onProcessorSelected(routingDecision);
      
      // Update analytics
      onAnalyticsUpdate({
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Error analyzing processors:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [processors, paymentRequest, onProcessorSelected, onAnalyticsUpdate]);

  /**
   * Calculate cost score for processor
   */
  const calculateCostScore = useCallback((processor: PaymentProcessor, request: PaymentRequest): number => {
    const totalCost = processor.fees.fixedFee + (request.amount * processor.fees.percentageFee / 100);
    const maxCost = 100; // Normalize against max expected cost
    return Math.max(0, 100 - (totalCost / maxCost * 100));
  }, []);

  /**
   * Calculate speed score for processor
   */
  const calculateSpeedScore = useCallback((processor: PaymentProcessor): number => {
    const speedScores = {
      instant: 100,
      minutes: 80,
      hours: 60,
      days: 40
    };
    return speedScores[processor.capabilities.processingTime] || 0;
  }, []);

  /**
   * Calculate compliance score for processor
   */
  const calculateComplianceScore = useCallback((processor: PaymentProcessor, request: PaymentRequest): number => {
    let score = 0;
    
    // Base compliance level score
    const complianceScores = { basic: 60, enhanced: 80, enterprise: 100 };
    score += complianceScores[processor.complianceLevel] * 0.4;

    // 3DS support
    if (processor.capabilities.supports3DS) score += 20;
    
    // Fraud detection
    if (processor.capabilities.supportsFraudDetection) score += 20;
    
    // Risk-based adjustments
    if (request.riskScore && request.riskScore > 70) {
      score = Math.min(score, processor.capabilities.supportsFraudDetection ? score : score * 0.7);
    }

    return Math.min(100, score);
  }, []);

  /**
   * Calculate estimated cost
   */
  const calculateEstimatedCost = useCallback((processor: PaymentProcessor, request: PaymentRequest): number => {
    let cost = processor.fees.fixedFee + (request.amount * processor.fees.percentageFee / 100);
    
    // Add international fee if applicable
    if (processor.fees.internationalFee && request.customerCountry !== 'US') {
      cost += request.amount * processor.fees.internationalFee / 100;
    }
    
    // Add currency conversion fee if applicable
    if (processor.fees.currencyConversionFee && request.currency !== 'USD') {
      cost += request.amount * processor.fees.currencyConversionFee / 100;
    }
    
    return cost;
  }, []);

  /**
   * Calculate risk level
   */
  const calculateRiskLevel = useCallback((request: PaymentRequest): 'low' | 'medium' | 'high' => {
    const riskScore = request.riskScore || 0;
    
    if (riskScore < 30) return 'low';
    if (riskScore < 70) return 'medium';
    return 'high';
  }, []);

  /**
   * Generate reasoning for decision
   */
  const generateReasoning = useCallback((scoredProcessor: any, request: PaymentRequest): string[] => {
    const reasons = [];
    
    if (scoredProcessor.successScore > 95) {
      reasons.push('High success rate (>95%)');
    }
    
    if (scoredProcessor.costScore > 80) {
      reasons.push('Cost-effective pricing');
    }
    
    if (scoredProcessor.speedScore === 100) {
      reasons.push('Instant processing capability');
    }
    
    if (scoredProcessor.processor.capabilities.supportsFraudDetection) {
      reasons.push('Advanced fraud detection');
    }
    
    if (scoredProcessor.complianceScore > 90) {
      reasons.push('High compliance standards');
    }
    
    return reasons;
  }, []);

  useEffect(() => {
    if (processors.length > 0 && paymentRequest) {
      analyzeProcessors();
    }
  }, [processors, paymentRequest, analyzeProcessors]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Processor Selection</h3>
        <button
          onClick={analyzeProcessors}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          Re-analyze
        </button>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            Analyzing processors...
          </div>
        </div>
      ) : decision ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Primary Processor Selected</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Processor:</span>
                <span className="ml-2 font-medium">{processors.find(p => p.id === decision.primaryProcessor)?.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Estimated Cost:</span>
                <span className="ml-2 font-medium">${decision.estimatedCost.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Success Rate:</span>
                <span className="ml-2 font-medium">{decision.expectedSuccessRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-600">Processing Time:</span>
                <span className="ml-2 font-medium capitalize">{decision.processingTime}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Decision Reasoning</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {decision.reasoning.map((reason, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {decision.fallbackProcessors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Fallback Processors</h4>
              <div className="flex flex-wrap gap-2">
                {decision.fallbackProcessors.map((processorId, index) => (
                  <span
                    key={processorId}
                    className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm"
                  >
                    {index + 1}. {processors.find(p => p.id === processorId)?.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No routing decision available
        </div>
      )}
    </div>
  );
};

/**
 * Fallback handler component
 */
interface FallbackHandlerProps {
  attempt: PaymentAttempt;
  fallbackProcessors: string[];
  processors: PaymentProcessor[];
  onFallbackTriggered: (processorId: string, attempt: number) => void;
}

const FallbackHandler: React.FC<FallbackHandlerProps> = ({
  attempt,
  fallbackProcessors,
  processors,
  onFallbackTriggered
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Handle fallback to next processor
   */
  const handleFallback = useCallback(async () => {
    if (attempt.attempt >= fallbackProcessors.length) {
      return; // No more fallback processors
    }

    setIsProcessing(true);
    
    try {
      const nextProcessorId = fallbackProcessors[attempt.attempt];
      onFallbackTriggered(nextProcessorId, attempt.attempt + 1);
    } catch (error) {
      console.error('Error handling fallback:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [attempt, fallbackProcessors, onFallbackTriggered]);

  if (attempt.status !== 'failed' || attempt.attempt >= fallbackProcessors.length) {
    return null;
  }

  const nextProcessor = processors.find(p => p.id === fallbackProcessors[attempt.attempt]);

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <span className="font-medium text-orange-900">Payment Failed - Fallback Available</span>
        </div>
        <button
          onClick={handleFallback}
          disabled={isProcessing}
          className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Try Fallback'}
        </button>
      </div>
      
      {nextProcessor && (
        <div className="text-sm text-orange-800">
          Next processor: <span className="font-medium">{nextProcessor.name}</span>
          <span className="ml-2 text-orange-600">
            (Success rate: {nextProcessor.healthStatus.successRate.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Retry logic manager component
 */
interface RetryLogicManagerProps {
  attempts: PaymentAttempt[];
  maxRetries: number;
  retryDelay: number;
  onRetry: () => void;
}

const RetryLogicManager: React.FC<RetryLogicManagerProps> = ({
  attempts,
  maxRetries,
  retryDelay,
  onRetry
}) => {
  const [timeUntilRetry, setTimeUntilRetry] = useState(0);

  const lastAttempt = attempts[attempts.length - 1];
  const canRetry = attempts.length < maxRetries && lastAttempt?.status === 'failed';

  useEffect(() => {
    if (canRetry && lastAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.updatedAt).getTime();
      const remainingDelay = Math.max(0, retryDelay * 1000 - timeSinceLastAttempt);
      
      setTimeUntilRetry(Math.ceil(remainingDelay / 1000));
      
      if (remainingDelay <= 0) {
        return;
      }

      const interval = setInterval(() => {
        setTimeUntilRetry(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [canRetry, lastAttempt, retryDelay]);

  if (!canRetry) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-600" />
          <span className="font-medium text-yellow-900">
            Retry Available ({attempts.length}/{maxRetries})
          </span>
        </div>
        
        {timeUntilRetry > 0 ? (
          <div className="text-sm text-yellow-800">
            Next retry in {timeUntilRetry}s
          </div>
        ) : (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          >
            Retry Now
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Routing analytics component
 */
interface RoutingAnalyticsProps {
  analytics: RoutingAnalytics;
  onRefresh: () => void;
}

const RoutingAnalytics: React.FC<RoutingAnalyticsProps> = ({
  analytics,
  onRefresh
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Routing Analytics</h3>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="w-4 h-