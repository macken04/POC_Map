/**
 * Background Job Manager
 * 
 * Manages asynchronous high-resolution map generation jobs.
 * Provides job queuing, status tracking, and completion handling
 * for non-blocking user experience during map purchases.
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class BackgroundJobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // In-memory job storage
    this.isProcessing = false;
    this.processingQueue = [];
    this.maxConcurrentJobs = 1; // Process one at a time to manage resources
    this.jobTimeout = 300000; // 5 minutes timeout per job
    this.persistenceFile = path.join(__dirname, '..', 'jobs', 'generation-queue.json');
    
    // Ensure jobs directory exists
    this.initializeStorage();
    
    console.log('[BackgroundJobManager] Service initialized');
  }

  async initializeStorage() {
    try {
      const jobsDir = path.join(__dirname, '..', 'jobs');
      await fs.mkdir(jobsDir, { recursive: true });
      
      // Load persisted jobs if they exist
      await this.loadPersistedJobs();
      
      console.log('[BackgroundJobManager] Storage initialized');
    } catch (error) {
      console.error('[BackgroundJobManager] Storage initialization failed:', error);
    }
  }

  /**
   * Create a new map generation job
   */
  async createJob(jobData) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      purchaseId: jobData.purchaseId,
      previewId: jobData.previewId,
      status: 'pending',
      mapConfig: jobData.mapConfig,
      printSize: jobData.printSize || 'A4',
      orientation: jobData.orientation || 'portrait',
      filePath: null,
      fileName: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      maxRetries: 2
    };

    this.jobs.set(jobId, job);
    await this.persistJobs();
    
    console.log('[BackgroundJobManager] Created job:', {
      jobId,
      purchaseId: job.purchaseId,
      status: job.status
    });

    // Start processing if not already running
    this.processQueue();
    
    return job;
  }

  /**
   * Get job status
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get job by purchase ID
   */
  getJobByPurchaseId(purchaseId) {
    for (const job of this.jobs.values()) {
      if (job.purchaseId === purchaseId) {
        return job;
      }
    }
    return null;
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.warn('[BackgroundJobManager] Job not found for status update:', jobId);
      return null;
    }

    job.status = status;
    Object.assign(job, additionalData);

    if (status === 'processing') {
      job.startedAt = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date().toISOString();
    }

    this.jobs.set(jobId, job);
    await this.persistJobs();

    console.log('[BackgroundJobManager] Job status updated:', {
      jobId,
      status,
      purchaseId: job.purchaseId
    });

    // Emit event for external listeners
    this.emit('jobStatusChanged', job);

    return job;
  }

  /**
   * Process the job queue
   */
  async processQueue() {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (const job of pendingJobs) {
        if (this.processingQueue.length >= this.maxConcurrentJobs) {
          break; // Wait for current jobs to complete
        }

        this.processingQueue.push(job.id);
        this.processJob(job.id).catch(error => {
          console.error('[BackgroundJobManager] Job processing error:', error);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual job
   */
  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') {
      return;
    }

    try {
      await this.updateJobStatus(jobId, 'processing');

      console.log('[BackgroundJobManager] Starting job processing:', {
        jobId,
        purchaseId: job.purchaseId,
        printSize: job.printSize
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `map_${job.purchaseId}_${timestamp}_${job.printSize}-${job.orientation}.png`;
      const filePath = path.join(__dirname, '..', 'generated-maps', 'completed', fileName);

      // Ensure completed directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Import mapService and generate high-res map
      const mapService = require('./mapService');
      
      // Set timeout for map generation
      const generationPromise = mapService.generateHighResFromPreviewConfig({
        ...job.mapConfig,
        dpi: 300, // Ensure high-res
        fileName: fileName
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout exceeded')), this.jobTimeout);
      });

      const resultPath = await Promise.race([generationPromise, timeoutPromise]);

      // Verify file was created
      const fileExists = await fs.access(resultPath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`Generated file not found: ${resultPath}`);
      }

      // Update job with success
      await this.updateJobStatus(jobId, 'completed', {
        filePath: resultPath,
        fileName: fileName
      });

      console.log('[BackgroundJobManager] Job completed successfully:', {
        jobId,
        fileName,
        filePath: resultPath
      });

    } catch (error) {
      console.error('[BackgroundJobManager] Job failed:', {
        jobId,
        error: error.message,
        retryCount: job.retryCount
      });

      // Check if we should retry
      if (job.retryCount < job.maxRetries) {
        await this.updateJobStatus(jobId, 'pending', {
          retryCount: job.retryCount + 1,
          error: error.message
        });
        
        console.log('[BackgroundJobManager] Job queued for retry:', {
          jobId,
          retryCount: job.retryCount + 1
        });
      } else {
        await this.updateJobStatus(jobId, 'failed', {
          error: error.message
        });
      }
    } finally {
      // Remove from processing queue
      const index = this.processingQueue.indexOf(jobId);
      if (index > -1) {
        this.processingQueue.splice(index, 1);
      }

      // Continue processing other jobs
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Get all jobs with optional status filter
   */
  getJobs(status = null) {
    const allJobs = Array.from(this.jobs.values());
    if (status) {
      return allJobs.filter(job => job.status === status);
    }
    return allJobs;
  }

  /**
   * Clean up old completed jobs
   */
  async cleanup(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const jobsToRemove = [];
    for (const [jobId, job] of this.jobs) {
      if (job.status === 'completed' && new Date(job.completedAt) < cutoffDate) {
        jobsToRemove.push(jobId);
        
        // Clean up file if it exists
        if (job.filePath) {
          try {
            await fs.unlink(job.filePath);
            console.log('[BackgroundJobManager] Cleaned up file:', job.filePath);
          } catch (error) {
            console.warn('[BackgroundJobManager] File cleanup failed:', error.message);
          }
        }
      }
    }

    for (const jobId of jobsToRemove) {
      this.jobs.delete(jobId);
    }

    if (jobsToRemove.length > 0) {
      await this.persistJobs();
      console.log('[BackgroundJobManager] Cleaned up jobs:', jobsToRemove.length);
    }
  }

  /**
   * Persist jobs to disk
   */
  async persistJobs() {
    try {
      const jobsArray = Array.from(this.jobs.values());
      await fs.writeFile(this.persistenceFile, JSON.stringify(jobsArray, null, 2));
    } catch (error) {
      console.error('[BackgroundJobManager] Job persistence failed:', error);
    }
  }

  /**
   * Load persisted jobs from disk
   */
  async loadPersistedJobs() {
    try {
      const data = await fs.readFile(this.persistenceFile, 'utf8');
      const jobsArray = JSON.parse(data);
      
      for (const job of jobsArray) {
        this.jobs.set(job.id, job);
      }
      
      console.log('[BackgroundJobManager] Loaded persisted jobs:', jobsArray.length);
      
      // Resume processing pending jobs
      this.processQueue();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[BackgroundJobManager] Failed to load persisted jobs:', error);
      }
    }
  }

  /**
   * Get system statistics
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      isProcessing: this.isProcessing,
      processingQueue: this.processingQueue.length
    };
  }
}

// Export singleton instance
module.exports = new BackgroundJobManager();