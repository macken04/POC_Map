/**
 * Canvas Size Manager for Print-Quality Map Export
 * Handles dynamic canvas resizing based on selected print dimensions
 * Manages viewport-to-print aspect ratio conversions and memory optimization
 */

class CanvasSizeManager {
  constructor(options = {}) {
    this.options = {
      // Default canvas sizing options
      maxViewportWidth: options.maxViewportWidth || 1200,
      maxViewportHeight: options.maxViewportHeight || 800,
      minViewportWidth: options.minViewportWidth || 400,
      minViewportHeight: options.minViewportHeight || 300,
      
      // Performance settings
      resizeDebounce: options.resizeDebounce || 300,
      enableTransitions: options.enableTransitions !== false,
      memoryThreshold: options.memoryThreshold || 500, // MB
      
      // Quality settings
      // Use 0.24 scale (24% of print size) - optimized for screen fit
      // 5% smaller than 0.25 to prevent cutoff, still 33% larger than original 0.18
      // Preview dimensions are 0.24× of print dimensions (e.g., A4: 595×842px from 2480×3508px)
      viewportScaleFactor: options.viewportScaleFactor || 0.24,
      previewQuality: options.viewportScaleFactor || 150, // DPI for preview
      
      ...options
    };

    // Print size specifications (matching map-design.js)
    this.printSizes = {
      A4: {
        name: 'A4 Standard',
        physicalSize: { width: 210, height: 297 }, // mm
        portrait: { width: 2480, height: 3508 },   // 300 DPI pixels
        landscape: { width: 3508, height: 2480 },
        aspectRatio: { portrait: 0.71, landscape: 1.41 }
      },
      A3: {
        name: 'A3 Large', 
        physicalSize: { width: 297, height: 420 }, // mm
        portrait: { width: 3508, height: 4961 },   // 300 DPI pixels
        landscape: { width: 4961, height: 3508 },
        aspectRatio: { portrait: 0.71, landscape: 1.41 }
      }
    };

    // State management
    this.currentFormat = 'A4';
    this.currentOrientation = 'portrait';
    this.currentQuality = 300;
    this.isResizing = false;
    this.resizeTimeout = null;
    this.memoryMonitor = null;

    // Performance tracking
    this.performanceMetrics = {
      lastResizeTime: 0,
      resizeCount: 0,
      averageResizeTime: 0,
      memoryUsage: 0
    };

    this.init();
  }

  /**
   * Initialize the canvas size manager
   */
  init() {
    // Start memory monitoring if available
    if (performance.memory) {
      this.startMemoryMonitoring();
    }

    console.log('Canvas Size Manager initialized');
  }

  /**
   * Calculate optimal viewport dimensions for a given print format
   * Uses fixed 0.18 scale (18% of print size) for compact, clean presentation
   *
   * @param {string} format - Print format (A4, A3)
   * @param {string} orientation - Orientation (portrait, landscape)
   * @param {number} quality - Target DPI (used for memory calculation)
   * @returns {Object} Calculated viewport dimensions
   */
  calculateViewportDimensions(format, orientation, quality = 150) {
    const printSpec = this.printSizes[format];
    if (!printSpec) {
      throw new Error(`Unsupported print format: ${format}`);
    }

    const printDimensions = printSpec[orientation];
    const aspectRatio = printSpec.aspectRatio[orientation];

    // CRITICAL: Use 0.24 scale (24% of print size) - optimized for screen fit
    // 5% smaller than 0.25 to prevent cutoff, still 33% larger than original 0.18
    // The map view in the editor exactly matches what gets exported (just at 24% scale)
    const scaleFactor = this.options.viewportScaleFactor; // Should be 0.24

    // Calculate viewport as exact scaled-down version of print dimensions
    const viewportWidth = Math.round(printDimensions.width * scaleFactor);
    const viewportHeight = Math.round(printDimensions.height * scaleFactor);

    // Resulting dimensions (24% of print size, optimized for screen fit):
    // A4 portrait: 2480 × 3508 → 595 × 842 pixels
    // A4 landscape: 3508 × 2480 → 842 × 595 pixels
    // A3 portrait: 3508 × 4961 → 842 × 1191 pixels
    // A3 landscape: 4961 × 3508 → 1191 × 842 pixels

    return {
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      print: {
        width: printDimensions.width,
        height: printDimensions.height
      },
      scaling: {
        factor: scaleFactor,
        x: scaleFactor,
        y: scaleFactor,
        // Export must multiply by this to get print dimensions
        exportMultiplier: 1 / scaleFactor // Should be 4.17 (1 / 0.24)
      },
      aspectRatio,
      memoryEstimate: this.calculateMemoryRequirements(
        printDimensions.width,
        printDimensions.height,
        quality
      )
    };
  }

