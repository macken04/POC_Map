# Batch GPX Image Generator

## Overview

The Batch GPX Image Generator is a command-line tool designed for administrative users to generate high-resolution map images from a single GPX file across **all available theme and color combinations**.

This tool is **completely separate** from the main application flow and does **NOT modify** any existing services or functionality. It simply uses existing services (`MapService`, `GPXTCXParser`) to batch-generate images.

## Key Features

✅ **Zero Impact on Existing Functionality** - Uses existing services without modification
✅ **All Theme/Color Combinations** - Generates 12 unique variations automatically
✅ **High-Resolution Output** - 300 DPI print-quality images (configurable)
✅ **Progress Tracking** - Real-time progress with timing information
✅ **Error Handling** - Continues on failure, logs errors
✅ **Parallel Processing** - Optional concurrent generation (up to 3x)
✅ **Flexible Filtering** - Generate only specific themes or colors
✅ **Detailed Reporting** - JSON log with all generation details

## Installation

No additional installation required. The script uses existing project dependencies.

## Usage

### Basic Usage

Generate all theme/color combinations for a GPX file:

```bash
cd /home/user/POC_Map/backend
node scripts/batch-gpx-generator.js --gpx path/to/your-route.gpx
```

### All Options

```bash
node scripts/batch-gpx-generator.js \
  --gpx path/to/route.gpx \           # Required: Path to GPX file
  --format A4 \                       # Optional: A4 or A3 (default: A4)
  --orientation portrait \            # Optional: portrait or landscape (default: portrait)
  --dpi 300 \                         # Optional: 72-600 (default: 300)
  --output-dir ./custom-output \      # Optional: Custom output directory
  --route-width 4 \                   # Optional: Route line width in pixels
  --route-color "#ff4444" \           # Optional: Route color hex code
  --themes classic,minimal \          # Optional: Filter by themes
  --colors grey,dark \                # Optional: Filter by colors
  --parallel 2                        # Optional: Concurrent generations (1-3)
```

### Common Use Cases

#### 1. Generate All Combinations (Default)

```bash
node scripts/batch-gpx-generator.js --gpx my-route.gpx
```

**Generates:** 12 images (all theme/color combinations)

#### 2. Only Classic Theme

```bash
node scripts/batch-gpx-generator.js --gpx my-route.gpx --themes classic
```

**Generates:** 6 images (classic theme with all colors)

#### 3. Only Dark and Grey Colors Across All Themes

```bash
node scripts/batch-gpx-generator.js --gpx my-route.gpx --colors dark,grey
```

**Generates:** 3 images (classic/dark, classic/grey, minimal/dark, minimal/grey)

#### 4. A3 Landscape with Parallel Processing

```bash
node scripts/batch-gpx-generator.js \
  --gpx my-route.gpx \
  --format A3 \
  --orientation landscape \
  --parallel 2
```

**Generates:** 12 images (A3 landscape, 2 concurrent)

#### 5. Custom Output Directory

```bash
node scripts/batch-gpx-generator.js \
  --gpx my-route.gpx \
  --output-dir /path/to/custom/output
```

## Available Themes and Colors

### Classic Theme (6 colors)
- `classic` - Traditional white/grey
- `grey` - Greyscale variant
- `dark` - Dark mode
- `blue` - Blue accent
- `orange` - Orange accent
- `pink` - Pink accent

### Minimal Theme (5 colors)
- `dark` - Dark minimal
- `pink` - Pink minimal
- `grey` - Grey minimal
- `sand` - Sandy/beige tones
- `sage` - Green/sage tones

### Bubble Theme (1 color)
- `bubble` - Unique bubble style

**Total:** 12 unique combinations

## Output

### File Naming Convention

```
{gpx-filename}_{theme}_{color}_{format}_{orientation}.png
```

**Examples:**
- `my-route_classic_grey_A4_portrait.png`
- `my-route_minimal_sand_A3_landscape.png`
- `my-route_bubble_bubble_A4_portrait.png`

### Output Directory Structure

```
generated-maps/
└── batch/
    ├── my-route_classic_classic_A4_portrait.png
    ├── my-route_classic_grey_A4_portrait.png
    ├── my-route_classic_dark_A4_portrait.png
    ├── ...
    └── batch-log-1234567890.json
```

### Log Files

Each batch generation creates a detailed JSON log:

```json
{
  "options": {
    "gpxPath": "my-route.gpx",
    "format": "A4",
    "orientation": "portrait",
    "dpi": 300
  },
  "results": [
    {
      "success": true,
      "filename": "my-route_classic_grey_A4_portrait.png",
      "duration": 2345,
      "theme": "classic",
      "color": "grey"
    }
  ],
  "summary": {
    "total": 12,
    "successful": 12,
    "failed": 0,
    "totalDuration": 28540,
    "avgDuration": 2378
  },
  "timestamp": "2025-11-21T16:30:00.000Z"
}
```

## Console Output Example

