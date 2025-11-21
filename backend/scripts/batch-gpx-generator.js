#!/usr/bin/env node

/**
 * Batch GPX Image Generator
 *
 * Generates high-resolution map images for a single GPX file across all available
 * theme and color combinations. This script is designed for administrative use
 * to bulk-generate map variations without requiring UI interaction.
 *
 * IMPORTANT: This script does NOT modify any existing services or functionality.
 * It only USES existing services (MapService, GPXTCXParser) to batch generate images.
 *
 * Usage:
 *   node batch-gpx-generator.js --gpx path/to/route.gpx [options]
 *
 * Options:
 *   --gpx <path>           Path to GPX file (required)
 *   --format <size>        Print format: A4 or A3 (default: A4)
 *   --orientation <dir>    Orientation: portrait or landscape (default: portrait)
 *   --dpi <number>         DPI resolution (default: 300)
 *   --output-dir <path>    Output directory (default: ./generated-maps/batch)
 *   --route-width <px>     Route line width (default: 4)
 *   --route-color <hex>    Route color hex code (default: #ff4444)
 *   --themes <list>        Comma-separated themes to generate (default: all)
 *   --colors <list>        Comma-separated colors to generate (default: all)
 *   --parallel <number>    Number of concurrent generations (default: 1, max: 3)
 *   --help                 Show this help message
 *
 * Examples:
 *   # Generate all combinations
 *   node batch-gpx-generator.js --gpx my-route.gpx
 *
 *   # Only classic theme in grey and dark
 *   node batch-gpx-generator.js --gpx route.gpx --themes classic --colors grey,dark
 *
 *   # A3 landscape with parallel generation
 *   node batch-gpx-generator.js --gpx route.gpx --format A3 --orientation landscape --parallel 2
 */