  /**
   * Calculate memory requirements for given dimensions and quality
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels  
   * @param {number} quality - Target DPI
   * @returns {Object} Memory requirement information
   */
  calculateMemoryRequirements(width, height, quality) {
    const totalPixels = width * height;
    const qualityMultiplier = quality / 96; // Web standard DPI
    const bytesPerPixel = 4; // RGBA
    const bufferMultiplier = 2.5; // Account for multiple buffers and overhead
    
    const estimatedBytes = totalPixels * bytesPerPixel * qualityMultiplier * bufferMultiplier;
    const estimatedMB = Math.round(estimatedBytes / (1024 * 1024));
    
    return {
      estimatedMB,
      isHighMemory: estimatedMB > this.options.memoryThreshold,
      requiresOptimization: estimatedMB > (this.options.memoryThreshold * 2),
      totalPixels,
      qualityMultiplier,
      recommendations: this.getMemoryRecommendations(estimatedMB)
    };
  }

  /**
   * Get memory optimization recommendations
   * @param {number} estimatedMB - Estimated memory usage in MB
   * @returns {Array} Array of recommendation objects
   */
  getMemoryRecommendations(estimatedMB) {
    const recommendations = [];

    if (estimatedMB > 1000) {
      recommendations.push({
        type: 'critical',
        message: 'Consider reducing DPI to 150 for better performance',
        action: 'reduce_dpi'
      });
    }

    if (estimatedMB > 500) {
      recommendations.push({
        type: 'warning', 
        message: 'Large canvas size may cause performance issues',
        action: 'enable_optimization'
      });
    }

    if (estimatedMB > 200) {
      recommendations.push({
        type: 'info',
        message: 'Progressive rendering recommended for smooth experience',
        action: 'enable_progressive'
      });
    }

    return recommendations;
  }