```
============================================================
🚀 BATCH GPX IMAGE GENERATOR
============================================================

Configuration:
  GPX file: my-route.gpx
  Format: A4 portrait
  DPI: 300
  Route color: #ff4444
  Route width: 4px
  Output: ./generated-maps/batch
  Parallel: sequential

✓ Output directory ready: ./generated-maps/batch

📁 Reading GPX file: my-route.gpx
📊 Parsing GPX data...
✓ GPX parsed successfully
  - Coordinates: 245
  - Distance: 15.32 km
  - Bounds: {...}

🎨 Found 12 theme/color combinations

⚙️  Starting generation...

[ 1/12] classic/classic      ... ✓ (2.3s)
[ 2/12] classic/grey         ... ✓ (1.9s)
[ 3/12] classic/dark         ... ✓ (2.1s)
[ 4/12] classic/blue         ... ✓ (2.0s)
[ 5/12] classic/orange       ... ✓ (2.2s)
[ 6/12] classic/pink         ... ✓ (2.1s)
[ 7/12] minimal/dark         ... ✓ (1.8s)
[ 8/12] minimal/pink         ... ✓ (1.9s)
[ 9/12] minimal/grey         ... ✓ (2.0s)
[10/12] minimal/sand         ... ✓ (1.8s)
[11/12] minimal/sage         ... ✓ (1.9s)
[12/12] bubble/bubble        ... ✓ (2.0s)

============================================================
📊 BATCH GENERATION SUMMARY
============================================================

✓ Successful: 12/12
✗ Failed: 0/12
⏱️  Total time: 24.0s
⏱️  Avg time per image: 2.0s

📁 Output directory: ./generated-maps/batch

✓ Generated files:
  - my-route_classic_classic_A4_portrait.png
  - my-route_classic_grey_A4_portrait.png
  - my-route_classic_dark_A4_portrait.png
  - my-route_classic_blue_A4_portrait.png
  - my-route_classic_orange_A4_portrait.png
  - my-route_classic_pink_A4_portrait.png
  - my-route_minimal_dark_A4_portrait.png
  - my-route_minimal_pink_A4_portrait.png
  - my-route_minimal_grey_A4_portrait.png
  - my-route_minimal_sand_A4_portrait.png
  - my-route_minimal_sage_A4_portrait.png
  - my-route_bubble_bubble_A4_portrait.png

============================================================

📄 Detailed log saved: ./generated-maps/batch/batch-log-1732208400000.json
```

## Performance

### Timing Estimates

- **Sequential (default):** ~2-3 seconds per image
  - 12 images: ~24-36 seconds

- **Parallel (--parallel 2):** ~1.5-2x faster
  - 12 images: ~14-20 seconds

- **Parallel (--parallel 3):** ~2-2.5x faster
  - 12 images: ~10-15 seconds

### Resource Usage

- **Memory:** ~200-500 MB per concurrent generation
- **CPU:** Scales with parallel setting
- **Disk:** ~2-5 MB per image (300 DPI PNG)

## Troubleshooting

### Error: "GPX file not found"

**Solution:** Verify the path to your GPX file is correct.

```bash
ls -la path/to/your-route.gpx
```

### Error: "Browser launch failed"

**Solution:** Ensure Puppeteer is installed and Chromium is available.

```bash
cd backend
npm install puppeteer
```

### Error: "Invalid format" or "Invalid orientation"

**Solution:** Check that format is `A4` or `A3` (case-insensitive) and orientation is `portrait` or `landscape`.

### Slow Generation

**Solutions:**
1. Use parallel processing: `--parallel 2`
2. Reduce DPI for testing: `--dpi 150`
3. Generate fewer combinations: `--themes classic --colors grey,dark`

### Memory Issues

**Solutions:**
1. Reduce parallel setting: `--parallel 1`
2. Lower DPI: `--dpi 150`
3. Close other applications

## Integration with Existing System

### Safety Guarantees

✅ **Read-Only Operations** - Only reads from existing services
✅ **No Service Modifications** - Does not modify MapService or GPXTCXParser
✅ **Isolated Output** - Writes to separate `batch/` directory
✅ **Independent Execution** - Runs completely separately from main app

### Services Used

1. **GPXTCXParser** (`backend/services/gpxTcxParser.js`)
   - Parses GPX file
   - Extracts coordinates, bounds, metadata

2. **MapService** (`backend/services/mapService.js`)
   - Generates high-resolution images
   - Handles Puppeteer/Mapbox rendering

### No Impact Areas

- ❌ Does NOT touch Shopify theme files
- ❌ Does NOT modify authentication system
- ❌ Does NOT affect web server routes
- ❌ Does NOT change database or sessions
- ❌ Does NOT interfere with user uploads

## Advanced Usage

### Automated Batch Processing

Process multiple GPX files with a shell script:

```bash
#!/bin/bash
# batch-process-all.sh

for gpx in routes/*.gpx; do
  echo "Processing: $gpx"
  node scripts/batch-gpx-generator.js --gpx "$gpx" --parallel 2
done
```

### Cron Job for Scheduled Processing

```bash
# Process GPX files every night at 2 AM
0 2 * * * cd /home/user/POC_Map/backend && node scripts/batch-gpx-generator.js --gpx /path/to/route.gpx
```

### Custom Theme Subsets

Create a configuration file for repeated use:

```bash
#!/bin/bash
# generate-web-variants.sh
# Generate only web-optimized variants

node scripts/batch-gpx-generator.js \
  --gpx "$1" \
  --dpi 150 \
  --themes classic,minimal \
  --colors grey,dark \
  --parallel 2
```

## Support

For issues or questions:

1. Check this README
2. Review console output and error messages
3. Check log files in output directory
4. Verify GPX file is valid
5. Test with sample GPX file first

## Version History

- **v1.0.0** (2025-11-21) - Initial release
  - All theme/color combinations
  - Sequential and parallel processing
  - Comprehensive error handling
  - Detailed logging
