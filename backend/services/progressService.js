/**
 * Progress Service
 * Handles real-time progress tracking for canvas export operations
 * Uses Socket.IO for WebSocket communication
 */

const { Server } = require('socket.io');

class ProgressService {
  constructor() {
    this.io = null;
    this.activeJobs = new Map(); // jobId -> job data
    this.userSockets = new Map(); // userId -> Set of socket ids
    this.socketUsers = new Map(); // socketId -> userId
    this.jobCallbacks = new Map(); // jobId -> cancellation callback
    
    // Progress tracking settings
    this.settings = {
      heartbeatInterval: 5000, // 5 seconds
      jobTimeout: 300000, // 5 minutes
      maxConcurrentJobs: 10,
      enableDetailedLogging: true
    };

    console.log('ProgressService: Initialized');
  }

  /**
   * Initialize Socket.IO with HTTP server
   * @param {http.Server} server - HTTP server instance
   * @param {Object} options - Socket.IO options
   */
  initialize(server, options = {}) {
    const defaultOptions = {
      cors: {
        origin: ["http://localhost:3000", "https://boss-hog-freely.ngrok-free.app", "https://print-my-ride-version-5.myshopify.com"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    };

    this.io = new Server(server, { ...defaultOptions, ...options });
    
    this.io.on('connection', (socket) => {
      console.log(`ProgressService: Client connected (${socket.id})`);
      
      // Handle user authentication
      socket.on('authenticate', (data) => {
        this.authenticateSocket(socket, data);
      });

      // Handle job subscription
      socket.on('subscribe-job', (jobId) => {
        this.subscribeToJob(socket, jobId);
      });

      // Handle job cancellation
      socket.on('cancel-job', (jobId) => {
        this.cancelJob(socket, jobId);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Send initial connection status
      socket.emit('connected', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        server: 'Print My Ride Progress Service'
      });
    });

    console.log('ProgressService: Socket.IO initialized');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    return this.io;
  }

  /**
   * Authenticate socket with user session
   * @param {Socket} socket - Socket.IO socket
   * @param {Object} authData - Authentication data
   */
  authenticateSocket(socket, authData) {
    try {
      const { userId, sessionId } = authData;
      
      if (!userId) {
        socket.emit('auth-error', { error: 'User ID required' });
        return;
      }

      // Store user-socket mapping
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socket.id);
      this.socketUsers.set(socket.id, userId);

      socket.userId = userId;
      socket.sessionId = sessionId;

      socket.emit('authenticated', {
        userId: userId,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });

      // Send any pending job updates
      this.sendPendingUpdates(socket, userId);

      console.log(`ProgressService: User ${userId} authenticated on socket ${socket.id}`);
      
    } catch (error) {
      console.error('ProgressService: Authentication failed:', error);
      socket.emit('auth-error', { error: 'Authentication failed' });
    }
  }

  /**
   * Subscribe socket to job updates
   * @param {Socket} socket - Socket.IO socket
   * @param {string} jobId - Job ID to subscribe to
   */
  subscribeToJob(socket, jobId) {
    if (!socket.userId) {
      socket.emit('subscription-error', { error: 'Authentication required' });
      return;
    }

    const job = this.activeJobs.get(jobId);
    if (!job) {
      socket.emit('subscription-error', { error: 'Job not found', jobId });
      return;
    }

    // Check if user owns this job
    if (job.userId !== socket.userId) {
      socket.emit('subscription-error', { error: 'Unauthorized', jobId });
      return;
    }

    // Join job room
    socket.join(`job-${jobId}`);
    
    // Send current job status
    socket.emit('job-status', {
      jobId: jobId,
      ...this.getJobStatus(jobId)
    });

    console.log(`ProgressService: Socket ${socket.id} subscribed to job ${jobId}`);
  }

  /**
   * Start a new progress tracking job
   * @param {string} jobId - Unique job identifier
   * @param {Object} jobData - Job information
   * @returns {Object} Job tracking object
   */
  startJob(jobId, jobData) {
    if (this.activeJobs.size >= this.settings.maxConcurrentJobs) {
      throw new Error('Maximum concurrent jobs exceeded');
    }

    const job = {
      id: jobId,
      userId: jobData.userId,
      type: jobData.type || 'canvas-export',
      status: 'started',
      progress: 0,
      steps: jobData.steps || [],
      currentStep: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      metadata: jobData.metadata || {},
      cancellable: jobData.cancellable !== false,
      timeoutId: null
    };

    this.activeJobs.set(jobId, job);

    // Set job timeout
    if (this.settings.jobTimeout > 0) {
      job.timeoutId = setTimeout(() => {
        this.timeoutJob(jobId);
      }, this.settings.jobTimeout);
    }

    // Emit job started event
    this.emitToUser(job.userId, 'job-started', {
      jobId: jobId,
      type: job.type,
      steps: job.steps,
      cancellable: job.cancellable
    });

    if (this.settings.enableDetailedLogging) {
      console.log(`ProgressService: Started job ${jobId} for user ${job.userId}`);
    }

    return job;
  }

  /**
   * Update job progress
   * @param {string} jobId - Job identifier
   * @param {Object} update - Progress update data
   */
  updateProgress(jobId, update) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`ProgressService: Job ${jobId} not found for progress update`);
      return;
    }