  /**
   * Resize canvas with specified dimensions and options
   * @param {HTMLElement} container - Canvas container element
   * @param {string} format - Print format
   * @param {string} orientation - Orientation
   * @param {number} quality - Target DPI
   * @param {Object} options - Resize options
   * @returns {Promise} Resize operation promise
   */
  async resizeCanvas(container, format, orientation, quality = 150, options = {}) {
    if (this.isResizing && !options.force) {
      console.log('Resize already in progress, skipping');
      return;
    }

    this.isResizing = true;
    const startTime = performance.now();

    try {
      // Clear any pending resize timeout
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = null;
      }

      // Calculate new dimensions
      const dimensions = this.calculateViewportDimensions(format, orientation, quality);
      
      console.log(`Resizing canvas for ${format} ${orientation}:`, dimensions);

      // Check memory requirements and warn if needed
      if (dimensions.memoryEstimate.isHighMemory) {
        console.warn('High memory usage expected:', dimensions.memoryEstimate);
        this.showMemoryWarning(dimensions.memoryEstimate);
      }

      // Apply resize with transition if enabled
      if (this.options.enableTransitions && !options.immediate) {
        await this.animatedResize(container, dimensions, options);
      } else {
        await this.immediateResize(container, dimensions, options);
      }

      // Update state
      this.currentFormat = format;
      this.currentOrientation = orientation;
      this.currentQuality = quality;

      // Update performance metrics
      const resizeTime = performance.now() - startTime;
      this.updatePerformanceMetrics(resizeTime);

      console.log(`Canvas resize completed in ${resizeTime.toFixed(2)}ms`);
      
      return dimensions;

    } catch (error) {
      console.error('Canvas resize failed:', error);
      throw error;
    } finally {
      this.isResizing = false;
    }
  }

  /**
   * Perform animated canvas resize with smooth transitions
   * @param {HTMLElement} container - Canvas container
   * @param {Object} dimensions - Target dimensions
   * @param {Object} options - Animation options
   * @returns {Promise} Animation completion promise
   */
  async animatedResize(container, dimensions, options = {}) {
    return new Promise((resolve, reject) => {
      const duration = options.duration || 300;
      const easing = options.easing || 'ease-out';
      
      // Store original dimensions
      const originalWidth = container.offsetWidth;
      const originalHeight = container.offsetHeight;

      // Add transition styles
      container.style.transition = `width ${duration}ms ${easing}, height ${duration}ms ${easing}`;
      
      // Apply new dimensions
      container.style.width = `${dimensions.viewport.width}px`;
      container.style.height = `${dimensions.viewport.height}px`;

      // Wait for transition to complete
      const transitionEndHandler = (event) => {
        if (event.target === container && event.propertyName === 'width') {
          container.removeEventListener('transitionend', transitionEndHandler);
          container.style.transition = ''; // Remove transition
          resolve();
        }
      };

      container.addEventListener('transitionend', transitionEndHandler);

      // Fallback timeout in case transition doesn't fire
      setTimeout(() => {
        container.removeEventListener('transitionend', transitionEndHandler);
        container.style.transition = '';
        resolve();
      }, duration + 100);
    });
  }

  /**
   * Perform immediate canvas resize without animation
   * @param {HTMLElement} container - Canvas container
   * @param {Object} dimensions - Target dimensions
   * @param {Object} options - Resize options
   * @returns {Promise} Resize completion promise
   */
  async immediateResize(container, dimensions, options = {}) {
    return new Promise((resolve) => {
      // Apply dimensions immediately
      container.style.width = `${dimensions.viewport.width}px`;
      container.style.height = `${dimensions.viewport.height}px`;
      
      // Force layout recalculation
      container.offsetHeight;
      
      // Resolve on next frame to ensure DOM update
      requestAnimationFrame(() => resolve());
    });
  }

  /**
   * Debounced resize function to prevent excessive resize operations
   * @param {Function} resizeFunc - Function to execute
   * @param {number} delay - Debounce delay
   * @returns {Function} Debounced function
   */
  debounceResize(resizeFunc, delay = null) {
    delay = delay || this.options.resizeDebounce;
    
    return (...args) => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = setTimeout(() => {
        resizeFunc.apply(this, args);
      }, delay);
    };
  }

  /**
   * Get current canvas configuration
   * @returns {Object} Current configuration
   */
  getCurrentConfig() {
    return {
      format: this.currentFormat,
      orientation: this.currentOrientation,
      quality: this.currentQuality,
      dimensions: this.calculateViewportDimensions(
        this.currentFormat,
        this.currentOrientation,
        this.currentQuality
      ),
      performanceMetrics: { ...this.performanceMetrics },
      memoryUsage: this.getCurrentMemoryUsage()
    };
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    if (!performance.memory) return;

    const monitorMemory = () => {
      const memoryInfo = {
        used: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
        total: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
        limit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))
      };

      this.performanceMetrics.memoryUsage = memoryInfo.used;

      // Warn if memory usage is high
      if (memoryInfo.used > this.options.memoryThreshold) {
        console.warn('High memory usage detected:', memoryInfo);
      }
    };

    // Monitor every 5 seconds
    this.memoryMonitor = setInterval(monitorMemory, 5000);
    monitorMemory(); // Initial check
  }

  /**
   * Get current memory usage
   * @returns {Object} Memory usage information
   */
  getCurrentMemoryUsage() {
    if (!performance.memory) return null;

    return {
      used: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
      total: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
      limit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))
    };
  }

  /**
   * Update performance metrics
   * @param {number} resizeTime - Time taken for resize operation
   */
  updatePerformanceMetrics(resizeTime) {
    this.performanceMetrics.lastResizeTime = resizeTime;
    this.performanceMetrics.resizeCount++;
    
    // Calculate running average
    const totalTime = this.performanceMetrics.averageResizeTime * 
                     (this.performanceMetrics.resizeCount - 1) + resizeTime;
    this.performanceMetrics.averageResizeTime = totalTime / this.performanceMetrics.resizeCount;
  }

  /**
   * Show memory warning to user
   * @param {Object} memoryEstimate - Memory estimate information
   */
  showMemoryWarning(memoryEstimate) {
    // This could be enhanced to show actual UI warnings
    console.warn('Memory Warning:', {
      estimatedUsage: `${memoryEstimate.estimatedMB}MB`,
      recommendations: memoryEstimate.recommendations
    });

    // Dispatch custom event for UI to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('canvas-memory-warning', {
        detail: memoryEstimate
      }));
    }
  }

  /**
   * Get export configuration for current canvas size
   * @returns {Object} Export configuration
   */
  getExportConfig() {
    const printSpec = this.printSizes[this.currentFormat];
    const printDimensions = printSpec[this.currentOrientation];
    
    return {
      format: this.currentFormat,
      orientation: this.currentOrientation,
      quality: this.currentQuality,
      width: printDimensions.width,
      height: printDimensions.height,
      aspectRatio: printSpec.aspectRatio[this.currentOrientation],
      memoryEstimate: this.calculateMemoryRequirements(
        printDimensions.width,
        printDimensions.height,
        this.currentQuality
      )
    };
  }

  /**
   * Validate canvas dimensions against browser limits
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Object} Validation result
   */
  validateCanvasDimensions(width, height) {
    // Maximum canvas size varies by browser
    const maxCanvasSize = 32767; // Conservative limit for most browsers
    const maxArea = 268435456; // 16384 * 16384
    
    const area = width * height;
    
    return {
      valid: width <= maxCanvasSize && height <= maxCanvasSize && area <= maxArea,
      width: width <= maxCanvasSize,
      height: height <= maxCanvasSize,
      area: area <= maxArea,
      maxCanvasSize,
      maxArea,
      currentArea: area
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }

    console.log('Canvas Size Manager cleaned up');
  }
}

// Make CanvasSizeManager available globally
if (typeof window !== 'undefined') {
  window.CanvasSizeManager = CanvasSizeManager;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasSizeManager;
}