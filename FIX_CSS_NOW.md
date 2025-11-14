# URGENT: Fix CSS Not Updating

## Problem Confirmed
The UI shows the OLD CSS is being served (border-top visible above social proof section).

## Quick Fix Steps (Do These Now)

### 1. Verify Files Were Uploaded to Shopify

**Check via Shopify Admin:**
1. Go to: Shopify Admin → Online Store → Themes
2. Click "..." next to your theme → **"Edit code"**
3. Navigate to: `assets/homepage-hero.css`
4. **Scroll to line ~217** (look for "Social Proof Section" comment)
5. **Check if you see:**
   ```css
   .hero-social-proof {
     display: flex;
     flex-direction: column;
     align-items: center;
     gap: 0.75rem;
     margin-top: 1rem;
     /* NO border-top line should be here */
   }
   ```

**If you see `border-top: 1px solid #e0e0e0;` → File wasn't uploaded!**

### 2. Upload Files NOW (Choose Your Method)

#### Option A: Using Shopify CLI (Recommended)
```bash
cd /Users/davedev/Desktop/dev/map/working/map_site_vibe/shopify-theme/dawn
shopify theme push --only assets/homepage-hero.css sections/hero-map-printing.liquid
```

#### Option B: Manual Upload via Admin
1. Shopify Admin → Themes → Edit code
2. Open `assets/homepage-hero.css`
3. **DELETE ALL** existing content
4. **COPY ENTIRE** content from: `shopify-theme/dawn/assets/homepage-hero.css`
5. **PASTE** and click **"Save"**
6. Open `sections/hero-map-printing.liquid`
7. **DELETE ALL** existing content  
8. **COPY ENTIRE** content from: `shopify-theme/dawn/sections/hero-map-printing.liquid`
9. **PASTE** and click **"Save"**

### 3. Force Clear All Caches

**Browser:**
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Or: Open DevTools (F12) → Right-click refresh → "Empty Cache and Hard Reload"

**Shopify:**
1. Go to Shopify Admin → Themes → **"Customize"**
2. Make ANY tiny change (open any section, click save)
3. This forces Shopify to regenerate assets

### 4. Verify Changes Are Live

**After 2-3 minutes, check:**
1. Refresh your site
2. The border-top line above "Loved by 12,000+ cyclists" should be **GONE**
3. Spacing should be **tighter** (less white space)
4. Page should have a **smooth fade-in** animation

**Quick Test in Browser Console:**
```javascript
fetch('/assets/homepage-hero.css')
  .then(r => r.text())
  .then(text => {
    if (text.includes('border-top: 1px solid #e0e0e0')) {
      alert('❌ OLD CSS STILL BEING SERVED - File not uploaded correctly!');
    } else if (text.includes('gap: 1.5rem') && text.includes('margin-top: 1rem')) {
      alert('✅ NEW CSS IS LIVE - Hard refresh your browser!');
    } else {
      alert('⚠️ Unknown CSS version - Check file manually');
    }
  });
```

## What Should Be Different

**BEFORE (What you see now):**
- ❌ Border-top line above social proof
- ❌ Too much white space between elements
- ❌ Large gaps between columns
- ❌ No animations

**AFTER (What you should see):**
- ✅ NO border-top line
- ✅ Tighter, more compact spacing
- ✅ Smaller gaps (1.5rem instead of 3rem)
- ✅ Smooth fade-in animation on load

## Still Not Working?

1. **Wait 5 minutes** - Shopify CDN can take time
2. **Try incognito window** - Eliminates browser cache
3. **Check file timestamps** - CSS file should show recent modification
4. **Verify correct theme** - Make sure you're viewing the right theme (not a duplicate)