    // Update job data
    if (update.progress !== undefined) {
      job.progress = Math.max(0, Math.min(100, update.progress));
    }
    
    if (update.currentStep !== undefined) {
      job.currentStep = update.currentStep;
    }
    
    if (update.status !== undefined) {
      job.status = update.status;
    }
    
    if (update.message !== undefined) {
      job.message = update.message;
    }
    
    if (update.metadata !== undefined) {
      job.metadata = { ...job.metadata, ...update.metadata };
    }

    job.lastUpdate = Date.now();

    // Emit progress update
    const progressData = {
      jobId: jobId,
      progress: job.progress,
      status: job.status,
      currentStep: job.currentStep,
      totalSteps: job.steps.length,
      message: job.message,
      elapsedTime: Date.now() - job.startTime,
      metadata: job.metadata
    };

    // Send to job subscribers
    this.io.to(`job-${jobId}`).emit('progress-update', progressData);
    
    // Send to user's other sockets
    this.emitToUser(job.userId, 'job-progress', progressData);

    if (this.settings.enableDetailedLogging) {
      console.log(`ProgressService: Updated job ${jobId} - ${job.progress}% (${job.status})`);
    }
  }

  /**
   * Complete a job
   * @param {string} jobId - Job identifier
   * @param {Object} result - Job completion result
   */
  completeJob(jobId, result = {}) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`ProgressService: Job ${jobId} not found for completion`);
      return;
    }

    // Clear timeout
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    // Update job status
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = Date.now();
    job.result = result;

    const completionData = {
      jobId: jobId,
      status: 'completed',
      progress: 100,
      elapsedTime: job.completedAt - job.startTime,
      result: result
    };

    // Emit completion events
    this.io.to(`job-${jobId}`).emit('job-completed', completionData);
    this.emitToUser(job.userId, 'job-completed', completionData);

    // Clean up job after delay
    setTimeout(() => {
      this.cleanupJob(jobId);
    }, 30000); // Keep job data for 30 seconds after completion

    console.log(`ProgressService: Completed job ${jobId} in ${completionData.elapsedTime}ms`);
  }

  /**
   * Fail a job with error
   * @param {string} jobId - Job identifier
   * @param {Error|string} error - Error information
   */
  failJob(jobId, error) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.warn(`ProgressService: Job ${jobId} not found for failure`);
      return;
    }

    // Clear timeout
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    // Update job status
    job.status = 'failed';
    job.failedAt = Date.now();
    job.error = error instanceof Error ? error.message : error;

    const failureData = {
      jobId: jobId,
      status: 'failed',
      progress: job.progress,
      error: job.error,
      elapsedTime: job.failedAt - job.startTime
    };

    // Emit failure events
    this.io.to(`job-${jobId}`).emit('job-failed', failureData);
    this.emitToUser(job.userId, 'job-failed', failureData);

    // Clean up job after delay
    setTimeout(() => {
      this.cleanupJob(jobId);
    }, 60000); // Keep failed job data for 1 minute

    console.error(`ProgressService: Failed job ${jobId}:`, job.error);
  }

  /**
   * Cancel a job
   * @param {Socket} socket - Requesting socket
   * @param {string} jobId - Job identifier
   */
  cancelJob(socket, jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      socket.emit('cancel-error', { error: 'Job not found', jobId });
      return;
    }

    // Check authorization
    if (job.userId !== socket.userId) {
      socket.emit('cancel-error', { error: 'Unauthorized', jobId });
      return;
    }

    // Check if cancellable
    if (!job.cancellable) {
      socket.emit('cancel-error', { error: 'Job not cancellable', jobId });
      return;
    }

    // Execute cancellation callback if exists
    const callback = this.jobCallbacks.get(jobId);
    if (callback) {
      try {
        callback();
        this.jobCallbacks.delete(jobId);
      } catch (error) {
        console.error(`ProgressService: Error executing cancel callback for job ${jobId}:`, error);
      }
    }

    // Update job status
    job.status = 'cancelled';
    job.cancelledAt = Date.now();

    const cancellationData = {
      jobId: jobId,
      status: 'cancelled',
      progress: job.progress,
      elapsedTime: job.cancelledAt - job.startTime
    };

    // Emit cancellation events
    this.io.to(`job-${jobId}`).emit('job-cancelled', cancellationData);
    this.emitToUser(job.userId, 'job-cancelled', cancellationData);

    // Clean up job immediately
    this.cleanupJob(jobId);

    console.log(`ProgressService: Cancelled job ${jobId}`);
  }

  /**
   * Set cancellation callback for job
   * @param {string} jobId - Job identifier
   * @param {Function} callback - Cancellation callback
   */
  setCancellationCallback(jobId, callback) {
    if (typeof callback === 'function') {
      this.jobCallbacks.set(jobId, callback);
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job identifier
   * @returns {Object|null} Job status
   */
  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      totalSteps: job.steps.length,
      message: job.message,
      elapsedTime: Date.now() - job.startTime,
      cancellable: job.cancellable,
      metadata: job.metadata
    };
  }

  /**
   * Get all jobs for user
   * @param {string} userId - User identifier
   * @returns {Array} User's jobs
   */
  getUserJobs(userId) {
    const userJobs = [];
    
    for (const [jobId, job] of this.activeJobs) {
      if (job.userId === userId) {
        userJobs.push(this.getJobStatus(jobId));
      }
    }
    
    return userJobs;
  }

  /**
   * Emit event to all user's sockets
   * @param {string} userId - User identifier
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToUser(userId, event, data) {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      });
    }
  }

  /**
   * Send pending updates to newly connected socket
   * @param {Socket} socket - Socket instance
   * @param {string} userId - User identifier
   */
  sendPendingUpdates(socket, userId) {
    const userJobs = this.getUserJobs(userId);
    if (userJobs.length > 0) {
      socket.emit('pending-jobs', userJobs);
    }
  }

  /**
   * Handle socket disconnection
   * @param {Socket} socket - Disconnected socket
   * @param {string} reason - Disconnection reason
   */
  handleDisconnect(socket, reason) {
    const userId = this.socketUsers.get(socket.id);
    
    if (userId) {
      // Remove socket from user's socket set
      const userSocketIds = this.userSockets.get(userId);
      if (userSocketIds) {
        userSocketIds.delete(socket.id);
        if (userSocketIds.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      
      // Remove socket from socketUsers map
      this.socketUsers.delete(socket.id);
    }

    console.log(`ProgressService: Client disconnected (${socket.id}), reason: ${reason}`);
  }

  /**
   * Timeout a job
   * @param {string} jobId - Job identifier
   */
  timeoutJob(jobId) {
    this.failJob(jobId, 'Job timed out');
  }

  /**
   * Clean up completed/failed job
   * @param {string} jobId - Job identifier
   */
  cleanupJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      // Clear timeout if exists
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
      // Remove cancellation callback
      this.jobCallbacks.delete(jobId);
      
      // Remove all sockets from job room
      this.io.in(`job-${jobId}`).socketsLeave(`job-${jobId}`);
      
      if (this.settings.enableDetailedLogging) {
        console.log(`ProgressService: Cleaned up job ${jobId}`);
      }
    }
  }

  /**
   * Start cleanup interval for orphaned jobs
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes
      
      for (const [jobId, job] of this.activeJobs) {
        // Clean up very old jobs that might be orphaned
        if (now - job.lastUpdate > staleThreshold) {
          console.warn(`ProgressService: Cleaning up stale job ${jobId}`);
          this.cleanupJob(jobId);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      activeJobs: this.activeJobs.size,
      connectedUsers: this.userSockets.size,
      totalSockets: this.socketUsers.size,
      settings: this.settings,
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown service gracefully
   */
  shutdown() {
    console.log('ProgressService: Shutting down...');
    
    // Cancel all active jobs
    for (const [jobId, job] of this.activeJobs) {
      this.cancelJob({ userId: job.userId }, jobId);
    }
    
    // Close Socket.IO server
    if (this.io) {
      this.io.close();
    }
    
    console.log('ProgressService: Shutdown complete');
  }
}

module.exports = ProgressService;