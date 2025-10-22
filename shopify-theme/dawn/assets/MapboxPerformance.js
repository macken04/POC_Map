/**
 * MapboxPerformance.js - Performance Monitoring and Memory Management
 * 
 * Handles:
 * - Performance monitoring and FPS tracking
 * - Memory usage monitoring and cleanup
 * - Browser-specific optimizations
 * - Automatic performance adjustments
 * - Memory leak detection and prevention
 * - Performance metrics reporting
 * 
 * Dependencies:
 * - MapboxCore (for map instance access)
 */

class MapboxPerformance {
  constructor(core, options = {}) {
    this.core = core;
    this.map = null; // Will be set when core is initialized
    
    // Performance monitoring state
    this.performanceMetrics = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0,
      averageFPS: 0,
      memoryUsage: 0,
      lastMemoryCheck: 0,
      renderingTime: 0
    };

    // Memory management
    this.memoryManager = {
      objectPools: new Map(),
      trackedResources: new Set(),
      cleanupIntervals: new Set(),
      memoryThresholds: {
        warning: 50 * 1024 * 1024, // 50MB
        critical: 100 * 1024 * 1024, // 100MB
        cleanup: 75 * 1024 * 1024 // 75MB
      }
    };

    // Performance optimization settings
    this.optimizationSettings = {
      adaptiveQuality: true,
      autoCleanup: true,
      performanceMonitoring: true,
      memoryLeakDetection: true,
      browserOptimizations: true
    };

    // Default options
    this.options = {
      enablePerformanceMonitoring: true,
      enableMemoryManagement: true,
      enableAutoOptimization: true,
      targetFPS: 60,
      memoryCheckInterval: 5000, // 5 seconds
      cleanupInterval: 30000, // 30 seconds
      performanceReportInterval: 60000, // 1 minute
      ...options
    };

    // Performance state
    this.isOptimizing = false;
    this.lastOptimizationTime = 0;
    this.performanceReports = [];

    // Bind methods
    this.startPerformanceMonitoring = this.startPerformanceMonitoring.bind(this);
    this.stopPerformanceMonitoring = this.stopPerformanceMonitoring.bind(this);
    this.optimizePerformance = this.optimizePerformance.bind(this);
    this.performMemoryCleanup = this.performMemoryCleanup.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize performance management
   * @param {mapboxgl.Map} map - Map instance
   */
  init(map) {
    this.map = map;

    if (this.options.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring();
    }

    if (this.options.enableMemoryManagement) {
      this.initializeMemoryManagement();
    }

    if (this.options.enableAutoOptimization) {
      this.initializeAutoOptimization();
    }

    // Apply browser-specific optimizations
    this.applyBrowserOptimizations();

    console.log('MapboxPerformance: Performance management initialized');
    return this;
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    if (!this.options.enablePerformanceMonitoring) return;

    console.log('MapboxPerformance: Starting performance monitoring...');

    // FPS monitoring
    this.startFPSMonitoring();

    // Memory usage monitoring
    this.startMemoryMonitoring();

    // Rendering performance monitoring
    this.startRenderingMonitoring();

    // Performance reporting
    this.startPerformanceReporting();
  }

  /**
   * Start FPS monitoring
   */
  startFPSMonitoring() {
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - this.performanceMetrics.lastFrameTime;
      
      if (delta > 0) {
        this.performanceMetrics.fps = 1000 / delta;
        this.performanceMetrics.frameCount++;
        
        // Calculate average FPS over time
        const alpha = 0.1; // Smoothing factor
        this.performanceMetrics.averageFPS = 
          this.performanceMetrics.averageFPS * (1 - alpha) + 
          this.performanceMetrics.fps * alpha;
      }
      
      this.performanceMetrics.lastFrameTime = now;
      
      // Check if performance optimization is needed
      if (this.performanceMetrics.averageFPS < this.options.targetFPS * 0.8) {
        this.scheduleOptimization();
      }
      
      requestAnimationFrame(updateFPS);
    };

