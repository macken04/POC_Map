/**
 * High-Resolution Map Exporter for Mapbox GL JS
 * Frontend client-side implementation for high-resolution map export
 * Complements the backend Puppeteer-based export for preview generation
 * 
 * Usage:
 * const exporter = new HighResMapExporter(map);
 * const canvas = await exporter.exportToCanvas('A4', 'portrait');
 * const pngBlob = await exporter.exportToPNGBlob('A4', 'portrait');
 */

(function(global) {
  'use strict';

  class HighResMapExporter {
    constructor(map) {
      if (!map || typeof map.getCanvas !== 'function') {
        throw new Error('HighResMapExporter requires a valid Mapbox GL JS map instance');
      }
      
      this.map = map;
      this.originalContainer = null;
      this.originalViewport = null;
      
      // Print dimensions at 300 DPI
      this.printSizes = {
        A4: { 
          width: 2480, 
          height: 3508,
          inches: { width: 8.27, height: 11.69 },
          name: 'A4 Portrait (300 DPI)'
        },
        A3: { 
          width: 3508, 
          height: 4961,
          inches: { width: 11.69, height: 16.53 },
          name: 'A3 Portrait (300 DPI)'
        }
      };

      // DPI presets for different quality levels
      this.dpiPresets = {
        preview: { dpi: 72, quality: 0.7 },
        standard: { dpi: 150, quality: 0.8 },
        print: { dpi: 300, quality: 1.0 }
      };

      // Format-specific quality settings
      this.formatSettings = {
        png: {
          compressionLevel: 6, // 0-9, 0=no compression, 9=max compression
          quality: 1.0, // PNG doesn't use quality in canvas.toBlob, but we track it
          antiAliasing: true,
          optimizeText: true
        },
        jpeg: {
          quality: 0.9, // 0.0-1.0 for JPEG
          antiAliasing: true,
          optimizeText: true,
          backgroundColor: '#ffffff' // JPEG doesn't support transparency
        }
      };

      // Quality presets for different use cases
      this.qualityPresets = {
        low: { 
          png: { quality: 0.6, compressionLevel: 9 },
          jpeg: { quality: 0.7 }
        },
        medium: { 
          png: { quality: 0.8, compressionLevel: 6 },
          jpeg: { quality: 0.85 }
        },
        high: { 
          png: { quality: 1.0, compressionLevel: 3 },
          jpeg: { quality: 0.95 }
        }
      };
    }

    /**
     * Export map to high-resolution canvas
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @param {Object} options - Additional export options
     * @returns {Promise<HTMLCanvasElement>} High-resolution canvas
     */
    async exportToCanvas(size = 'A4', orientation = 'portrait', quality = 'print', options = {}) {
      return new Promise(async (resolve, reject) => {
        try {
          console.log(`HighResMapExporter: Starting ${quality} export (${size} ${orientation})`);

          // Validate parameters
          this._validateExportParameters(size, orientation, quality);

          // Get dimensions and settings for export
          const exportConfig = this._prepareExportConfiguration(size, orientation, quality);

          // Store original state for restoration
          this._storeOriginalState();

          // Performance monitoring and optimization
          const performanceStart = performance.now();
          const memoryBefore = this._getMemoryUsage();
          
          // Check if we need canvas tiling for large exports
          const shouldUseTiling = this._shouldUseTiling(exportConfig, options);
          
          if (shouldUseTiling) {
            console.log('HighResMapExporter: Using canvas tiling for large export');
            const canvas = await this._performTiledExport(exportConfig, options, resolve, reject);
            resolve(canvas);
          } else {
            // Use standard export method
            this._performExport(exportConfig, resolve, reject);
          }

        } catch (error) {
          console.error('HighResMapExporter: Export initialization failed:', error);
          this._restoreOriginalState();
          reject(error);
        }
      });
    }

    /**
     * Check if we should use canvas tiling for performance
     * @private
     * @param {Object} exportConfig - Export configuration
     * @param {Object} options - Export options
     * @returns {boolean} True if should use tiling
     */
    _shouldUseTiling(exportConfig, options) {
      const pixelCount = exportConfig.scaledDimensions.width * exportConfig.scaledDimensions.height;
      const maxPixelsWithoutTiling = options.maxPixelsWithoutTiling || 16777216; // 4096x4096
      const memoryUsage = this._getMemoryUsage();
      const memoryThreshold = options.memoryThreshold || 100 * 1024 * 1024; // 100MB
      
      return pixelCount > maxPixelsWithoutTiling || 
             (memoryUsage && memoryUsage > memoryThreshold) ||
             options.forceTiling === true;
    }

    /**
     * Get current memory usage if available
     * @private
     * @returns {number|null} Memory usage in bytes
     */
    _getMemoryUsage() {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return null;
    }

    /**
     * Perform tiled export for large canvases
     * @private
     * @param {Object} exportConfig - Export configuration
     * @param {Object} options - Export options
     * @returns {Promise<HTMLCanvasElement>} Exported canvas
     */
    async _performTiledExport(exportConfig, options) {
      const tileSize = options.tileSize || 2048; // Default tile size
      const overlap = options.tileOverlap || 64; // Overlap to prevent seams
      
      const totalWidth = exportConfig.scaledDimensions.width;
      const totalHeight = exportConfig.scaledDimensions.height;
      
      // Calculate number of tiles needed
      const tilesX = Math.ceil(totalWidth / (tileSize - overlap));
      const tilesY = Math.ceil(totalHeight / (tileSize - overlap));
      
      console.log(`HighResMapExporter: Tiling export into ${tilesX}x${tilesY} tiles`);
      
      // Create final canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = totalWidth;
      finalCanvas.height = totalHeight;
      const finalCtx = finalCanvas.getContext('2d');
      
      // Set high-quality rendering options
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      
      // Get current map bounds
      const bounds = this.map.getBounds();
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      
      try {
        // Process each tile
        for (let y = 0; y < tilesY; y++) {
          for (let x = 0; x < tilesX; x++) {
            // Calculate tile position and bounds
            const tileX = x * (tileSize - overlap);
            const tileY = y * (tileSize - overlap);
            
            const tileWidth = Math.min(tileSize, totalWidth - tileX);
            const tileHeight = Math.min(tileSize, totalHeight - tileY);
            
            // Calculate geographic bounds for this tile
            const tileBounds = this._calculateTileBounds(bounds, tileX, tileY, tileWidth, tileHeight, totalWidth, totalHeight);
            
            // Render this tile
            const tileCanvas = await this._renderTile(tileBounds, tileWidth, tileHeight, exportConfig);
            
            // Draw tile onto final canvas
            finalCtx.drawImage(tileCanvas, tileX, tileY);
            
            // Force garbage collection if possible
            if (window.gc && typeof window.gc === 'function') {
              window.gc();
            }
            
            // Add small delay to prevent browser blocking
            await this._delay(10);
            
            console.log(`HighResMapExporter: Tile ${x + 1},${y + 1} of ${tilesX},${tilesY} completed`);
          }
        }
        
        // Add export metadata
        this._addExportMetadata(finalCtx, exportConfig, totalWidth, totalHeight);
        
        // Restore original state
        this._restoreOriginalState();
        
        console.log('HighResMapExporter: Tiled export completed');
        return finalCanvas;
        
      } catch (error) {
        console.error('HighResMapExporter: Tiled export failed:', error);
        this._restoreOriginalState();
        throw error;
      }
    }

    /**
     * Calculate geographic bounds for a tile
     * @private
     */
    _calculateTileBounds(totalBounds, tileX, tileY, tileWidth, tileHeight, totalWidth, totalHeight) {
      const sw = totalBounds.getSouthWest();
      const ne = totalBounds.getNorthEast();
      
      const lngRange = ne.lng - sw.lng;
      const latRange = ne.lat - sw.lat;
      
      const tileSW = {
        lng: sw.lng + (tileX / totalWidth) * lngRange,
        lat: sw.lat + ((totalHeight - tileY - tileHeight) / totalHeight) * latRange
      };
      
      const tileNE = {
        lng: sw.lng + ((tileX + tileWidth) / totalWidth) * lngRange,
        lat: sw.lat + ((totalHeight - tileY) / totalHeight) * latRange
      };
      
      return new mapboxgl.LngLatBounds([tileSW, tileNE]);
    }

    /**
     * Render a single tile
     * @private
     */
    async _renderTile(bounds, width, height, exportConfig) {
      return new Promise((resolve, reject) => {
        const container = this.map.getContainer();
        
        // Set container size for this tile
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        
        // Fit map to tile bounds
        this.map.resize();
        this.map.fitBounds(bounds, { padding: 0 });
        
        const renderHandler = () => {
          try {
            // Create tile canvas
            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = width;
            tileCanvas.height = height;
            
            const ctx = tileCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw map canvas
            const mapCanvas = this.map.getCanvas();
            ctx.drawImage(mapCanvas, 0, 0, width, height);
            
            resolve(tileCanvas);
          } catch (error) {
            reject(error);
          }
        };
        
        // Wait for render
        this.map.once('idle', renderHandler);
        
        // Timeout fallback
        setTimeout(() => {
          this.map.off('idle', renderHandler);
          renderHandler();
        }, 5000);
      });
    }

    /**
     * Progressive rendering with memory management
     * @private
     */
    async _performProgressiveExport(exportConfig, options) {
      const chunkSize = options.chunkSize || 1024; // Process in chunks
      const totalWidth = exportConfig.scaledDimensions.width;
      const totalHeight = exportConfig.scaledDimensions.height;
      
      console.log('HighResMapExporter: Using progressive rendering');
      
      // Create final canvas
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      
      // Set high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      try {
        // Get source canvas
        const container = this.map.getContainer();
        const displayScale = Math.min(1, 800 / totalWidth);
        const displayWidth = Math.round(totalWidth * displayScale);
        const displayHeight = Math.round(totalHeight * displayScale);
        
        container.style.width = `${displayWidth}px`;
        container.style.height = `${displayHeight}px`;
        this.map.resize();
        
        await this._waitForRender();
        
        const mapCanvas = this.map.getCanvas();
        const scaleRatio = totalWidth / displayWidth;
        
        // Process in chunks to manage memory
        for (let y = 0; y < totalHeight; y += chunkSize) {
          for (let x = 0; x < totalWidth; x += chunkSize) {
            const chunkWidth = Math.min(chunkSize, totalWidth - x);
            const chunkHeight = Math.min(chunkSize, totalHeight - y);
            
            // Scale coordinates for source canvas
            const srcX = x / scaleRatio;
            const srcY = y / scaleRatio;
            const srcWidth = chunkWidth / scaleRatio;
            const srcHeight = chunkHeight / scaleRatio;
            
            // Draw chunk
            ctx.drawImage(
              mapCanvas,
              srcX, srcY, srcWidth, srcHeight,
              x, y, chunkWidth, chunkHeight
            );
            
            // Add delay to prevent blocking
            await this._delay(1);
          }
          
          // Progress callback if provided
          if (options.onProgress) {
            const progress = Math.round((y / totalHeight) * 100);
            options.onProgress(progress);
          }
        }
        
        // Add metadata
        this._addExportMetadata(ctx, exportConfig, totalWidth, totalHeight);
        
        return canvas;
        
      } catch (error) {
        console.error('HighResMapExporter: Progressive export failed:', error);
        throw error;
      }
    }

    /**
     * Wait for map render completion
     * @private
     */
    _waitForRender() {
      return new Promise((resolve) => {
        const handler = () => {
          this.map.off('render', handler);
          resolve();
        };
        
        this.map.once('render', handler);
        this.map.triggerRepaint();
        
        // Timeout fallback
        setTimeout(() => {
          this.map.off('render', handler);
          resolve();
        }, 10000);
      });
    }

    /**
     * Add delay for non-blocking processing
     * @private
     */
    _delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Monitor and optimize memory usage during export
     * @private
     */
    _optimizeMemoryUsage() {
      const memoryUsage = this._getMemoryUsage();
      if (!memoryUsage) return;
      
      const memoryThreshold = 150 * 1024 * 1024; // 150MB threshold
      
      if (memoryUsage > memoryThreshold) {
        console.warn(`HighResMapExporter: High memory usage detected: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        
        // Force garbage collection if available
        if (window.gc && typeof window.gc === 'function') {
          window.gc();
          console.log('HighResMapExporter: Forced garbage collection');
        }
        
        // Clear canvas cache if available
        if (this.map._painter && this.map._painter.clearStencil) {
          this.map._painter.clearStencil();
        }
      }
    }

    /**
     * Export map to PNG data URL
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @param {Object} options - Additional export options
     * @returns {Promise<string>} PNG data URL
     */
    async exportToPNG(size = 'A4', orientation = 'portrait', quality = 'print', options = {}) {
      // Monitor memory usage before export
      this._optimizeMemoryUsage();
      
      const canvas = await this.exportToCanvas(size, orientation, quality, options);
      const qualitySettings = this.dpiPresets[quality];
      return canvas.toDataURL('image/png', qualitySettings.quality);
    }

    /**
     * Export map to PNG blob
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @param {Object} options - Additional export options
     * @returns {Promise<Blob>} PNG blob
     */
    async exportToPNGBlob(size = 'A4', orientation = 'portrait', quality = 'print', options = {}) {
      // Monitor memory usage before export
      this._optimizeMemoryUsage();
      
      const canvas = await this.exportToCanvas(size, orientation, quality, options);
      return new Promise(resolve => {
        const qualitySettings = this.dpiPresets[quality];
        canvas.toBlob(blob => resolve(blob), 'image/png', qualitySettings.quality);
      });
    }

    /**
     * Export map to JPEG data URL
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @param {string} qualityLevel - 'low', 'medium', or 'high'
     * @param {Object} options - Additional export options
     * @returns {Promise<string>} JPEG data URL
     */
    async exportToJPEG(size = 'A4', orientation = 'portrait', quality = 'print', qualityLevel = 'high', options = {}) {
      // Monitor memory usage before export
      this._optimizeMemoryUsage();
      
      const canvas = await this.exportToCanvas(size, orientation, quality, options);
      const jpegQuality = this.qualityPresets[qualityLevel].jpeg.quality;
      
      // Create a new canvas with white background for JPEG
      const jpegCanvas = document.createElement('canvas');
      jpegCanvas.width = canvas.width;
      jpegCanvas.height = canvas.height;
      const ctx = jpegCanvas.getContext('2d');
      
      // Fill with white background (JPEG doesn't support transparency)
      ctx.fillStyle = this.formatSettings.jpeg.backgroundColor;
      ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
      
      // Draw the original canvas on top
      ctx.drawImage(canvas, 0, 0);
      
      return jpegCanvas.toDataURL('image/jpeg', jpegQuality);
    }

    /**
     * Export map to JPEG blob
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @param {string} qualityLevel - 'low', 'medium', or 'high'
     * @param {Object} options - Additional export options
     * @returns {Promise<Blob>} JPEG blob
     */
    async exportToJPEGBlob(size = 'A4', orientation = 'portrait', quality = 'print', qualityLevel = 'high', options = {}) {
      // Monitor memory usage before export
      this._optimizeMemoryUsage();
      
      const canvas = await this.exportToCanvas(size, orientation, quality, options);
      const jpegQuality = this.qualityPresets[qualityLevel].jpeg.quality;
      
      return new Promise(resolve => {
        // Create a new canvas with white background for JPEG
        const jpegCanvas = document.createElement('canvas');
        jpegCanvas.width = canvas.width;
        jpegCanvas.height = canvas.height;
        const ctx = jpegCanvas.getContext('2d');
        
        // Fill with white background (JPEG doesn't support transparency)
        ctx.fillStyle = this.formatSettings.jpeg.backgroundColor;
        ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
        
        // Draw the original canvas on top
        ctx.drawImage(canvas, 0, 0);
        
        jpegCanvas.toBlob(blob => resolve(blob), 'image/jpeg', jpegQuality);
      });
    }

    /**
     * Generate preview canvas (low resolution for quick display)
     * @param {number} maxWidth - Maximum width for preview
     * @param {number} maxHeight - Maximum height for preview
     * @returns {Promise<HTMLCanvasElement>} Preview canvas
     */
    async generatePreview(maxWidth = 800, maxHeight = 600) {
      return new Promise((resolve, reject) => {
        try {
          console.log(`HighResMapExporter: Generating preview (${maxWidth}x${maxHeight})`);

          // Store original state
          this._storeOriginalState();

          const container = this.map.getContainer();
          const originalStyle = {
            width: container.style.width,
            height: container.style.height
          };

          // Set preview dimensions
          container.style.width = `${maxWidth}px`;
          container.style.height = `${maxHeight}px`;

          // Force map resize
          this.map.resize();

          // Wait for render and capture
          this.map.once('render', () => {
            try {
              const mapCanvas = this.map.getCanvas();
              
              // Create preview canvas
              const previewCanvas = document.createElement('canvas');
              previewCanvas.width = maxWidth;
              previewCanvas.height = maxHeight;
              
              const ctx = previewCanvas.getContext('2d');
              ctx.drawImage(mapCanvas, 0, 0, maxWidth, maxHeight);

              // Restore original container size
              container.style.width = originalStyle.width;
              container.style.height = originalStyle.height;
              this.map.resize();

              console.log('HighResMapExporter: Preview generated successfully');
              resolve(previewCanvas);

            } catch (error) {
              console.error('HighResMapExporter: Preview generation failed:', error);
              // Ensure restoration on error
              container.style.width = originalStyle.width;
              container.style.height = originalStyle.height;
              this.map.resize();
              reject(error);
            }
          });

          // Trigger render
          this.map.triggerRepaint();

        } catch (error) {
          console.error('HighResMapExporter: Preview initialization failed:', error);
          this._restoreOriginalState();
          reject(error);
        }
      });
    }

    /**
     * Validate export parameters
     * @private
     */
    _validateExportParameters(size, orientation, quality) {
      if (!this.printSizes[size.toUpperCase()]) {
        throw new Error(`Unsupported size: ${size}. Supported sizes: ${Object.keys(this.printSizes).join(', ')}`);
      }

      if (!['portrait', 'landscape'].includes(orientation.toLowerCase())) {
        throw new Error(`Unsupported orientation: ${orientation}. Supported: portrait, landscape`);
      }

      if (!this.dpiPresets[quality]) {
        throw new Error(`Unsupported quality: ${quality}. Supported: ${Object.keys(this.dpiPresets).join(', ')}`);
      }

      // Check if map has preserveDrawingBuffer enabled
      if (!this.map.getCanvas()) {
        throw new Error('Map canvas not accessible. Ensure preserveDrawingBuffer is enabled.');
      }
    }

    /**
     * Prepare export configuration
     * @private
     */
    _prepareExportConfiguration(size, orientation, quality) {
      let dimensions = { ...this.printSizes[size.toUpperCase()] };
      
      // Swap dimensions for landscape
      if (orientation.toLowerCase() === 'landscape') {
        dimensions = {
          width: dimensions.height,
          height: dimensions.width,
          inches: {
            width: dimensions.inches.height,
            height: dimensions.inches.width
          },
          name: dimensions.name.replace('Portrait', 'Landscape')
        };
      }

      const dpiSettings = this.dpiPresets[quality];
      
      // Calculate actual pixel dimensions based on quality
      const scaleFactor = dpiSettings.dpi / 300; // Scale from 300 DPI base
      const scaledDimensions = {
        width: Math.round(dimensions.width * scaleFactor),
        height: Math.round(dimensions.height * scaleFactor)
      };

      // Calculate device pixel ratio for high-DPI rendering
      const devicePixelRatio = Math.max(1, dpiSettings.dpi / 96);

      return {
        originalDimensions: dimensions,
        scaledDimensions: scaledDimensions,
        devicePixelRatio: devicePixelRatio,
        quality: dpiSettings.quality,
        dpi: dpiSettings.dpi,
        size: size,
        orientation: orientation
      };
    }

    /**
     * Store original map state for restoration
     * @private
     */
    _storeOriginalState() {
      const container = this.map.getContainer();
      this.originalContainer = {
        width: container.style.width,
        height: container.style.height
      };

      // Store viewport state if possible
      this.originalViewport = {
        center: this.map.getCenter(),
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch()
      };
    }

    /**
     * Restore original map state
     * @private
     */
    _restoreOriginalState() {
      if (this.originalContainer) {
        const container = this.map.getContainer();
        container.style.width = this.originalContainer.width;
        container.style.height = this.originalContainer.height;
        this.map.resize();
      }

      // Reset stored state
      this.originalContainer = null;
      this.originalViewport = null;
    }

    /**
     * Perform the actual export operation
     * @private
     */
    _performExport(config, resolve, reject) {
      try {
        const container = this.map.getContainer();
        
        // Calculate display dimensions (what user sees)
        const displayScale = Math.min(1, 800 / config.scaledDimensions.width);
        const displayWidth = Math.round(config.scaledDimensions.width * displayScale);
        const displayHeight = Math.round(config.scaledDimensions.height * displayScale);

        // Set container to display size
        container.style.width = `${displayWidth}px`;
        container.style.height = `${displayHeight}px`;

        // Force map to resize and render
        this.map.resize();

        // Wait for render completion
        const renderHandler = () => {
          try {
            // Create high-resolution canvas
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = config.scaledDimensions.width;
            exportCanvas.height = config.scaledDimensions.height;

            const ctx = exportCanvas.getContext('2d');
            
            // Set high-quality rendering options
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Scale up the context for high-resolution rendering
            const scaleRatio = config.scaledDimensions.width / displayWidth;
            ctx.scale(scaleRatio, scaleRatio);

            // Draw the map canvas
            const mapCanvas = this.map.getCanvas();
            ctx.drawImage(mapCanvas, 0, 0, displayWidth, displayHeight);

            // Add export metadata overlay
            this._addExportMetadata(ctx, config, displayWidth, displayHeight);

            // Restore original state
            this._restoreOriginalState();

            console.log(`HighResMapExporter: Export completed (${config.scaledDimensions.width}x${config.scaledDimensions.height} at ${config.dpi} DPI)`);
            resolve(exportCanvas);

          } catch (error) {
            console.error('HighResMapExporter: Export rendering failed:', error);
            this._restoreOriginalState();
            reject(error);
          }
        };

        // Attach render handler and trigger repaint
        this.map.once('render', renderHandler);
        this.map.triggerRepaint();

        // Timeout fallback
        setTimeout(() => {
          this.map.off('render', renderHandler);
          renderHandler(); // Try anyway
        }, 10000);

      } catch (error) {
        console.error('HighResMapExporter: Export setup failed:', error);
        this._restoreOriginalState();
        reject(error);
      }
    }

    /**
     * Add export metadata overlay to canvas
     * @private
     */
    _addExportMetadata(ctx, config, displayWidth, displayHeight) {
      // Save context state
      ctx.save();
      
      // Reset scale for overlay text
      const scaleRatio = config.scaledDimensions.width / displayWidth;
      ctx.scale(1/scaleRatio, 1/scaleRatio);

      // Add watermark/metadata
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(config.scaledDimensions.width - 200, config.scaledDimensions.height - 30, 190, 25);
      
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${config.dpi} DPI • Print My Ride`, 
        config.scaledDimensions.width - 10, 
        config.scaledDimensions.height - 10
      );

      // Restore context state
      ctx.restore();
    }

    /**
     * Get export capabilities and status
     * @returns {Object} Capabilities object
     */
    getCapabilities() {
      const webglSupported = this._checkWebGLSupport();
      const canvasAccessible = !!this.map.getCanvas();
      
      return {
        webglSupported: webglSupported,
        canvasAccessible: canvasAccessible,
        preserveDrawingBuffer: canvasAccessible,
        supportedFormats: Object.keys(this.printSizes),
        supportedOrientations: ['portrait', 'landscape'],
        supportedQualities: Object.keys(this.dpiPresets),
        maxRecommendedDimensions: {
          width: 4961, // A3 width
          height: 4961,
          reason: 'Browser memory limitations'
        },
        browserCapabilities: this._detectBrowserCapabilities()
      };
    }

    /**
     * Check WebGL support
     * @private
     */
    _checkWebGLSupport() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      } catch (e) {
        return false;
      }
    }

    /**
     * Detect browser capabilities for optimization
     * @private
     */
    _detectBrowserCapabilities() {
      const userAgent = navigator.userAgent;
      return {
        browser: this._getBrowserName(userAgent),
        mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
        memoryInfo: navigator.deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 1,
        maxTouchPoints: navigator.maxTouchPoints || 0
      };
    }

    /**
     * Get browser name from user agent
     * @private
     */
    _getBrowserName(userAgent) {
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'chrome';
      if (userAgent.includes('Firefox')) return 'firefox';
      if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
      if (userAgent.includes('Edg')) return 'edge';
      return 'unknown';
    }

    /**
     * Validate map instance and configuration
     * @returns {Array} Array of validation warnings/errors
     */
    validateConfiguration() {
      const issues = [];

      // Check map instance
      if (!this.map || typeof this.map.getCanvas !== 'function') {
        issues.push({ level: 'error', message: 'Invalid map instance provided' });
        return issues;
      }

      // Check preserveDrawingBuffer
      if (!this.map.getCanvas()) {
        issues.push({ 
          level: 'error', 
          message: 'Map canvas not accessible. Ensure preserveDrawingBuffer: true is set in map options.' 
        });
      }

      // Check WebGL support
      if (!this._checkWebGLSupport()) {
        issues.push({ 
          level: 'warning', 
          message: 'WebGL not supported. Map rendering may be limited.' 
        });
      }

      // Check browser capabilities
      const capabilities = this._detectBrowserCapabilities();
      if (capabilities.mobile) {
        issues.push({ 
          level: 'warning', 
          message: 'Mobile device detected. High-resolution export may be limited by memory.' 
        });
      }

      if (capabilities.memoryInfo && capabilities.memoryInfo < 4) {
        issues.push({ 
          level: 'warning', 
          message: `Low device memory (${capabilities.memoryInfo}GB). Large exports may fail.` 
        });
      }

      return issues;
    }

    /**
     * Configure anti-aliasing and text optimization settings
     * @param {boolean} antiAliasing - Enable/disable anti-aliasing
     * @param {boolean} optimizeText - Enable/disable text optimization
     * @param {string} format - 'png' or 'jpeg'
     */
    configureRenderingQuality(antiAliasing = true, optimizeText = true, format = 'png') {
      if (this.formatSettings[format]) {
        this.formatSettings[format].antiAliasing = antiAliasing;
        this.formatSettings[format].optimizeText = optimizeText;
      }
    }

    /**
     * Get optimal format and quality settings for file size vs quality balance
     * @param {number} targetFileSizeMB - Desired maximum file size in MB
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @returns {Object} Recommended export settings
     */
    getOptimalExportSettings(targetFileSizeMB = 5, size = 'A4', orientation = 'portrait') {
      const dimensions = this._getDimensions(size, orientation);
      const estimatedPixels = dimensions.width * dimensions.height;
      
      // Estimate file sizes (rough approximations)
      const estimates = {
        jpeg: {
          low: estimatedPixels * 0.3 / (1024 * 1024), // ~0.3 bytes per pixel
          medium: estimatedPixels * 0.5 / (1024 * 1024),
          high: estimatedPixels * 0.8 / (1024 * 1024)
        },
        png: {
          low: estimatedPixels * 1.2 / (1024 * 1024), // ~1.2 bytes per pixel
          medium: estimatedPixels * 1.8 / (1024 * 1024),
          high: estimatedPixels * 2.5 / (1024 * 1024)
        }
      };

      // Find best format and quality combination
      for (const format of ['jpeg', 'png']) {
        for (const quality of ['low', 'medium', 'high']) {
          if (estimates[format][quality] <= targetFileSizeMB) {
            return {
              format,
              qualityLevel: quality,
              estimatedSizeMB: estimates[format][quality].toFixed(2),
              exportMethod: format === 'jpeg' ? 'exportToJPEGBlob' : 'exportToPNGBlob',
              settings: this.qualityPresets[quality][format]
            };
          }
        }
      }

      // If no setting meets target, return lowest quality JPEG
      return {
        format: 'jpeg',
        qualityLevel: 'low',
        estimatedSizeMB: estimates.jpeg.low.toFixed(2),
        exportMethod: 'exportToJPEGBlob',
        settings: this.qualityPresets.low.jpeg,
        warning: `Target file size ${targetFileSizeMB}MB may not be achievable. Using lowest quality settings.`
      };
    }

    /**
     * Compare file sizes between formats and quality levels
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @returns {Object} Size estimates for different export options
     */
    getFileSizeEstimates(size = 'A4', orientation = 'portrait') {
      const dimensions = this._getDimensions(size, orientation);
      const estimatedPixels = dimensions.width * dimensions.height;
      
      return {
        jpeg: {
          low: { sizeMB: (estimatedPixels * 0.3 / (1024 * 1024)).toFixed(2), quality: this.qualityPresets.low.jpeg.quality },
          medium: { sizeMB: (estimatedPixels * 0.5 / (1024 * 1024)).toFixed(2), quality: this.qualityPresets.medium.jpeg.quality },
          high: { sizeMB: (estimatedPixels * 0.8 / (1024 * 1024)).toFixed(2), quality: this.qualityPresets.high.jpeg.quality }
        },
        png: {
          low: { sizeMB: (estimatedPixels * 1.2 / (1024 * 1024)).toFixed(2), compressionLevel: this.qualityPresets.low.png.compressionLevel },
          medium: { sizeMB: (estimatedPixels * 1.8 / (1024 * 1024)).toFixed(2), compressionLevel: this.qualityPresets.medium.png.compressionLevel },
          high: { sizeMB: (estimatedPixels * 2.5 / (1024 * 1024)).toFixed(2), compressionLevel: this.qualityPresets.high.png.compressionLevel }
        },
        dimensions: dimensions,
        totalPixels: estimatedPixels
      };
    }

    /**
     * Get available export formats and their capabilities
     * @returns {Object} Available formats and their features
     */
    getSupportedFormats() {
      return {
        png: {
          name: 'PNG',
          description: 'Lossless compression, supports transparency',
          transparency: true,
          compression: 'lossless',
          qualityLevels: ['low', 'medium', 'high'],
          typical_file_size: 'larger',
          best_for: 'High quality prints, images with transparency'
        },
        jpeg: {
          name: 'JPEG',
          description: 'Lossy compression, smaller file sizes',
          transparency: false,
          compression: 'lossy',
          qualityLevels: ['low', 'medium', 'high'],
          typical_file_size: 'smaller',
          best_for: 'Web sharing, email, smaller file sizes'
        }
      };
    }

    /**
     * Get performance optimization recommendations
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @returns {Object} Performance optimization recommendations
     */
    getPerformanceRecommendations(size = 'A4', orientation = 'portrait', quality = 'print') {
      const config = this._prepareExportConfiguration(size, orientation, quality);
      const pixelCount = config.scaledDimensions.width * config.scaledDimensions.height;
      const memoryUsage = this._getMemoryUsage();
      const capabilities = this._detectBrowserCapabilities();
      
      const recommendations = {
        useTiling: false,
        useProgressive: false,
        suggestedTileSize: 2048,
        suggestedQuality: quality,
        estimatedMemory: Math.round(pixelCount * 4 / 1024 / 1024), // 4 bytes per pixel in MB
        warnings: [],
        optimizations: []
      };

      // Memory-based recommendations
      if (memoryUsage && memoryUsage > 100 * 1024 * 1024) { // > 100MB
        recommendations.warnings.push('High memory usage detected. Consider using tiling for better performance.');
        recommendations.useTiling = true;
      }

      // Pixel count-based recommendations
      if (pixelCount > 16777216) { // > 4096x4096
        recommendations.warnings.push('Very large export requested. Tiling recommended for optimal performance.');
        recommendations.useTiling = true;
        recommendations.suggestedTileSize = 1024; // Smaller tiles for very large exports
      } else if (pixelCount > 4194304) { // > 2048x2048
        recommendations.useProgressive = true;
        recommendations.optimizations.push('Progressive rendering enabled for improved responsiveness.');
      }

      // Device-based recommendations
      if (capabilities.mobile) {
        recommendations.warnings.push('Mobile device detected. Consider reducing quality for better performance.');
        if (quality === 'print') {
          recommendations.suggestedQuality = 'standard';
        }
        recommendations.useTiling = true;
        recommendations.suggestedTileSize = 1024;
      }

      // Browser-based recommendations
      if (!this._checkWebGLSupport()) {
        recommendations.warnings.push('WebGL not available. Export performance may be limited.');
      }

      // Memory threshold recommendations
      if (recommendations.estimatedMemory > 500) { // > 500MB estimated
        recommendations.warnings.push(`Large memory usage estimated (${recommendations.estimatedMemory}MB). Consider reducing size or quality.`);
        recommendations.useTiling = true;
      }

      // Optimization suggestions
      if (!recommendations.useTiling && !recommendations.useProgressive) {
        recommendations.optimizations.push('Export size and system capabilities are optimal for standard rendering.');
      }

      if (recommendations.useTiling) {
        recommendations.optimizations.push(`Canvas tiling enabled with ${recommendations.suggestedTileSize}px tiles for memory efficiency.`);
      }

      return recommendations;
    }

    /**
     * Get export performance settings optimized for current system
     * @param {string} size - 'A4' or 'A3'
     * @param {string} orientation - 'portrait' or 'landscape'
     * @param {string} quality - 'preview', 'standard', or 'print'
     * @returns {Object} Optimized export options
     */
    getOptimizedExportOptions(size = 'A4', orientation = 'portrait', quality = 'print') {
      const recommendations = this.getPerformanceRecommendations(size, orientation, quality);
      
      return {
        // Tiling options
        forceTiling: recommendations.useTiling,
        tileSize: recommendations.suggestedTileSize,
        tileOverlap: recommendations.useTiling ? 32 : 0,
        
        // Progressive options
        useProgressive: recommendations.useProgressive,
        chunkSize: recommendations.useProgressive ? 512 : 1024,
        
        // Memory management
        maxPixelsWithoutTiling: 16777216, // 4096x4096
        memoryThreshold: 150 * 1024 * 1024, // 150MB
        
        // Quality optimization
        quality: recommendations.suggestedQuality,
        
        // Progress callback for UI updates
        onProgress: null, // Can be set by caller
        
        // Performance monitoring
        enablePerformanceLogging: true,
        enableMemoryOptimization: true
      };
    }
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = HighResMapExporter;
  } else if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define(function() { return HighResMapExporter; });
  } else {
    // Browser globals
    global.HighResMapExporter = HighResMapExporter;
  }

})(typeof window !== 'undefined' ? window : this);