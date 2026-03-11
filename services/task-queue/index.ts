/**
 * CR AudioViz AI - Distributed Task Queue System
 * 
 * Main entry point for the distributed task queue system using Redis and Bull.
 * Provides scalable background job processing with automatic retry logic,
 * priority queuing, and worker auto-scaling capabilities.
 * 
 * @fileoverview Distributed task queue microservice
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bull';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { EventEmitter } from 'events';

// Type definitions
interface JobData {
  id: string;
  type: JobType;
  userId: string;
  payload: Record<string, any>;
  priority: JobPriority;
  metadata: JobMetadata;
  createdAt: Date;
}

interface JobMetadata {
  source: string;
  version: string;
  tags: string[];
  estimatedDuration?: number;
  dependencies?: string[];
}

enum JobType {
  AUDIO_ANALYSIS = 'audio_analysis',
  AUDIO_PROCESSING = 'audio_processing',
  VISUALIZATION_GENERATION = 'visualization_generation',
  DATA_ANALYSIS = 'data_analysis',
  FILE_CONVERSION = 'file_conversion',
  ML_INFERENCE = 'ml_inference',
  BATCH_PROCESSING = 'batch_processing'
}

enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
  BACKGROUND = 5
}

enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused'
}

interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    cluster?: boolean;
    nodes?: Array<{ host: string; port: number }>;
  };
  queues: {
    [key: string]: {
      concurrency: number;
      maxRetries: number;
      backoffDelay: number;
      priority: boolean;
    };
  };
  workers: {
    autoScale: boolean;
    minWorkers: number;
    maxWorkers: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
  };
  monitoring: {
    metricsEnabled: boolean;
    healthCheckInterval: number;
    alertingEnabled: boolean;
  };
}

interface WorkerMetrics {
  processed: number;
  failed: number;
  active: number;
  waiting: number;
  delayed: number;
  completed: number;
  throughput: number;
  avgProcessingTime: number;
  errorRate: number;
}

interface RetryOptions {
  maxRetries: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  backoffDelay: number;
  maxBackoffDelay?: number;
  jitter?: boolean;
}

/**
 * Main Task Queue Service Class
 * 
 * Manages distributed task queues with Redis and Bull, providing
 * scalable job processing, retry logic, and worker management.
 */
