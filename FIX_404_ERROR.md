# Fix 404 Error - CSS File Not Found

## Issue
The CSS file `homepage-hero.css` is returning a 404 error, meaning it's not accessible on Shopify.

## Root Cause
The file may not have been uploaded correctly, or Shopify is serving it with a different URL.

## Solution Steps

### Step 1: Verify File Exists on Shopify

**Via Shopify Admin:**
1. Go to: Shopify Admin → Online Store → Themes
2. Click "..." next to Dawn theme → **"Edit code"**
3. Navigate to: **`assets`** folder in the left sidebar
4. **Look for:** `homepage-hero.css` in the list
5. **If you see it:** Click on it to verify the content (check for no border-top)
6. **If you DON'T see it:** The file wasn't uploaded → Go to Step 2

### Step 2: Push File Again (Force Upload)

**If file is missing or wrong:**

```bash
cd /Users/davedev/Desktop/dev/map/working/map_site_vibe/shopify-theme/dawn
shopify theme push --only assets/homepage-hero.css --force
```

**Or push all assets:**
```bash
shopify theme push --only assets/
```

### Step 3: Check Actual CSS URL Being Used

**On your live site, run this in browser console:**

```javascript
// Find all stylesheet links
const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
const heroCSS = stylesheets.find(link => 
  link.href.includes('homepage-hero') || 
  link.href.includes('hero')
);

if (heroCSS) {
  console.log('✅ Hero CSS found at:', heroCSS.href);
  // Try to fetch from that exact URL
  fetch(heroCSS.href)
    .then(r => {
      console.log('Status:', r.status);
      if (r.ok) {
        return r.text();
      } else {
        throw new Error('CSS file returned ' + r.status);
      }
    })
    .then(text => {
      console.log('✅ CSS loaded successfully');
      console.log('Has border-top:', text.includes('border-top: 1px solid #e0e0e0'));
      console.log('Has new spacing:', text.includes('gap: 1.5rem'));
    })
    .catch(err => console.error('❌ Error loading CSS:', err));
} else {
  console.log('❌ Hero CSS link not found in page');
  console.log('All stylesheets:', stylesheets.map(s => s.href));
}
```

### Step 4: Manual Upload via Shopify Admin

**If CLI push doesn't work:**

1. Go to: Shopify Admin → Online Store → Themes
2. Click "..." → **"Edit code"**
3. Navigate to: **`assets`** folder
4. Click **"Add a new asset"** (or upload if file exists)
5. Name it: `homepage-hero.css`
6. **Copy ENTIRE content** from: `shopify-theme/dawn/assets/homepage-hero.css`
7. Paste into Shopify editor
8. Click **"Save"**
9. Verify: Click on the file again to confirm it saved correctly

### Step 5: Verify Section References CSS Correctly

**Check the section file:**
1. Go to: Shopify Admin → Themes → Edit code
2. Navigate to: **`sections`** folder
3. Open: `hero-map-printing.liquid`
4. **Line 1 should be:**
   ```liquid
   {{ 'homepage-hero.css' | asset_url | stylesheet_tag }}
   ```
5. **If different:** Update it to match above
6. Click **"Save"**

### Step 6: Check Network Tab

**On your live site:**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by **"CSS"**
4. Refresh page
5. Look for `homepage-hero.css` in the list
6. **Click on it** to see:
   - Status code (should be 200, not 404)
   - Request URL (what Shopify is actually using)
   - Response (the actual CSS content)

**If you see it with 404:**
- The file name might be wrong
- The file might not exist on Shopify
- The path might be incorrect

**If you DON'T see it at all:**
- The CSS might not be loading
- Check if the section is actually on the page
- Check if there are JavaScript errors

### Step 7: Alternative - Check Actual Asset URL

**Shopify sometimes uses versioned URLs. Check what's actually being used:**

```javascript
// Get the actual stylesheet link
const link = document.querySelector('link[href*="homepage-hero"]');
if (link) {
  console.log('CSS URL:', link.href);
  console.log('Try accessing:', link.href);
} else {
  console.log('❌ No hero CSS link found');
  
  // Check all CSS files
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    console.log('CSS file:', link.href);
  });
}
```

## Common Issues

### Issue 1: File Name Case Sensitivity
- Check if file is named exactly: `homepage-hero.css` (lowercase, with hyphens)
- Shopify is case-sensitive

### Issue 2: File Not in Assets Folder
- File must be in `assets/` folder, not `sections/` or root

### Issue 3: Cached Broken Link
- Even after fixing, browser might cache the 404
- Clear cache and hard refresh

### Issue 4: Different Theme
- Make sure you're viewing the correct theme
- Check which theme is live/published

## Quick Test

**After fixing, verify:**
1. Go to your site
2. Right-click → View Page Source
3. Search for `homepage-hero.css`
4. You should see a link like:
   ```html
   <link rel="stylesheet" href="https://cdn.shopify.com/s/files/1/.../homepage-hero.css?...">
   ```
5. Click that link - should load the CSS file
6. Check for `border-top` in the content - should NOT be there

## Next Steps

1. **First:** Verify file exists in Shopify Admin
2. **Then:** Check Network tab to see actual URL being used
3. **Finally:** Use that URL to verify CSS content is correct