const GPXTCXParser = require('../services/gpxTcxParser');
const MapService = require('../services/mapService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Theme and color combinations from mapbox-config.js
 * This is a static copy to avoid loading frontend code in backend script
 */
const THEME_COLOR_MAP = {
  classic: {
    name: 'Classic',
    colors: {
      classic: {
        name: 'Classic',
        url: 'mapbox://styles/macken04/cme05849o00eb01sbh2b46dz4'
      },
      grey: {
        name: 'Grey',
        url: 'mapbox://styles/macken04/cmdowoyfi003o01r5h90e8r6l'
      },
      dark: {
        name: 'Dark',
        url: 'mapbox://styles/macken04/cmdowqfh4004h01sb14fe6x3u'
      },
      blue: {
        name: 'Blue',
        url: 'mapbox://styles/macken04/cmdowyoil001d01sh5937dt1p'
      },
      orange: {
        name: 'Orange',
        url: 'mapbox://styles/macken04/cmhxe59y8001801qx91nfd6qc'
      },
      pink: {
        name: 'Pink',
        url: 'mapbox://styles/macken04/cme063epj00rq01pjamus26ma'
      }
    }
  },
  minimal: {
    name: 'Minimal',
    colors: {
      dark: {
        name: 'Dark',
        url: 'mapbox://styles/macken04/cm9mvpjc8010b01quegchbmov'
      },
      pink: {
        name: 'Pink',
        url: 'mapbox://styles/macken04/cm9mvpk4s010c01qu4jzgccqt'
      },
      grey: {
        name: 'Grey',
        url: 'mapbox://styles/macken04/cm9mvpjxz001q01pgco8gefok'
      },
      sand: {
        name: 'Sand',
        url: 'mapbox://styles/macken04/cm9mvpjrw001801s5d2xv8t27'
      },
      sage: {
        name: 'Sage',
        url: 'mapbox://styles/macken04/cm9mvpjj0006y01qsckitaoib'
      }
    }
  },
  bubble: {
    name: 'Bubble',
    colors: {
      bubble: {
        name: 'Bubble',
        url: 'mapbox://styles/macken04/cmdpqgs5y00av01qs9jat5xu9'
      }
    }
  }
};

/**
 * Batch GPX Generator Class
 */
class BatchGPXGenerator {
  constructor() {
    this.parser = new GPXTCXParser();
    this.mapService = new MapService();
    this.results = [];
    this.startTime = null;
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args) {
    const options = {
      gpxPath: null,
      format: 'A4',
      orientation: 'portrait',
      dpi: 300,
      outputDir: path.join(__dirname, '..', 'generated-maps', 'batch'),
      routeWidth: 4,
      routeColor: '#ff4444',
      themes: null, // null means all themes
      colors: null, // null means all colors
      parallel: 1,
      showHelp: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--gpx':
          options.gpxPath = nextArg;
          i++;
          break;
        case '--format':
          options.format = nextArg?.toUpperCase() || 'A4';
          i++;
          break;
        case '--orientation':
          options.orientation = nextArg?.toLowerCase() || 'portrait';
          i++;
          break;
        case '--dpi':
          options.dpi = parseInt(nextArg) || 300;
          i++;
          break;
        case '--output-dir':
          options.outputDir = nextArg;
          i++;
          break;
        case '--route-width':
          options.routeWidth = parseInt(nextArg) || 4;
          i++;
          break;
        case '--route-color':
          options.routeColor = nextArg || '#ff4444';
          i++;
          break;
        case '--themes':
          options.themes = nextArg ? nextArg.split(',').map(t => t.trim()) : null;
          i++;
          break;
        case '--colors':
          options.colors = nextArg ? nextArg.split(',').map(c => c.trim()) : null;
          i++;
          break;
        case '--parallel':
          options.parallel = Math.min(parseInt(nextArg) || 1, 3);
          i++;
          break;
        case '--help':
        case '-h':
          options.showHelp = true;
          break;
      }
    }

    return options;
  }

  /**
   * Show help message
   */
  showHelp() {
    const helpText = `
Batch GPX Image Generator

Generates high-resolution map images for a single GPX file across all available
theme and color combinations.

Usage:
  node batch-gpx-generator.js --gpx path/to/route.gpx [options]

Options:
  --gpx <path>           Path to GPX file (required)
  --format <size>        Print format: A4 or A3 (default: A4)
  --orientation <dir>    Orientation: portrait or landscape (default: portrait)
  --dpi <number>         DPI resolution (default: 300)
  --output-dir <path>    Output directory (default: ./generated-maps/batch)
  --route-width <px>     Route line width (default: 4)
  --route-color <hex>    Route color hex code (default: #ff4444)
  --themes <list>        Comma-separated themes to generate (default: all)
                         Available: classic, minimal, bubble
  --colors <list>        Comma-separated colors to generate (default: all)
                         Varies by theme
  --parallel <number>    Number of concurrent generations (default: 1, max: 3)
  --help, -h             Show this help message

Examples:
  # Generate all combinations
  node batch-gpx-generator.js --gpx my-route.gpx

  # Only classic theme in grey and dark
  node batch-gpx-generator.js --gpx route.gpx --themes classic --colors grey,dark

  # A3 landscape with parallel generation
  node batch-gpx-generator.js --gpx route.gpx --format A3 --orientation landscape --parallel 2

  # Custom output directory
  node batch-gpx-generator.js --gpx route.gpx --output-dir /path/to/output

Available Themes and Colors:
  classic: classic, grey, dark, blue, orange, pink
  minimal: dark, pink, grey, sand, sage
  bubble: bubble
`;
    console.log(helpText);
  }

  /**
   * Validate options
   */
  validateOptions(options) {
    const errors = [];

    if (!options.gpxPath) {
      errors.push('GPX file path is required (--gpx)');
    }

    if (!['A4', 'A3'].includes(options.format)) {
      errors.push(`Invalid format '${options.format}'. Must be A4 or A3`);
    }

    if (!['portrait', 'landscape'].includes(options.orientation)) {
      errors.push(`Invalid orientation '${options.orientation}'. Must be portrait or landscape`);
    }

    if (options.dpi < 72 || options.dpi > 600) {
      errors.push(`Invalid DPI '${options.dpi}'. Must be between 72 and 600`);
    }

    if (options.themes) {
      const validThemes = Object.keys(THEME_COLOR_MAP);
      const invalidThemes = options.themes.filter(t => !validThemes.includes(t));
      if (invalidThemes.length > 0) {
        errors.push(`Invalid themes: ${invalidThemes.join(', ')}. Valid themes: ${validThemes.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Get all theme/color combinations based on filters
   */
  getAllCombinations(themeFilter = null, colorFilter = null) {
    const combinations = [];

    const themes = themeFilter || Object.keys(THEME_COLOR_MAP);

    for (const themeKey of themes) {
      if (!THEME_COLOR_MAP[themeKey]) continue;

      const theme = THEME_COLOR_MAP[themeKey];
      const colors = colorFilter || Object.keys(theme.colors);

      for (const colorKey of colors) {
        if (!theme.colors[colorKey]) continue;

        combinations.push({
          theme: themeKey,
          themeName: theme.name,
          color: colorKey,
          colorName: theme.colors[colorKey].name,
          styleUrl: theme.colors[colorKey].url
        });
      }
    }

    return combinations;
  }

  /**
   * Parse GPX file
   */
  async parseGPX(gpxPath) {
    console.log(`\n📁 Reading GPX file: ${gpxPath}`);

    try {
      // Check if file exists
      await fs.access(gpxPath);
    } catch (error) {
      throw new Error(`GPX file not found: ${gpxPath}`);
    }

    const buffer = await fs.readFile(gpxPath);
    const filename = path.basename(gpxPath);

    console.log(`📊 Parsing GPX data...`);
    const routeData = await this.parser.parseGPXFile(buffer, filename);

    console.log(`✓ GPX parsed successfully`);
    console.log(`  - Coordinates: ${routeData.coordinates.length}`);
    console.log(`  - Distance: ${routeData.distance ? (routeData.distance / 1000).toFixed(2) + ' km' : 'N/A'}`);
    console.log(`  - Bounds: ${JSON.stringify(routeData.bounds)}`);

    return routeData;
  }

  /**
   * Get base filename without extension
   */
  getBaseName(filePath) {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Generate single map image
   */
  async generateSingle(routeData, combination, options, current, total) {
    const { theme, color, styleUrl } = combination;
    const baseName = this.getBaseName(options.gpxPath);

    const outputFilename = `${baseName}_${theme}_${color}_${options.format}_${options.orientation}.png`;
    const outputPath = path.join(options.outputDir, outputFilename);

    const progressPrefix = `[${String(current).padStart(2)}/${String(total).padStart(2)}]`;
    const themeColorLabel = `${theme}/${color}`.padEnd(20);

    process.stdout.write(`${progressPrefix} ${themeColorLabel} ... `);

    const startTime = Date.now();

    try {
      const mapOptions = {
        routeCoordinates: routeData.coordinates,
        bounds: routeData.bounds,
        center: routeData.center,
        format: options.format,
        orientation: options.orientation,
        dpi: options.dpi,
        style: styleUrl,
        routeColor: options.routeColor,
        routeWidth: options.routeWidth,
        outputPath,
        showStartEnd: true,
        title: routeData.name || baseName,
        exportFormat: 'png',
        qualityLevel: 'high',
        memoryOptimization: true
      };

      await this.mapService.generateMap(mapOptions);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✓ (${duration}s)`);

      return {
        success: true,
        outputPath,
        filename: outputFilename,
        duration: Date.now() - startTime,
        theme,
        color
      };

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✗ Failed (${duration}s)`);
      console.error(`  Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        theme,
        color
      };
    }
  }

  /**
   * Generate batch with sequential processing
   */
  async generateBatchSequential(routeData, combinations, options) {
    const results = [];

    for (let i = 0; i < combinations.length; i++) {
      const result = await this.generateSingle(
        routeData,
        combinations[i],
        options,
        i + 1,
        combinations.length
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Generate batch with parallel processing
   */
  async generateBatchParallel(routeData, combinations, options, concurrency) {
    const results = [];
    const queue = [...combinations];
    let completed = 0;

    const processBatch = async (batchIndex) => {
      while (queue.length > 0) {
        const combination = queue.shift();
        if (!combination) break;

        const index = combinations.indexOf(combination);
        const result = await this.generateSingle(
          routeData,
          combination,
          options,
          index + 1,
          combinations.length
        );

        results[index] = result;
        completed++;
      }
    };

    // Create worker promises
    const workers = Array.from({ length: concurrency }, (_, i) => processBatch(i));
    await Promise.all(workers);

    return results;
  }

  /**
   * Generate summary report
   */
  generateReport(results, options, totalDuration) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✓ Successful: ${successful.length}/${results.length}`);
    console.log(`✗ Failed: ${failed.length}/${results.length}`);
    console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`⏱️  Avg time per image: ${(avgDuration / 1000).toFixed(1)}s`);

    if (successful.length > 0) {
      console.log(`\n📁 Output directory: ${options.outputDir}`);
      console.log(`\n✓ Generated files:`);
      successful.forEach(r => {
        console.log(`  - ${r.filename}`);
      });
    }

    if (failed.length > 0) {
      console.log(`\n✗ Failed generations:`);
      failed.forEach(r => {
        console.log(`  - ${r.theme}/${r.color}: ${r.error}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Write detailed log file
    const logPath = path.join(options.outputDir, `batch-log-${Date.now()}.json`);
    return fs.writeFile(logPath, JSON.stringify({
      options,
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        totalDuration,
        avgDuration
      },
      timestamp: new Date().toISOString()
    }, null, 2))
    .then(() => {
      console.log(`📄 Detailed log saved: ${logPath}\n`);
    })
    .catch(err => {
      console.warn(`⚠️  Could not save log file: ${err.message}\n`);
    });
  }

  /**
   * Main generation workflow
   */
  async generate(options) {
    this.startTime = Date.now();

    console.log('\n' + '='.repeat(60));
    console.log('🚀 BATCH GPX IMAGE GENERATOR');
    console.log('='.repeat(60));
    console.log(`\nConfiguration:`);
    console.log(`  GPX file: ${options.gpxPath}`);
    console.log(`  Format: ${options.format} ${options.orientation}`);
    console.log(`  DPI: ${options.dpi}`);
    console.log(`  Route color: ${options.routeColor}`);
    console.log(`  Route width: ${options.routeWidth}px`);
    console.log(`  Output: ${options.outputDir}`);
    console.log(`  Parallel: ${options.parallel > 1 ? options.parallel + ' concurrent' : 'sequential'}`);

    try {
      // Ensure output directory exists
      await fs.mkdir(options.outputDir, { recursive: true });
      console.log(`\n✓ Output directory ready: ${options.outputDir}`);

      // Parse GPX file
      const routeData = await this.parseGPX(options.gpxPath);

      // Get combinations
      const combinations = this.getAllCombinations(options.themes, options.colors);
      console.log(`\n🎨 Found ${combinations.length} theme/color combinations`);

      if (options.themes || options.colors) {
        console.log(`   Filtered by: ${options.themes ? 'themes=' + options.themes.join(',') : ''} ${options.colors ? 'colors=' + options.colors.join(',') : ''}`);
      }

      console.log(`\n⚙️  Starting generation...\n`);

      // Generate maps
      let results;
      if (options.parallel > 1) {
        results = await this.generateBatchParallel(routeData, combinations, options, options.parallel);
      } else {
        results = await this.generateBatchSequential(routeData, combinations, options);
      }

      // Generate report
      const totalDuration = Date.now() - this.startTime;
      await this.generateReport(results, options, totalDuration);

      const successCount = results.filter(r => r.success).length;
      return successCount === results.length ? 0 : 1; // Exit code

    } catch (error) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error.stack);
      return 1; // Exit code
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const generator = new BatchGPXGenerator();
  const options = generator.parseArgs(process.argv.slice(2));

  if (options.showHelp) {
    generator.showHelp();
    process.exit(0);
  }

  // Validate options
  const errors = generator.validateOptions(options);
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nUse --help for usage information\n');
    process.exit(1);
  }

  // Run generation
  const exitCode = await generator.generate(options);
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = BatchGPXGenerator;
