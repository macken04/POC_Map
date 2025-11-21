# Quick Start Guide - Batch GPX Generator

## 1-Minute Setup

### Test with Sample File

```bash
cd /home/user/POC_Map/backend

# Show help
node scripts/batch-gpx-generator.js --help

# Test with sample GPX (generates 12 images)
node scripts/batch-gpx-generator.js --gpx scripts/sample-route.gpx
```

**Expected output location:** `backend/generated-maps/batch/`

---

## Common Commands

### Generate All Combinations

```bash
# Default: A4 portrait, 300 DPI, all themes/colors
node scripts/batch-gpx-generator.js --gpx /path/to/your-route.gpx
```

### Generate with Custom Settings

```bash
# A3 landscape, parallel processing
node scripts/batch-gpx-generator.js \
  --gpx /path/to/route.gpx \
  --format A3 \
  --orientation landscape \
  --parallel 2
```

### Generate Specific Themes Only

```bash
# Only classic and minimal themes
node scripts/batch-gpx-generator.js \
  --gpx /path/to/route.gpx \
  --themes classic,minimal
```

### Generate Specific Colors Only

```bash
# Only grey and dark colors across all themes
node scripts/batch-gpx-generator.js \
  --gpx /path/to/route.gpx \
  --colors grey,dark
```

---

## File Outputs

### Generated Images

Location: `backend/generated-maps/batch/`

Naming: `{gpx-name}_{theme}_{color}_{format}_{orientation}.png`

Example:
```
sample-route_classic_grey_A4_portrait.png
sample-route_minimal_sand_A4_portrait.png
```

### Log Files

Location: `backend/generated-maps/batch/batch-log-{timestamp}.json`

Contains:
- All generation results
- Success/failure details
- Timing information
- Configuration used

---

## Verification

### Check Generated Files

```bash
ls -lh backend/generated-maps/batch/
```

### View Sample Image

```bash
# macOS
open backend/generated-maps/batch/sample-route_classic_grey_A4_portrait.png

# Linux
xdg-open backend/generated-maps/batch/sample-route_classic_grey_A4_portrait.png
```

### View Log

```bash
cat backend/generated-maps/batch/batch-log-*.json | jq .
```

---

## Troubleshooting Quick Fixes

### Problem: "GPX file not found"

```bash
# Verify file exists
ls -la /path/to/your-route.gpx

# Use absolute path
node scripts/batch-gpx-generator.js --gpx /absolute/path/to/route.gpx
```

### Problem: "Command not found: node"

```bash
# Check Node.js installation
which node
node --version

# Install if missing (example for Ubuntu)
# sudo apt-get install nodejs
```

### Problem: Browser launch failed

```bash
# Reinstall Puppeteer
cd backend
npm install puppeteer
```

### Problem: Slow generation

```bash
# Use parallel processing
node scripts/batch-gpx-generator.js --gpx route.gpx --parallel 2

# Or reduce DPI for testing
node scripts/batch-gpx-generator.js --gpx route.gpx --dpi 150
```

---

## Full Documentation

See `README-BATCH-GENERATOR.md` for:
- Complete option reference
- Advanced usage examples
- Performance tuning
- Integration details
- API reference

---

## Safety Notes

✅ **This script is completely safe to run alongside your existing application:**

- Does NOT modify any existing services
- Does NOT affect the main web application
- Does NOT touch Shopify theme files
- Does NOT modify authentication or sessions
- Writes to isolated `batch/` directory only

The script **only reads** from existing services (GPXTCXParser, MapService) and **only writes** to a separate output directory.

---

## Quick Reference

| What You Want | Command |
|---------------|---------|
| All combinations | `--gpx route.gpx` |
| Faster generation | `--parallel 2` |
| Specific themes | `--themes classic,minimal` |
| Specific colors | `--colors grey,dark` |
| A3 size | `--format A3` |
| Landscape | `--orientation landscape` |
| Lower quality (faster) | `--dpi 150` |
| Custom output | `--output-dir /path/to/output` |

---

**Ready to generate? Start with the sample:**

```bash
node scripts/batch-gpx-generator.js --gpx scripts/sample-route.gpx
```