export class TaskQueueService extends EventEmitter {
  private readonly config: QueueConfig;
  private readonly redis: Redis;
  private readonly supabase: any;
  private readonly logger: Logger;
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly metrics: Map<string, WorkerMetrics> = new Map();
  private isInitialized: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: QueueConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    
    // Initialize Redis connection
    this.redis = this.initializeRedis();
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Initialize Redis connection with cluster support
   */
  private initializeRedis(): Redis {
    try {
      if (this.config.redis.cluster && this.config.redis.nodes) {
        return new Redis.Cluster(this.config.redis.nodes, {
          redisOptions: {
            password: this.config.redis.password,
            retryDelayOnFailover: 1000,
            maxRetriesPerRequest: 3
          }
        });
      } else {
        return new Redis({
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          db: this.config.redis.db,
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: 3
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  /**
   * Initialize the task queue system
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Task Queue Service...');

      // Test Redis connection
      await this.redis.ping();
      this.logger.info('Redis connection established');

      // Initialize queues
      await this.initializeQueues();

      // Initialize workers
      await this.initializeWorkers();

      // Start health monitoring
      if (this.config.monitoring.healthCheckInterval > 0) {
        this.startHealthMonitoring();
      }

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.logger.info('Task Queue Service initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.logger.error('Failed to initialize Task Queue Service:', error);
      throw error;
    }
  }

  /**
   * Initialize all job queues
   */
  private async initializeQueues(): Promise<void> {
    const queueOptions: QueueOptions = {
      redis: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    for (const [queueName, queueConfig] of Object.entries(this.config.queues)) {
      const queue = new Queue(queueName, {
        ...queueOptions,
        defaultJobOptions: {
          ...queueOptions.defaultJobOptions,
          attempts: queueConfig.maxRetries,
          backoff: {
            type: 'exponential',
            delay: queueConfig.backoffDelay
          }
        }
      });

      this.queues.set(queueName, queue);
      this.logger.info(`Queue '${queueName}' initialized`);
    }
  }

  /**
   * Initialize workers for job processing
   */
  private async initializeWorkers(): Promise<void> {
    const workerOptions: WorkerOptions = {
      connection: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db
      },
      limiter: {
        max: 10,
        duration: 1000
      }
    };

    for (const [queueName, queueConfig] of Object.entries(this.config.queues)) {
      const worker = new Worker(
        queueName,
        this.createJobProcessor(queueName),
        {
          ...workerOptions,
          concurrency: queueConfig.concurrency
        }
      );

      // Set up worker event listeners
      this.setupWorkerEventListeners(worker, queueName);

      this.workers.set(queueName, worker);
      this.initializeMetrics(queueName);
      
      this.logger.info(`Worker for '${queueName}' initialized with concurrency: ${queueConfig.concurrency}`);
    }
  }

  /**
   * Create job processor function for a specific queue
   */
  private createJobProcessor(queueName: string) {
    return async (job: Job<JobData>) => {
      const startTime = Date.now();
      
      try {
        this.logger.info(`Processing job ${job.id} of type ${job.data.type} in queue ${queueName}`);
        
        // Update job status to active
        await this.updateJobStatus(job.data.id, JobStatus.ACTIVE, {
          startedAt: new Date(),
          workerId: process.pid.toString()
        });

        // Process job based on type
        const result = await this.processJobByType(job.data);
        
        // Update metrics
        const processingTime = Date.now() - startTime;
        this.updateMetrics(queueName, 'completed', processingTime);

        // Update job status to completed
        await this.updateJobStatus(job.data.id, JobStatus.COMPLETED, {
          completedAt: new Date(),
          result,
          processingTime
        });

        this.logger.info(`Job ${job.id} completed successfully in ${processingTime}ms`);
        return result;

      } catch (error) {
        const processingTime = Date.now() - startTime;
        this.updateMetrics(queueName, 'failed', processingTime);

        // Update job status to failed
        await this.updateJobStatus(job.data.id, JobStatus.FAILED, {
          failedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
          processingTime
        });

        this.logger.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    };
  }

  /**
   * Process job based on its type
   */
  private async processJobByType(jobData: JobData): Promise<any> {
    switch (jobData.type) {
      case JobType.AUDIO_ANALYSIS:
        return await this.processAudioAnalysis(jobData);
      
      case JobType.AUDIO_PROCESSING:
        return await this.processAudioProcessing(jobData);
      
      case JobType.VISUALIZATION_GENERATION:
        return await this.processVisualizationGeneration(jobData);
      
      case JobType.DATA_ANALYSIS:
        return await this.processDataAnalysis(jobData);
      
      case JobType.FILE_CONVERSION:
        return await this.processFileConversion(jobData);
      
      case JobType.ML_INFERENCE:
        return await this.processMLInference(jobData);
      
      case JobType.BATCH_PROCESSING:
        return await this.processBatchProcessing(jobData);
      
      default:
        throw new Error(`Unknown job type: ${jobData.type}`);
    }
  }

  /**
   * Add a job to the queue
   */
  public async addJob(
    queueName: string,
    jobData: Omit<JobData, 'id' | 'createdAt'>,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
      backoff?: any;
    }
  ): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Task Queue Service not initialized');
      }

      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }

      const jobId = `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const completeJobData: JobData = {
        ...jobData,
        id: jobId,
        createdAt: new Date()
      };

      // Store job metadata in Supabase
      await this.storeJobMetadata(completeJobData);

      // Add job to Bull queue
      const job = await queue.add(jobData.type, completeJobData, {
        priority: jobData.priority,
        delay: options?.delay,
        attempts: options?.attempts || this.config.queues[queueName]?.maxRetries || 3,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: this.config.queues[queueName]?.backoffDelay || 2000
        }
      });

      this.logger.info(`Job ${jobId} added to queue ${queueName}`);
      this.emit('jobAdded', { jobId, queueName, type: jobData.type });

      return jobId;

    } catch (error) {
      this.logger.error('Failed to add job to queue:', error);
      throw error;
    }
  }

  /**
   * Get job status and details
   */
  public async getJobStatus(jobId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('job_queue')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Find the job in all queues
      for (const [queueName, queue] of this.queues) {
        const jobs = await queue.getJobs(['waiting', 'active', 'delayed'], 0, -1);
        const job = jobs.find(j => j.data.id === jobId);
        
        if (job) {
          await job.remove();
          await this.updateJobStatus(jobId, JobStatus.FAILED, {
            cancelledAt: new Date(),
            reason: 'Cancelled by user'
          });
          
          this.logger.info(`Job ${jobId} cancelled from queue ${queueName}`);
          this.emit('jobCancelled', { jobId, queueName });
          return true;
        }
      }

      return false;

    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get queue metrics
   */
  public async getQueueMetrics(queueName?: string): Promise<WorkerMetrics | Map<string, WorkerMetrics>> {
    try {
      if (queueName) {
        return this.metrics.get(queueName) || this.createDefaultMetrics();
      } else {
        return new Map(this.metrics);
      }
    } catch (error) {
      this.logger.error('Failed to get queue metrics:', error);
      throw error;
    }
  }

  /**
   * Scale workers for a specific queue
   */
  public async scaleWorkers(queueName: string, targetConcurrency: number): Promise<void> {
    try {
      const worker = this.workers.get(queueName);
      if (!worker) {
        throw new Error(`Worker for queue '${queueName}' not found`);
      }

      // Bull doesn't support dynamic concurrency scaling directly
      // This would require recreating workers or using external scaling
      this.logger.warn(`Worker scaling requested for ${queueName} to ${targetConcurrency} - manual intervention required`);
      
      this.emit('scalingRequested', { queueName, targetConcurrency });

    } catch (error) {
      this.logger.error(`Failed to scale workers for ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Store job metadata in Supabase
   */
  private async storeJobMetadata(jobData: JobData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('job_queue')
        .insert({
          id: jobData.id,
          type: jobData.type,
          user_id: jobData.userId,
          payload: jobData.payload,
          priority: jobData.priority,
          metadata: jobData.metadata,
          status: JobStatus.PENDING,
          created_at: jobData.createdAt.toISOString()
        });

      if (error) throw error;

    } catch (error) {
      this.logger.error('Failed to store job metadata:', error);
      throw error;
    }
  }

  /**
   * Update job status in Supabase
   */
  private async updateJobStatus(
    jobId: string, 
    status: JobStatus, 
    updates: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('job_queue')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...updates
        })
        .eq('id', jobId);

      if (error) throw error;

    } catch (error) {
      this.logger.error(`Failed to update job status for ${jobId}:`, error);
      // Don't throw error to avoid job processing failure
    }
  }

  /**
   * Setup worker event listeners
   */
  private setupWorkerEventListeners(worker: Worker, queueName: string): void {
    worker.on('completed', (job, result) => {
      this.logger.info(`Job ${job.id} completed in queue ${queueName}`);
      this.emit('jobCompleted', { jobId: job.id, queueName, result });
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
      this.emit('jobFailed', { jobId: job?.id, queueName, error: err });
    });

    worker.on('active', (job) => {
      this.logger.info(`Job ${job.id} started processing in queue ${queueName}`);
      this.emit('jobActive', { jobId: job.id, queueName });
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
      this.emit('jobStalled', { jobId, queueName });
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}:`, err);
      this.emit('workerError', { queueName, error: err });
    });
  }

  /**
   * Setup general event listeners
   */
  private setupEventListeners(): void {
    // Handle Redis connection events
    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
      this.emit('redisConnected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
      this.emit('redisError', err);
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.emit('redisClosed');
    });

    // Handle process signals for graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed:', error);
        this.emit('healthCheckFailed', error);
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Perform health check on queues and workers
   */
  private async performHealthCheck(): Promise<void> {
    // Check Redis connection
    await this.redis.ping();

    // Check queue health
    for (const [queueName, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const failed = await queue.getFailed();
      
      // Update metrics
      this.updateQueueMetrics(queueName, {
        waiting: waiting.length,
        active: active.length,
        failed: failed.length
      });
    }

    this.emit('healthCheckCompleted');
  }

  /**
   * Initialize metrics for a queue
   */
  private initializeMetrics(queueName: string): void {
    this.metrics.set(queueName, this.createDefaultMetrics());
  }

  /**
   * Create default metrics object
   */
  private createDefaultMetrics(): WorkerMetrics {
    return {
      processed: 0,
      failed: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
      completed: 0,
      throughput: 0,
      avgProcessingTime: 0,
      errorRate: 0
    };
  }

  /**
   * Update worker metrics
   */
  private updateMetrics(queueName: string, event: 'completed' | 'failed', processingTime?: number): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    if (event === 'completed') {
      metrics.completed++;
      metrics.processed++;
      if (processingTime) {
        metrics.avgProcessingTime = (metrics.avgProcessingTime + processingTime) / 2;
      }
    } else if (event === 'failed') {
      metrics.failed++;
      metrics.processed++;
    }

    // Calculate error rate
    metrics.errorRate = metrics.processed > 0 ? (metrics.failed / metrics.processed) * 100 : 0;

    // Calculate throughput (jobs per second)
    metrics.throughput = metrics.processed / (Date.now() / 1000);

    this.metrics.set(queueName, metrics);
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(queueName: string, updates: Partial<WorkerMetrics>): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    Object.assign(metrics, updates);
    this.metrics.set(queueName, metrics);
  }

  /**
   * Job processing methods (placeholders for actual implementations)
   */
  private async processAudioAnalysis(jobData: JobData): Promise<any> {
    // Implement audio analysis logic
    this.logger.info(`Processing audio analysis job ${jobData.id}`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
    return { type: 'audio_analysis', result: 'completed' };
  }

  private async processAudioProcessing(jobData: JobData): Promise<any> {
    // Implement audio processing logic
    this.logger.info(`Processing audio processing job ${jobData.id}`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
    return { type