    updateFPS();
  }

  /**
   * Start memory usage monitoring
   */
  startMemoryMonitoring() {
    const checkMemoryUsage = () => {
      if (performance.memory) {
        const memoryInfo = performance.memory;
        this.performanceMetrics.memoryUsage = memoryInfo.usedJSHeapSize;
        this.performanceMetrics.lastMemoryCheck = Date.now();

        // Check memory thresholds
        if (memoryInfo.usedJSHeapSize > this.memoryManager.memoryThresholds.critical) {
          console.warn('MapboxPerformance: Critical memory usage detected');
          this.performMemoryCleanup();
        } else if (memoryInfo.usedJSHeapSize > this.memoryManager.memoryThresholds.cleanup) {
          this.scheduleCleanup();
        }
      }
    };

    // Initial check
    checkMemoryUsage();
    
    // Periodic monitoring
    setInterval(checkMemoryUsage, this.options.memoryCheckInterval);
  }

  /**
   * Start rendering performance monitoring
   */
  startRenderingMonitoring() {
    if (!this.map) return;

    this.map.on('render', () => {
      const renderStart = performance.now();
      
      requestAnimationFrame(() => {
        this.performanceMetrics.renderingTime = performance.now() - renderStart;
      });
    });
  }

  /**
   * Start performance reporting
   */
  startPerformanceReporting() {
    const generateReport = () => {
      const report = this.generatePerformanceReport();
      this.performanceReports.push(report);
      
      // Keep only last 10 reports
      if (this.performanceReports.length > 10) {
        this.performanceReports.shift();
      }
      
      console.log('MapboxPerformance: Performance report generated', report);
    };

    setInterval(generateReport, this.options.performanceReportInterval);
  }

  /**
   * Initialize memory management
   */
  initializeMemoryManagement() {
    console.log('MapboxPerformance: Initializing memory management...');

    // Setup automatic cleanup
    this.setupAutoCleanup();

    // Initialize object pools
    this.initializeObjectPools();

    // Setup memory leak detection
    this.setupMemoryLeakDetection();
  }

  /**
   * Setup automatic cleanup
   */
  setupAutoCleanup() {
    const cleanup = () => {
      this.performMemoryCleanup();
    };

    const cleanupInterval = setInterval(cleanup, this.options.cleanupInterval);
    this.memoryManager.cleanupIntervals.add(cleanupInterval);
  }

  /**
   * Initialize object pools for memory efficiency
   */
  initializeObjectPools() {
    // Coordinate pool
    this.memoryManager.objectPools.set('coordinates', {
      pool: [],
      create: () => ({ lat: 0, lng: 0 }),
      reset: (obj) => { obj.lat = 0; obj.lng = 0; }
    });

    // Feature pool
    this.memoryManager.objectPools.set('features', {
      pool: [],
      create: () => ({ type: 'Feature', properties: {}, geometry: null }),
      reset: (obj) => { 
        obj.properties = {}; 
        obj.geometry = null; 
      }
    });

    console.log('MapboxPerformance: Object pools initialized');
  }

  /**
   * Setup memory leak detection
   */
  setupMemoryLeakDetection() {
    // Track DOM nodes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.memoryManager.trackedResources.add(node);
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.memoryManager.trackedResources.delete(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('MapboxPerformance: Memory leak detection initialized');
  }

  /**
   * Initialize auto-optimization
   */
  initializeAutoOptimization() {
    // Monitor performance and auto-optimize
    const checkOptimization = () => {
      if (this.shouldOptimize()) {
        this.optimizePerformance();
      }
    };

    setInterval(checkOptimization, 5000); // Check every 5 seconds
  }

  /**
   * Apply browser-specific optimizations
   */
  applyBrowserOptimizations() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      this.applyChromeOptimizations();
    } else if (userAgent.includes('firefox')) {
      this.applyFirefoxOptimizations();
    } else if (userAgent.includes('safari')) {
      this.applySafariOptimizations();
    } else if (userAgent.includes('edge')) {
      this.applyEdgeOptimizations();
    }

    // Mobile optimizations
    if (this.isMobile()) {
      this.applyMobileOptimizations();
    }
  }

  /**
   * Apply Chrome-specific optimizations
   */
  applyChromeOptimizations() {
    // Enable hardware acceleration hints
    if (this.map) {
      this.map.getContainer().style.willChange = 'transform';
    }
  }

  /**
   * Apply Firefox-specific optimizations
   */
  applyFirefoxOptimizations() {
    // Reduce rendering frequency on Firefox
    if (this.map) {
      this.map.setMaxZoom(18); // Reduce max zoom for better performance
    }
  }

  /**
   * Apply Safari-specific optimizations
   */
  applySafariOptimizations() {
    // Safari memory management
    if (this.map) {
      this.map.getContainer().style.webkitBackfaceVisibility = 'hidden';
    }
  }

  /**
   * Apply Edge-specific optimizations
   */
  applyEdgeOptimizations() {
    // Reduce animation complexity on Edge
    if (this.map) {
      this.map.getContainer().style.msContentZooming = 'none';
    }
  }

  /**
   * Apply mobile-specific optimizations
   */
  applyMobileOptimizations() {
    if (!this.map) return;

    // Reduce tile size for mobile
    this.map.setRenderWorldCopies(false);
    
    // Disable pitch on mobile
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    
    // Reduce rendering quality on mobile if performance is poor
    if (this.performanceMetrics.averageFPS < 30) {
      this.map.setMaxZoom(16);
    }
  }

  /**
   * Check if optimization is needed
   * @returns {boolean} Whether optimization should be performed
   */
  shouldOptimize() {
    const now = Date.now();
    const timeSinceLastOptimization = now - this.lastOptimizationTime;
    
    return !this.isOptimizing && 
           timeSinceLastOptimization > 10000 && // Wait at least 10 seconds between optimizations
           (this.performanceMetrics.averageFPS < this.options.targetFPS * 0.7 ||
            this.performanceMetrics.memoryUsage > this.memoryManager.memoryThresholds.warning);
  }

  /**
   * Schedule performance optimization
   */
  scheduleOptimization() {
    if (this.isOptimizing) return;
    
    setTimeout(() => {
      this.optimizePerformance();
    }, 1000); // Delay to avoid immediate optimization
  }

  /**
   * Schedule memory cleanup
   */
  scheduleCleanup() {
    setTimeout(() => {
      this.performMemoryCleanup();
    }, 2000);
  }

  /**
   * Optimize performance based on current metrics
   */
  optimizePerformance() {
    if (this.isOptimizing || !this.map) return;
    
    console.log('MapboxPerformance: Starting performance optimization...');
    this.isOptimizing = true;
    this.lastOptimizationTime = Date.now();

    try {
      // Adjust quality based on FPS
      if (this.performanceMetrics.averageFPS < 30) {
        this.applyLowPerformanceOptimizations();
      } else if (this.performanceMetrics.averageFPS < 45) {
        this.applyMediumPerformanceOptimizations();
      }

      // Memory-based optimizations
      if (this.performanceMetrics.memoryUsage > this.memoryManager.memoryThresholds.warning) {
        this.performMemoryCleanup();
      }

      console.log('MapboxPerformance: Performance optimization completed');
      
    } catch (error) {
      console.error('MapboxPerformance: Optimization failed:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Apply optimizations for low performance devices
   */
  applyLowPerformanceOptimizations() {
    if (!this.map) return;

    // Reduce maximum zoom
    this.map.setMaxZoom(16);
    
    // Disable some visual effects
    this.map.setFog(null);
    
    // Reduce tile detail
    if (this.map.getSource('mapbox-dem')) {
      this.map.removeLayer('hillshading');
    }

    console.log('MapboxPerformance: Low performance optimizations applied');
  }

  /**
   * Apply optimizations for medium performance devices
   */
  applyMediumPerformanceOptimizations() {
    if (!this.map) return;

    // Slightly reduce maximum zoom
    this.map.setMaxZoom(18);
    
    // Reduce some effects
    this.map.setPaintProperty('background', 'background-opacity', 0.8);

    console.log('MapboxPerformance: Medium performance optimizations applied');
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    console.log('MapboxPerformance: Performing memory cleanup...');

    try {
      // Clean up object pools
      this.cleanupObjectPools();
      
      // Clean up tracked resources
      this.cleanupTrackedResources();
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      console.log('MapboxPerformance: Memory cleanup completed');
      
    } catch (error) {
      console.error('MapboxPerformance: Memory cleanup failed:', error);
    }
  }

  /**
   * Clean up object pools
   */
  cleanupObjectPools() {
    this.memoryManager.objectPools.forEach((pool, name) => {
      // Keep only a small number of objects in each pool
      pool.pool.splice(10);
      console.log(`MapboxPerformance: Cleaned up ${name} object pool`);
    });
  }

  /**
   * Clean up tracked resources
   */
  cleanupTrackedResources() {
    let cleanedCount = 0;
    
    this.memoryManager.trackedResources.forEach((resource) => {
      if (!document.contains(resource)) {
        this.memoryManager.trackedResources.delete(resource);
        cleanedCount++;
      }
    });
    
    console.log(`MapboxPerformance: Cleaned up ${cleanedCount} orphaned resources`);
  }

  /**
   * Generate performance report
   * @returns {Object} Performance report
   */
  generatePerformanceReport() {
    const memoryInfo = performance.memory || {};
    
    return {
      timestamp: Date.now(),
      fps: {
        current: Math.round(this.performanceMetrics.fps),
        average: Math.round(this.performanceMetrics.averageFPS),
        target: this.options.targetFPS
      },
      memory: {
        used: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024) // MB
      },
      rendering: {
        time: Math.round(this.performanceMetrics.renderingTime),
        frameCount: this.performanceMetrics.frameCount
      },
      optimizations: {
        lastOptimization: this.lastOptimizationTime,
        isOptimizing: this.isOptimizing
      }
    };
  }

  /**
   * Get current performance metrics
   * @returns {Object} Current performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      report: this.generatePerformanceReport()
    };
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getMemoryStats() {
    const memoryInfo = performance.memory || {};
    
    return {
      used: memoryInfo.usedJSHeapSize || 0,
      total: memoryInfo.totalJSHeapSize || 0,
      limit: memoryInfo.jsHeapSizeLimit || 0,
      trackedResources: this.memoryManager.trackedResources.size,
      objectPools: Array.from(this.memoryManager.objectPools.entries()).map(([name, pool]) => ({
        name,
        size: pool.pool.length
      }))
    };
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring() {
    console.log('MapboxPerformance: Stopping performance monitoring...');
    
    // Clear intervals
    this.memoryManager.cleanupIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.memoryManager.cleanupIntervals.clear();
  }

  /**
   * Check if device is mobile
   * @returns {boolean} Whether device is mobile
   */
  isMobile() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Clean up performance management
   */
  cleanup() {
    console.log('MapboxPerformance: Starting cleanup...');
    
    // Stop monitoring
    this.stopPerformanceMonitoring();
    
    // Perform final cleanup
    this.performMemoryCleanup();
    
    // Reset state
    this.map = null;
    this.isOptimizing = false;
    this.performanceReports = [];
    
    console.log('MapboxPerformance: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxPerformance;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxPerformance; });
} else {
  window.MapboxPerformance = MapboxPerformance;
}