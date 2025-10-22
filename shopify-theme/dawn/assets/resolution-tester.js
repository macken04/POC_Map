/**
 * Resolution Testing Framework for High-DPI Rendering
 * Provides visual verification tools and automated testing for pixel density validation
 * 
 * This framework helps verify that the DPI manipulation is working correctly and
 * that the rendered output achieves the target resolution quality.
 * 
 * Usage:
 * const tester = new ResolutionTester();
 * const results = await tester.runFullTestSuite();
 */

(function(global) {
  'use strict';

  class ResolutionTester {
    constructor(options = {}) {
      this.options = Object.assign({
        enableVisualTests: true,
        enablePerformanceTests: true,
        enableMemoryTracking: true,
        testContainerId: 'resolution-test-container',
        maxTestDuration: 30000, // 30 seconds
        targetDPIs: [96, 150, 300, 600],
        testFormats: ['A4', 'A3'],
        verbose: false
      }, options);

      // Test state
      this.testResults = [];
      this.currentTest = null;
      this.testContainer = null;
      this.dpiManager = null;
      this.performanceMonitor = null;

      // Test patterns for visual verification
      this.testPatterns = {
        // Grid pattern to verify pixel alignment
        grid: this.createGridPattern.bind(this),
        // Text pattern to verify text rendering quality
        text: this.createTextPattern.bind(this),
        // Gradient pattern to verify smooth color transitions
        gradient: this.createGradientPattern.bind(this),
        // Line pattern to verify anti-aliasing
        lines: this.createLinePattern.bind(this),
        // Circle pattern to verify curve rendering
        circles: this.createCirclePattern.bind(this)
      };

      // Performance metrics
      this.performanceMetrics = {
        renderTime: 0,
        memoryUsage: 0,
        frameRate: 0,
        canvasOperations: 0
      };
    }

    /**
     * Initialize the resolution testing framework
     */
    async init() {
      console.log('ResolutionTester: Initializing...');

      try {
        // Create test container
        this.testContainer = this.createTestContainer();

        // Initialize DPI manager if available
        if (typeof DPIManager !== 'undefined') {
          this.dpiManager = new DPIManager();
          await this.dpiManager.init();
        }

        // Initialize performance monitor
        this.performanceMonitor = new PerformanceMonitor();

        console.log('ResolutionTester: Initialized successfully');
        return this;
      } catch (error) {
        console.error('ResolutionTester: Initialization failed:', error);
        throw error;
      }
    }

    /**
     * Run complete test suite
     * @returns {Object} Comprehensive test results
     */
    async runFullTestSuite() {
      console.log('ResolutionTester: Starting full test suite...');
      const startTime = performance.now();

      try {
        const results = {
          timestamp: new Date().toISOString(),
          browser: this.getBrowserInfo(),
          device: this.getDeviceInfo(),
          dpiSupport: await this.testDPISupport(),
          visualTests: await this.runVisualTests(),
          performanceTests: await this.runPerformanceTests(),
          memoryTests: await this.runMemoryTests(),
          crossBrowserTests: await this.runCrossBrowserTests(),
          overallScore: 0,
          recommendations: [],
          duration: 0
        };

        // Calculate overall score
        results.overallScore = this.calculateOverallScore(results);
        
        // Generate recommendations
        results.recommendations = this.generateRecommendations(results);
        
        // Set duration
        results.duration = performance.now() - startTime;

        // Store results
        this.testResults.push(results);

        console.log('ResolutionTester: Full test suite completed');
        console.log('Test Results:', results);

        return results;
      } catch (error) {
        console.error('ResolutionTester: Test suite failed:', error);
        throw error;
      }
    }

    /**
     * Test DPI support and manipulation capabilities
     * @returns {Object} DPI support test results
     */
    async testDPISupport() {
      console.log('Testing DPI support...');
      
      const results = {
        dpiManagerAvailable: !!this.dpiManager,
        originalRatio: window.devicePixelRatio || 1,
        supportedMethods: [],
        testResults: {},
        browserCompatibility: null,
        overallSupport: false
      };

      try {
        if (this.dpiManager) {
          // Test browser compatibility
          results.browserCompatibility = this.dpiManager.checkBrowserSupport();
          
          // Test high DPI support
          const dpiTest = this.dpiManager.testHighDPISupport();
          results.testResults = dpiTest;
          
          // Test each target DPI
          for (const targetDPI of this.options.targetDPIs) {
            try {
              const scalingFactor = this.dpiManager.setDPI(targetDPI);
              const actualRatio = window.devicePixelRatio;
              const success = Math.abs(actualRatio - (targetDPI / 96)) < 0.1;
              
              results.testResults[`dpi_${targetDPI}`] = {
                targetDPI,
                expectedRatio: targetDPI / 96,
                actualRatio,
                scalingFactor,
                success,
                error: null
              };

              // Restore original DPI
              this.dpiManager.restoreOriginalDPI();
              
            } catch (error) {
              results.testResults[`dpi_${targetDPI}`] = {
                targetDPI,
                success: false,
                error: error.message
              };
            }
          }

          results.overallSupport = Object.values(results.testResults)
            .filter(r => typeof r === 'object' && r.targetDPI)
            .every(r => r.success);
        }

      } catch (error) {
        console.error('DPI support test failed:', error);
        results.error = error.message;
      }

      return results;
    }

    /**
     * Run visual verification tests
     * @returns {Object} Visual test results
     */
    async runVisualTests() {
      if (!this.options.enableVisualTests) {
        return { skipped: true };
      }

      console.log('Running visual tests...');
      const results = {
        patterns: {},
        overallQuality: 0,
        issues: []
      };

      try {
        // Test each pattern at different DPIs
        for (const [patternName, patternFunc] of Object.entries(this.testPatterns)) {
          results.patterns[patternName] = {};
          
          for (const targetDPI of this.options.targetDPIs) {
            const patternResult = await this.testPattern(patternName, patternFunc, targetDPI);
            results.patterns[patternName][`dpi_${targetDPI}`] = patternResult;
          }
        }

        // Calculate overall quality score
        results.overallQuality = this.calculateVisualQuality(results.patterns);
        
        // Identify issues
        results.issues = this.identifyVisualIssues(results.patterns);

      } catch (error) {
        console.error('Visual tests failed:', error);
        results.error = error.message;
      }

      return results;
    }

    /**
     * Run performance benchmarks
     * @returns {Object} Performance test results
     */
    async runPerformanceTests() {
      if (!this.options.enablePerformanceTests) {
        return { skipped: true };
      }

      console.log('Running performance tests...');
      const results = {
        renderingSpeed: {},
        memoryUsage: {},
        scalingPerformance: {},
        recommendations: []
      };

      try {
        // Test rendering speed at different DPIs
        for (const targetDPI of this.options.targetDPIs) {
          const perfTest = await this.measureRenderingPerformance(targetDPI);
          results.renderingSpeed[`dpi_${targetDPI}`] = perfTest;
        }

        // Test memory usage
        for (const format of this.options.testFormats) {
          const memoryTest = await this.measureMemoryUsage(format, 300);
          results.memoryUsage[format] = memoryTest;
        }

        // Generate performance recommendations
        results.recommendations = this.generatePerformanceRecommendations(results);

      } catch (error) {
        console.error('Performance tests failed:', error);
        results.error = error.message;
      }

      return results;
    }

    /**
     * Run memory usage tests
     * @returns {Object} Memory test results
     */
    async runMemoryTests() {
      console.log('Running memory tests...');
      const results = {
        baselineMemory: 0,
        dpiMemoryImpact: {},
        formatMemoryUsage: {},
        memoryLeaks: false,
        gcEfficiency: 0
      };

      try {
        // Measure baseline memory
        results.baselineMemory = this.measureCurrentMemory();

        // Test memory impact of different DPIs
        for (const targetDPI of this.options.targetDPIs) {
          const memoryBefore = this.measureCurrentMemory();
          
          if (this.dpiManager) {
            this.dpiManager.setDPI(targetDPI);
            await this.createTestCanvas(1000, 1000);
            
            const memoryAfter = this.measureCurrentMemory();
            results.dpiMemoryImpact[`dpi_${targetDPI}`] = {
              before: memoryBefore,
              after: memoryAfter,
              increase: memoryAfter - memoryBefore,
              scalingFactor: targetDPI / 96
            };

            this.dpiManager.restoreOriginalDPI();
            this.cleanupTestCanvas();
          }
        }

        // Test memory usage for different formats
        for (const format of this.options.testFormats) {
          const memoryTest = await this.measureFormatMemoryUsage(format);
          results.formatMemoryUsage[format] = memoryTest;
        }

        // Test for memory leaks
        results.memoryLeaks = await this.detectMemoryLeaks();

        // Test garbage collection efficiency
        results.gcEfficiency = await this.measureGCEfficiency();

      } catch (error) {
        console.error('Memory tests failed:', error);
        results.error = error.message;
      }

      return results;
    }

    /**
     * Run cross-browser compatibility tests
     * @returns {Object} Cross-browser test results
     */
    async runCrossBrowserTests() {
      console.log('Running cross-browser tests...');
      const results = {
        currentBrowser: this.getBrowserInfo(),
        features: {},
        compatibility: {},
        workarounds: []
      };

      try {
        // Test browser-specific features
        results.features = {
          defineProperty: this.testDefinePropertySupport(),
          webgl: this.testWebGLSupport(),
          canvas2d: this.testCanvas2DSupport(),
          devicePixelRatio: this.testDevicePixelRatioSupport(),
          performanceAPI: this.testPerformanceAPISupport()
        };

        // Test compatibility
        results.compatibility = this.assessBrowserCompatibility(results.features);

        // Generate workarounds for identified issues
        results.workarounds = this.generateBrowserWorkarounds(results.compatibility);

      } catch (error) {
        console.error('Cross-browser tests failed:', error);
        results.error = error.message;
      }

      return results;
    }

    /**
     * Test a specific visual pattern at target DPI
     * @param {string} patternName - Pattern name
     * @param {Function} patternFunc - Pattern generation function
     * @param {number} targetDPI - Target DPI
     * @returns {Object} Pattern test results
     */
    async testPattern(patternName, patternFunc, targetDPI) {
      const results = {
        pattern: patternName,
        targetDPI,
        success: false,
        quality: 0,
        metrics: {},
        issues: []
      };

      try {
        // Set target DPI
        if (this.dpiManager) {
          this.dpiManager.setDPI(targetDPI);
        }

        // Create test canvas
        const canvas = this.createTestCanvas(800, 600);
        const startTime = performance.now();

        // Generate pattern
        await patternFunc(canvas, targetDPI);

        // Measure rendering time
        const renderTime = performance.now() - startTime;

        // Analyze pattern quality
        const qualityMetrics = this.analyzePatternQuality(canvas, patternName);

        results.success = true;
        results.quality = qualityMetrics.overallScore;
        results.metrics = {
          renderTime,
          ...qualityMetrics
        };

        // Clean up
        this.cleanupTestCanvas();
        if (this.dpiManager) {
          this.dpiManager.restoreOriginalDPI();
        }

      } catch (error) {
        console.error(`Pattern test failed for ${patternName}:`, error);
        results.error = error.message;
        results.issues.push(error.message);
      }

      return results;
    }

    /**
     * Create grid pattern for pixel alignment testing
     * @param {HTMLCanvasElement} canvas - Test canvas
     * @param {number} targetDPI - Target DPI
     */
    async createGridPattern(canvas, targetDPI) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const scaleFactor = targetDPI / 96;
      const gridSize = Math.round(20 * scaleFactor);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Set line properties
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = Math.max(1, scaleFactor * 0.5);
      
      // Draw vertical lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Draw horizontal lines
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    /**
     * Create text pattern for text rendering quality testing
     * @param {HTMLCanvasElement} canvas - Test canvas
     * @param {number} targetDPI - Target DPI
     */
    async createTextPattern(canvas, targetDPI) {
      const ctx = canvas.getContext('2d');
      const scaleFactor = targetDPI / 96;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Test different font sizes
      const fontSizes = [8, 10, 12, 14, 16, 20, 24].map(size => Math.round(size * scaleFactor));
      const testText = 'Resolution Test 123 !@#';
      
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      
      fontSizes.forEach((fontSize, index) => {
        ctx.font = `${fontSize}px Arial`;
        const y = index * (fontSize + 10);
        ctx.fillText(`${fontSize}px: ${testText}`, 10, y);
      });
    }

    /**
     * Create gradient pattern for smooth color transition testing
     * @param {HTMLCanvasElement} canvas - Test canvas
     * @param {number} targetDPI - Target DPI
     */
    async createGradientPattern(canvas, targetDPI) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Create linear gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.25, '#ffff00');
      gradient.addColorStop(0.5, '#00ff00');
      gradient.addColorStop(0.75, '#00ffff');
      gradient.addColorStop(1, '#0000ff');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    /**
     * Create line pattern for anti-aliasing testing
     * @param {HTMLCanvasElement} canvas - Test canvas
     * @param {number} targetDPI - Target DPI
     */
    async createLinePattern(canvas, targetDPI) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const scaleFactor = targetDPI / 96;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = scaleFactor;
      
      // Draw lines at different angles
      const angles = [0, 15, 30, 45, 60, 75, 90];
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;
      
      angles.forEach(angle => {
        const radian = (angle * Math.PI) / 180;
        const endX = centerX + Math.cos(radian) * radius;
        const endY = centerY + Math.sin(radian) * radius;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      });
    }

    /**
     * Create circle pattern for curve rendering testing
     * @param {HTMLCanvasElement} canvas - Test canvas
     * @param {number} targetDPI - Target DPI
     */
    async createCirclePattern(canvas, targetDPI) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const scaleFactor = targetDPI / 96;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = scaleFactor;
      
      // Draw circles of different sizes
      const centerX = width / 2;
      const centerY = height / 2;
      const radii = [20, 40, 60, 80, 100].map(r => r * scaleFactor);
      
      radii.forEach(radius => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      });
    }

    /**
     * Analyze pattern quality metrics
     * @param {HTMLCanvasElement} canvas - Canvas to analyze
     * @param {string} patternName - Pattern name
     * @returns {Object} Quality metrics
     */
    analyzePatternQuality(canvas, patternName) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Basic quality metrics
      const metrics = {
        sharpness: this.calculateSharpness(data, canvas.width, canvas.height),
        contrast: this.calculateContrast(data),
        aliasing: this.detectAliasing(data, canvas.width, canvas.height),
        uniformity: this.calculateUniformity(data),
        overallScore: 0
      };
      
      // Calculate overall score based on pattern type
      metrics.overallScore = this.calculatePatternScore(metrics, patternName);
      
      return metrics;
    }

    /**
     * Calculate sharpness metric
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Sharpness score (0-100)
     */
    calculateSharpness(data, width, height) {
      let sharpness = 0;
      let count = 0;
      
      // Calculate gradient magnitude
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          
          // Get grayscale values
          const current = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const right = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
          const bottom = (data[(y + 1) * width * 4 + x * 4] + 
                         data[(y + 1) * width * 4 + x * 4 + 1] + 
                         data[(y + 1) * width * 4 + x * 4 + 2]) / 3;
          
          // Calculate gradient
          const gx = Math.abs(right - current);
          const gy = Math.abs(bottom - current);
          const gradient = Math.sqrt(gx * gx + gy * gy);
          
          sharpness += gradient;
          count++;
        }
      }
      
      return count > 0 ? Math.min(100, (sharpness / count) * 2) : 0;
    }

    /**
     * Calculate contrast metric
     * @param {Uint8ClampedArray} data - Image data
     * @returns {number} Contrast score (0-100)
     */
    calculateContrast(data) {
      let min = 255, max = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        min = Math.min(min, gray);
        max = Math.max(max, gray);
      }
      
      return ((max - min) / 255) * 100;
    }

    /**
     * Detect aliasing artifacts
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {number} Aliasing score (lower is better, 0-100)
     */
    detectAliasing(data, width, height) {
      let aliasingCount = 0;
      let totalEdges = 0;
      
      // Look for jagged edges
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          const current = (data[i] + data[i + 1] + data[i + 2]) / 3;
          
          // Check neighboring pixels
          const neighbors = [
            (data[i - 4] + data[i - 3] + data[i - 2]) / 3, // left
            (data[i + 4] + data[i + 5] + data[i + 6]) / 3, // right
            (data[(y - 1) * width * 4 + x * 4] + 
             data[(y - 1) * width * 4 + x * 4 + 1] + 
             data[(y - 1) * width * 4 + x * 4 + 2]) / 3, // top
            (data[(y + 1) * width * 4 + x * 4] + 
             data[(y + 1) * width * 4 + x * 4 + 1] + 
             data[(y + 1) * width * 4 + x * 4 + 2]) / 3  // bottom
          ];
          
          // Check for sharp transitions (potential aliasing)
          let isEdge = false;
          neighbors.forEach(neighbor => {
            if (Math.abs(current - neighbor) > 128) {
              isEdge = true;
              totalEdges++;
              
              // Check for jaggedness
              if (this.isJaggedEdge(data, x, y, width, height)) {
                aliasingCount++;
              }
            }
          });
        }
      }
      
      return totalEdges > 0 ? (aliasingCount / totalEdges) * 100 : 0;
    }

    /**
     * Check if an edge is jagged (aliased)
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {boolean} Whether the edge is jagged
     */
    isJaggedEdge(data, x, y, width, height) {
      // Simple heuristic: check for stair-step patterns
      const windowSize = 3;
      let stepChanges = 0;
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const i = (ny * width + nx) * 4;
            const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // Count rapid changes in small areas
            if (dx > 0 || dy > 0) {
              const prevI = ((ny - Math.sign(dy)) * width + (nx - Math.sign(dx))) * 4;
              if (prevI >= 0 && prevI < data.length) {
                const prevGray = (data[prevI] + data[prevI + 1] + data[prevI + 2]) / 3;
                if (Math.abs(gray - prevGray) > 64) {
                  stepChanges++;
                }
              }
            }
          }
        }
      }
      
      return stepChanges > 4; // Threshold for considering jagged
    }

    /**
     * Calculate uniformity metric
     * @param {Uint8ClampedArray} data - Image data
     * @returns {number} Uniformity score (0-100)
     */
    calculateUniformity(data) {
      const values = [];
      
      // Sample pixel values
      for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        values.push(gray);
      }
      
      if (values.length === 0) return 0;
      
      // Calculate standard deviation
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      // Convert to uniformity score (lower stdDev = higher uniformity)
      return Math.max(0, 100 - (stdDev / 255) * 100);
    }

    /**
     * Calculate pattern-specific quality score
     * @param {Object} metrics - Quality metrics
     * @param {string} patternName - Pattern name
     * @returns {number} Overall score (0-100)
     */
    calculatePatternScore(metrics, patternName) {
      // Weight metrics differently based on pattern type
      const weights = {
        grid: { sharpness: 0.4, contrast: 0.3, aliasing: 0.2, uniformity: 0.1 },
        text: { sharpness: 0.5, contrast: 0.2, aliasing: 0.3, uniformity: 0.0 },
        gradient: { sharpness: 0.1, contrast: 0.2, aliasing: 0.1, uniformity: 0.6 },
        lines: { sharpness: 0.3, contrast: 0.3, aliasing: 0.4, uniformity: 0.0 },
        circles: { sharpness: 0.3, contrast: 0.2, aliasing: 0.4, uniformity: 0.1 }
      };
      
      const weight = weights[patternName] || weights.grid;
      
      return (
        metrics.sharpness * weight.sharpness +
        metrics.contrast * weight.contrast +
        (100 - metrics.aliasing) * weight.aliasing + // Invert aliasing (lower is better)
        metrics.uniformity * weight.uniformity
      );
    }

    /**
     * Enhanced Resolution Validation Methods
     * Advanced validation tools for 300 DPI quality verification
     */

    /**
     * Validate 300 DPI output quality against standards
     * @param {HTMLCanvasElement} canvas - Canvas to validate
     * @param {number} targetDPI - Target DPI (default: 300)
     * @returns {Object} Validation results
     */
    validate300DPIQuality(canvas, targetDPI = 300) {
      const startTime = performance.now();
      
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Cannot get 2D context from canvas');
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const validation = {
          targetDPI,
          actualDPI: this.calculateActualDPI(canvas, targetDPI),
          pixelDensity: this.analyzePlexelDensity(imageData, canvas.width, canvas.height),
          textRendering: this.validateTextRenderingQuality(canvas),
          lineSharpness: this.validateLineSharpness(imageData, canvas.width, canvas.height),
          colorAccuracy: this.validateColorAccuracy(imageData),
          antiAliasing: this.validateAntiAliasing(imageData, canvas.width, canvas.height),
          memoryEfficiency: this.validateMemoryEfficiency(canvas),
          renderingTime: 0,
          overallScore: 0,
          recommendations: [],
          certification: null
        };

        validation.renderingTime = performance.now() - startTime;
        validation.overallScore = this.calculateValidationScore(validation);
        validation.recommendations = this.generateValidationRecommendations(validation);
        validation.certification = this.getCertificationLevel(validation.overallScore);

        return validation;
      } catch (error) {
        return {
          error: error.message,
          targetDPI,
          failed: true,
          renderingTime: performance.now() - startTime
        };
      }
    }

    /**
     * Calculate actual DPI from canvas properties
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} targetDPI - Target DPI
     * @returns {number} Calculated actual DPI
     */
    calculateActualDPI(canvas, targetDPI) {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const canvasPixelRatio = canvas.width / (canvas.offsetWidth || canvas.style.width.replace('px', '') || canvas.width);
      const effectiveRatio = canvasPixelRatio || devicePixelRatio;
      
      return Math.round(96 * effectiveRatio); // 96 is standard screen DPI
    }

    /**
     * Analyze pixel density for quality assessment
     * @param {ImageData} imageData - Canvas image data
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {Object} Pixel density analysis
     */
    analyzePlexelDensity(imageData, width, height) {
      const data = imageData.data;
      const totalPixels = width * height;
      const sampleSize = Math.min(10000, Math.floor(totalPixels / 100)); // Sample 1% or max 10k pixels
      
      let uniqueColors = new Set();
      let colorVariance = 0;
      let avgBrightness = 0;
      
      // Sample pixels systematically
      const step = Math.floor(totalPixels / sampleSize);
      
      for (let i = 0; i < data.length; i += step * 4) {
        if (i + 3 >= data.length) break;
        
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Track unique colors
        const colorKey = `${r},${g},${b},${a}`;
        uniqueColors.add(colorKey);
        
        // Calculate brightness
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        avgBrightness += brightness;
      }
      
      avgBrightness /= sampleSize;
      
      return {
        totalPixels,
        sampledPixels: sampleSize,
        uniqueColors: uniqueColors.size,
        colorDiversity: (uniqueColors.size / sampleSize) * 100,
        averageBrightness: Math.round(avgBrightness),
        densityScore: Math.min(100, (uniqueColors.size / sampleSize) * 200) // 0-100 score
      };
    }

    /**
     * Validate text rendering quality for 300 DPI
     * @param {HTMLCanvasElement} canvas - Canvas to test
     * @returns {Object} Text rendering validation
     */
    validateTextRenderingQuality(canvas) {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 400;
      testCanvas.height = 200;
      const ctx = testCanvas.getContext('2d');
      
      // Apply same scaling as main canvas
      const scaleFactor = canvas.width / canvas.offsetWidth || 1;
      ctx.scale(scaleFactor, scaleFactor);
      
      // Test different font sizes that should be crisp at 300 DPI
      const testSizes = [8, 10, 12, 14, 16, 20];
      const results = [];
      
      testSizes.forEach((fontSize, index) => {
        ctx.clearRect(0, 0, 400, 200);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        
        const testText = 'Ag'; // Good test characters for sharpness
        ctx.fillText(testText, 10, 10);
        
        const imageData = ctx.getImageData(0, 0, 100, 50);
        const sharpness = this.calculateTextSharpness(imageData);
        
        results.push({
          fontSize,
          sharpness,
          readable: sharpness > 50, // Threshold for readability
          crisp: sharpness > 75 // Threshold for crispness at 300 DPI
        });
      });
      
      testCanvas.remove();
      
      const avgSharpness = results.reduce((sum, r) => sum + r.sharpness, 0) / results.length;
      const readableCount = results.filter(r => r.readable).length;
      const crispCount = results.filter(r => r.crisp).length;
      
      return {
        results,
        averageSharpness: Math.round(avgSharpness),
        readabilityScore: (readableCount / results.length) * 100,
        crispnessScore: (crispCount / results.length) * 100,
        overallScore: (avgSharpness + (crispCount / results.length) * 100) / 2
      };
    }

    /**
     * Calculate text sharpness from image data
     * @param {ImageData} imageData - Image data containing text
     * @returns {number} Sharpness score (0-100)
     */
    calculateTextSharpness(imageData) {
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      
      let edgeSum = 0;
      let edgeCount = 0;
      
      // Use Sobel operator for edge detection
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // Convert to grayscale
          const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          
          // Sobel X kernel
          const gx = 
            -1 * ((data[idx - width * 4 - 4] + data[idx - width * 4 - 3] + data[idx - width * 4 - 2]) / 3) +
             1 * ((data[idx - width * 4 + 4] + data[idx - width * 4 + 3] + data[idx - width * 4 + 2]) / 3) +
            -2 * ((data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3) +
             2 * ((data[idx + 4] + data[idx + 3] + data[idx + 2]) / 3) +
            -1 * ((data[idx + width * 4 - 4] + data[idx + width * 4 - 3] + data[idx + width * 4 - 2]) / 3) +
             1 * ((data[idx + width * 4 + 4] + data[idx + width * 4 + 3] + data[idx + width * 4 + 2]) / 3);
          
          // Sobel Y kernel
          const gy = 
            -1 * ((data[idx - width * 4 - 4] + data[idx - width * 4 - 3] + data[idx - width * 4 - 2]) / 3) +
            -2 * ((data[idx - width * 4] + data[idx - width * 4 + 1] + data[idx - width * 4 + 2]) / 3) +
            -1 * ((data[idx - width * 4 + 4] + data[idx - width * 4 + 3] + data[idx - width * 4 + 2]) / 3) +
             1 * ((data[idx + width * 4 - 4] + data[idx + width * 4 - 3] + data[idx + width * 4 - 2]) / 3) +
             2 * ((data[idx + width * 4] + data[idx + width * 4 + 1] + data[idx + width * 4 + 2]) / 3) +
             1 * ((data[idx + width * 4 + 4] + data[idx + width * 4 + 3] + data[idx + width * 4 + 2]) / 3);
          
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          
          if (magnitude > 10) { // Only count significant edges
            edgeSum += magnitude;
            edgeCount++;
          }
        }
      }
      
      return edgeCount > 0 ? Math.min(100, (edgeSum / edgeCount) / 2) : 0;
    }

    /**
     * Validate line sharpness for vector graphics
     * @param {ImageData} imageData - Canvas image data
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {Object} Line sharpness validation
     */
    validateLineSharpness(imageData, width, height) {
      const data = imageData.data;
      let sharpEdges = 0;
      let softEdges = 0;
      let totalEdges = 0;
      
      // Sample horizontal and vertical lines
      const sampleLines = [
        // Horizontal samples
        { y: Math.floor(height * 0.25), x1: 0, x2: width - 1, direction: 'horizontal' },
        { y: Math.floor(height * 0.5), x1: 0, x2: width - 1, direction: 'horizontal' },
        { y: Math.floor(height * 0.75), x1: 0, x2: width - 1, direction: 'horizontal' },
        // Vertical samples
        { x: Math.floor(width * 0.25), y1: 0, y2: height - 1, direction: 'vertical' },
        { x: Math.floor(width * 0.5), y1: 0, y2: height - 1, direction: 'vertical' },
        { x: Math.floor(width * 0.75), y1: 0, y2: height - 1, direction: 'vertical' }
      ];
      
      sampleLines.forEach(line => {
        const transitions = this.findColorTransitions(data, width, height, line);
        
        transitions.forEach(transition => {
          totalEdges++;
          
          if (transition.sharpness > 80) {
            sharpEdges++;
          } else if (transition.sharpness < 40) {
            softEdges++;
          }
        });
      });
      
      return {
        totalEdges,
        sharpEdges,
        softEdges,
        sharpnessRatio: totalEdges > 0 ? (sharpEdges / totalEdges) * 100 : 0,
        softnessPenalty: totalEdges > 0 ? (softEdges / totalEdges) * 100 : 0,
        overallScore: totalEdges > 0 ? ((sharpEdges - softEdges * 0.5) / totalEdges) * 100 : 0
      };
    }

    /**
     * Find color transitions along a line
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Object} line - Line definition
     * @returns {Array} Array of transition objects
     */
    findColorTransitions(data, width, height, line) {
      const transitions = [];
      let lastColor = null;
      
      if (line.direction === 'horizontal') {
        for (let x = line.x1; x <= line.x2; x++) {
          const idx = (line.y * width + x) * 4;
          if (idx >= data.length) continue;
          
          const color = {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            brightness: (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114)
          };
          
          if (lastColor && Math.abs(color.brightness - lastColor.brightness) > 50) {
            // Significant brightness change detected
            const sharpness = this.calculateTransitionSharpness(data, width, x, line.y, 'horizontal');
            transitions.push({
              position: x,
              from: lastColor.brightness,
              to: color.brightness,
              difference: Math.abs(color.brightness - lastColor.brightness),
              sharpness
            });
          }
          
          lastColor = color;
        }
      } else if (line.direction === 'vertical') {
        for (let y = line.y1; y <= line.y2; y++) {
          const idx = (y * width + line.x) * 4;
          if (idx >= data.length) continue;
          
          const color = {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            brightness: (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114)
          };
          
          if (lastColor && Math.abs(color.brightness - lastColor.brightness) > 50) {
            const sharpness = this.calculateTransitionSharpness(data, width, line.x, y, 'vertical');
            transitions.push({
              position: y,
              from: lastColor.brightness,
              to: color.brightness,
              difference: Math.abs(color.brightness - lastColor.brightness),
              sharpness
            });
          }
          
          lastColor = color;
        }
      }
      
      return transitions;
    }

    /**
     * Calculate sharpness of a color transition
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} direction - Transition direction
     * @returns {number} Sharpness score (0-100)
     */
    calculateTransitionSharpness(data, width, x, y, direction) {
      const windowSize = 3;
      let gradientSum = 0;
      let count = 0;
      
      if (direction === 'horizontal') {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const idx1 = (y * width + (x + dx)) * 4;
          const idx2 = (y * width + (x + dx + 1)) * 4;
          
          if (idx1 >= 0 && idx2 < data.length) {
            const brightness1 = (data[idx1] * 0.299 + data[idx1 + 1] * 0.587 + data[idx1 + 2] * 0.114);
            const brightness2 = (data[idx2] * 0.299 + data[idx2 + 1] * 0.587 + data[idx2 + 2] * 0.114);
            
            gradientSum += Math.abs(brightness2 - brightness1);
            count++;
          }
        }
      } else {
        for (let dy = -windowSize; dy <= windowSize; dy++) {
          const idx1 = ((y + dy) * width + x) * 4;
          const idx2 = ((y + dy + 1) * width + x) * 4;
          
          if (idx1 >= 0 && idx2 < data.length) {
            const brightness1 = (data[idx1] * 0.299 + data[idx1 + 1] * 0.587 + data[idx1 + 2] * 0.114);
            const brightness2 = (data[idx2] * 0.299 + data[idx2 + 1] * 0.587 + data[idx2 + 2] * 0.114);
            
            gradientSum += Math.abs(brightness2 - brightness1);
            count++;
          }
        }
      }
      
      return count > 0 ? Math.min(100, (gradientSum / count)) : 0;
    }

    /**
     * Validate color accuracy for print reproduction
     * @param {ImageData} imageData - Canvas image data
     * @returns {Object} Color accuracy validation
     */
    validateColorAccuracy(imageData) {
      const data = imageData.data;
      const colorProfile = {
        reds: 0, greens: 0, blues: 0,
        grays: 0, whites: 0, blacks: 0,
        saturated: 0, desaturated: 0
      };
      
      let totalPixels = 0;
      let colorVariance = 0;
      
      // Sample every 10th pixel for performance
      for (let i = 0; i < data.length; i += 40) { // 40 = 10 pixels * 4 components
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a > 128) { // Only count non-transparent pixels
          totalPixels++;
          
          // Classify color
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max > 0 ? (max - min) / max : 0;
          const brightness = (r + g + b) / 3;
          
          if (saturation < 0.1) {
            if (brightness < 32) colorProfile.blacks++;
            else if (brightness > 223) colorProfile.whites++;
            else colorProfile.grays++;
          } else {
            if (r > g && r > b) colorProfile.reds++;
            else if (g > r && g > b) colorProfile.greens++;
            else if (b > r && b > g) colorProfile.blues++;
            
            if (saturation > 0.7) colorProfile.saturated++;
            else colorProfile.desaturated++;
          }
          
          // Calculate color variance for diversity
          const variance = Math.pow(r - 128, 2) + Math.pow(g - 128, 2) + Math.pow(b - 128, 2);
          colorVariance += variance;
        }
      }
      
      // Normalize profiles to percentages
      if (totalPixels > 0) {
        Object.keys(colorProfile).forEach(key => {
          colorProfile[key] = (colorProfile[key] / totalPixels) * 100;
        });
        colorVariance = Math.sqrt(colorVariance / totalPixels);
      }
      
      return {
        profile: colorProfile,
        diversity: Math.min(100, colorVariance / 100),
        printSuitability: this.assessPrintSuitability(colorProfile),
        recommendGamutWarning: colorProfile.saturated > 30 // High saturation may not print well
      };
    }

    /**
     * Assess print suitability based on color profile
     * @param {Object} colorProfile - Color distribution profile
     * @returns {number} Print suitability score (0-100)
     */
    assessPrintSuitability(colorProfile) {
      let score = 100;
      
      // Penalize extreme distributions
      if (colorProfile.blacks > 50) score -= 10; // Too much black
      if (colorProfile.whites > 50) score -= 10; // Too much white
      if (colorProfile.saturated > 40) score -= 15; // Too much saturation
      if (colorProfile.grays < 10) score -= 5; // Too little grayscale
      
      // Reward balanced distributions
      const balance = Math.abs(colorProfile.reds - colorProfile.greens) + 
                     Math.abs(colorProfile.greens - colorProfile.blues) + 
                     Math.abs(colorProfile.blues - colorProfile.reds);
      
      if (balance < 30) score += 10; // Well balanced colors
      
      return Math.max(0, score);
    }

    /**
     * Validate anti-aliasing quality
     * @param {ImageData} imageData - Canvas image data
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {Object} Anti-aliasing validation
     */
    validateAntiAliasing(imageData, width, height) {
      const data = imageData.data;
      let aliasedEdges = 0;
      let smoothEdges = 0;
      let totalEdges = 0;
      
      // Sample diagonal and curved areas where aliasing is most visible
      const sampleRegions = [
        { x: Math.floor(width * 0.25), y: Math.floor(height * 0.25), size: 20 },
        { x: Math.floor(width * 0.75), y: Math.floor(height * 0.25), size: 20 },
        { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5), size: 30 },
        { x: Math.floor(width * 0.25), y: Math.floor(height * 0.75), size: 20 },
        { x: Math.floor(width * 0.75), y: Math.floor(height * 0.75), size: 20 }
      ];
      
      sampleRegions.forEach(region => {
        const analysis = this.analyzeRegionAliasing(data, width, height, region);
        totalEdges += analysis.edges;
        aliasedEdges += analysis.aliased;
        smoothEdges += analysis.smooth;
      });
      
      return {
        totalEdges,
        aliasedEdges,
        smoothEdges,
        aliasingPercentage: totalEdges > 0 ? (aliasedEdges / totalEdges) * 100 : 0,
        smoothnessPercentage: totalEdges > 0 ? (smoothEdges / totalEdges) * 100 : 0,
        qualityScore: totalEdges > 0 ? 100 - ((aliasedEdges / totalEdges) * 100) : 100
      };
    }

    /**
     * Analyze aliasing in a specific region
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {Object} region - Region to analyze
     * @returns {Object} Regional aliasing analysis
     */
    analyzeRegionAliasing(data, width, height, region) {
      let edges = 0;
      let aliased = 0;
      let smooth = 0;
      
      const startX = Math.max(0, region.x - region.size);
      const endX = Math.min(width - 1, region.x + region.size);
      const startY = Math.max(0, region.y - region.size);
      const endY = Math.min(height - 1, region.y + region.size);
      
      for (let y = startY; y < endY - 1; y++) {
        for (let x = startX; x < endX - 1; x++) {
          const current = this.getPixelBrightness(data, width, x, y);
          const right = this.getPixelBrightness(data, width, x + 1, y);
          const bottom = this.getPixelBrightness(data, width, x, y + 1);
          
          const horizontalDiff = Math.abs(current - right);
          const verticalDiff = Math.abs(current - bottom);
          
          if (horizontalDiff > 50 || verticalDiff > 50) {
            edges++;
            
            // Check for intermediate values (anti-aliasing)
            const hasIntermediateH = this.hasIntermediateValues(data, width, x, y, x + 1, y);
            const hasIntermediateV = this.hasIntermediateValues(data, width, x, y, x, y + 1);
            
            if (hasIntermediateH || hasIntermediateV) {
              smooth++;
            } else if (horizontalDiff > 128 || verticalDiff > 128) {
              aliased++;
            }
          }
        }
      }
      
      return { edges, aliased, smooth };
    }

    /**
     * Get pixel brightness
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Brightness value
     */
    getPixelBrightness(data, width, x, y) {
      const idx = (y * width + x) * 4;
      return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
    }

    /**
     * Check for intermediate values between two pixels (indicating anti-aliasing)
     * @param {Uint8ClampedArray} data - Image data
     * @param {number} width - Image width
     * @param {number} x1 - First pixel X
     * @param {number} y1 - First pixel Y
     * @param {number} x2 - Second pixel X
     * @param {number} y2 - Second pixel Y
     * @returns {boolean} Whether intermediate values exist
     */
    hasIntermediateValues(data, width, x1, y1, x2, y2) {
      const brightness1 = this.getPixelBrightness(data, width, x1, y1);
      const brightness2 = this.getPixelBrightness(data, width, x2, y2);
      const expectedIntermediate = (brightness1 + brightness2) / 2;
      
      // Check surrounding pixels for intermediate values
      const neighbors = [
        [x1 - 1, y1], [x1 + 1, y1], [x1, y1 - 1], [x1, y1 + 1],
        [x2 - 1, y2], [x2 + 1, y2], [x2, y2 - 1], [x2, y2 + 1]
      ];
      
      for (const [x, y] of neighbors) {
        if (x >= 0 && y >= 0 && x < width && y >= 0) {
          const neighborBrightness = this.getPixelBrightness(data, width, x, y);
          if (Math.abs(neighborBrightness - expectedIntermediate) < 20) {
            return true; // Found intermediate value
          }
        }
      }
      
      return false;
    }

    /**
     * Validate memory efficiency during rendering
     * @param {HTMLCanvasElement} canvas - Canvas to analyze
     * @returns {Object} Memory efficiency validation
     */
    validateMemoryEfficiency(canvas) {
      const memoryBefore = this.measureCurrentMemory();
      const canvasMemory = (canvas.width * canvas.height * 4) / (1024 * 1024); // MB
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      return {
        canvasMemoryMB: Math.round(canvasMemory * 100) / 100,
        systemMemoryMB: memoryBefore,
        devicePixelRatio,
        efficiencyRatio: canvasMemory > 0 ? (canvasMemory / devicePixelRatio) : 0,
        isEfficient: canvasMemory < 200, // Under 200MB is considered efficient
        warning: canvasMemory > 500 ? 'High memory usage - consider optimization' : null
      };
    }

    /**
     * Calculate overall validation score
     * @param {Object} validation - Validation results
     * @returns {number} Overall score (0-100)  
     */
    calculateValidationScore(validation) {
      const weights = {
        pixelDensity: 0.25,
        textRendering: 0.25,
        lineSharpness: 0.20,
        colorAccuracy: 0.15,
        antiAliasing: 0.10,
        memoryEfficiency: 0.05
      };
      
      let score = 0;
      
      if (validation.pixelDensity) {
        score += validation.pixelDensity.densityScore * weights.pixelDensity;
      }
      
      if (validation.textRendering) {
        score += validation.textRendering.overallScore * weights.textRendering;
      }
      
      if (validation.lineSharpness) {
        score += validation.lineSharpness.overallScore * weights.lineSharpness;
      }
      
      if (validation.colorAccuracy) {
        score += validation.colorAccuracy.printSuitability * weights.colorAccuracy;
      }
      
      if (validation.antiAliasing) {
        score += validation.antiAliasing.qualityScore * weights.antiAliasing;
      }
      
      if (validation.memoryEfficiency) {
        const memoryScore = validation.memoryEfficiency.isEfficient ? 100 : 
                           validation.memoryEfficiency.canvasMemoryMB < 500 ? 75 : 50;
        score += memoryScore * weights.memoryEfficiency;
      }
      
      return Math.round(score);
    }

    /**
     * Generate validation recommendations
     * @param {Object} validation - Validation results
     * @returns {Array} Array of recommendations
     */
    generateValidationRecommendations(validation) {
      const recommendations = [];
      
      if (validation.pixelDensity && validation.pixelDensity.densityScore < 70) {
        recommendations.push({
          type: 'warning',
          category: 'density',
          message: 'Pixel density below recommended threshold',
          suggestion: 'Increase canvas resolution or DPI setting'
        });
      }
      
      if (validation.textRendering && validation.textRendering.crispnessScore < 80) {
        recommendations.push({
          type: 'warning',
          category: 'text',
          message: 'Text rendering not crisp enough for 300 DPI',
          suggestion: 'Check font rendering settings and anti-aliasing'
        });
      }
      
      if (validation.lineSharpness && validation.lineSharpness.overallScore < 70) {
        recommendations.push({
          type: 'warning',
          category: 'lines',
          message: 'Line sharpness below print quality standards',
          suggestion: 'Disable image smoothing for pixel-perfect lines'
        });
      }
      
      if (validation.colorAccuracy && validation.colorAccuracy.recommendGamutWarning) {
        recommendations.push({
          type: 'info',
          category: 'color',
          message: 'High color saturation detected',
          suggestion: 'Consider color profile adjustment for print reproduction'
        });
      }
      
      if (validation.antiAliasing && validation.antiAliasing.aliasingPercentage > 20) {
        recommendations.push({
          type: 'warning',
          category: 'aliasing',
          message: 'Significant aliasing artifacts detected',
          suggestion: 'Enable anti-aliasing for smooth curves and diagonals'
        });
      }
      
      if (validation.memoryEfficiency && !validation.memoryEfficiency.isEfficient) {
        recommendations.push({
          type: 'caution',
          category: 'memory',
          message: 'High memory usage detected',
          suggestion: 'Consider progressive rendering or canvas size optimization'
        });
      }
      
      return recommendations;
    }

    /**
     * Get certification level based on overall score
     * @param {number} score - Overall validation score
     * @returns {Object} Certification information
     */
    getCertificationLevel(score) {
      if (score >= 90) {
        return {
          level: 'premium',
          label: 'Premium Print Quality',
          description: 'Meets professional 300 DPI print standards',
          color: '#22c55e'
        };
      } else if (score >= 80) {
        return {
          level: 'standard',
          label: 'Standard Print Quality', 
          description: 'Suitable for most print applications',
          color: '#3b82f6'
        };
      } else if (score >= 70) {
        return {
          level: 'acceptable',
          label: 'Acceptable Quality',
          description: 'May show quality issues in high-end printing',
          color: '#f59e0b'
        };
      } else {
        return {
          level: 'poor',
          label: 'Below Print Standards',
          description: 'Not recommended for professional printing',
          color: '#ef4444'
        };
      }
    }

    // Additional helper methods for test framework...
    
    /**
     * Create test container element
     * @returns {HTMLElement} Test container
     */
    createTestContainer() {
      let container = document.getElementById(this.options.testContainerId);
      
      if (!container) {
        container = document.createElement('div');
        container.id = this.options.testContainerId;
        container.style.cssText = `
          position: absolute;
          top: -10000px;
          left: -10000px;
          visibility: hidden;
          pointer-events: none;
        `;
        document.body.appendChild(container);
      }
      
      return container;
    }

    /**
     * Create test canvas
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {HTMLCanvasElement} Test canvas
     */
    createTestCanvas(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.style.display = 'none';
      this.testContainer.appendChild(canvas);
      return canvas;
    }

    /**
     * Clean up test canvas
     */
    cleanupTestCanvas() {
      const canvases = this.testContainer.querySelectorAll('canvas');
      canvases.forEach(canvas => canvas.remove());
    }

    /**
     * Get browser information
     * @returns {Object} Browser info
     */
    getBrowserInfo() {
      const userAgent = navigator.userAgent;
      return {
        userAgent,
        name: this.detectBrowserName(userAgent),
        version: this.detectBrowserVersion(userAgent),
        platform: navigator.platform,
        language: navigator.language
      };
    }

    /**
     * Get device information
     * @returns {Object} Device info
     */
    getDeviceInfo() {
      return {
        screenWidth: screen.width,
        screenHeight: screen.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        hardwareConcurrency: navigator.hardwareConcurrency || 1,
        maxTouchPoints: navigator.maxTouchPoints || 0
      };
    }

    /**
     * Detect browser name from user agent
     * @param {string} userAgent - User agent string
     * @returns {string} Browser name
     */
    detectBrowserName(userAgent) {
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
      if (userAgent.includes('Edg')) return 'Edge';
      return 'Unknown';
    }

    /**
     * Detect browser version from user agent
     * @param {string} userAgent - User agent string
     * @returns {string} Browser version
     */
    detectBrowserVersion(userAgent) {
      const patterns = {
        Chrome: /Chrome\/([0-9.]+)/,
        Firefox: /Firefox\/([0-9.]+)/,
        Safari: /Version\/([0-9.]+)/,
        Edge: /Edg\/([0-9.]+)/
      };
      
      const browserName = this.detectBrowserName(userAgent);
      const pattern = patterns[browserName];
      
      if (pattern) {
        const match = userAgent.match(pattern);
        return match ? match[1] : 'Unknown';
      }
      
      return 'Unknown';
    }

    /**
     * Measure current memory usage (approximate)
     * @returns {number} Memory usage in MB
     */
    measureCurrentMemory() {
      if (performance.memory) {
        return Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      }
      return 0;
    }

    /**
     * Export test results as downloadable JSON
     * @param {Object} results - Test results to export
     */
    exportResults(results) {
      const dataStr = JSON.stringify(results, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `resolution-test-results-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
      if (this.testContainer && this.testContainer.parentNode) {
        this.testContainer.parentNode.removeChild(this.testContainer);
      }
      
      if (this.dpiManager) {
        this.dpiManager.cleanup();
      }
    }
  }

  /**
   * Performance Monitor for tracking rendering performance
   */
  class PerformanceMonitor {
    constructor() {
      this.metrics = {
        renderTimes: [],
        memorySnapshots: [],
        frameRates: []
      };
    }

    startMeasurement() {
      this.startTime = performance.now();
      this.startMemory = this.getCurrentMemory();
    }

    endMeasurement() {
      const endTime = performance.now();
      const endMemory = this.getCurrentMemory();
      
      return {
        duration: endTime - this.startTime,
        memoryDelta: endMemory - this.startMemory
      };
    }

    getCurrentMemory() {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    }
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResolutionTester, PerformanceMonitor };
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return { ResolutionTester, PerformanceMonitor }; });
  } else {
    global.ResolutionTester = ResolutionTester;
    global.PerformanceMonitor = PerformanceMonitor;
  }

})(typeof window !== 'undefined' ? window : this);