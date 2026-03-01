/**
 * Async Job Processor
 * 
 * Handles long-running tasks asynchronously to avoid blocking API requests
 * Supports job queuing, retry logic, and progress tracking
 */

import { Logger } from 'winston';
import { EventEmitter } from 'events';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  result?: any;
  status: JobStatus;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export interface JobHandler<T = any, R = any> {
  type: string;
  handler: (data: T, job: Job<T>) => Promise<R>;
  maxRetries?: number;
  timeout?: number; // milliseconds
}

export interface AsyncJobProcessorConfig {
  concurrency: number; // Number of concurrent jobs
  pollInterval: number; // milliseconds
  defaultTimeout: number; // milliseconds
  defaultMaxRetries: number;
}

/**
 * Async Job Processor
 * 
 * Processes jobs asynchronously with retry logic and progress tracking
 */
export class AsyncJobProcessor extends EventEmitter {
  private config: AsyncJobProcessorConfig;
  private logger: Logger;
  private handlers: Map<string, JobHandler>;
  private jobs: Map<string, Job>;
  private queue: string[]; // Job IDs in priority order
  private running: Set<string>; // Currently running job IDs
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: AsyncJobProcessorConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.handlers = new Map();
    this.jobs = new Map();
    this.queue = [];
    this.running = new Set();
  }

  /**
   * Register a job handler
   */
  registerHandler<T = any, R = any>(handler: JobHandler<T, R>): void {
    this.handlers.set(handler.type, handler);
    this.logger.info(`Registered job handler: ${handler.type}`);
  }

  /**
   * Add a job to the queue
   */
  async addJob<T = any>(
    type: string,
    data: T,
    options: {
      priority?: number;
      maxRetries?: number;
    } = {},
  ): Promise<string> {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    const jobId = this.generateJobId();
    const job: Job<T> = {
      id: jobId,
      type,
      data,
      priority: options.priority ?? 0,
      retries: 0,
      maxRetries: options.maxRetries ?? handler.maxRetries ?? this.config.defaultMaxRetries,
      createdAt: new Date(),
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    this.enqueue(jobId);

    this.logger.info(`Job added: ${jobId}`, { type, priority: job.priority });
    this.emit('job:added', job);

    return jobId;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.isProcessing) {
      this.logger.warn('Job processor already running');
      return;
    }

    this.isProcessing = true;
    this.logger.info('Starting async job processor', {
      concurrency: this.config.concurrency,
      pollInterval: this.config.pollInterval,
    });

    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, this.config.pollInterval);

    // Process immediately
    this.processJobs();
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for running jobs to complete
    const runningJobs = Array.from(this.running);
    if (runningJobs.length > 0) {
      this.logger.info(`Waiting for ${runningJobs.length} running jobs to complete...`);
      
      // Wait up to 30 seconds for jobs to complete
      const timeout = 30000;
      const startTime = Date.now();
      
      while (this.running.size > 0 && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.info('Async job processor stopped');
  }

  /**
   * Process jobs from queue
   */
  private async processJobs(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    // Check if we can process more jobs
    while (this.running.size < this.config.concurrency && this.queue.length > 0) {
      const jobId = this.dequeue();
      if (!jobId) {
        break;
      }

      const job = this.jobs.get(jobId);
      if (!job) {
        continue;
      }

      // Process job
      this.processJob(job);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.logger.error(`No handler for job type: ${job.type}`, { jobId: job.id });
      job.status = 'failed';
      job.failedAt = new Date();
      job.error = `No handler registered for job type: ${job.type}`;
      this.emit('job:failed', job);
      return;
    }

    this.running.add(job.id);
    job.status = 'running';
    job.startedAt = new Date();
    
    this.logger.info(`Processing job: ${job.id}`, { type: job.type });
    this.emit('job:started', job);

    try {
      // Set timeout
      const timeout = handler.timeout ?? this.config.defaultTimeout;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), timeout);
      });

      // Execute handler with timeout
      const result = await Promise.race([
        handler.handler(job.data, job),
        timeoutPromise,
      ]);

      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      
      this.logger.info(`Job completed: ${job.id}`, { type: job.type });
      this.emit('job:completed', job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Job failed: ${job.id}`, {
        type: job.type,
        error: errorMessage,
        retries: job.retries,
      });

      // Check if we should retry
      if (job.retries < job.maxRetries) {
        job.retries++;
        job.status = 'retrying';
        
        this.logger.info(`Retrying job: ${job.id}`, {
          attempt: job.retries,
          maxRetries: job.maxRetries,
        });
        
        // Re-queue job with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, job.retries), 30000);
        setTimeout(() => {
          this.enqueue(job.id);
        }, delay);
        
        this.emit('job:retrying', job);
      } else {
        // Max retries reached
        job.status = 'failed';
        job.failedAt = new Date();
        job.error = errorMessage;
        
        this.emit('job:failed', job);
      }
    } finally {
      this.running.delete(job.id);
    }
  }

  /**
   * Enqueue a job (priority queue)
   */
  private enqueue(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    // Insert job in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      const queuedJob = this.jobs.get(this.queue[i]);
      if (queuedJob && job.priority > queuedJob.priority) {
        this.queue.splice(i, 0, jobId);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(jobId);
    }
  }

  /**
   * Dequeue a job
   */
  private dequeue(): string | undefined {
    return this.queue.shift();
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    retrying: number;
    queueLength: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      retrying: jobs.filter(j => j.status === 'retrying').length,
      queueLength: this.queue.length,
    };
  }

  /**
   * Clear completed and failed jobs
   */
  clearFinishedJobs(olderThan?: Date): void {
    const cutoff = olderThan ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        (job.completedAt || job.failedAt) &&
        (job.completedAt || job.failedAt)! < cutoff
      ) {
        this.jobs.delete(jobId);
      }
    }
  }
}

/**
 * Pre-defined job types for common long-running tasks
 */
export const JobTypes = {
  COST_ANOMALY_DETECTION: 'cost:anomaly:detection',
  SCORECARD_CALCULATION: 'maturity:scorecard:calculation',
  DORA_METRICS_CALCULATION: 'dora:metrics:calculation',
  BULK_SCORECARD_UPDATE: 'maturity:scorecard:bulk-update',
  COST_REPORT_GENERATION: 'cost:report:generation',
};
