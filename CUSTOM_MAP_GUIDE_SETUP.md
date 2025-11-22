# Custom Map Guide Page - Setup Instructions

## Overview

A comprehensive "How to Build Your Custom Map" guide page has been created for your Shopify store. This page provides step-by-step instructions for customers on how to create their custom map prints from Strava activities.

## What's Included

### 1. **Guide Section** (`custom-map-guide.liquid`)
Located in: `shopify-theme/dawn/sections/custom-map-guide.liquid`

Features:
- **Hero Section** with eyebrow text, heading, and description
- **Interactive Process Steps Preview** showing 4 main steps (Connect, Select, Customize, Print)
- **Detailed Step-by-Step Guide** with:
  - Step 1: Connect Your Strava Account
  - Step 2: Select Your Favorite Activity
  - Step 3: Customize Your Map Design (updated with 4-tab interface details)
  - Step 4: Choose Format & Place Order
- **Map Styles Showcase** featuring 8 pre-designed styles
- **Customization Options Grid** showcasing all available customization features
- **Call-to-Action Section** with trust badges

### 2. **Page Template** (`page.custom-map-guide.json`)
Located in: `shopify-theme/dawn/templates/page.custom-map-guide.json`

Includes:
- Main guide section with all content configured
- Map examples gallery section
- FAQ section with 8 common questions
- Fully customizable via Shopify theme editor

### 3. **Styling** (`custom-map-guide.css`)
Located in: `shopify-theme/dawn/assets/custom-map-guide.css`

Professional styling with:
- Gradient backgrounds
- Smooth animations
- Responsive design for all devices
- Accessibility features
- Interactive hover effects

## Recent Updates

### Enhanced Content (Current Session)

1. **Updated Step 3 Description**
   - Now accurately reflects the 4-tab customization interface (Style, Colors, Text, Size)
   - Added details about each tab's functionality
   - Included route line width customization (1-10px)

2. **Added Route Line Styling Option**
   - New customization option block for route line styling
   - Details about line thickness slider
   - Route color palette options (Red, Black, White, Blue)

3. **Improved Feature Lists**
   - More specific details about actual functionality
   - Better alignment with the real map customization interface

## How to Set Up the Page in Shopify Admin

### Option 1: Create New Page (If doesn't exist)

1. **Login to Shopify Admin**
   - Go to: https://print-my-ride-version-5.myshopify.com/admin

2. **Navigate to Pages**
   - In the admin sidebar, go to: **Online Store > Pages**

3. **Create New Page**
   - Click **Add page** button
   - **Title**: "How to Build Your Custom Map" (or your preferred title)
   - **Content**: Leave blank (template will provide content)

4. **Assign Template**
   - In the right sidebar, under **Theme template**
   - Select: `page.custom-map-guide`

5. **Configure SEO (Optional)**
   - Click **Edit website SEO** at the bottom
   - **Page title**: "How to Build Your Custom Map | Print My Ride"
   - **Description**: "Learn how to create custom map prints from your Strava activities in 4 simple steps. Transform your cycling adventures into museum-quality wall art."
   - **URL handle**: `how-to-build-custom-map` or `custom-map-guide`

6. **Save**
   - Click **Save** in the top right

### Option 2: Update Existing Page

If a page already exists:
1. Go to **Online Store > Pages**
2. Find the guide page
3. Click to edit
4. Ensure **Theme template** is set to `page.custom-map-guide`
5. Save

## Customizing Content

### Via Shopify Theme Editor

1. **Navigate to Theme Customizer**
   - **Online Store > Themes**
   - Click **Customize** on your live theme

2. **Navigate to the Guide Page**
   - Use the page selector at the top
   - Select your guide page

3. **Customize Sections**
   - Click on any section to edit
   - **Guide Hero**: Edit heading, description, eyebrow text
   - **Process Steps**: Modify step titles, descriptions, features
   - **Map Styles**: Add/edit style cards with previews
   - **Customization Options**: Edit option cards and details
   - **CTA Section**: Update buttons, links, trust badges

4. **Add/Remove Blocks**
   - Within each section, you can add more:
     - Process steps
     - Map style cards
     - Customization option cards

5. **Adjust Settings**
   - Padding (top/bottom)
   - Color schemes
   - Text alignment
   - Show/hide sections

## Content Structure

### Step Blocks
Each step includes:
- **Title**: Main step heading
- **Description**: Detailed explanation
- **Features**: Pipe-separated list (e.g., "Feature 1|Feature 2|Feature 3")
- **Image**: Optional screenshot or visual (recommended to add)

### Map Style Blocks
Each style includes:
- **Style Name**: e.g., "Classic", "Minimal"
- **Description**: What makes this style unique
- **Best For**: Use case recommendation
- **Color Scheme**: Comma-separated hex colors
- **Preview Image**: Optional (falls back to generated SVG)

