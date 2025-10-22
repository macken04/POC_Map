/**
 * Progress Tracker Client
 * Handles real-time progress tracking via WebSocket connection
 * Integrates with Print My Ride canvas export system
 */

(function(global) {
  'use strict';

  class ProgressTracker {
    constructor(options = {}) {
      this.options = {
        serverUrl: options.serverUrl || window.location.origin,
        autoConnect: options.autoConnect !== false,
        reconnectAttempts: options.reconnectAttempts || 5,
        reconnectDelay: options.reconnectDelay || 1000,
        debug: options.debug || false,
        ...options
      };

      this.socket = null;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.reconnectCount = 0;
      this.userId = null;
      this.sessionId = null;
      
      // Event handlers
      this.eventHandlers = {
        connected: [],
        authenticated: [],
        disconnected: [],
        'job-started': [],
        'progress-update': [],
        'job-completed': [],
        'job-failed': [],
        'job-cancelled': [],
        error: []
      };

      // Active job subscriptions
      this.activeJobs = new Map();
      
      this.log('ProgressTracker initialized');

      if (this.options.autoConnect) {
        this.connect();
      }
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
      if (this.socket && this.socket.connected) {
        this.log('Already connected');
        return;
      }

      this.log('Connecting to progress service...');

      try {
        // Load Socket.IO client library dynamically if not available
        if (typeof io === 'undefined') {
          this.loadSocketIO().then(() => {
            this.initializeSocket();
          });
        } else {
          this.initializeSocket();
        }
      } catch (error) {
        this.log('Connection failed:', error);
        this.emit('error', { type: 'connection', error: error.message });
      }
    }

    /**
     * Load Socket.IO client library
     */
    loadSocketIO() {
      return new Promise((resolve, reject) => {
        if (typeof io !== 'undefined') {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Socket.IO client'));
        document.head.appendChild(script);
      });
    }

    /**
     * Initialize Socket.IO connection
     */
    initializeSocket() {
      this.socket = io(this.options.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      // Connection events
      this.socket.on('connect', () => {
        this.log('Connected to server');
        this.isConnected = true;
        this.reconnectCount = 0;
        this.emit('connected', { socketId: this.socket.id });
      });

      this.socket.on('disconnect', (reason) => {
        this.log('Disconnected:', reason);
        this.isConnected = false;
        this.isAuthenticated = false;
        this.emit('disconnected', { reason });
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.attemptReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        this.log('Connection error:', error);
        this.emit('error', { type: 'connection', error: error.message });
        this.attemptReconnect();
      });

      // Authentication events
      this.socket.on('authenticated', (data) => {
        this.log('Authenticated:', data);
        this.isAuthenticated = true;
        this.emit('authenticated', data);
      });

      this.socket.on('auth-error', (data) => {
        this.log('Authentication error:', data);
        this.emit('error', { type: 'authentication', error: data.error });
      });

      // Job progress events
      this.socket.on('job-started', (data) => {
        this.log('Job started:', data);
        this.activeJobs.set(data.jobId, { ...data, status: 'started' });
        this.emit('job-started', data);
      });

      this.socket.on('progress-update', (data) => {
        this.log('Progress update:', data);
        if (this.activeJobs.has(data.jobId)) {
          this.activeJobs.set(data.jobId, { ...this.activeJobs.get(data.jobId), ...data });
        }
        this.emit('progress-update', data);
      });

      this.socket.on('job-completed', (data) => {
        this.log('Job completed:', data);
        if (this.activeJobs.has(data.jobId)) {
          this.activeJobs.set(data.jobId, { ...this.activeJobs.get(data.jobId), ...data, status: 'completed' });
        }
        this.emit('job-completed', data);
      });

      this.socket.on('job-failed', (data) => {
        this.log('Job failed:', data);
        if (this.activeJobs.has(data.jobId)) {
          this.activeJobs.set(data.jobId, { ...this.activeJobs.get(data.jobId), ...data, status: 'failed' });
        }
        this.emit('job-failed', data);
      });

      this.socket.on('job-cancelled', (data) => {
        this.log('Job cancelled:', data);
        if (this.activeJobs.has(data.jobId)) {
          this.activeJobs.delete(data.jobId);
        }
        this.emit('job-cancelled', data);
      });

      // Subscription events
      this.socket.on('subscription-error', (data) => {
        this.log('Subscription error:', data);
        this.emit('error', { type: 'subscription', error: data.error, jobId: data.jobId });
      });

      // Pending jobs for reconnection
      this.socket.on('pending-jobs', (jobs) => {
        this.log('Received pending jobs:', jobs);
        jobs.forEach(job => {
          this.activeJobs.set(job.id, job);
          this.emit('job-started', job);
        });
      });
    }

    /**
     * Authenticate with server
     * @param {string} userId - User identifier
     * @param {string} sessionId - Session identifier
     */
    authenticate(userId, sessionId) {
      if (!this.isConnected) {
        this.log('Not connected, cannot authenticate');
        return false;
      }

      this.userId = userId;
      this.sessionId = sessionId;

      this.log('Authenticating...', { userId, sessionId });
      this.socket.emit('authenticate', { userId, sessionId });
      return true;
    }

    /**
     * Subscribe to job progress updates
     * @param {string} jobId - Job identifier
     */
    subscribeToJob(jobId) {
      if (!this.isAuthenticated) {
        this.log('Not authenticated, cannot subscribe to job');
        return false;
      }

      this.log('Subscribing to job:', jobId);
      this.socket.emit('subscribe-job', jobId);
      return true;
    }

    /**
     * Cancel a job
     * @param {string} jobId - Job identifier
     */
    cancelJob(jobId) {
      if (!this.isAuthenticated) {
        this.log('Not authenticated, cannot cancel job');
        return false;
      }

      this.log('Cancelling job:', jobId);
      this.socket.emit('cancel-job', jobId);
      return true;
    }

    /**
     * Get active job status
     * @param {string} jobId - Job identifier
     * @returns {Object|null} Job status
     */
    getJobStatus(jobId) {
      return this.activeJobs.get(jobId) || null;
    }

    /**
     * Get all active jobs
     * @returns {Array} Array of active jobs
     */
    getActiveJobs() {
      return Array.from(this.activeJobs.values());
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(handler);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler to remove
     */
    off(event, handler) {
      if (this.eventHandlers[event]) {
        const index = this.eventHandlers[event].indexOf(handler);
        if (index > -1) {
          this.eventHandlers[event].splice(index, 1);
        }
      }
    }

    /**
     * Emit event to handlers
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            this.log('Event handler error:', error);
          }
        });
      }
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
      if (this.reconnectCount >= this.options.reconnectAttempts) {
        this.log('Max reconnection attempts reached');
        this.emit('error', { type: 'reconnection', error: 'Max attempts reached' });
        return;
      }

      this.reconnectCount++;
      const delay = this.options.reconnectDelay * this.reconnectCount;
      
      this.log(`Attempting reconnection ${this.reconnectCount}/${this.options.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, delay);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
      this.log('Disconnecting...');
      
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.isConnected = false;
      this.isAuthenticated = false;
      this.activeJobs.clear();
    }

    /**
     * Get connection status
     * @returns {Object} Connection status
     */
    getStatus() {
      return {
        isConnected: this.isConnected,
        isAuthenticated: this.isAuthenticated,
        userId: this.userId,
        sessionId: this.sessionId,
        activeJobs: this.activeJobs.size,
        socketId: this.socket ? this.socket.id : null
      };
    }

    /**
     * Log debug messages
     * @param {...any} args - Log arguments
     */
    log(...args) {
      if (this.options.debug) {
        console.log('[ProgressTracker]', ...args);
      }
    }

    /**
     * Create progress UI component
     * @param {HTMLElement} container - Container element
     * @param {Object} options - UI options
     * @returns {Object} Progress UI controller
     */
    createProgressUI(container, options = {}) {
      const ui = new ProgressUI(container, {
        theme: options.theme || 'default',
        showDetails: options.showDetails !== false,
        showCancel: options.showCancel !== false,
        ...options
      });

      // Connect UI to progress events
      this.on('job-started', (data) => ui.showProgress(data));
      this.on('progress-update', (data) => ui.updateProgress(data));
      this.on('job-completed', (data) => ui.showComplete(data));
      this.on('job-failed', (data) => ui.showError(data));
      this.on('job-cancelled', (data) => ui.showCancelled(data));

      return ui;
    }
  }

  /**
   * Progress UI Component
   * Creates and manages progress display elements
   */
  class ProgressUI {
    constructor(container, options = {}) {
      this.container = container;
      this.options = options;
      this.currentJobId = null;
      this.progressElement = null;
    }

    showProgress(jobData) {
      this.currentJobId = jobData.jobId;
      this.createProgressElement(jobData);
    }

    updateProgress(data) {
      if (data.jobId !== this.currentJobId || !this.progressElement) return;
      
      const progressBar = this.progressElement.querySelector('.progress-bar');
      const progressText = this.progressElement.querySelector('.progress-text');
      const stepText = this.progressElement.querySelector('.step-text');
      
      if (progressBar) {
        progressBar.style.width = `${data.progress}%`;
        progressBar.setAttribute('aria-valuenow', data.progress);
      }
      
      if (progressText) {
        progressText.textContent = `${data.progress}%`;
      }
      
      if (stepText && data.message) {
        stepText.textContent = data.message;
      }
    }

    showComplete(data) {
      if (data.jobId !== this.currentJobId) return;
      
      const progressContainer = this.progressElement.querySelector('.progress-container');
      if (progressContainer) {
        progressContainer.innerHTML = `
          <div class="progress-complete">
            <div class="success-icon">✓</div>
            <div class="success-message">Export completed successfully!</div>
            ${data.result && data.result.downloadUrl ? 
              `<a href="${data.result.downloadUrl}" class="download-link" download>Download Map</a>` : 
              ''
            }
          </div>
        `;
      }
      
      // Auto-hide after 5 seconds
      setTimeout(() => this.hide(), 5000);
    }

    showError(data) {
      if (data.jobId !== this.currentJobId) return;
      
      const progressContainer = this.progressElement.querySelector('.progress-container');
      if (progressContainer) {
        progressContainer.innerHTML = `
          <div class="progress-error">
            <div class="error-icon">✗</div>
            <div class="error-message">Export failed: ${data.error}</div>
            <button class="retry-button" onclick="window.location.reload()">Try Again</button>
          </div>
        `;
      }
    }

    showCancelled(data) {
      if (data.jobId !== this.currentJobId) return;
      
      const progressContainer = this.progressElement.querySelector('.progress-container');
      if (progressContainer) {
        progressContainer.innerHTML = `
          <div class="progress-cancelled">
            <div class="cancelled-message">Export cancelled</div>
          </div>
        `;
      }
      
      setTimeout(() => this.hide(), 3000);
    }

    createProgressElement(jobData) {
      this.progressElement = document.createElement('div');
      this.progressElement.className = 'progress-tracker';
      this.progressElement.innerHTML = `
        <div class="progress-container">
          <div class="progress-header">
            <span class="progress-title">Exporting Map...</span>
            <span class="progress-text">0%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <div class="step-text">Starting export...</div>
          ${this.options.showCancel ? '<button class="cancel-button">Cancel</button>' : ''}
        </div>
      `;
      
      // Add CSS styles
      this.addStyles();
      
      // Add cancel handler
      if (this.options.showCancel) {
        const cancelButton = this.progressElement.querySelector('.cancel-button');
        if (cancelButton) {
          cancelButton.addEventListener('click', () => {
            if (window.progressTracker) {
              window.progressTracker.cancelJob(this.currentJobId);
            }
          });
        }
      }
      
      this.container.appendChild(this.progressElement);
    }

    addStyles() {
      if (document.getElementById('progress-tracker-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'progress-tracker-styles';
      styles.textContent = `
        .progress-tracker {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin: 10px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-family: Arial, sans-serif;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .progress-title {
          font-weight: bold;
          color: #333;
        }
        .progress-text {
          color: #666;
          font-size: 14px;
        }
        .progress-bar-container {
          background: #f0f0f0;
          border-radius: 4px;
          height: 8px;
          margin-bottom: 10px;
          overflow: hidden;
        }
        .progress-bar {
          background: linear-gradient(90deg, #4CAF50, #45a049);
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 4px;
        }
        .step-text {
          color: #666;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .progress-complete {
          text-align: center;
          color: #4CAF50;
        }
        .success-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .success-message {
          font-size: 16px;
          margin-bottom: 15px;
        }
        .download-link {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 4px;
          font-weight: bold;
        }
        .progress-error {
          text-align: center;
          color: #f44336;
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .retry-button, .cancel-button {
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .cancel-button {
          background: #f44336;
          float: right;
        }
        .retry-button:hover, .cancel-button:hover {
          opacity: 0.8;
        }
      `;
      document.head.appendChild(styles);
    }

    hide() {
      if (this.progressElement) {
        this.progressElement.remove();
        this.progressElement = null;
        this.currentJobId = null;
      }
    }
  }

  // Export classes
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProgressTracker, ProgressUI };
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return { ProgressTracker, ProgressUI }; });
  } else {
    global.ProgressTracker = ProgressTracker;
    global.ProgressUI = ProgressUI;
  }

})(typeof window !== 'undefined' ? window : this);