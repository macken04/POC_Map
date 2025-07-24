/**
 * Canvas Processing Service
 * Handles multi-format image processing for canvas exports
 * Supports PNG, JPEG, WebP with quality optimization and metadata embedding
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class CanvasProcessor {
  constructor() {
    this.supportedFormats = {
      png: {
        name: 'PNG',
        extension: 'png',
        mimetype: 'image/png',
        supportsTransparency: true,
        compressionType: 'lossless',
        defaultQuality: 90
      },
      jpeg: {
        name: 'JPEG',
        extension: 'jpg',
        mimetype: 'image/jpeg',
        supportsTransparency: false,
        compressionType: 'lossy',
        defaultQuality: 85
      },
      webp: {
        name: 'WebP',
        extension: 'webp',
        mimetype: 'image/webp',
        supportsTransparency: true,
        compressionType: 'lossy',
        defaultQuality: 80
      }
    };

    this.qualityPresets = {
      low: { png: 30, jpeg: 60, webp: 50 },
      medium: { png: 60, jpeg: 80, webp: 70 },
      high: { png: 90, jpeg: 95, webp: 90 },
      print: { png: 100, jpeg: 98, webp: 95 }
    };

    this.dpiSettings = {
      preview: 72,
      standard: 150,
      print: 300,
      premium: 600
    };
  }

  /**
   * Process canvas buffer with format conversion and optimization
   * @param {Buffer} inputBuffer - Canvas image buffer
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed image info
   */
  async processCanvas(inputBuffer, options = {}) {
    const {
      format = 'png',
      quality = 'high',
      width,
      height,
      dpi = 300,
      metadata = {},
      optimization = true
    } = options;

    try {
      console.log(`CanvasProcessor: Processing canvas (${format}, ${quality}, ${dpi} DPI)`);

      // Validate format
      if (!this.supportedFormats[format]) {
        throw new Error(`Unsupported format: ${format}. Supported: ${Object.keys(this.supportedFormats).join(', ')}`);
      }

      // Initialize Sharp processor
      let processor = sharp(inputBuffer);

      // Get image metadata
      const imageMetadata = await processor.metadata();
      const originalWidth = imageMetadata.width;
      const originalHeight = imageMetadata.height;

      console.log(`CanvasProcessor: Original dimensions: ${originalWidth}x${originalHeight}`);

      // Apply DPI setting (affects metadata, not pixel dimensions)
      processor = processor.withMetadata({
        density: dpi
      });

      // Resize if dimensions specified and different from original
      if ((width && width !== originalWidth) || (height && height !== originalHeight)) {
        processor = processor.resize(width, height, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        });
        console.log(`CanvasProcessor: Resized to ${width}x${height}`);
      }

      // Apply format-specific processing
      const formatConfig = this.supportedFormats[format];
      const qualityValue = this.getQualityValue(quality, format);

      switch (format) {
        case 'png':
          processor = processor.png({
            quality: qualityValue,
            compressionLevel: this.getCompressionLevel(quality),
            progressive: optimization,
            palette: optimization // Use palette for smaller files when possible
          });
          break;

        case 'jpeg':
          processor = processor.jpeg({
            quality: qualityValue,
            progressive: optimization,
            mozjpeg: true // Use mozjpeg encoder for better compression
          });
          break;

        case 'webp':
          processor = processor.webp({
            quality: qualityValue,
            lossless: quality === 'print', // Use lossless for print quality
            nearLossless: quality === 'high',
            smartSubsample: optimization
          });
          break;
      }

      // Add metadata if specified
      if (metadata.title || metadata.description || metadata.copyright) {
        const exifData = {};
        if (metadata.title) exifData[0x010e] = metadata.title; // ImageDescription
        if (metadata.description) exifData[0x9286] = metadata.description; // UserComment  
        if (metadata.copyright) exifData[0x8298] = metadata.copyright; // Copyright
        
        processor = processor.withMetadata({ exif: { ifd0: exifData } });
      }

      // Process the image
      const processedBuffer = await processor.toBuffer({ resolveWithObject: true });
      
      const result = {
        buffer: processedBuffer.data,
        info: processedBuffer.info,
        format: format,
        quality: quality,
        qualityValue: qualityValue,
        originalSize: inputBuffer.length,
        processedSize: processedBuffer.data.length,
        compressionRatio: ((inputBuffer.length - processedBuffer.data.length) / inputBuffer.length * 100).toFixed(2),
        dimensions: {
          width: processedBuffer.info.width,
          height: processedBuffer.info.height
        },
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          dpi: dpi,
          format: formatConfig.name,
          mimetype: formatConfig.mimetype
        }
      };

      console.log(`CanvasProcessor: Processed successfully - ${result.originalSize} → ${result.processedSize} bytes (${result.compressionRatio}% reduction)`);
      
      return result;

    } catch (error) {
      console.error('CanvasProcessor: Processing failed:', error);
      throw new Error(`Canvas processing failed: ${error.message}`);
    }
  }

  /**
   * Create multiple format variants of the same canvas
   * @param {Buffer} inputBuffer - Canvas image buffer
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Multiple format results
   */
  async createVariants(inputBuffer, options = {}) {
    const {
      formats = ['png', 'jpeg'],
      qualities = ['medium', 'high'],
      baseMetadata = {}
    } = options;

    try {
      console.log(`CanvasProcessor: Creating variants - formats: ${formats.join(', ')}, qualities: ${qualities.join(', ')}`);

      const variants = {};

      for (const format of formats) {
        variants[format] = {};
        
        for (const quality of qualities) {
          const variantKey = `${format}_${quality}`;
          console.log(`CanvasProcessor: Processing variant: ${variantKey}`);

          try {
            const result = await this.processCanvas(inputBuffer, {
              ...options,
              format,
              quality,
              metadata: {
                ...baseMetadata,
                variant: variantKey
              }
            });

            variants[format][quality] = result;
          } catch (error) {
            console.warn(`CanvasProcessor: Failed to create variant ${variantKey}:`, error.message);
            variants[format][quality] = { error: error.message };
          }
        }
      }

      return {
        success: true,
        variants,
        summary: this.createVariantsSummary(variants)
      };

    } catch (error) {
      console.error('CanvasProcessor: Variants creation failed:', error);
      throw new Error(`Variants creation failed: ${error.message}`);
    }
  }

  /**
   * Optimize image for specific use case
   * @param {Buffer} inputBuffer - Canvas image buffer
   * @param {string} useCase - Optimization target ('web', 'print', 'email', 'social')
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Optimized image result
   */
  async optimizeForUseCase(inputBuffer, useCase, options = {}) {
    const optimizationProfiles = {
      web: {
        format: 'webp',
        quality: 'medium',
        maxWidth: 1920,
        maxHeight: 1080,
        progressive: true
      },
      print: {
        format: 'png',
        quality: 'print',
        dpi: 300,
        colorProfile: 'srgb'
      },
      email: {
        format: 'jpeg',
        quality: 'medium',
        maxWidth: 800,
        maxHeight: 600,
        progressive: false
      },
      social: {
        format: 'jpeg',
        quality: 'high',
        maxWidth: 1200,
        maxHeight: 1200,
        progressive: true
      },
      thumbnail: {
        format: 'jpeg',
        quality: 'medium',
        maxWidth: 300,
        maxHeight: 300,
        progressive: false
      }
    };

    const profile = optimizationProfiles[useCase];
    if (!profile) {
      throw new Error(`Unknown use case: ${useCase}. Available: ${Object.keys(optimizationProfiles).join(', ')}`);
    }

    console.log(`CanvasProcessor: Optimizing for ${useCase}`);

    // Apply size constraints if specified
    let processingOptions = { ...options, ...profile };
    
    if (profile.maxWidth || profile.maxHeight) {
      const metadata = await sharp(inputBuffer).metadata();
      const originalWidth = metadata.width;
      const originalHeight = metadata.height;
      
      let newWidth = originalWidth;
      let newHeight = originalHeight;
      
      // Calculate new dimensions maintaining aspect ratio
      if (profile.maxWidth && originalWidth > profile.maxWidth) {
        newWidth = profile.maxWidth;
        newHeight = Math.round((originalHeight * profile.maxWidth) / originalWidth);
      }
      
      if (profile.maxHeight && newHeight > profile.maxHeight) {
        newHeight = profile.maxHeight;
        newWidth = Math.round((originalWidth * profile.maxHeight) / originalHeight);
      }
      
      // Only set dimensions if they're different from original
      if (newWidth !== originalWidth || newHeight !== originalHeight) {
        processingOptions.width = newWidth;
        processingOptions.height = newHeight;
        
        console.log(`CanvasProcessor: Resizing for ${useCase}: ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight}`);
      }
    }

    return await this.processCanvas(inputBuffer, processingOptions);
  }

  /**
   * Add watermark or branding to canvas
   * @param {Buffer} inputBuffer - Canvas image buffer
   * @param {Object} watermarkOptions - Watermark configuration
   * @returns {Promise<Buffer>} Image with watermark
   */
  async addWatermark(inputBuffer, watermarkOptions = {}) {
    const {
      text,
      position = 'bottom-right',
      opacity = 0.7,
      fontSize = 24,
      color = 'white',
      background = 'rgba(0,0,0,0.5)'
    } = watermarkOptions;

    try {
      console.log(`CanvasProcessor: Adding watermark: "${text}" at ${position}`);

      const image = sharp(inputBuffer);
      const metadata = await image.metadata();

      // Create watermark text as SVG
      const svgText = `
        <svg width="${metadata.width}" height="${metadata.height}">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.5"/>
            </filter>
          </defs>
          <text x="${this.getWatermarkX(position, metadata.width)}" 
                y="${this.getWatermarkY(position, metadata.height)}" 
                font-family="Arial, sans-serif" 
                font-size="${fontSize}" 
                fill="${color}" 
                opacity="${opacity}"
                text-anchor="${this.getTextAnchor(position)}"
                filter="url(#shadow)">
            ${text}
          </text>
        </svg>
      `;

      const watermarkBuffer = Buffer.from(svgText);
      
      const result = await image
        .composite([{ input: watermarkBuffer, blend: 'over' }])
        .toBuffer();

      console.log('CanvasProcessor: Watermark added successfully');
      return result;

    } catch (error) {
      console.error('CanvasProcessor: Watermark addition failed:', error);
      throw new Error(`Watermark addition failed: ${error.message}`);
    }
  }

  /**
   * Get quality value for format and preset
   * @private
   */
  getQualityValue(qualityPreset, format) {
    if (typeof qualityPreset === 'number') {
      return Math.max(1, Math.min(100, qualityPreset));
    }
    
    return this.qualityPresets[qualityPreset]?.[format] || this.supportedFormats[format].defaultQuality;
  }

  /**
   * Get compression level for PNG
   * @private
   */
  getCompressionLevel(quality) {
    const levels = {
      low: 1,
      medium: 6,
      high: 8,
      print: 9
    };
    return levels[quality] || 6;
  }

  /**
   * Create summary of variants
   * @private
   */
  createVariantsSummary(variants) {
    const summary = {
      totalVariants: 0,
      successful: 0,
      failed: 0,
      totalSizeReduction: 0,
      bestCompression: null,
      smallestFile: null
    };

    let smallestSize = Infinity;
    let bestCompressionRatio = 0;

    Object.keys(variants).forEach(format => {
      Object.keys(variants[format]).forEach(quality => {
        const variant = variants[format][quality];
        summary.totalVariants++;

        if (variant.error) {
          summary.failed++;
        } else {
          summary.successful++;
          
          const compressionRatio = parseFloat(variant.compressionRatio);
          summary.totalSizeReduction += compressionRatio;

          if (variant.processedSize < smallestSize) {
            smallestSize = variant.processedSize;
            summary.smallestFile = `${format}_${quality}`;
          }

          if (compressionRatio > bestCompressionRatio) {
            bestCompressionRatio = compressionRatio;
            summary.bestCompression = `${format}_${quality}`;
          }
        }
      });
    });

    summary.averageCompression = summary.successful > 0 
      ? (summary.totalSizeReduction / summary.successful).toFixed(2) + '%'
      : '0%';

    return summary;
  }

  /**
   * Get watermark X position
   * @private
   */
  getWatermarkX(position, width) {
    if (position.includes('left')) return 20;
    if (position.includes('right')) return width - 20;
    return width / 2;
  }

  /**
   * Get watermark Y position
   * @private
   */
  getWatermarkY(position, height) {
    if (position.includes('top')) return 40;
    if (position.includes('bottom')) return height - 20;
    return height / 2;
  }

  /**
   * Get text anchor for watermark
   * @private
   */
  getTextAnchor(position) {
    if (position.includes('left')) return 'start';
    if (position.includes('right')) return 'end';
    return 'middle';
  }

  /**
   * Get supported formats information
   */
  getSupportedFormats() {
    return { ...this.supportedFormats };
  }

  /**
   * Get quality presets information
   */
  getQualityPresets() {
    return { ...this.qualityPresets };
  }

  /**
   * Get DPI settings information
   */
  getDPISettings() {
    return { ...this.dpiSettings };
  }

  /**
   * Validate processing options
   */
  validateOptions(options) {
    const errors = [];

    if (options.format && !this.supportedFormats[options.format]) {
      errors.push(`Unsupported format: ${options.format}`);
    }

    if (options.quality && typeof options.quality === 'string' && !this.qualityPresets[options.quality]) {
      errors.push(`Unknown quality preset: ${options.quality}`);
    }

    if (options.width && (!Number.isInteger(options.width) || options.width <= 0)) {
      errors.push('Width must be a positive integer');
    }

    if (options.height && (!Number.isInteger(options.height) || options.height <= 0)) {
      errors.push('Height must be a positive integer');
    }

    if (options.dpi && (!Number.isInteger(options.dpi) || options.dpi <= 0)) {
      errors.push('DPI must be a positive integer');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = CanvasProcessor;