### Customization Option Blocks
Each option includes:
- **Icon**: Select from predefined icons
- **Title**: Option name
- **Description**: What this option does
- **Choices**: Pipe-separated available options

## Adding Screenshots/Images

To make the guide more helpful, add actual screenshots:

1. **Take Screenshots**
   - Navigate to each step of your map customization process
   - Capture clear screenshots

2. **Upload to Shopify**
   - Go to **Settings > Files**
   - Upload your images

3. **Add to Guide**
   - In theme customizer, edit each step block
   - Click "Select image" under each step
   - Choose your uploaded screenshot

**Recommended Screenshots:**
- Step 1: Strava OAuth login screen
- Step 2: Activity selection interface
- Step 3: Map customization interface (showing the 4 tabs)
- Step 4: Print size and format selection

## Navigation & Links

### Adding to Main Menu

1. **Go to Navigation**
   - **Online Store > Navigation**

2. **Edit Main Menu**
   - Find your main menu (usually "Main menu")
   - Click **Add menu item**

3. **Configure Link**
   - **Name**: "How to Create" or "Guide"
   - **Link**: Search for your guide page
   - Position it appropriately in your menu

4. **Save**

### Adding to Footer

1. **Go to Theme Customizer**
2. **Navigate to Footer section**
3. **Add menu item** linking to your guide page

## Testing the Page

### Using Shopify Theme Dev

1. **Start Development Server**
   ```bash
   cd shopify-theme/dawn
   shopify theme dev
   ```

2. **Access the Page**
   - Open the provided URL (e.g., https://...myshopify.com?preview_theme_id=...)
   - Navigate to your guide page
   - Check: `/pages/how-to-build-custom-map` or your chosen URL handle

3. **Test Functionality**
   - ✓ All sections load correctly
   - ✓ Images display (if added)
   - ✓ Animations work smoothly
   - ✓ Responsive on mobile/tablet/desktop
   - ✓ CTA buttons link correctly
   - ✓ FAQ accordions expand/collapse

### Browser Testing

Test on:
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome Mobile
- **Tablet**: iPad, Android tablets

## Maintenance

### Updating Content

When customization features change:
1. Edit the page template JSON file directly, or
2. Use Shopify theme customizer for quick edits

### Adding New Features

When adding new customization options:
1. Add a new `customization_option` block in the template
2. Update the block_order array
3. Test in theme editor

## Integration Points

### Links to Update

Make sure these CTAs link correctly:
- **Primary CTA**: "Start Creating Now" → `/pages/strava-login`
- **Secondary CTA**: "View Gallery" → `/pages/gallery` (or your gallery page)
- **Back to Activities**: Links in step descriptions

### Cross-Promotion

Consider adding links to this guide from:
- **Homepage**: "Learn How It Works" button
- **Product Pages**: "How to Create" tab
- **Strava Login Page**: "Not sure how? Read our guide"
- **Email Campaigns**: Link to guide for new customers

## Analytics

### Track Page Performance

Consider adding:
1. **Google Analytics Events**
   - Track CTA button clicks
   - Monitor scroll depth
   - Measure time on page

2. **Shopify Analytics**
   - Monitor page views
   - Track conversion from guide → login

## File Locations Reference

```
shopify-theme/dawn/
├── sections/
│   ├── custom-map-guide.liquid          # Main section file
│   ├── map-examples-gallery.liquid      # Gallery section (if used)
│   └── collapsible-content.liquid       # FAQ section
├── assets/
│   └── custom-map-guide.css             # Styling
├── templates/
│   └── page.custom-map-guide.json       # Page template
```

## Support & Troubleshooting

### Common Issues

**Page doesn't show content:**
- Ensure template is assigned to the page
- Check that blocks are in the correct order
- Verify section files exist

**Images don't load:**
- Check image URLs in theme editor
- Ensure images are uploaded to Shopify Files
- Verify image picker selections

**Styling looks wrong:**
- Clear browser cache
- Check CSS file is loading
- Inspect for CSS conflicts

**CTA buttons don't work:**
- Verify link URLs in settings
- Check that target pages exist
- Test in different browsers

## Next Steps

1. ✅ **Create the page in Shopify admin** (if not exists)
2. ✅ **Add screenshots** to each step for better visual guidance
3. ✅ **Test the page** using `shopify theme dev`
4. ✅ **Add to navigation** menu
5. ✅ **Promote the guide** on homepage and product pages
6. ✅ **Monitor analytics** to see customer engagement

---

**Need help?** Refer to the Shopify documentation or test the page locally first using the theme dev command.
