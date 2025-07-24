/**
 * Performance Monitoring Service
 * Comprehensive monitoring for large dataset processing, request timeouts,
 * memory usage, and performance bottlenecks in route rendering operations.
 * 
 * Features:
 * - Request processing time tracking
 * - Memory usage monitoring and alerts
 * - Large dataset processing optimization
 * - Timeout handling with graceful degradation
 * - Performance metrics collection and analysis
 * - Automatic performance recommendations
 */

const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = Object.assign({
      // Performance thresholds
      slowRequestThreshold: 5000, // 5 seconds
      memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
      memoryCriticalThreshold: 200 * 1024 * 1024, // 200MB
      maxRequestTimeout: 30000, // 30 seconds
      
      // Large dataset settings
      largeDatasetThreshold: 10000, // 10k coordinates
      massiveDatasetThreshold: 50000, // 50k coordinates
      maxCoordinatesPerRequest: 100000, // 100k coordinates
      
      // Monitoring settings
      enableRealTimeMonitoring: true,
      metricsCollectionInterval: 60000, // 1 minute
      performanceHistorySize: 1000,
      enableMemoryProfiling: process.env.NODE_ENV === 'development',
      
      // Alert settings
      enablePerformanceAlerts: true,
      alertThresholds: {
        consecutiveSlowRequests: 5,
        memoryLeakDetection: true,
        highCpuUsage: 80 // 80% CPU usage
      },
      
      // Optimization settings
      enableAutoOptimization: true,
      coordinateSimplificationFactor: 0.5, // Reduce by 50% when needed
      enableProgressiveProcessing: true,
      maxProcessingBatchSize: 5000
    }, options);

    // Performance tracking data
    this.metrics = {
      requests: new Map(),
      activeRequests: new Set(),
      performanceHistory: [],
      memorySnapshots: [],
      slowRequests: [],
      errors: []
    };

    // System monitoring
    this.systemMetrics = {
      startTime: Date.now(),
      totalRequests: 0,
      totalSlowRequests: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      currentMemoryUsage: 0
    };

    // Performance optimization cache
    this.optimizationCache = new Map();
    
    // Initialize monitoring
    this.initializeMonitoring();
    
    console.log('PerformanceMonitor initialized with options:', this.options);
  }

  /**
   * Initialize performance monitoring systems
   */
  initializeMonitoring() {
    if (this.options.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
    
    // Set up process monitoring
    this.setupProcessMonitoring();
    
    // Set up automatic cleanup
    this.setupPeriodicCleanup();
  }

  /**
   * Start real-time performance monitoring
   */
  startRealTimeMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.analyzePerformanceTrends();
      this.checkPerformanceAlerts();
    }, this.options.metricsCollectionInterval);
    
    console.log('Real-time performance monitoring started');
  }

  /**
   * Setup process-level monitoring
   */
  setupProcessMonitoring() {
    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.recordError('uncaught_exception', error);
    });
    
    // Monitor unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      this.recordError('unhandled_rejection', { message: reason });
    });
    
    // Monitor memory warnings
    if (process.memoryUsage) {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        this.checkMemoryUsage(memUsage);
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Setup periodic cleanup of old data
   */
  setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Start monitoring a request
   * @param {string} requestId - Unique request identifier
   * @param {Object} context - Request context information
   * @returns {Object} Request monitoring object
   */
  startRequest(requestId, context = {}) {
    const monitoring = {
      requestId: requestId,
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      context: context,
      phases: [],
      warnings: [],
      status: 'active'
    };
    
    this.metrics.requests.set(requestId, monitoring);
    this.metrics.activeRequests.add(requestId);
    this.systemMetrics.totalRequests++;
    
    // Set timeout if specified
    if (context.timeout) {
      monitoring.timeoutId = setTimeout(() => {
        this.handleRequestTimeout(requestId);
      }, context.timeout);
    }
    
    this.emit('requestStarted', monitoring);
    return monitoring;
  }

  /**
   * Record a processing phase for a request
   * @param {string} requestId - Request identifier
   * @param {string} phaseName - Name of the processing phase
   * @param {Object} phaseData - Additional phase data
   */
  recordPhase(requestId, phaseName, phaseData = {}) {
    const monitoring = this.metrics.requests.get(requestId);
    if (!monitoring) return;
    
    const phase = {
      name: phaseName,
      startTime: Date.now(),
      duration: null,
      data: phaseData,
      memoryUsage: process.memoryUsage()
    };
    
    // End previous phase if exists
    if (monitoring.phases.length > 0) {
      const lastPhase = monitoring.phases[monitoring.phases.length - 1];
      if (!lastPhase.duration) {
        lastPhase.duration = phase.startTime - lastPhase.startTime;
      }
    }
    
    monitoring.phases.push(phase);
    
    // Check for performance warnings
    this.checkPhasePerformance(requestId, phase);
    
    this.emit('phaseRecorded', { requestId, phase });
  }

  /**
   * Record a performance warning for a request
   * @param {string} requestId - Request identifier
   * @param {string} warningType - Type of warning
   * @param {Object} details - Warning details
   */
  recordWarning(requestId, warningType, details = {}) {
    const monitoring = this.metrics.requests.get(requestId);
    if (!monitoring) return;
    
    const warning = {
      type: warningType,
      timestamp: Date.now(),
      details: details,
      phase: monitoring.phases.length > 0 ? 
        monitoring.phases[monitoring.phases.length - 1].name : 'unknown'
    };
    
    monitoring.warnings.push(warning);
    
    this.emit('performanceWarning', { requestId, warning });
    
    console.warn(`Performance warning for request ${requestId}: ${warningType}`, details);
  }

  /**
   * End monitoring for a request
   * @param {string} requestId - Request identifier
   * @param {Object} result - Request result information
   * @returns {Object} Performance summary
   */
  endRequest(requestId, result = {}) {
    const monitoring = this.metrics.requests.get(requestId);
    if (!monitoring) return null;
    
    // Clear timeout if exists
    if (monitoring.timeoutId) {
      clearTimeout(monitoring.timeoutId);
    }
    
    // Complete timing
    monitoring.endTime = Date.now();
    monitoring.totalDuration = monitoring.endTime - monitoring.startTime;
    monitoring.endMemory = process.memoryUsage();
    monitoring.memoryDelta = monitoring.endMemory.heapUsed - monitoring.startMemory.heapUsed;
    monitoring.status = result.success ? 'completed' : 'failed';
    monitoring.result = result;
    
    // End last phase if needed
    if (monitoring.phases.length > 0) {
      const lastPhase = monitoring.phases[monitoring.phases.length - 1];
      if (!lastPhase.duration) {
        lastPhase.duration = monitoring.endTime - lastPhase.startTime;
      }
    }
    
    // Remove from active requests
    this.metrics.activeRequests.delete(requestId);
    
    // Create performance summary
    const summary = this.createPerformanceSummary(monitoring);
    
    // Add to history
    this.metrics.performanceHistory.push(summary);
    
    // Trim history if too large
    if (this.metrics.performanceHistory.length > this.options.performanceHistorySize) {
      this.metrics.performanceHistory.shift();
    }
    
    // Update system metrics
    this.updateSystemMetrics(summary);
    
    // Check if this was a slow request
    if (summary.totalDuration > this.options.slowRequestThreshold) {
      this.handleSlowRequest(summary);
    }
    
    this.emit('requestCompleted', summary);
    
    return summary;
  }

  /**
   * Monitor large dataset processing
   * @param {string} requestId - Request identifier
   * @param {Array} dataset - Dataset being processed
   * @param {string} datasetType - Type of dataset (coordinates, activities, etc.)
   * @returns {Object} Dataset analysis and recommendations
   */
  monitorLargeDataset(requestId, dataset, datasetType = 'coordinates') {
    const analysis = {
      size: Array.isArray(dataset) ? dataset.length : (dataset.size || 0),
      type: datasetType,
      isLarge: false,
      isMassive: false,
      recommendations: [],
      estimatedProcessingTime: 0,
      memoryEstimate: 0
    };
    
    // Analyze dataset size
    if (analysis.size > this.options.largeDatasetThreshold) {
      analysis.isLarge = true;
      this.recordWarning(requestId, 'large_dataset', {
        size: analysis.size,
        type: datasetType,
        threshold: this.options.largeDatasetThreshold
      });
    }
    
    if (analysis.size > this.options.massiveDatasetThreshold) {
      analysis.isMassive = true;
      this.recordWarning(requestId, 'massive_dataset', {
        size: analysis.size,
        type: datasetType,
        threshold: this.options.massiveDatasetThreshold
      });
    }
    
    // Generate processing estimates
    analysis.estimatedProcessingTime = this.estimateProcessingTime(analysis.size, datasetType);
    analysis.memoryEstimate = this.estimateMemoryUsage(analysis.size, datasetType);
    
    // Generate recommendations
    analysis.recommendations = this.generateDatasetRecommendations(analysis);
    
    // Record the analysis
    this.recordPhase(requestId, 'dataset_analysis', analysis);
    
    return analysis;
  }

  /**
   * Process dataset with performance optimization
   * @param {string} requestId - Request identifier
   * @param {Array} dataset - Dataset to process
   * @param {Function} processingFunction - Function to process the data
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processWithOptimization(requestId, dataset, processingFunction, options = {}) {
    const analysis = this.monitorLargeDataset(requestId, dataset, options.datasetType);
    
    this.recordPhase(requestId, 'optimized_processing_start');
    
    try {
      // Apply optimizations based on dataset size
      let optimizedDataset = dataset;
      let processingOptions = { ...options };
      
      if (analysis.isLarge && this.options.enableAutoOptimization) {
        optimizedDataset = this.optimizeDataset(dataset, analysis);
        processingOptions.optimized = true;
        processingOptions.originalSize = dataset.length;
        processingOptions.optimizedSize = optimizedDataset.length;
      }
      
      // Use progressive processing for massive datasets
      if (analysis.isMassive && this.options.enableProgressiveProcessing) {
        return await this.processProgressively(
          requestId, 
          optimizedDataset, 
          processingFunction, 
          processingOptions
        );
      }
      
      // Regular processing with monitoring
      const result = await this.processWithMonitoring(
        requestId,
        optimizedDataset,
        processingFunction,
        processingOptions
      );
      
      this.recordPhase(requestId, 'optimized_processing_complete', {
        resultSize: result.data ? result.data.length : 0,
        optimizationsApplied: processingOptions.optimized
      });
      
      return result;
      
    } catch (error) {
      this.recordWarning(requestId, 'processing_error', {
        error: error.message,
        datasetSize: dataset.length
      });
      throw error;
    }
  }

  /**
   * Process dataset progressively in batches
   * @param {string} requestId - Request identifier
   * @param {Array} dataset - Dataset to process
   * @param {Function} processingFunction - Processing function
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Combined processing result
   */
  async processProgressively(requestId, dataset, processingFunction, options = {}) {
    const batchSize = options.batchSize || this.options.maxProcessingBatchSize;
    const batches = [];
    
    // Split dataset into batches
    for (let i = 0; i < dataset.length; i += batchSize) {
      batches.push(dataset.slice(i, i + batchSize));
    }
    
    this.recordPhase(requestId, 'progressive_processing_start', {
      totalBatches: batches.length,
      batchSize: batchSize,
      datasetSize: dataset.length
    });
    
    const results = [];
    let processedCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      this.recordPhase(requestId, `processing_batch_${i + 1}`, {
        batchNumber: i + 1,
        batchSize: batch.length,
        progress: Math.round((processedCount / dataset.length) * 100)
      });
      
      try {
        const batchResult = await processingFunction(batch, {
          ...options,
          batchNumber: i + 1,
          totalBatches: batches.length
        });
        
        results.push(batchResult);
        processedCount += batch.length;
        
        // Memory check between batches
        this.checkMemoryUsage();
        
        // Small delay to prevent overwhelming the system
        if (i < batches.length - 1) {
          await this.sleep(10);
        }
        
      } catch (batchError) {
        this.recordWarning(requestId, 'batch_processing_error', {
          batchNumber: i + 1,
          error: batchError.message
        });
        
        // Continue with remaining batches or fail completely based on options
        if (options.continueOnBatchError) {
          results.push({ error: batchError.message, batch: i + 1 });
        } else {
          throw batchError;
        }
      }
    }
    
    // Combine results
    const combinedResult = this.combineProgressiveResults(results, options);
    
    this.recordPhase(requestId, 'progressive_processing_complete', {
      totalProcessed: processedCount,
      successfulBatches: results.filter(r => !r.error).length,
      failedBatches: results.filter(r => r.error).length
    });
    
    return combinedResult;
  }

  /**
   * Process with continuous monitoring
   * @param {string} requestId - Request identifier
   * @param {Array} dataset - Dataset to process
   * @param {Function} processingFunction - Processing function
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processWithMonitoring(requestId, dataset, processingFunction, options = {}) {
    const startMemory = process.memoryUsage();
    const startTime = Date.now();
    
    // Set up memory monitoring during processing
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage();
      const memoryDelta = currentMemory.heapUsed - startMemory.heapUsed;
      
      if (memoryDelta > this.options.memoryWarningThreshold) {
        this.recordWarning(requestId, 'high_memory_usage_during_processing', {
          memoryDelta: memoryDelta,
          currentMemory: currentMemory.heapUsed,
          threshold: this.options.memoryWarningThreshold
        });
      }
    }, 5000); // Check every 5 seconds
    
    try {
      const result = await processingFunction(dataset, options);
      
      clearInterval(memoryMonitor);
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      this.recordPhase(requestId, 'processing_complete', {
        processingTime: endTime - startTime,
        memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
        datasetSize: dataset.length,
        resultSize: result.data ? result.data.length : 0
      });
      
      return result;
      
    } catch (error) {
      clearInterval(memoryMonitor);
      throw error;
    }
  }

  /**
   * Optimize dataset for better performance
   * @param {Array} dataset - Original dataset
   * @param {Object} analysis - Dataset analysis
   * @returns {Array} Optimized dataset
   */
  optimizeDataset(dataset, analysis) {
    if (analysis.type === 'coordinates') {
      return this.optimizeCoordinates(dataset, analysis);
    }
    
    // For other dataset types, apply generic optimization
    const targetSize = Math.floor(dataset.length * this.options.coordinateSimplificationFactor);
    const step = Math.ceil(dataset.length / targetSize);
    
    const optimized = [];
    for (let i = 0; i < dataset.length; i += step) {
      optimized.push(dataset[i]);
    }
    
    // Always include the last item
    if (optimized[optimized.length - 1] !== dataset[dataset.length - 1]) {
      optimized.push(dataset[dataset.length - 1]);
    }
    
    return optimized;
  }

  /**
   * Optimize coordinate arrays specifically
   * @param {Array} coordinates - Coordinate array
   * @param {Object} analysis - Dataset analysis
   * @returns {Array} Optimized coordinates
   */
  optimizeCoordinates(coordinates, analysis) {
    // Simple Douglas-Peucker-style simplification
    if (coordinates.length < 1000) return coordinates;
    
    const targetSize = analysis.isMassive ? 
      Math.floor(coordinates.length * 0.1) : // Aggressive reduction for massive datasets
      Math.floor(coordinates.length * this.options.coordinateSimplificationFactor);
    
    const simplified = [];
    const step = Math.floor(coordinates.length / targetSize);
    
    for (let i = 0; i < coordinates.length; i += step) {
      simplified.push(coordinates[i]);
    }
    
    // Always include start and end points
    if (simplified[0] !== coordinates[0]) {
      simplified.unshift(coordinates[0]);
    }
    if (simplified[simplified.length - 1] !== coordinates[coordinates.length - 1]) {
      simplified.push(coordinates[coordinates.length - 1]);
    }
    
    return simplified;
  }

  /**
   * Combine results from progressive processing
   * @param {Array} results - Array of batch results
   * @param {Object} options - Processing options
   * @returns {Object} Combined result
   */
  combineProgressiveResults(results, options) {
    const combined = {
      success: true,
      data: [],
      metadata: {
        totalBatches: results.length,
        successfulBatches: 0,
        failedBatches: 0,
        errors: []
      }
    };
    
    for (const result of results) {
      if (result.error) {
        combined.metadata.failedBatches++;
        combined.metadata.errors.push(result.error);
      } else {
        combined.metadata.successfulBatches++;
        if (result.data) {
          if (Array.isArray(result.data)) {
            combined.data.push(...result.data);
          } else {
            combined.data.push(result.data);
          }
        }
      }
    }
    
    // Determine overall success
    combined.success = combined.metadata.failedBatches === 0 || 
                      (options.allowPartialFailure && combined.metadata.successfulBatches > 0);
    
    return combined;
  }

  /**
   * Estimate processing time for dataset
   * @param {number} size - Dataset size
   * @param {string} type - Dataset type
   * @returns {number} Estimated time in milliseconds
   */
  estimateProcessingTime(size, type) {
    // Base estimates (ms per item)
    const baseEstimates = {
      coordinates: 0.1,
      activities: 5,
      routes: 10,
      files: 100
    };
    
    const baseTime = (baseEstimates[type] || 1) * size;
    
    // Add overhead for large datasets
    const overhead = size > this.options.largeDatasetThreshold ? 
      Math.log(size) * 100 : 0;
    
    return Math.ceil(baseTime + overhead);
  }

  /**
   * Estimate memory usage for dataset
   * @param {number} size - Dataset size
   * @param {string} type - Dataset type
   * @returns {number} Estimated memory in bytes
   */
  estimateMemoryUsage(size, type) {
    // Base estimates (bytes per item)
    const baseEstimates = {
      coordinates: 50, // [lat, lng] + metadata
      activities: 2000, // Activity object
      routes: 10000, // Route with coordinates
      files: 1000 // File metadata
    };
    
    return (baseEstimates[type] || 100) * size;
  }

  /**
   * Generate dataset optimization recommendations
   * @param {Object} analysis - Dataset analysis
   * @returns {Array} Array of recommendation objects
   */
  generateDatasetRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.isLarge) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        message: 'Consider reducing dataset size or using progressive loading',
        action: 'enable_optimization'
      });
    }
    
    if (analysis.isMassive) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Dataset is very large - enable progressive processing',
        action: 'enable_progressive_processing'
      });
    }
    
    if (analysis.estimatedProcessingTime > 10000) {
      recommendations.push({
        type: 'timeout',
        priority: 'high',
        message: 'Processing may take over 10 seconds - consider timeout handling',
        action: 'increase_timeout'
      });
    }
    
    if (analysis.memoryEstimate > this.options.memoryWarningThreshold) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'High memory usage expected - monitor memory consumption',
        action: 'enable_memory_monitoring'
      });
    }
    
    return recommendations;
  }

  /**
   * Handle request timeout
   * @param {string} requestId - Request identifier
   */
  handleRequestTimeout(requestId) {
    const monitoring = this.metrics.requests.get(requestId);
    if (!monitoring) return;
    
    monitoring.status = 'timeout';
    monitoring.endTime = Date.now();
    monitoring.totalDuration = monitoring.endTime - monitoring.startTime;
    
    this.recordWarning(requestId, 'request_timeout', {
      duration: monitoring.totalDuration,
      timeout: monitoring.context.timeout || this.options.maxRequestTimeout
    });
    
    this.metrics.activeRequests.delete(requestId);
    
    this.emit('requestTimeout', { requestId, monitoring });
    
    console.error(`Request ${requestId} timed out after ${monitoring.totalDuration}ms`);
  }

  /**
   * Check phase performance and generate warnings
   * @param {string} requestId - Request identifier
   * @param {Object} phase - Phase object
   */
  checkPhasePerformance(requestId, phase) {
    // Check memory usage
    const memoryUsage = phase.memoryUsage.heapUsed;
    if (memoryUsage > this.options.memoryWarningThreshold) {
      this.recordWarning(requestId, 'high_memory_usage', {
        phase: phase.name,
        memoryUsage: memoryUsage,
        threshold: this.options.memoryWarningThreshold
      });
    }
    
    // Check phase duration when completed
    if (phase.duration && phase.duration > 5000) { // 5 seconds
      this.recordWarning(requestId, 'slow_phase', {
        phase: phase.name,
        duration: phase.duration,
        threshold: 5000
      });
    }
  }

  /**
   * Check system memory usage
   * @param {Object} memUsage - Memory usage object (optional)
   */
  checkMemoryUsage(memUsage = null) {
    const memory = memUsage || process.memoryUsage();
    this.systemMetrics.currentMemoryUsage = memory.heapUsed;
    
    if (memory.heapUsed > this.systemMetrics.peakMemoryUsage) {
      this.systemMetrics.peakMemoryUsage = memory.heapUsed;
    }
    
    // Check thresholds
    if (memory.heapUsed > this.options.memoryCriticalThreshold) {
      this.emit('memoryCritical', { memoryUsage: memory.heapUsed });
      console.error(`Critical memory usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    } else if (memory.heapUsed > this.options.memoryWarningThreshold) {
      this.emit('memoryWarning', { memoryUsage: memory.heapUsed });
      console.warn(`High memory usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Store memory snapshot
    this.metrics.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external
    });
    
    // Trim snapshots
    if (this.metrics.memorySnapshots.length > 100) {
      this.metrics.memorySnapshots.shift();
    }
  }

  /**
   * Create performance summary from monitoring data
   * @param {Object} monitoring - Request monitoring object
   * @returns {Object} Performance summary
   */
  createPerformanceSummary(monitoring) {
    return {
      requestId: monitoring.requestId,
      totalDuration: monitoring.totalDuration,
      status: monitoring.status,
      memoryDelta: monitoring.memoryDelta,
      phasesCount: monitoring.phases.length,
      warningsCount: monitoring.warnings.length,
      context: monitoring.context,
      phases: monitoring.phases.map(phase => ({
        name: phase.name,
        duration: phase.duration,
        memoryUsed: phase.memoryUsage.heapUsed
      })),
      warnings: monitoring.warnings,
      timestamp: monitoring.endTime || Date.now()
    };
  }

  /**
   * Update system-wide metrics
   * @param {Object} summary - Performance summary
   */
  updateSystemMetrics(summary) {
    // Update average response time
    const total = this.systemMetrics.averageResponseTime * (this.systemMetrics.totalRequests - 1);
    this.systemMetrics.averageResponseTime = 
      (total + summary.totalDuration) / this.systemMetrics.totalRequests;
    
    // Track slow requests
    if (summary.totalDuration > this.options.slowRequestThreshold) {
      this.systemMetrics.totalSlowRequests++;
    }
  }

  /**
   * Handle slow request
   * @param {Object} summary - Performance summary
   */
  handleSlowRequest(summary) {
    this.metrics.slowRequests.push(summary);
    
    // Trim slow requests history
    if (this.metrics.slowRequests.length > 100) {
      this.metrics.slowRequests.shift();
    }
    
    this.emit('slowRequest', summary);
    
    console.warn(`Slow request detected: ${summary.requestId} took ${summary.totalDuration}ms`);
  }

  /**
   * Record error for monitoring
   * @param {string} errorType - Type of error
   * @param {Object} error - Error object
   */
  recordError(errorType, error) {
    const errorRecord = {
      type: errorType,
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    this.metrics.errors.push(errorRecord);
    
    // Trim error history
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
    
    this.emit('error', errorRecord);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    this.checkMemoryUsage();
    
    // Collect CPU usage if available
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      this.systemMetrics.cpuUsage = cpuUsage;
    }
    
    this.emit('metricsCollected', this.systemMetrics);
  }

  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    const recentRequests = this.metrics.performanceHistory.slice(-50); // Last 50 requests
    
    if (recentRequests.length < 10) return;
    
    // Calculate trends
    const avgDuration = recentRequests.reduce((sum, req) => sum + req.totalDuration, 0) / recentRequests.length;
    const slowRequestsRatio = recentRequests.filter(req => req.totalDuration > this.options.slowRequestThreshold).length / recentRequests.length;
    
    // Check for performance degradation
    if (slowRequestsRatio > 0.3) { // More than 30% slow requests
      this.emit('performanceDegradation', {
        avgDuration: avgDuration,
        slowRequestsRatio: slowRequestsRatio,
        recentRequestsCount: recentRequests.length
      });
    }
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts() {
    if (!this.options.enablePerformanceAlerts) return;
    
    // Check consecutive slow requests
    const recentSlowRequests = this.metrics.slowRequests.slice(-this.options.alertThresholds.consecutiveSlowRequests);
    if (recentSlowRequests.length === this.options.alertThresholds.consecutiveSlowRequests) {
      this.emit('consecutiveSlowRequests', {
        count: recentSlowRequests.length,
        requests: recentSlowRequests
      });
    }
  }

  /**
   * Cleanup old metrics data
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean performance history
    this.metrics.performanceHistory = this.metrics.performanceHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
    
    // Clean memory snapshots
    this.metrics.memorySnapshots = this.metrics.memorySnapshots.filter(
      snapshot => snapshot.timestamp > cutoffTime
    );
    
    // Clean slow requests
    this.metrics.slowRequests = this.metrics.slowRequests.filter(
      request => request.timestamp > cutoffTime
    );
    
    // Clean errors
    this.metrics.errors = this.metrics.errors.filter(
      error => error.timestamp > cutoffTime
    );
    
    // Clean completed requests
    for (const [requestId, monitoring] of this.metrics.requests.entries()) {
      if (monitoring.status !== 'active' && 
          (monitoring.endTime || monitoring.startTime) < cutoffTime) {
        this.metrics.requests.delete(requestId);
      }
    }
  }

  /**
   * Get comprehensive performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return {
      system: { ...this.systemMetrics },
      active: {
        activeRequests: this.metrics.activeRequests.size,
        totalRequests: this.systemMetrics.totalRequests,
        slowRequestsRatio: this.systemMetrics.totalSlowRequests / Math.max(1, this.systemMetrics.totalRequests)
      },
      recent: {
        recentRequests: this.metrics.performanceHistory.slice(-10),
        slowRequests: this.metrics.slowRequests.slice(-5),
        errors: this.metrics.errors.slice(-5)
      },
      memory: {
        current: this.systemMetrics.currentMemoryUsage,
        peak: this.systemMetrics.peakMemoryUsage,
        snapshots: this.metrics.memorySnapshots.slice(-10)
      }
    };
  }

  /**
   * Sleep utility for async operations
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Destroy monitor and cleanup
   */
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Clear all active request timeouts
    for (const monitoring of this.metrics.requests.values()) {
      if (monitoring.timeoutId) {
        clearTimeout(monitoring.timeoutId);
      }
    }
    
    this.removeAllListeners();
    
    console.log('PerformanceMonitor destroyed');
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor({
  enableRealTimeMonitoring: true,
  enablePerformanceAlerts: true,
  enableAutoOptimization: true
});

module.exports = performanceMonitor;