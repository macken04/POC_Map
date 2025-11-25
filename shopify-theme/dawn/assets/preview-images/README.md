# Map Theme Preview Images

This directory contains preview thumbnails for all map themes shown in the customization UI.

## Generation

Preview images are generated using the Puppeteer script:

```bash
cd backend
node scripts/generate-theme-previews.js
```

## Format

- **WebP**: Primary format (8-12KB per image, ~80% quality)
- **PNG**: Fallback format for older browsers (15-20KB per image)
- **Dimensions**: 220×220px @1x display
- **Source Resolution**: 440×440px @2x for crisp display

## Files

Each theme-color combination has two files:
- `{theme}-{color}.webp` - Modern browsers
- `{theme}-{color}.png` - Fallback

Example:
- `classic-dark.webp` / `classic-dark.png`
- `minimal-pink.webp` / `minimal-pink.png`
- `bubble-bubble.webp` / `bubble-bubble.png`

## Total Size

Approximately 228KB for all 19 preview images (both formats).

## Troubleshooting

If preview generation fails with Puppeteer:

1. **Try with Docker** (more reliable):
   ```bash
   docker run -v $(pwd):/app -w /app node:18 node backend/scripts/generate-theme-previews.js
   ```

2. **Alternative: Use Mapbox Static API** (requires manual work):
   - Create 220×220px screenshots using Mapbox Static API
   - Save as WebP and PNG in this directory
   - Follow naming convention: `{theme}-{color}.webp/png`

3. **Fallback**: UI will show gradient + icon if images aren't found
   - The UI gracefully falls back to gradients
   - Users will still see a visual representation
   - Images can be added later without code changes

## Note

Preview images use a sample London cycling route for consistency across all styles.
