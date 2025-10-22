/**
 * DPI Manager for High-Resolution Rendering
 * Handles device pixel ratio manipulation for achieving 300 DPI print-quality output
 * 
 * This class provides functionality to temporarily override the browser's devicePixelRatio
 * property to achieve higher resolution rendering for print-quality map exports.
 * 
 * Usage:
 * const dpiManager = new DPIManager();
 * dpiManager.setDPI(300); // Set to 300 DPI
 * // ... render content at high resolution
 * dpiManager.restoreOriginalDPI(); // Restore original setting
 */

(function(global) {
  'use strict';

  class DPIManager {
    constructor() {
      this.originalDevicePixelRatio = null;
      this.currentDPI = null;
      this.isOverridden = false;
      this.supportChecked = false;
      this.supportInfo = null;
      
      // Standard DPI references
      this.DPI_STANDARDS = {
        SCREEN_LOW: 72,      // Standard low-density screens
        SCREEN_STANDARD: 96, // Standard web displays  
        SCREEN_HIGH: 144,    // High-density displays (1.5x)
        SCREEN_RETINA: 192,  // Retina displays (2x)
        PRINT_DRAFT: 150,    // Draft quality printing
        PRINT_STANDARD: 300, // Professional print quality (target)
        PRINT_HIGH: 600      // Premium print quality
      };

      // Enhanced browser compatibility matrix with detailed feature support
      this.BROWSER_SUPPORT = {
        chrome: { 
          minVersion: 60, 
          fullSupport: true,
          features: {
            defineProperty: { minVersion: 60, support: 'full' },
            webgl: { minVersion: 33, support: 'full' },
            canvas2d: { minVersion: 1, support: 'full' },
            performanceAPI: { minVersion: 61, support: 'full' },
            devicePixelRatio: { minVersion: 1, support: 'full' }
          },
          limitations: [],
          workarounds: []
        },
        firefox: { 
          minVersion: 55, 
          fullSupport: true,
          features: {
            defineProperty: { minVersion: 55, support: 'full' },
            webgl: { minVersion: 4, support: 'full' },
            canvas2d: { minVersion: 1, support: 'full' },
            performanceAPI: { minVersion: 48, support: 'full' },
            devicePixelRatio: { minVersion: 4, support: 'full' }
          },
          limitations: ['memory-limits'],
          workarounds: ['reduce-canvas-size']
        },
        safari: { 
          minVersion: 12, 
          fullSupport: true, 
          features: {
            defineProperty: { minVersion: 12, support: 'partial' },
            webgl: { minVersion: 8, support: 'full' },
            canvas2d: { minVersion: 3, support: 'full' },
            performanceAPI: { minVersion: 11, support: 'partial' },
            devicePixelRatio: { minVersion: 3, support: 'full' }
          },
          limitations: ['mobile', 'memory-strict', 'webgl-context-loss'],
          workarounds: ['polyfill-define-property', 'webgl-context-restore', 'memory-monitoring']
        },
        edge: { 
          minVersion: 79, 
          fullSupport: true,
          features: {
            defineProperty: { minVersion: 79, support: 'full' },
            webgl: { minVersion: 12, support: 'full' },
            canvas2d: { minVersion: 12, support: 'full' },
            performanceAPI: { minVersion: 79, support: 'full' },
            devicePixelRatio: { minVersion: 12, support: 'full' }
          },
          limitations: [],
          workarounds: []
        },
        'edge-legacy': {
          minVersion: 12,
          fullSupport: false,
          features: {
            defineProperty: { minVersion: 12, support: 'none' },
            webgl: { minVersion: 12, support: 'partial' },
            canvas2d: { minVersion: 12, support: 'full' },
            performanceAPI: { minVersion: null, support: 'none' },
            devicePixelRatio: { minVersion: 12, support: 'full' }
          },
          limitations: ['no-define-property', 'limited-webgl', 'no-performance-api'],
          workarounds: ['polyfill-all', 'canvas-fallback']
        },
        ie: { 
          minVersion: null, 
          fullSupport: false,
          features: {
            defineProperty: { minVersion: null, support: 'none' },
            webgl: { minVersion: null, support: 'none' },
            canvas2d: { minVersion: 9, support: 'partial' },
            performanceAPI: { minVersion: null, support: 'none' },
            devicePixelRatio: { minVersion: null, support: 'none' }
          },
          limitations: ['no-modern-features', 'canvas-limited'],
          workarounds: ['full-polyfill', 'degraded-mode']
        },
        // Mobile browsers
        'chrome-mobile': {
          minVersion: 60,
          fullSupport: true,
          features: {
            defineProperty: { minVersion: 60, support: 'full' },
            webgl: { minVersion: 33, support: 'full' },
            canvas2d: { minVersion: 1, support: 'full' },
            performanceAPI: { minVersion: 61, support: 'partial' },
            devicePixelRatio: { minVersion: 1, support: 'full' }
          },
          limitations: ['memory-limited', 'touch-only'],
          workarounds: ['memory-optimization', 'touch-coordinates']
        },
        'safari-mobile': {
          minVersion: 12,
          fullSupport: false,
          features: {
            defineProperty: { minVersion: 12, support: 'limited' },
            webgl: { minVersion: 8, support: 'limited' },
            canvas2d: { minVersion: 3, support: 'full' },
            performanceAPI: { minVersion: null, support: 'none' },
            devicePixelRatio: { minVersion: 3, support: 'full' }
          },
          limitations: ['memory-very-limited', 'context-loss-frequent', 'background-throttling'],
          workarounds: ['aggressive-memory-management', 'context-restore', 'background-detection']
        }
      };
    }

    /**
     * Initialize DPI manager and check browser support
     */
    async init() {
      console.log('DPIManager: Initializing...');
      
      try {
        // Store original device pixel ratio
        this.originalDevicePixelRatio = window.devicePixelRatio || 1;
        console.log(`DPIManager: Original device pixel ratio: ${this.originalDevicePixelRatio}`);

        // Check browser support
        this.supportInfo = this.checkBrowserSupport();
        this.supportChecked = true;

        if (!this.supportInfo.supported) {
          console.warn('DPIManager: Browser support limited:', this.supportInfo.warnings);
        }

        console.log('DPIManager: Initialized successfully');
        return this;
      } catch (error) {
        console.error('DPIManager: Initialization failed:', error);
        throw error;
      }
    }

    /**
     * Set custom DPI for high-resolution rendering
     * @param {number} targetDPI - Target DPI (e.g., 300 for print quality)
     * @returns {number} The actual scaling factor applied
     */
    setDPI(targetDPI) {
      if (!this.supportChecked) {
        throw new Error('DPIManager must be initialized before use');
      }

      if (!Number.isInteger(targetDPI) || targetDPI <= 0) {
        throw new Error('Target DPI must be a positive integer');
      }

      if (targetDPI > 1200) {
        console.warn(`DPIManager: Very high DPI requested (${targetDPI}). This may cause performance issues.`);
      }

      try {
        // Store original value if not already stored
        if (!this.isOverridden) {
          this.originalDevicePixelRatio = window.devicePixelRatio || 1;
        }

        // Calculate scaling factor (target DPI / standard web DPI)
        const scalingFactor = targetDPI / this.DPI_STANDARDS.SCREEN_STANDARD;
        
        console.log(`DPIManager: Setting DPI to ${targetDPI} (scaling factor: ${scalingFactor.toFixed(3)})`);

        // Override devicePixelRatio using defineProperty
        if (this.supportInfo.method === 'defineProperty') {
          Object.defineProperty(window, 'devicePixelRatio', {
            get: function() { return scalingFactor; },
            configurable: true
          });
        } else if (this.supportInfo.method === 'polyfill') {
          // Fallback polyfill approach
          window.__originalDevicePixelRatio = this.originalDevicePixelRatio;
          window.devicePixelRatio = scalingFactor;
        }

        // Trigger resize event to notify components of the change
        this.triggerResizeEvent();

        // Update state
        this.currentDPI = targetDPI;
        this.isOverridden = true;

        console.log(`DPIManager: Successfully set device pixel ratio to ${scalingFactor.toFixed(3)}`);
        return scalingFactor;

      } catch (error) {
        console.error('DPIManager: Failed to set DPI:', error);
        throw new Error(`Failed to set DPI: ${error.message}`);
      }
    }

    /**
     * Restore original device pixel ratio
     */
    restoreOriginalDPI() {
      if (!this.isOverridden) {
        console.log('DPIManager: Device pixel ratio not overridden, nothing to restore');
        return;
      }

      try {
        console.log(`DPIManager: Restoring original device pixel ratio: ${this.originalDevicePixelRatio}`);

        if (this.supportInfo.method === 'defineProperty') {
          Object.defineProperty(window, 'devicePixelRatio', {
            get: function() { return this.originalDevicePixelRatio; }.bind(this),
            configurable: true
          });
        } else if (this.supportInfo.method === 'polyfill') {
          window.devicePixelRatio = window.__originalDevicePixelRatio || this.originalDevicePixelRatio;
          delete window.__originalDevicePixelRatio;
        }

        // Trigger resize event to notify components
        this.triggerResizeEvent();

        // Reset state
        this.currentDPI = null;
        this.isOverridden = false;

        console.log('DPIManager: Successfully restored original device pixel ratio');
      } catch (error) {
        console.error('DPIManager: Failed to restore DPI:', error);
        throw new Error(`Failed to restore DPI: ${error.message}`);
      }
    }

    /**
     * Calculate dimensions for print sizes at target DPI with enhanced features
     * @param {string} size - Print size (A4, A3, etc.)
     * @param {number} dpi - Target DPI (default: 300)
     * @param {Object} options - Additional options (orientation, margins, bleed)
     * @returns {Object} Calculated dimensions with comprehensive information
     */
    calculatePrintDimensions(size, dpi = 300, options = {}) {
      const {
        orientation = 'portrait', // 'portrait' | 'landscape'
        margins = { top: 0, right: 0, bottom: 0, left: 0 }, // in mm
        bleed = 0, // bleed area in mm
        includeSafeArea = false, // include safe printing area
        unit = 'px' // return unit: 'px' | 'mm' | 'in'
      } = options;

      const mmToPx = dpi / 25.4; // Convert mm to pixels at specified DPI
      const mmToIn = 1 / 25.4; // Convert mm to inches
      
      const sizes = {
        A4: { width: 210, height: 297 }, // mm
        A3: { width: 297, height: 420 }, // mm  
        A2: { width: 420, height: 594 }, // mm
        A1: { width: 594, height: 841 }, // mm
        A0: { width: 841, height: 1189 }, // mm
        LETTER: { width: 216, height: 279 }, // mm (8.5" x 11")
        LEGAL: { width: 216, height: 356 }, // mm (8.5" x 14")
        TABLOID: { width: 279, height: 432 }, // mm (11" x 17")
        // Additional formats
        A5: { width: 148, height: 210 }, // mm
        A6: { width: 105, height: 148 }, // mm
        B4: { width: 250, height: 353 }, // mm
        B5: { width: 176, height: 250 }, // mm
        POSTCARD: { width: 102, height: 152 }, // mm (4" x 6")
        PHOTO_4x6: { width: 102, height: 152 }, // mm
        PHOTO_5x7: { width: 127, height: 178 }, // mm
        PHOTO_8x10: { width: 203, height: 254 }, // mm
        POSTER_18x24: { width: 457, height: 610 }, // mm
        POSTER_24x36: { width: 610, height: 914 } // mm
      };

      const baseDimensions = sizes[size.toUpperCase()];
      if (!baseDimensions) {
        const available = Object.keys(sizes).join(', ');
        throw new Error(`Unknown size: ${size}. Available sizes: ${available}`);
      }

      // Handle orientation
      let width = baseDimensions.width;
      let height = baseDimensions.height;
      
      if (orientation.toLowerCase() === 'landscape') {
        [width, height] = [height, width];
      }

      // Calculate dimensions with bleed
      const totalWidth = width + (bleed * 2);
      const totalHeight = height + (bleed * 2);

      // Calculate printable area (minus margins)
      const printableWidth = width - margins.left - margins.right;
      const printableHeight = height - margins.top - margins.bottom;

      // Calculate safe area (standard 6mm margin from edges)
      const safeMargin = 6; // mm
      const safeWidth = width - (safeMargin * 2);
      const safeHeight = height - (safeMargin * 2);

      // Convert to pixels
      const pixelWidth = Math.round(width * mmToPx);
      const pixelHeight = Math.round(height * mmToPx);
      const totalPixelWidth = Math.round(totalWidth * mmToPx);
      const totalPixelHeight = Math.round(totalHeight * mmToPx);
      const printablePixelWidth = Math.round(printableWidth * mmToPx);
      const printablePixelHeight = Math.round(printableHeight * mmToPx);
      const safePixelWidth = Math.round(safeWidth * mmToPx);
      const safePixelHeight = Math.round(safeHeight * mmToPx);

      // Create comprehensive result object
      const result = {
        // Basic dimensions
        width: pixelWidth,
        height: pixelHeight,
        
        // Original format info
        format: size.toUpperCase(),
        orientation: orientation,
        dpi: dpi,
        
        // Physical dimensions
        physical: {
          mm: { width: width, height: height },
          inches: { 
            width: parseFloat((width * mmToIn).toFixed(3)), 
            height: parseFloat((height * mmToIn).toFixed(3)) 
          }
        },
        
        // Dimensions with bleed
        withBleed: {
          mm: { width: totalWidth, height: totalHeight },
          px: { width: totalPixelWidth, height: totalPixelHeight },
          inches: { 
            width: parseFloat((totalWidth * mmToIn).toFixed(3)), 
            height: parseFloat((totalHeight * mmToIn).toFixed(3)) 
          }
        },
        
        // Printable area (minus margins)
        printable: {
          mm: { width: printableWidth, height: printableHeight },
          px: { width: printablePixelWidth, height: printablePixelHeight },
          inches: { 
            width: parseFloat((printableWidth * mmToIn).toFixed(3)), 
            height: parseFloat((printableHeight * mmToIn).toFixed(3)) 
          }
        },
        
        // Safe printing area
        safe: includeSafeArea ? {
          mm: { width: safeWidth, height: safeHeight },
          px: { width: safePixelWidth, height: safePixelHeight },
          inches: { 
            width: parseFloat((safeWidth * mmToIn).toFixed(3)), 
            height: parseFloat((safeHeight * mmToIn).toFixed(3)) 
          }
        } : null,
        
        // Additional calculations
        aspectRatio: parseFloat((pixelWidth / pixelHeight).toFixed(3)),
        totalPixels: pixelWidth * pixelHeight,
        totalPixelsWithBleed: totalPixelWidth * totalPixelHeight,
        
        // Memory estimations
        estimatedMemoryMB: Math.round((pixelWidth * pixelHeight * 4) / (1024 * 1024)),
        estimatedMemoryWithBleedMB: Math.round((totalPixelWidth * totalPixelHeight * 4) / (1024 * 1024)),
        
        // Conversion factors
        conversionFactors: {
          mmToPx: mmToPx,
          pxToMm: 1 / mmToPx,
          mmToIn: mmToIn,
          inToMm: 25.4
        },
        
        // Configuration used
        config: {
          margins: margins,
          bleed: bleed,
          includeSafeArea: includeSafeArea,
          unit: unit
        },
        
        // Quality recommendations
        recommendations: this.generateQualityRecommendations(pixelWidth, pixelHeight, dpi),
        
        // Legacy compatibility (maintaining original API)
        mmWidth: width,
        mmHeight: height,
        widthInches: parseFloat((width * mmToIn).toFixed(2)),
        heightInches: parseFloat((height * mmToIn).toFixed(2))
      };

      // Convert final dimensions based on requested unit
      if (unit === 'mm') {
        result.width = width;
        result.height = height;
      } else if (unit === 'in') {
        result.width = parseFloat((width * mmToIn).toFixed(3));
        result.height = parseFloat((height * mmToIn).toFixed(3));
      }
      // Default is 'px', already set

      return result;
    }

    /**
     * Generate quality recommendations based on dimensions and DPI
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels  
     * @param {number} dpi - Target DPI
     * @returns {Array} Array of recommendation objects
     */
    generateQualityRecommendations(width, height, dpi) {
      const recommendations = [];
      const totalPixels = width * height;
      const memoryMB = Math.round((totalPixels * 4) / (1024 * 1024));

      // DPI recommendations
      if (dpi < 150) {
        recommendations.push({
          type: 'warning',
          category: 'dpi',
          message: 'DPI below 150 may result in pixelated prints',
          suggestion: 'Consider increasing to 300 DPI for professional quality'
        });
      } else if (dpi > 600) {
        recommendations.push({
          type: 'info',
          category: 'dpi',
          message: 'Very high DPI may increase processing time significantly',
          suggestion: '300-600 DPI is typically sufficient for most print applications'
        });
      }

      // Memory recommendations
      if (memoryMB > 500) {
        recommendations.push({
          type: 'warning',
          category: 'memory',
          message: `High memory usage estimated: ${memoryMB}MB`,
          suggestion: 'Consider progressive rendering or tiling for large images'
        });
      }

      // Resolution recommendations  
      if (totalPixels > 50000000) { // 50 megapixels
        recommendations.push({
          type: 'caution',
          category: 'resolution',
          message: 'Very high resolution may cause browser performance issues',
          suggestion: 'Test rendering performance and consider optimization'
        });
      }

      // Aspect ratio recommendations
      const aspectRatio = width / height;
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        recommendations.push({
          type: 'info',
          category: 'aspect',
          message: 'Extreme aspect ratio detected',
          suggestion: 'Verify dimensions are correct for intended use'
        });
      }

      return recommendations;
    }

    /**
     * Convert between different units
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit ('px', 'mm', 'in')
     * @param {string} toUnit - Target unit ('px', 'mm', 'in')
     * @param {number} dpi - DPI for pixel conversions
     * @returns {number} Converted value
     */
    convertUnits(value, fromUnit, toUnit, dpi = 300) {
      if (fromUnit === toUnit) return value;

      // Convert to mm as intermediate unit
      let mmValue;
      
      switch (fromUnit.toLowerCase()) {
        case 'px':
          mmValue = value / (dpi / 25.4);
          break;
        case 'in':
          mmValue = value * 25.4;
          break;
        case 'mm':
          mmValue = value;
          break;
        default:
          throw new Error(`Unknown source unit: ${fromUnit}`);
      }

      // Convert from mm to target unit
      switch (toUnit.toLowerCase()) {
        case 'px':
          return Math.round(mmValue * (dpi / 25.4));
        case 'in':
          return parseFloat((mmValue / 25.4).toFixed(3));
        case 'mm':
          return parseFloat(mmValue.toFixed(2));
        default:
          throw new Error(`Unknown target unit: ${toUnit}`);
      }
    }

    /**
     * Get optimal DPI for given print size and intended viewing distance
     * @param {string} printSize - Print size (A4, A3, etc.)
     * @param {number} viewingDistance - Viewing distance in inches
     * @returns {number} Recommended DPI
     */
    getOptimalDPI(printSize, viewingDistance = 12) {
      // Visual acuity calculation: 1 arcminute = 1/60 degree
      // At normal viewing distance, human eye resolves ~0.3mm (300 DPI equivalent)
      
      const baseDPI = 300; // Standard for close viewing (12 inches)
      const scaleFactor = 12 / viewingDistance; // Scale based on viewing distance
      
      // Adjust for print size (larger prints viewed from further away)
      const sizeMultipliers = {
        'A6': 1.2, 'A5': 1.1, 'A4': 1.0, 'A3': 0.9, 'A2': 0.8, 'A1': 0.7, 'A0': 0.6,
        'POSTCARD': 1.2, 'PHOTO_4X6': 1.2, 'PHOTO_5X7': 1.1, 'PHOTO_8X10': 1.0,
        'LETTER': 1.0, 'LEGAL': 0.95, 'TABLOID': 0.9,
        'POSTER_18X24': 0.6, 'POSTER_24X36': 0.5
      };
      
      const sizeMultiplier = sizeMultipliers[printSize.toUpperCase()] || 1.0;
      const recommendedDPI = Math.round(baseDPI * scaleFactor * sizeMultiplier);
      
      // Clamp to practical ranges
      return Math.max(150, Math.min(600, recommendedDPI));
    }

    /**
     * Canvas Scaling System for High-Resolution Output
     * Manages canvas scaling for high-DPI rendering while maintaining visual consistency
     */

    /**
     * Scale canvas for high-resolution rendering
     * @param {HTMLCanvasElement} canvas - Canvas element to scale
     * @param {number} scaleFactor - Scaling factor (from device pixel ratio)
     * @param {Object} options - Scaling options
     * @returns {Object} Scaling information and cleanup function
     */
    scaleCanvas(canvas, scaleFactor, options = {}) {
      const {
        maintainSize = true, // Keep visual size consistent
        scaleContext = true, // Scale the drawing context
        preserveImageSmoothing = false, // Disable smoothing for pixel-perfect rendering
        handleInteractions = true // Handle mouse/touch coordinate adjustments
      } = options;

      const originalWidth = canvas.width;
      const originalHeight = canvas.height;
      const originalStyle = {
        width: canvas.style.width,
        height: canvas.style.height
      };

      try {
        // Scale canvas resolution
        canvas.width = Math.round(originalWidth * scaleFactor);
        canvas.height = Math.round(originalHeight * scaleFactor);

        // Maintain visual size if requested
        if (maintainSize) {
          canvas.style.width = originalWidth + 'px';
          canvas.style.height = originalHeight + 'px';
        }

        // Get and configure context
        const ctx = canvas.getContext('2d');
        if (ctx && scaleContext) {
          // Scale the drawing context
          ctx.scale(scaleFactor, scaleFactor);
          
          // Configure image smoothing
          ctx.imageSmoothingEnabled = !preserveImageSmoothing;
          if (preserveImageSmoothing && ctx.imageSmoothingQuality) {
            ctx.imageSmoothingQuality = 'high';
          }
        }

        // Handle WebGL context
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          // WebGL viewport needs to be updated for the new resolution
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        // Set up interaction handlers if requested
        let interactionCleanup = null;
        if (handleInteractions) {
          interactionCleanup = this.setupCanvasInteractionHandlers(canvas, scaleFactor);
        }

        // Return scaling info and cleanup function
        return {
          scaleFactor,
          originalDimensions: { width: originalWidth, height: originalHeight },
          scaledDimensions: { width: canvas.width, height: canvas.height },
          context: ctx || gl,
          
          // Cleanup function to restore original state
          cleanup: () => {
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            canvas.style.width = originalStyle.width;
            canvas.style.height = originalStyle.height;
            
            if (interactionCleanup) {
              interactionCleanup();
            }
          },

          // Utility functions for coordinate conversion
          toCanvasCoordinates: (x, y) => ({
            x: x * scaleFactor,
            y: y * scaleFactor
          }),
          
          toScreenCoordinates: (x, y) => ({
            x: x / scaleFactor,
            y: y / scaleFactor
          })
        };

      } catch (error) {
        console.error('Canvas scaling failed:', error);
        
        // Restore original state on error
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        canvas.style.width = originalStyle.width;
        canvas.style.height = originalStyle.height;
        
        throw new Error(`Canvas scaling failed: ${error.message}`);
      }
    }

    /**
     * Scale multiple canvases consistently
     * @param {HTMLCanvasElement[]} canvases - Array of canvas elements
     * @param {number} scaleFactor - Scaling factor
     * @param {Object} options - Scaling options
     * @returns {Object} Scaling information and cleanup functions
     */
    scaleMultipleCanvases(canvases, scaleFactor, options = {}) {
      const scalingResults = [];
      const errors = [];

      // Scale each canvas
      canvases.forEach((canvas, index) => {
        try {
          const result = this.scaleCanvas(canvas, scaleFactor, options);
          scalingResults.push({ canvas, result, index });
        } catch (error) {
          errors.push({ canvas, error, index });
          console.error(`Failed to scale canvas ${index}:`, error);
        }
      });

      return {
        successful: scalingResults,
        failed: errors,
        scaleFactor,
        
        // Cleanup all successfully scaled canvases
        cleanup: () => {
          scalingResults.forEach(({ result }) => {
            if (result.cleanup) {
              result.cleanup();
            }
          });
        },

        // Get coordinate converters for all canvases
        getCoordinateConverters: () => {
          const converters = {};
          scalingResults.forEach(({ canvas, result, index }) => {
            converters[index] = {
              toCanvas: result.toCanvasCoordinates,
              toScreen: result.toScreenCoordinates
            };
          });
          return converters;
        }
      };
    }

    /**
     * Set up interaction handlers for scaled canvas
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} scaleFactor - Current scaling factor
     * @returns {Function} Cleanup function
     */
    setupCanvasInteractionHandlers(canvas, scaleFactor) {
      const originalHandlers = new Map();
      
      // Store references to original event handlers
      const eventTypes = ['click', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend'];
      
      eventTypes.forEach(eventType => {
        const originalHandler = canvas[`on${eventType}`];
        if (originalHandler) {
          originalHandlers.set(eventType, originalHandler);
        }
      });

      // Create coordinate adjustment wrapper
      const adjustCoordinates = (event) => {
        if (event.offsetX !== undefined && event.offsetY !== undefined) {
          // Adjust mouse coordinates
          event.offsetX = Math.round(event.offsetX * scaleFactor);
          event.offsetY = Math.round(event.offsetY * scaleFactor);
        }
        
        if (event.layerX !== undefined && event.layerY !== undefined) {
          event.layerX = Math.round(event.layerX * scaleFactor);
          event.layerY = Math.round(event.layerY * scaleFactor);
        }

        // Adjust touch coordinates
        if (event.touches) {
          Array.from(event.touches).forEach(touch => {
            const rect = canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) * scaleFactor;
            const y = (touch.clientY - rect.top) * scaleFactor;
            
            // Add adjusted coordinates as custom properties
            touch.canvasX = Math.round(x);
            touch.canvasY = Math.round(y);
          });
        }

        return event;
      };

      // Wrap existing handlers
      const wrappedHandlers = new Map();
      originalHandlers.forEach((handler, eventType) => {
        const wrappedHandler = (event) => {
          const adjustedEvent = adjustCoordinates(event);
          return handler.call(canvas, adjustedEvent);
        };
        
        wrappedHandlers.set(eventType, wrappedHandler);
        canvas[`on${eventType}`] = wrappedHandler;
      });

      // Also handle addEventListener-based handlers
      const originalAddEventListener = canvas.addEventListener.bind(canvas);
      const eventListeners = new Map();
      
      canvas.addEventListener = function(type, listener, options) {
        if (eventTypes.includes(type)) {
          const wrappedListener = (event) => {
            const adjustedEvent = adjustCoordinates(event);
            return listener.call(this, adjustedEvent);
          };
          
          eventListeners.set(listener, { type, wrappedListener, options });
          return originalAddEventListener(type, wrappedListener, options);
        }
        
        return originalAddEventListener(type, listener, options);
      };

      // Return cleanup function
      return () => {
        // Restore original handlers
        originalHandlers.forEach((handler, eventType) => {
          canvas[`on${eventType}`] = handler;
        });

        // Remove wrapped event listeners
        eventListeners.forEach(({ type, wrappedListener, options }, originalListener) => {
          canvas.removeEventListener(type, wrappedListener, options);
        });

        // Restore original addEventListener
        canvas.addEventListener = originalAddEventListener;
      };
    }

    /**
     * Create a high-resolution render target
     * @param {number} width - Logical width
     * @param {number} height - Logical height  
     * @param {number} dpi - Target DPI
     * @param {Object} options - Render target options
     * @returns {Object} Render target with canvas and utilities
     */
    createHighResRenderTarget(width, height, dpi = 300, options = {}) {
      const {
        contextType = '2d', // '2d' or 'webgl'
        alpha = true,
        preserveDrawingBuffer = false,
        antialias = true,
        powerPreference = 'high-performance'
      } = options;

      const scaleFactor = dpi / 96; // Assuming 96 DPI base
      const canvas = document.createElement('canvas');
      
      // Set logical size
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      // Set physical size
      canvas.width = Math.round(width * scaleFactor);
      canvas.height = Math.round(height * scaleFactor);

      let context;
      let contextOptions;

      if (contextType === '2d') {
        context = canvas.getContext('2d');
        if (context) {
          // Scale context for high resolution
          context.scale(scaleFactor, scaleFactor);
          
          // Configure for high quality rendering
          context.imageSmoothingEnabled = antialias;
          if (context.imageSmoothingQuality) {
            context.imageSmoothingQuality = 'high';
          }
        }
      } else if (contextType === 'webgl') {
        contextOptions = {
          alpha,
          preserveDrawingBuffer,
          antialias,
          powerPreference
        };
        
        context = canvas.getContext('webgl', contextOptions) || 
                 canvas.getContext('experimental-webgl', contextOptions);
        
        if (context) {
          // Set viewport for high resolution
          context.viewport(0, 0, canvas.width, canvas.height);
        }
      }

      if (!context) {
        throw new Error(`Failed to create ${contextType} context`);
      }

      return {
        canvas,
        context,
        width: canvas.width,
        height: canvas.height,
        logicalWidth: width,
        logicalHeight: height,
        scaleFactor,
        dpi,
        contextType,
        contextOptions,
        
        // Utility methods
        clear: () => {
          if (contextType === '2d') {
            context.clearRect(0, 0, width, height); // Use logical coordinates
          } else {
            context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
          }
        },
        
        resize: (newWidth, newHeight) => {
          canvas.style.width = newWidth + 'px';
          canvas.style.height = newHeight + 'px';
          canvas.width = Math.round(newWidth * scaleFactor);
          canvas.height = Math.round(newHeight * scaleFactor);
          
          if (contextType === '2d') {
            context.scale(scaleFactor, scaleFactor);
          } else {
            context.viewport(0, 0, canvas.width, canvas.height);
          }
          
          return { width: canvas.width, height: canvas.height };
        },
        
        toDataURL: (type = 'image/png', quality = 1.0) => {
          return canvas.toDataURL(type, quality);
        },
        
        toBlob: (callback, type = 'image/png', quality = 1.0) => {
          return canvas.toBlob(callback, type, quality);
        },
        
        getImageData: () => {
          if (contextType === '2d') {
            return context.getImageData(0, 0, canvas.width, canvas.height);
          }
          throw new Error('getImageData not supported for WebGL contexts');
        },
        
        // Memory usage estimation
        getMemoryUsage: () => {
          const bytes = canvas.width * canvas.height * 4; // RGBA
          return {
            bytes,
            mb: Math.round(bytes / (1024 * 1024) * 100) / 100,
            formatted: this.formatBytes(bytes)
          };
        },
        
        // Cleanup
        dispose: () => {
          if (contextType === 'webgl' && context.getExtension) {
            // Release WebGL resources
            const ext = context.getExtension('WEBGL_lose_context');
            if (ext) {
              ext.loseContext();
            }
          }
          
          // Clear canvas
          canvas.width = 1;
          canvas.height = 1;
        }
      };
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Test if high DPI rendering is supported and working
     * @returns {Object} Test results with support information
     */
    testHighDPISupport() {
      const testResults = {
        supported: false,
        actualRatio: 1,
        testRatio: 3,
        browserCompatible: false,
        canvasSupport: false,
        webglSupport: false,
        memoryLimit: 0,
        warnings: []
      };

      try {
        // Store original ratio
        const originalRatio = window.devicePixelRatio || 1;
        
        // Test canvas backing store scaling
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          testResults.warnings.push('Canvas 2D context not available');
          return testResults;
        }

        // Try to set a high pixel ratio temporarily
        const testRatio = 3;
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return testRatio; },
          configurable: true
        });

        // Test if canvas backing store responds to ratio change
        canvas.width = 100;
        canvas.height = 100;
        const backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                                 ctx.mozBackingStorePixelRatio ||
                                 ctx.msBackingStorePixelRatio ||
                                 ctx.oBackingStorePixelRatio ||
                                 ctx.backingStorePixelRatio || 1;

        testResults.actualRatio = canvas.width / 100; // Should reflect device pixel ratio
        testResults.canvasSupport = testResults.actualRatio >= 2;

        // Test WebGL support (important for Mapbox GL JS)
        const webglCanvas = document.createElement('canvas');
        const gl = webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl');
        if (gl) {
          testResults.webglSupport = true;
          testResults.memoryLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        }

        // Restore original ratio
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return originalRatio; },
          configurable: true
        });

        // Overall support determination
        testResults.supported = testResults.canvasSupport && testResults.webglSupport;
        testResults.browserCompatible = this.supportInfo?.supported || false;

        // Performance warnings
        if (testResults.memoryLimit < 4096) {
          testResults.warnings.push('Limited GPU memory - high DPI rendering may be slow');
        }

        // Clean up test elements
        canvas.remove();
        webglCanvas.remove();

      } catch (error) {
        testResults.warnings.push(`DPI test failed: ${error.message}`);
      }

      return testResults;
    }

    /**
     * Get current DPI information
     * @returns {Object} Current DPI state
     */
    getCurrentDPIInfo() {
      return {
        originalRatio: this.originalDevicePixelRatio,
        currentRatio: window.devicePixelRatio || 1,
        isOverridden: this.isOverridden,
        currentDPI: this.currentDPI,
        estimatedScreenDPI: Math.round((window.devicePixelRatio || 1) * this.DPI_STANDARDS.SCREEN_STANDARD),
        supportInfo: this.supportInfo
      };
    }

    /**
     * Calculate memory requirements for given dimensions at current DPI
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @returns {Object} Memory estimation
     */
    calculateMemoryRequirements(width, height) {
      const currentRatio = window.devicePixelRatio || 1;
      const actualWidth = Math.round(width * currentRatio);
      const actualHeight = Math.round(height * currentRatio);
      
      // Estimate memory: width * height * 4 bytes (RGBA) * buffer multiplier
      const bufferMultiplier = 2.5; // Account for browser overhead
      const estimatedBytes = actualWidth * actualHeight * 4 * bufferMultiplier;
      const estimatedMB = Math.round(estimatedBytes / (1024 * 1024));

      return {
        logicalDimensions: { width, height },
        physicalDimensions: { width: actualWidth, height: actualHeight },
        scalingFactor: currentRatio,
        estimatedMemoryMB: estimatedMB,
        totalPixels: actualWidth * actualHeight,
        isMemoryIntensive: estimatedMB > 200,
        recommendOptimization: estimatedMB > 500
      };
    }

    /**
     * Enhanced Browser Compatibility Layer
     * Comprehensive browser detection, feature testing, and polyfill management
     */

    /**
     * Check comprehensive browser support for DPI manipulation
     * @returns {Object} Detailed browser support information
     */
    checkBrowserSupport() {
      const userAgent = navigator.userAgent;
      const browserInfo = this.detectBrowserDetails(userAgent);
      const featureSupport = this.testBrowserFeatures();
      const compatibility = this.assessCompatibility(browserInfo, featureSupport);
      
      return {
        ...browserInfo,
        features: featureSupport,
        compatibility: compatibility,
        supportLevel: this.calculateSupportLevel(compatibility),
        recommendedMethod: this.getRecommendedMethod(compatibility),
        requiredPolyfills: this.getRequiredPolyfills(compatibility),
        performanceProfile: this.getPerformanceProfile(browserInfo),
        optimizations: this.getOptimizations(browserInfo, compatibility)
      };
    }

    /**
     * Detect detailed browser information
     * @param {string} userAgent - Browser user agent string
     * @returns {Object} Detailed browser information
     */
    detectBrowserDetails(userAgent) {
      const info = {
        browser: 'unknown',
        version: 'unknown',
        majorVersion: 0,
        isMobile: false,
        isTablet: false,
        platform: navigator.platform || 'unknown',
        touchCapable: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 1,
        deviceMemory: navigator.deviceMemory || null
      };

      try {
        // Chrome detection (including mobile)
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
          info.browser = userAgent.includes('Mobile') ? 'chrome-mobile' : 'chrome';
          const version = userAgent.match(/Chrome\/([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }
        // Firefox detection
        else if (userAgent.includes('Firefox')) {
          info.browser = 'firefox';
          const version = userAgent.match(/Firefox\/([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }
        // Safari detection (including mobile)
        else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
          if (/iPad|iPhone|iPod/.test(userAgent)) {
            info.browser = 'safari-mobile';
            info.isMobile = /iPhone|iPod/.test(userAgent);
            info.isTablet = /iPad/.test(userAgent);
          } else {
            info.browser = 'safari';
          }
          const version = userAgent.match(/Version\/([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }
        // Edge (Chromium-based)
        else if (userAgent.includes('Edg')) {
          info.browser = 'edge';
          const version = userAgent.match(/Edg\/([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }
        // Edge Legacy
        else if (userAgent.includes('Edge')) {
          info.browser = 'edge-legacy';
          const version = userAgent.match(/Edge\/([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }
        // Internet Explorer
        else if (userAgent.includes('Trident') || userAgent.includes('MSIE')) {
          info.browser = 'ie';
          const version = userAgent.match(/(?:MSIE |rv:)([0-9]+)/)?.[1];
          info.version = version || 'unknown';
          info.majorVersion = parseInt(version) || 0;
        }

        // Additional mobile detection
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
          info.isMobile = true;
        }

      } catch (error) {
        console.warn('Browser detection failed:', error);
      }

      return info;
    }

    /**
     * Test browser features comprehensively
     * @returns {Object} Feature support information
     */
    testBrowserFeatures() {
      const features = {
        defineProperty: this.testDefinePropertySupport(),
        webgl: this.testWebGLSupport(),
        canvas2d: this.testCanvas2DSupport(),
        devicePixelRatio: this.testDevicePixelRatioSupport(),
        performanceAPI: this.testPerformanceAPISupport(),
        eventSystem: this.testEventSystemSupport(),
        memoryAPI: this.testMemoryAPISupport(),
        workerSupport: this.testWorkerSupport(),
        offscreenCanvas: this.testOffscreenCanvasSupport()
      };

      return features;
    }

    /**
     * Test defineProperty support for devicePixelRatio manipulation
     * @returns {Object} Support information
     */
    testDefinePropertySupport() {
      try {
        const testValue = 2.5;
        const originalValue = window.devicePixelRatio || 1;
        
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return testValue; },
          configurable: true
        });
        
        const success = Math.abs(window.devicePixelRatio - testValue) < 0.01;
        
        // Restore original value
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return originalValue; },
          configurable: true
        });
        
        return {
          supported: success,
          method: success ? 'defineProperty' : 'polyfill',
          reliability: success ? 'high' : 'low'
        };
      } catch (error) {
        return {
          supported: false,
          method: 'polyfill',
          reliability: 'none',
          error: error.message
        };
      }
    }

    /**
     * Test WebGL support and capabilities
     * @returns {Object} WebGL support information
     */
    testWebGLSupport() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          return { supported: false, reason: 'No WebGL context' };
        }

        const info = {
          supported: true,
          version: gl.getParameter(gl.VERSION),
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
          extensions: gl.getSupportedExtensions() || []
        };

        // Test for useful extensions
        info.hasLoseContext = info.extensions.includes('WEBGL_lose_context');
        info.hasDebugRendererInfo = info.extensions.includes('WEBGL_debug_renderer_info');
        info.hasDepthTexture = info.extensions.includes('WEBGL_depth_texture');

        canvas.remove();
        return info;
      } catch (error) {
        return {
          supported: false,
          error: error.message
        };
      }
    }

    /**
     * Test Canvas 2D support and features
     * @returns {Object} Canvas 2D support information
     */
    testCanvas2DSupport() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          return { supported: false, reason: 'No 2D context' };
        }

        const info = {
          supported: true,
          imageSmoothingSupported: 'imageSmoothingEnabled' in ctx,
          imageSmoothingQuality: 'imageSmoothingQuality' in ctx,
          hitRegion: typeof ctx.hitRegion === 'function',
          path2D: typeof Path2D !== 'undefined',
          textMetrics: typeof ctx.measureText === 'function'
        };

        // Test backing store pixel ratio
        info.backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                                ctx.mozBackingStorePixelRatio ||
                                ctx.msBackingStorePixelRatio ||
                                ctx.oBackingStorePixelRatio ||
                                ctx.backingStorePixelRatio || 1;

        canvas.remove();
        return info;
      } catch (error) {
        return {
          supported: false,
          error: error.message
        };
      }
    }

    /**
     * Test devicePixelRatio support
     * @returns {Object} Device pixel ratio support information
     */
    testDevicePixelRatioSupport() {
      return {
        supported: 'devicePixelRatio' in window,
        currentValue: window.devicePixelRatio || 1,
        isConfigurable: this.isDevicePixelRatioConfigurable(),
        supportsChangeEvents: 'onresize' in window
      };
    }

    /**
     * Test if devicePixelRatio is configurable
     * @returns {boolean} Whether devicePixelRatio can be modified
     */
    isDevicePixelRatioConfigurable() {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
        return !descriptor || descriptor.configurable !== false;
      } catch (error) {
        return false;
      }
    }

    /**
     * Test Performance API support
     * @returns {Object} Performance API support information
     */
    testPerformanceAPISupport() {
      const perf = window.performance;
      
      return {
        supported: !!perf,
        now: typeof perf?.now === 'function',
        memory: !!perf?.memory,
        navigation: !!perf?.navigation,
        timing: !!perf?.timing,
        observer: typeof PerformanceObserver !== 'undefined'
      };
    }

    /**
     * Test event system support
     * @returns {Object} Event system support information
     */
    testEventSystemSupport() {
      return {
        customEvents: typeof CustomEvent !== 'undefined',
        addEventListener: typeof window.addEventListener === 'function',
        passive: this.testPassiveEventSupport(),
        once: this.testOnceEventSupport()
      };
    }

    /**
     * Test passive event listener support
     * @returns {boolean} Whether passive events are supported
     */
    testPassiveEventSupport() {
      let passiveSupported = false;
      try {
        const options = Object.defineProperty({}, 'passive', {
          get: function() { passiveSupported = true; }
        });
        window.addEventListener('test', null, options);
        window.removeEventListener('test', null, options);
      } catch (error) {
        // Passive not supported
      }
      return passiveSupported;
    }

    /**
     * Test once event listener support
     * @returns {boolean} Whether once events are supported
     */
    testOnceEventSupport() {
      try {
        let onceSupported = false;
        const testHandler = () => { onceSupported = true; };
        window.addEventListener('test', testHandler, { once: true });
        window.removeEventListener('test', testHandler);
        return true; // If no error, once is supported
      } catch (error) {
        return false;
      }
    }

    /**
     * Test memory API support
     * @returns {Object} Memory API support information
     */
    testMemoryAPISupport() {
      const perf = window.performance;
      const memory = perf?.memory;
      
      return {
        supported: !!memory,
        usedJSHeapSize: typeof memory?.usedJSHeapSize === 'number',
        totalJSHeapSize: typeof memory?.totalJSHeapSize === 'number',
        jsHeapSizeLimit: typeof memory?.jsHeapSizeLimit === 'number',
        deviceMemory: typeof navigator.deviceMemory === 'number'
      };
    }

    /**
     * Test Web Worker support
     * @returns {Object} Worker support information
     */
    testWorkerSupport() {
      return {
        worker: typeof Worker !== 'undefined',
        sharedWorker: typeof SharedWorker !== 'undefined',
        serviceWorker: 'serviceWorker' in navigator
      };
    }

    /**
     * Test OffscreenCanvas support
     * @returns {Object} OffscreenCanvas support information
     */
    testOffscreenCanvasSupport() {
      return {
        supported: typeof OffscreenCanvas !== 'undefined',
        transferable: typeof OffscreenCanvas !== 'undefined' && 'transferToImageBitmap' in OffscreenCanvas.prototype
      };
    }

    /**
     * Assess overall compatibility based on browser and feature support
     * @param {Object} browserInfo - Browser detection results
     * @param {Object} featureSupport - Feature test results
     * @returns {Object} Compatibility assessment
     */
    assessCompatibility(browserInfo, featureSupport) {
      const browserSupport = this.BROWSER_SUPPORT[browserInfo.browser] || this.BROWSER_SUPPORT.ie;
      const isVersionSupported = browserInfo.majorVersion >= (browserSupport.minVersion || 999);
      
      return {
        overall: isVersionSupported && browserSupport.fullSupport ? 'full' : 
                 isVersionSupported ? 'partial' : 'limited',
        browserSupported: isVersionSupported,
        featuresSupported: this.assessFeatureCompatibility(featureSupport),
        limitations: browserSupport.limitations || [],
        workarounds: browserSupport.workarounds || [],
        recommendedOptimizations: this.getRecommendedOptimizations(browserInfo, featureSupport)
      };
    }

    /**
     * Assess feature compatibility
     * @param {Object} featureSupport - Feature test results
     * @returns {Object} Feature compatibility assessment
     */
    assessFeatureCompatibility(featureSupport) {
      return {
        dpiManipulation: featureSupport.defineProperty.supported ? 'full' : 'polyfill',
        highResRendering: featureSupport.webgl.supported && featureSupport.canvas2d.supported ? 'full' : 'limited',
        performanceMonitoring: featureSupport.performanceAPI.supported ? 'full' : 'limited',
        memoryTracking: featureSupport.memoryAPI.supported ? 'full' : 'none'
      };
    }

    /**
     * Calculate overall support level
     * @param {Object} compatibility - Compatibility assessment
     * @returns {string} Support level ('excellent', 'good', 'fair', 'poor')
     */
    calculateSupportLevel(compatibility) {
      if (compatibility.overall === 'full' && compatibility.limitations.length === 0) {
        return 'excellent';
      } else if (compatibility.overall === 'full' || 
                (compatibility.overall === 'partial' && compatibility.limitations.length <= 2)) {
        return 'good';
      } else if (compatibility.overall === 'partial') {
        return 'fair';
      } else {
        return 'poor';
      }
    }

    /**
     * Get recommended method based on compatibility
     * @param {Object} compatibility - Compatibility assessment
     * @returns {string} Recommended method
     */
    getRecommendedMethod(compatibility) {
      if (compatibility.featuresSupported.dpiManipulation === 'full') {
        return 'defineProperty';
      } else {
        return 'polyfill';
      }
    }

    /**
     * Get required polyfills based on compatibility
     * @param {Object} compatibility - Compatibility assessment
     * @returns {Array} List of required polyfills
     */
    getRequiredPolyfills(compatibility) {
      const polyfills = [];
      
      if (compatibility.featuresSupported.dpiManipulation === 'polyfill') {
        polyfills.push('devicePixelRatio');
      }
      
      if (compatibility.featuresSupported.performanceMonitoring !== 'full') {
        polyfills.push('performance');
      }
      
      if (compatibility.limitations.includes('no-modern-features')) {
        polyfills.push('customEvents', 'addEventListener');
      }
      
      return polyfills;
    }

    /**
     * Get performance profile for browser
     * @param {Object} browserInfo - Browser information
     * @returns {Object} Performance profile
     */
    getPerformanceProfile(browserInfo) {
      const profiles = {
        chrome: { speed: 'fast', memory: 'efficient', stability: 'high' },
        'chrome-mobile': { speed: 'medium', memory: 'limited', stability: 'medium' },
        firefox: { speed: 'fast', memory: 'moderate', stability: 'high' },
        safari: { speed: 'fast', memory: 'strict', stability: 'high' },
        'safari-mobile': { speed: 'slow', memory: 'very-limited', stability: 'medium' },
        edge: { speed: 'fast', memory: 'efficient', stability: 'high' },
        'edge-legacy': { speed: 'slow', memory: 'moderate', stability: 'low' },
        ie: { speed: 'very-slow', memory: 'poor', stability: 'low' }
      };
      
      return profiles[browserInfo.browser] || profiles.ie;
    }

    /**
     * Get browser-specific optimizations
     * @param {Object} browserInfo - Browser information
     * @param {Object} compatibility - Compatibility assessment
     * @returns {Array} List of recommended optimizations
     */
    getOptimizations(browserInfo, compatibility) {
      const optimizations = [];
      
      // Mobile optimizations
      if (browserInfo.isMobile) {
        optimizations.push('reduce-memory-usage', 'optimize-touch-events', 'minimize-canvas-size');
      }
      
      // Safari-specific optimizations
      if (browserInfo.browser.includes('safari')) {
        optimizations.push('webgl-context-restore', 'memory-pressure-monitoring');
      }
      
      // Firefox-specific optimizations
      if (browserInfo.browser === 'firefox') {
        optimizations.push('canvas-size-limits', 'garbage-collection-friendly');
      }
      
      // Low-end device optimizations
      if (browserInfo.hardwareConcurrency <= 2 || (browserInfo.deviceMemory && browserInfo.deviceMemory <= 2)) {
        optimizations.push('progressive-rendering', 'texture-compression', 'frame-rate-limiting');
      }
      
      return optimizations;
    }

    /**
     * Get recommended optimizations based on browser and features
     * @param {Object} browserInfo - Browser information
     * @param {Object} featureSupport - Feature support information
     * @returns {Array} Recommended optimizations
     */
    getRecommendedOptimizations(browserInfo, featureSupport) {
      const optimizations = [];
      
      if (!featureSupport.webgl.supported) {
        optimizations.push('canvas-2d-fallback');
      }
      
      if (!featureSupport.memoryAPI.supported) {
        optimizations.push('manual-memory-tracking');
      }
      
      if (browserInfo.isMobile) {
        optimizations.push('aggressive-cleanup', 'background-rendering-pause');
      }
      
      return optimizations;
    }

    /**
     * Trigger resize event to notify components of DPI change
     */
    triggerResizeEvent() {
      try {
        // Create and dispatch resize event
        const resizeEvent = new Event('resize', { bubbles: true, cancelable: true });
        window.dispatchEvent(resizeEvent);
        
        // Also dispatch custom DPI change event
        const dpiChangeEvent = new CustomEvent('dpichange', {
          detail: {
            currentRatio: window.devicePixelRatio,
            originalRatio: this.originalDevicePixelRatio,
            isOverridden: this.isOverridden
          }
        });
        window.dispatchEvent(dpiChangeEvent);
        
      } catch (error) {
        console.warn('DPIManager: Failed to trigger resize event:', error);
      }
    }

    /**
     * Get available DPI presets
     * @returns {Object} DPI presets with descriptions
     */
    getDPIPresets() {
      return {
        [this.DPI_STANDARDS.SCREEN_LOW]: {
          name: 'Low Quality',
          description: 'Basic screen quality (72 DPI)',
          useCase: 'Fast preview, low bandwidth'
        },
        [this.DPI_STANDARDS.SCREEN_STANDARD]: {
          name: 'Standard Quality',
          description: 'Standard web display (96 DPI)',
          useCase: 'Normal web viewing'
        },
        [this.DPI_STANDARDS.SCREEN_HIGH]: {
          name: 'High Quality',
          description: 'High-density displays (144 DPI)',
          useCase: 'High-DPI monitors'
        },
        [this.DPI_STANDARDS.PRINT_DRAFT]: {
          name: 'Draft Print',
          description: 'Draft printing quality (150 DPI)',
          useCase: 'Draft prints, proofs'
        },
        [this.DPI_STANDARDS.PRINT_STANDARD]: {
          name: 'Print Quality',
          description: 'Professional print quality (300 DPI)',
          useCase: 'High-quality prints, wall art'
        },
        [this.DPI_STANDARDS.PRINT_HIGH]: {
          name: 'Premium Print',
          description: 'Premium print quality (600 DPI)',
          useCase: 'Professional photography, large format'
        }
      };
    }

    /**
     * Performance Optimization System for High-DPI Rendering
     * Advanced memory management, progressive rendering, and performance monitoring
     */

    /**
     * Initialize performance monitoring and optimization
     * @returns {Object} Performance optimizer instance
     */
    initializePerformanceOptimizer() {
      if (this.performanceOptimizer) {
        return this.performanceOptimizer;
      }

      this.performanceOptimizer = {
        // Memory management
        memoryThresholds: {
          warning: 200 * 1024 * 1024,      // 200MB
          critical: 500 * 1024 * 1024,     // 500MB
          maximum: 1024 * 1024 * 1024      // 1GB
        },
        
        // Performance monitoring
        metrics: {
          renderTimes: [],
          memoryUsage: [],
          frameRates: [],
          gcEvents: 0,
          optimizationEvents: 0
        },
        
        // Optimization state
        active: true,
        progressiveRenderingEnabled: false,
        memoryPressureMode: false,
        throttledMode: false,
        
        // Canvas pool for memory reuse
        canvasPool: new Map(),
        maxPoolSize: 10,
        
        // Performance observers
        observers: new Map(),
        
        // Cleanup functions
        cleanupTasks: []
      };

      this.setupPerformanceMonitoring();
      return this.performanceOptimizer;
    }

    /**
     * Set up performance monitoring and observers
     */
    setupPerformanceMonitoring() {
      const optimizer = this.performanceOptimizer;
      
      // Memory pressure monitoring
      if ('onmemory' in window) {
        const memoryHandler = (event) => {
          this.handleMemoryPressure(event.detail.level);
        };
        window.addEventListener('memory', memoryHandler);
        optimizer.cleanupTasks.push(() => {
          window.removeEventListener('memory', memoryHandler);
        });
      }

      // Performance observer for rendering metrics
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'measure' && entry.name.includes('dpi-render')) {
                optimizer.metrics.renderTimes.push({
                  duration: entry.duration,
                  timestamp: entry.startTime,
                  name: entry.name
                });
                
                // Keep only last 100 measurements
                if (optimizer.metrics.renderTimes.length > 100) {
                  optimizer.metrics.renderTimes.shift();
                }
              }
            }
          });
          
          observer.observe({ entryTypes: ['measure'] });
          optimizer.observers.set('performance', observer);
          
          optimizer.cleanupTasks.push(() => {
            observer.disconnect();
          });
        } catch (error) {
          console.warn('PerformanceObserver not available:', error);
        }
      }

      // Memory usage monitoring
      this.startMemoryMonitoring();
      
      // Frame rate monitoring
      this.startFrameRateMonitoring();
    }

    /**
     * Start memory usage monitoring
     */
    startMemoryMonitoring() {
      const optimizer = this.performanceOptimizer;
      
      const monitorMemory = () => {
        const usage = this.measureCurrentMemory();
        if (usage > 0) {
          optimizer.metrics.memoryUsage.push({
            usage,
            timestamp: performance.now()
          });
          
          // Keep only last 50 measurements
          if (optimizer.metrics.memoryUsage.length > 50) {
            optimizer.metrics.memoryUsage.shift();
          }
          
          // Check for memory pressure
          this.checkMemoryPressure(usage);
        }
      };
      
      const intervalId = setInterval(monitorMemory, 5000); // Every 5 seconds
      optimizer.cleanupTasks.push(() => {
        clearInterval(intervalId);
      });
    }

    /**
     * Start frame rate monitoring
     */
    startFrameRateMonitoring() {
      const optimizer = this.performanceOptimizer;
      let frameCount = 0;
      let lastTime = performance.now();
      
      const measureFrameRate = () => {
        const currentTime = performance.now();
        frameCount++;
        
        if (currentTime - lastTime >= 1000) { // Every second
          const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
          optimizer.metrics.frameRates.push({
            fps,
            timestamp: currentTime
          });
          
          // Keep only last 30 measurements
          if (optimizer.metrics.frameRates.length > 30) {
            optimizer.metrics.frameRates.shift();
          }
          
          frameCount = 0;
          lastTime = currentTime;
        }
        
        if (optimizer.active) {
          requestAnimationFrame(measureFrameRate);
        }
      };
      
      requestAnimationFrame(measureFrameRate);
    }

    /**
     * Check for memory pressure and trigger optimizations
     * @param {number} currentUsage - Current memory usage in bytes
     */
    checkMemoryPressure(currentUsage) {
      const optimizer = this.performanceOptimizer;
      const thresholds = optimizer.memoryThresholds;
      
      if (currentUsage > thresholds.critical && !optimizer.memoryPressureMode) {
        console.warn('DPIManager: Memory pressure detected, enabling aggressive optimization');
        this.enableMemoryPressureMode();
      } else if (currentUsage < thresholds.warning && optimizer.memoryPressureMode) {
        console.log('DPIManager: Memory pressure relieved, disabling aggressive optimization');
        this.disableMemoryPressureMode();
      }
    }

    /**
     * Handle memory pressure events
     * @param {string} level - Memory pressure level ('low', 'moderate', 'critical')
     */
    handleMemoryPressure(level) {
      console.log(`DPIManager: Memory pressure event: ${level}`);
      
      switch (level) {
        case 'critical':
          this.enableMemoryPressureMode();
          this.forceGarbageCollection();
          break;
        case 'moderate':
          this.enableMemoryPressureMode();
          break;
        case 'low':
          this.disableMemoryPressureMode();
          break;
      }
    }

    /**
     * Enable memory pressure mode with aggressive optimizations
     */
    enableMemoryPressureMode() {
      const optimizer = this.performanceOptimizer;
      
      if (optimizer.memoryPressureMode) return;
      
      optimizer.memoryPressureMode = true;
      optimizer.optimizationEvents++;
      
      // Clear canvas pool
      this.clearCanvasPool();
      
      // Enable progressive rendering
      this.enableProgressiveRendering();
      
      // Force garbage collection if available
      this.forceGarbageCollection();
      
      console.log('DPIManager: Memory pressure mode enabled');
    }

    /**
     * Disable memory pressure mode
     */
    disableMemoryPressureMode() {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer.memoryPressureMode) return;
      
      optimizer.memoryPressureMode = false;
      
      // Can optionally disable progressive rendering here
      // this.disableProgressiveRendering();
      
      console.log('DPIManager: Memory pressure mode disabled');
    }

    /**
     * Enable progressive rendering for large canvases
     */
    enableProgressiveRendering() {
      const optimizer = this.performanceOptimizer;
      optimizer.progressiveRenderingEnabled = true;
      console.log('DPIManager: Progressive rendering enabled');
    }

    /**
     * Disable progressive rendering
     */
    disableProgressiveRendering() {
      const optimizer = this.performanceOptimizer;
      optimizer.progressiveRenderingEnabled = false;
      console.log('DPIManager: Progressive rendering disabled');
    }

    /**
     * Create optimized render target with performance considerations
     * @param {number} width - Logical width
     * @param {number} height - Logical height
     * @param {number} dpi - Target DPI
     * @param {Object} options - Render options
     * @returns {Object} Optimized render target
     */
    createOptimizedRenderTarget(width, height, dpi = 300, options = {}) {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer) {
        return this.createHighResRenderTarget(width, height, dpi, options);
      }

      const scaleFactor = dpi / 96;
      const physicalWidth = Math.round(width * scaleFactor);
      const physicalHeight = Math.round(height * scaleFactor);
      const memoryEstimate = (physicalWidth * physicalHeight * 4) / (1024 * 1024); // MB
      
      // Check if we should use progressive rendering
      const useProgressive = optimizer.progressiveRenderingEnabled || 
                           memoryEstimate > 200 || 
                           physicalWidth > 4096 || 
                           physicalHeight > 4096;
      
      if (useProgressive) {
        return this.createProgressiveRenderTarget(width, height, dpi, options);
      }
      
      // Try to reuse canvas from pool
      const poolKey = `${physicalWidth}x${physicalHeight}`;
      const pooledCanvas = this.getPooledCanvas(poolKey, physicalWidth, physicalHeight);
      
      if (pooledCanvas) {
        return this.setupRenderTarget(pooledCanvas, width, height, dpi, options, true);
      }
      
      // Create new render target with monitoring
      performance.mark('dpi-render-create-start');
      const target = this.createHighResRenderTarget(width, height, dpi, options);
      performance.mark('dpi-render-create-end');
      performance.measure('dpi-render-create', 'dpi-render-create-start', 'dpi-render-create-end');
      
      return target;
    }

    /**
     * Create progressive render target for large canvases
     * @param {number} width - Logical width
     * @param {number} height - Logical height
     * @param {number} dpi - Target DPI
     * @param {Object} options - Render options
     * @returns {Object} Progressive render target
     */
    createProgressiveRenderTarget(width, height, dpi, options = {}) {
      const scaleFactor = dpi / 96;
      const physicalWidth = Math.round(width * scaleFactor);
      const physicalHeight = Math.round(height * scaleFactor);
      
      // Calculate tile size based on memory constraints
      const maxTileMemory = 50 * 1024 * 1024; // 50MB per tile
      const pixelsPerTile = maxTileMemory / 4; // 4 bytes per pixel (RGBA)
      const tileDimension = Math.floor(Math.sqrt(pixelsPerTile));
      
      const tileWidth = Math.min(tileDimension, physicalWidth);
      const tileHeight = Math.min(tileDimension, physicalHeight);
      
      const tilesX = Math.ceil(physicalWidth / tileWidth);
      const tilesY = Math.ceil(physicalHeight / tileHeight);
      
      console.log(`DPIManager: Creating progressive render target: ${tilesX}x${tilesY} tiles`);
      
      return {
        type: 'progressive',
        width: physicalWidth,
        height: physicalHeight,
        logicalWidth: width,
        logicalHeight: height,
        scaleFactor,
        dpi,
        
        // Tile configuration
        tileWidth,
        tileHeight,
        tilesX,
        tilesY,
        totalTiles: tilesX * tilesY,
        
        // Active tiles (created on demand)
        tiles: new Map(),
        
        // Create a specific tile
        createTile: (tileX, tileY) => {
          const key = `${tileX},${tileY}`;
          if (this.tiles.has(key)) {
            return this.tiles.get(key);
          }
          
          const startX = tileX * tileWidth;
          const startY = tileY * tileHeight;
          const actualTileWidth = Math.min(tileWidth, physicalWidth - startX);
          const actualTileHeight = Math.min(tileHeight, physicalHeight - startY);
          
          const canvas = document.createElement('canvas');
          canvas.width = actualTileWidth;
          canvas.height = actualTileHeight;
          
          const context = canvas.getContext('2d', options);
          if (context) {
            context.scale(scaleFactor, scaleFactor);
          }
          
          const tile = {
            canvas,
            context,
            x: startX,
            y: startY,
            width: actualTileWidth,
            height: actualTileHeight,
            logicalX: startX / scaleFactor,
            logicalY: startY / scaleFactor,
            logicalWidth: actualTileWidth / scaleFactor,
            logicalHeight: actualTileHeight / scaleFactor
          };
          
          this.tiles.set(key, tile);
          return tile;
        },
        
        // Get all tiles
        getAllTiles: () => {
          const allTiles = [];
          for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
              allTiles.push(this.createTile(x, y));
            }
          }
          return allTiles;
        },
        
        // Compose all tiles into final canvas
        compose: () => {
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = physicalWidth;
          finalCanvas.height = physicalHeight;
          finalCanvas.style.width = width + 'px';
          finalCanvas.style.height = height + 'px';
          
          const finalCtx = finalCanvas.getContext('2d');
          
          // Draw all tiles onto final canvas
          for (const [key, tile] of this.tiles) {
            finalCtx.drawImage(tile.canvas, tile.x, tile.y);
          }
          
          return finalCanvas;
        },
        
        // Clean up tiles
        dispose: () => {
          for (const [key, tile] of this.tiles) {
            tile.canvas.width = 1;
            tile.canvas.height = 1;
          }
          this.tiles.clear();
        }
      };
    }

    /**
     * Get pooled canvas or create new one
     * @param {string} key - Pool key
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {HTMLCanvasElement|null} Pooled canvas or null
     */
    getPooledCanvas(key, width, height) {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer.canvasPool.has(key)) {
        return null;
      }
      
      const pool = optimizer.canvasPool.get(key);
      if (pool.length === 0) {
        return null;
      }
      
      const canvas = pool.pop();
      
      // Verify canvas is still valid
      if (canvas.width === width && canvas.height === height) {
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
        }
        
        return canvas;
      }
      
      // Canvas size doesn't match, dispose it
      canvas.width = 1;
      canvas.height = 1;
      return null;
    }

    /**
     * Return canvas to pool for reuse
     * @param {HTMLCanvasElement} canvas - Canvas to pool
     * @param {string} key - Pool key
     */
    returnCanvasToPool(canvas, key) {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer.canvasPool.has(key)) {
        optimizer.canvasPool.set(key, []);
      }
      
      const pool = optimizer.canvasPool.get(key);
      
      if (pool.length < optimizer.maxPoolSize) {
        pool.push(canvas);
      } else {
        // Pool is full, dispose canvas
        canvas.width = 1;
        canvas.height = 1;
      }
    }

    /**
     * Clear canvas pool to free memory
     */
    clearCanvasPool() {
      const optimizer = this.performanceOptimizer;
      
      for (const [key, pool] of optimizer.canvasPool) {
        pool.forEach(canvas => {
          canvas.width = 1;
          canvas.height = 1;
        });
        pool.length = 0;
      }
      
      optimizer.canvasPool.clear();
      console.log('DPIManager: Canvas pool cleared');
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection() {
      if (window.gc) {
        window.gc();
        this.performanceOptimizer.metrics.gcEvents++;
        console.log('DPIManager: Forced garbage collection');
      }
    }

    /**
     * Setup render target with optimization features
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} width - Logical width
     * @param {number} height - Logical height
     * @param {number} dpi - DPI setting
     * @param {Object} options - Options
     * @param {boolean} pooled - Whether canvas is from pool
     * @returns {Object} Render target
     */
    setupRenderTarget(canvas, width, height, dpi, options, pooled = false) {
      const scaleFactor = dpi / 96;
      const context = canvas.getContext(options.contextType || '2d', options);
      
      if (context && options.contextType !== 'webgl') {
        context.scale(scaleFactor, scaleFactor);
      }
      
      const poolKey = pooled ? `${canvas.width}x${canvas.height}` : null;
      
      return {
        canvas,
        context,
        width: canvas.width,
        height: canvas.height,
        logicalWidth: width,
        logicalHeight: height,
        scaleFactor,
        dpi,
        pooled,
        poolKey,
        
        dispose: () => {
          if (pooled && poolKey) {
            this.returnCanvasToPool(canvas, poolKey);
          } else {
            canvas.width = 1;
            canvas.height = 1;
          }
        }
      };
    }

    /**
     * Get performance metrics
     * @returns {Object} Current performance metrics
     */
    getPerformanceMetrics() {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer) {
        return { error: 'Performance optimizer not initialized' };
      }
      
      const currentMemory = this.measureCurrentMemory();
      const avgRenderTime = optimizer.metrics.renderTimes.length > 0 ?
        optimizer.metrics.renderTimes.reduce((sum, t) => sum + t.duration, 0) / optimizer.metrics.renderTimes.length : 0;
      
      const avgFrameRate = optimizer.metrics.frameRates.length > 0 ?
        optimizer.metrics.frameRates.reduce((sum, f) => sum + f.fps, 0) / optimizer.metrics.frameRates.length : 0;
      
      return {
        memory: {
          current: currentMemory,
          peak: Math.max(...(optimizer.metrics.memoryUsage.map(m => m.usage).concat([currentMemory]))),
          average: optimizer.metrics.memoryUsage.length > 0 ?
            optimizer.metrics.memoryUsage.reduce((sum, m) => sum + m.usage, 0) / optimizer.metrics.memoryUsage.length : 0
        },
        rendering: {
          averageTime: Math.round(avgRenderTime * 100) / 100,
          totalRenders: optimizer.metrics.renderTimes.length,
          averageFrameRate: Math.round(avgFrameRate)
        },
        optimization: {
          memoryPressureMode: optimizer.memoryPressureMode,
          progressiveRenderingEnabled: optimizer.progressiveRenderingEnabled,
          canvasPoolSize: Array.from(optimizer.canvasPool.values()).reduce((sum, pool) => sum + pool.length, 0),
          optimizationEvents: optimizer.optimizationEvents,
          gcEvents: optimizer.metrics.gcEvents
        },
        thresholds: optimizer.memoryThresholds
      };
    }

    /**
     * Optimize DPI setting based on performance constraints
     * @param {number} targetDPI - Desired DPI
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {number} Optimized DPI
     */
    optimizeDPIForPerformance(targetDPI, width, height) {
      const optimizer = this.performanceOptimizer;
      
      if (!optimizer) {
        return targetDPI;
      }
      
      const scaleFactor = targetDPI / 96;
      const physicalWidth = Math.round(width * scaleFactor);
      const physicalHeight = Math.round(height * scaleFactor);
      const memoryEstimate = (physicalWidth * physicalHeight * 4) / (1024 * 1024); // MB
      
      let optimizedDPI = targetDPI;
      
      // Apply memory-based optimization
      if (memoryEstimate > 500) {
        optimizedDPI = Math.max(150, targetDPI * 0.7); // Reduce by 30%
        console.log(`DPIManager: Reduced DPI from ${targetDPI} to ${optimizedDPI} due to memory constraints`);
      } else if (optimizer.memoryPressureMode && memoryEstimate > 200) {
        optimizedDPI = Math.max(150, targetDPI * 0.8); // Reduce by 20%
        console.log(`DPIManager: Reduced DPI from ${targetDPI} to ${optimizedDPI} due to memory pressure`);
      }
      
      // Apply frame rate based optimization
      const recentFrameRates = optimizer.metrics.frameRates.slice(-10);
      if (recentFrameRates.length > 5) {
        const avgFPS = recentFrameRates.reduce((sum, f) => sum + f.fps, 0) / recentFrameRates.length;
        
        if (avgFPS < 15) { // Very low frame rate
          optimizedDPI = Math.max(150, optimizedDPI * 0.6);
          console.log(`DPIManager: Reduced DPI to ${optimizedDPI} due to low frame rate (${avgFPS.toFixed(1)} FPS)`);
        } else if (avgFPS < 30) { // Low frame rate
          optimizedDPI = Math.max(150, optimizedDPI * 0.8);
          console.log(`DPIManager: Reduced DPI to ${optimizedDPI} due to moderate frame rate (${avgFPS.toFixed(1)} FPS)`);
        }
      }
      
      return Math.round(optimizedDPI);
    }

    /**
     * Cleanup and restore original state
     */
    cleanup() {
      console.log('DPIManager: Cleaning up...');
      
      try {
        if (this.isOverridden) {
          this.restoreOriginalDPI();
        }
        
        // Cleanup performance optimizer
        if (this.performanceOptimizer) {
          // Stop monitoring
          this.performanceOptimizer.active = false;
          
          // Run cleanup tasks
          this.performanceOptimizer.cleanupTasks.forEach(cleanup => {
            try {
              cleanup();
            } catch (error) {
              console.warn('DPIManager: Cleanup task failed:', error);
            }
          });
          
          // Disconnect observers
          this.performanceOptimizer.observers.forEach(observer => {
            try {
              observer.disconnect();
            } catch (error) {
              console.warn('DPIManager: Observer disconnect failed:', error);
            }
          });
          
          // Clear canvas pool
          this.clearCanvasPool();
          
          this.performanceOptimizer = null;
        }
        
        // Reset state
        this.originalDevicePixelRatio = null;
        this.currentDPI = null;
        this.isOverridden = false;
        this.supportChecked = false;
        this.supportInfo = null;
        
        console.log('DPIManager: Cleanup completed');
      } catch (error) {
        console.error('DPIManager: Cleanup failed:', error);
      }
    }
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = DPIManager;
  } else if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define(function() { return DPIManager; });
  } else {
    // Browser globals
    global.DPIManager = DPIManager;
  }

})(typeof window !== 'undefined' ? window : this);