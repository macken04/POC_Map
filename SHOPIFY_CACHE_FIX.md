# Shopify CSS Cache Fix - Troubleshooting Guide

## Issue
Changes to `homepage-hero.css` are not appearing after pushing to Shopify.

## Root Causes
1. **Shopify Asset Caching** - CSS files are heavily cached by Shopify's CDN
2. **Browser Cache** - Your browser is serving cached CSS
3. **File Not Uploaded** - Files weren't actually pushed to Shopify
4. **Theme Not Published** - Theme needs to be republished after changes

## Solutions (Try in Order)

### Solution 1: Hard Refresh Browser
**Quick Fix:**
- **Mac**: `Cmd + Shift + R` or `Cmd + Option + R`
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Or**: Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### Solution 2: Verify Files Were Uploaded to Shopify

#### If using Shopify CLI:
```bash
# Check if files are tracked
cd shopify-theme/dawn
shopify theme push

# Or force push all files
shopify theme push --only assets/sections
```

#### If using Git + Shopify Theme Kit:
```bash
# Make sure files are committed first
git add shopify-theme/dawn/assets/homepage-hero.css
git add shopify-theme/dawn/sections/hero-map-printing.liquid
git commit -m "Update hero section spacing and styling"

# Then sync to Shopify
theme deploy --only assets/sections
```

#### If uploading manually:
1. Go to Shopify Admin → Online Store → Themes
2. Click "..." next to your theme → "Edit code"
3. Navigate to `assets/homepage-hero.css`
4. Verify the file has the updated content (check for `gap: 1.5rem` and `min-height: 400px`)
5. Navigate to `sections/hero-map-printing.liquid`
6. Verify the padding defaults are `56` instead of `80`

### Solution 3: Clear Shopify Theme Cache

#### Method A: Via Shopify Admin
1. Go to Shopify Admin → Online Store → Themes
2. Click "..." next to your theme → "Edit code"
3. Open any file
4. Make a small change (add a space) and save
5. This forces Shopify to regenerate assets

#### Method B: Via Theme Settings
1. Go to Shopify Admin → Online Store → Themes
2. Click "Customize" on your theme
3. Make any small change (even just re-saving a section)
4. Click "Save"
5. This forces asset regeneration

### Solution 4: Add Cache-Busting Version

If the above doesn't work, we can add a version parameter. However, Shopify's `asset_url` filter already includes automatic versioning based on file modification time.

**To force a version bump:**
1. Make a tiny change to the CSS file (add a comment)
2. Save and push to Shopify
3. This changes the file hash and forces a cache refresh

### Solution 5: Verify in Browser DevTools

1. Open your site in browser
2. Open DevTools (F12)
3. Go to Network tab
4. Refresh the page (Cmd+R / Ctrl+R)
5. Filter by "CSS"
6. Find `homepage-hero.css` in the list
7. Click on it to see:
   - **Status**: Should be 200 OK (not 304 Not Modified)
   - **Response**: Should show the updated CSS content
   - **Headers**: Check "Cache-Control" - should allow revalidation

### Solution 6: Check Section is Active on Page

1. Go to Shopify Admin → Online Store → Themes
2. Click "Customize"
3. Verify the "Hero - Map Printing" section is:
   - Added to your homepage
   - Not hidden or disabled
   - Using the correct settings

### Solution 7: Nuclear Option - Force Asset Regeneration

If nothing else works:

1. **Rename the CSS file temporarily:**
   - Rename `homepage-hero.css` to `homepage-hero-v2.css`
   - Update the reference in `hero-map-printing.liquid`
   - Push to Shopify
   - This forces a completely new asset URL

2. **Or add a version query parameter:**
   ```liquid
   {{ 'homepage-hero.css' | asset_url | stylesheet_tag }}
   ```
   Change to:
   ```liquid
   <link rel="stylesheet" href="{{ 'homepage-hero.css' | asset_url }}?v=2" type="text/css" media="all">
   ```

## Verification Checklist

After applying fixes, verify:

- [ ] File `shopify-theme/dawn/assets/homepage-hero.css` shows updated spacing (check for `gap: 1.5rem`)
- [ ] File `shopify-theme/dawn/sections/hero-map-printing.liquid` shows `"default": 56` for padding
- [ ] Changes are committed to git (if using version control)
- [ ] Files are pushed/uploaded to Shopify
- [ ] Browser cache is cleared (hard refresh)
- [ ] DevTools Network tab shows fresh CSS file (200 status, not 304)
- [ ] Page actually displays with tighter spacing

## Expected Results After Fix

You should see:
- ✅ Tighter spacing between hero elements (40-60% reduction)
- ✅ Smaller gaps between content columns
- ✅ Reduced padding on the hero section
- ✅ No border-top on social proof section
- ✅ Smooth fade-in animations on page load
- ✅ Better mobile spacing

## Still Not Working?

If none of the above work:

1. **Check file permissions** - Ensure files aren't read-only
2. **Check Shopify theme status** - Make sure you're editing the correct theme (not a duplicate)
3. **Contact Shopify Support** - There might be an issue with asset CDN
4. **Try in Incognito/Private mode** - This eliminates browser cache entirely

## Quick Debug Command

To check what version of the CSS file is being served:

```javascript
// Run in browser console on your site:
fetch('/assets/homepage-hero.css')
  .then(r => r.text())
  .then(text => {
    if (text.includes('gap: 1.5rem')) {
      console.log('✅ Updated CSS is being served');
    } else {
      console.log('❌ Old CSS is being served - cache issue');
    }
    console.log('First 500 chars:', text.substring(0, 500));
  });
```

