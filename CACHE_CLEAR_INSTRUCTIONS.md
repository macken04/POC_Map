# Clear Cache - Files Are Uploaded But Not Showing

## Status
✅ Files successfully pushed to Shopify
❌ Browser/CDN is serving cached CSS

## Immediate Steps (Do in Order)

### Step 1: Verify Files Were Actually Updated on Shopify

Open browser console on your site and run:
```javascript
fetch('/assets/homepage-hero.css')
  .then(r => r.text())
  .then(text => {
    const hasBorderTop = text.includes('border-top: 1px solid #e0e0e0');
    const hasNewSpacing = text.includes('gap: 1.5rem') && text.includes('min-height: 400px');
    
    console.log('=== CSS File Status ===');
    console.log('Has old border-top:', hasBorderTop);
    console.log('Has new spacing:', hasNewSpacing);
    
    if (hasBorderTop) {
      console.error('❌ OLD CSS STILL ON SHOPIFY - Files may not have synced correctly');
    } else if (hasNewSpacing) {
      console.log('✅ NEW CSS IS ON SHOPIFY - This is a browser cache issue');
      console.log('→ Do a hard refresh (Cmd+Shift+R)');
    } else {
      console.warn('⚠️ Unknown CSS version detected');
    }
    
    // Show first 1000 chars for manual verification
    console.log('\nFirst 1000 characters of CSS:');
    console.log(text.substring(0, 1000));
  });
```

### Step 2: Force Clear Browser Cache

**Method 1: Hard Refresh (Try This First)**
- **Mac**: Press `Cmd + Shift + R` (or `Cmd + Option + R`)
- **Windows**: Press `Ctrl + Shift + R` (or `Ctrl + F5`)
- Keep pressing until the border-top line disappears

**Method 2: DevTools Cache Disable**
1. Open DevTools (F12 or Right-click → Inspect)
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox at the top
4. **Keep DevTools open** while refreshing
5. Refresh page (Cmd+R / Ctrl+R)

**Method 3: Clear Cache Completely**
1. Open DevTools (F12)
2. Right-click the refresh button in browser
3. Select **"Empty Cache and Hard Reload"**

**Method 4: Incognito/Private Window**
- Open in incognito/private window (fresh cache)
- This will immediately show if cache is the issue

### Step 3: Force Shopify CDN Cache Clear

**Option A: Via Theme Customize**
1. Go to Shopify Admin → Online Store → Themes
2. Click **"Customize"** on your Dawn theme
3. Open any section (just click on it)
4. Make a tiny change (add a space in any text field)
5. Click **"Save"**
6. This forces Shopify to regenerate all assets
7. Wait 2-3 minutes, then hard refresh your site

**Option B: Via Edit Code (Force Asset Regeneration)**
1. Go to Shopify Admin → Themes → Edit code
2. Open `assets/homepage-hero.css`
3. Add a single space at the end of the file
4. Click "Save"
5. Remove the space
6. Click "Save" again
7. This changes the file hash and forces CDN refresh

### Step 4: Verify Changes Are Live

After cache clearing, check these:

**Visual Checks:**
- ✅ **NO border-top line** above "Loved by 12,000+ cyclists"
- ✅ **Tighter spacing** between hero elements
- ✅ **Smaller gaps** between content columns
- ✅ **Smooth fade-in animation** on page load
- ✅ Social proof is **closer to buttons** (1rem instead of 3rem spacing)

**Technical Checks:**
Run this in browser console:
```javascript
// Check if animations are loaded
const style = getComputedStyle(document.querySelector('.hero-content'));
console.log('Animation:', style.animation);
console.log('Expected: fadeInUp 0.6s ease-out');

// Check spacing
const wrapper = document.querySelector('.hero-content-wrapper');
const gap = getComputedStyle(wrapper).gap;
console.log('Gap:', gap);
console.log('Expected: 1.5rem (mobile) or 3rem (desktop)');
```

### Step 5: If Still Not Working

**Nuclear Option: Add Version Parameter**

If nothing works, we can force cache-busting by temporarily adding a version parameter:

1. Edit `shopify-theme/dawn/sections/hero-map-printing.liquid`
2. Change line 1 from:
   ```liquid
   {{ 'homepage-hero.css' | asset_url | stylesheet_tag }}
   ```
   To:
   ```liquid
   <link rel="stylesheet" href="{{ 'homepage-hero.css' | asset_url }}?v={{ 'now' | date: '%s' }}" type="text/css" media="all">
   ```
3. Push the file: `shopify theme push --only sections/hero-map-printing.liquid`
4. This forces a new URL every second (temporary fix)
5. **After cache clears, revert to original** (Shopify asset_url already has versioning)

## Expected Timeline

- **Browser cache clear**: Immediate (hard refresh)
- **Shopify CDN propagation**: 2-5 minutes after asset regeneration
- **Full cache clear**: Up to 15 minutes in rare cases

## What Should Change

**BEFORE (What you see now):**
- ❌ Border-top line above social proof section
- ❌ Generous spacing (3rem+ gaps)
- ❌ Large min-heights (500px+)
- ❌ No animations

**AFTER (What you should see):**
- ✅ NO border-top line
- ✅ Tighter spacing (1.5rem-3rem gaps)
- ✅ Smaller min-heights (400px-480px)
- ✅ Smooth fade-in animation
- ✅ Social proof closer to buttons

## Quick Test

The fastest way to test if cache is the issue:
1. Open an **incognito/private window**
2. Navigate to your site
3. If changes appear → It's browser cache
4. If changes DON'T appear → Shopify CDN cache (wait 5-10 minutes)

