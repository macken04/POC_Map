# Sportive Prints Setup Guide

Complete setup guide for creating and managing preconfigured cycling event map products in your Shopify store.

## Table of Contents
1. [Metafield Definitions](#metafield-definitions)
2. [Collection Setup](#collection-setup)
3. [Product Creation Workflow](#product-creation-workflow)
4. [Variant Structure](#variant-structure)
5. [Image Requirements](#image-requirements)
6. [Page Setup](#page-setup)
7. [Testing Checklist](#testing-checklist)

---

## 1. Metafield Definitions

### Step 1: Create Custom Metafield Definitions

Navigate to: **Shopify Admin > Settings > Custom data > Products > Add definition**

Create the following metafield definitions:

#### event.name
- **Namespace and key**: `event.name`
- **Name**: Event Name
- **Description**: Full name of the cycling event (e.g., "Tour de France Stage 12")
- **Type**: Single line text
- **Validations**: None

#### event.year
- **Namespace and key**: `event.year`
- **Name**: Event Year
- **Description**: Year the event took place
- **Type**: Integer
- **Validations**: Min: 1900, Max: 2100

#### event.distance_km
- **Namespace and key**: `event.distance_km`
- **Name**: Distance (km)
- **Description**: Total distance of the route in kilometers
- **Type**: Decimal
- **Validations**: Min: 0

#### event.elevation_m
- **Namespace and key**: `event.elevation_m`
- **Name**: Elevation Gain (m)
- **Description**: Total elevation gain in meters
- **Type**: Integer
- **Validations**: Min: 0

#### event.location
- **Namespace and key**: `event.location`
- **Name**: Location
- **Description**: Primary location/region (e.g., "French Alps", "Lake District")
- **Type**: Single line text

#### event.country
- **Namespace and key**: `event.country`
- **Name**: Country
- **Description**: Country where event takes place
- **Type**: Single line text

#### event.category
- **Namespace and key**: `event.category`
- **Name**: Event Category
- **Description**: Category classification
- **Type**: Single line text
- **Validations**: One of: "European Classics", "Sportive Events", "Iconic Climbs", "Global & Epic Challenges"

#### event.description
- **Namespace and key**: `event.description`
- **Name**: Event Description
- **Description**: Brief description of the event (1-2 sentences)
- **Type**: Multi-line text

#### event.route_highlights
- **Namespace and key**: `event.route_highlights`
- **Name**: Route Highlights
- **Description**: Key features and highlights of the route
- **Type**: Multi-line text

---

## 2. Collection Setup

### Step 1: Create Main Collection

Navigate to: **Products > Collections > Create collection**

**Main Collection:**
- **Title**: Sportive Prints
- **Handle**: sportive-prints
- **Description**: Celebrate the world's most legendary cycling routes with our professionally designed map prints. From iconic climbs to epic sportives, each print captures the essence of these unforgettable rides.
- **Collection type**: Manual (you'll add products manually)
- **Image**: Upload a hero image for the collection

### Step 2: Create Category Subcollections

Create four subcollections:

**1. European Classics**
- **Title**: European Classics
- **Handle**: european-classics
- **Description**: From Fred Whitton to Dragon Ride, explore Britain's most challenging and iconic sportive events.
- **Collection type**: Manual

**2. Sportive Events**
- **Title**: Sportive Events
- **Handle**: sportive-events
- **Description**: Ride the routes of Paris-Roubaix, Tour of Flanders, and other legendary professional races.
- **Collection type**: Manual

**3. Iconic Climbs**
- **Title**: Iconic Climbs
- **Handle**: iconic-climbs
- **Description**: Conquer Alpe d'Huez, Mont Ventoux, and the world's most famous mountain climbs on your wall.
- **Collection type**: Manual

**4. Global & Epic Challenges**
- **Title**: Global & Epic Challenges
- **Handle**: global-challenges
- **Description**: From Unbound Gravel to Cape Town Double Century, the world's toughest endurance events.
- **Collection type**: Manual

---

## 3. Product Creation Workflow

### Template Product Structure

For each event, create a product with the following structure:

#### Basic Information

**Title Format**: `[Event Name] Cycling Map Print`
- Example: "Fred Whitton Challenge Cycling Map Print"
- Example: "Alpe d'Huez Cycling Map Print"

**Handle**: `map-[event-slug]`
- Example: `map-fred-whitton-challenge`
- Example: `map-alpe-dhuez`

**Description Template**:
```
Celebrate [Event Name] with this beautifully designed cycling route map.

[Event description from metafield]

Available in three sizes and multiple styles, each print is professionally produced on museum-grade archival paper with fade-resistant inks.

Perfect for:
• Commemorating your personal achievement
• Inspiring your next cycling challenge
• Decorating your home, office, or pain cave
• Gifting to fellow cycling enthusiasts

Each map features the complete route with elevation profile, key statistics, and professional cartographic design.
```

**Product Type**: Map Print
**Vendor**: Your Store Name

#### Collections
Add product to:
1. Main "Sportive Prints" collection
2. Appropriate category subcollection (European Classics, Sportive Events, etc.)

#### Tags
Add relevant tags:
- Event name (e.g., "fred-whitton")
- Country (e.g., "england", "france")
- Category (e.g., "european-classics")
- Optional: "featured", "popular", "new"

---

## 4. Variant Structure

### Variant Configuration

Each product should have **18 variants** following this structure:

**Format**: `[Size] / [Style] / [Orientation]`

#### Sizes (3 options):
- **A4** - 210 × 297 mm (8.3 × 11.7 in)
- **A3** - 297 × 420 mm (11.7 × 16.5 in)
- **A2** - 420 × 594 mm (16.5 × 23.4 in)

#### Styles (3 options):
- **Classic Blue** - Traditional blue route on cream background
- **Minimal Grey** - Monochromatic grey tones
- **Vintage Brown** - Sepia/vintage aesthetic

#### Orientations (2 options):
- **Portrait** - Vertical orientation
- **Landscape** - Horizontal orientation

### Variant List (18 total):

```
1.  A4 / Classic Blue / Portrait - £35.00
2.  A4 / Classic Blue / Landscape - £35.00
3.  A4 / Minimal Grey / Portrait - £35.00
4.  A4 / Minimal Grey / Landscape - £35.00
5.  A4 / Vintage Brown / Portrait - £35.00
6.  A4 / Vintage Brown / Landscape - £35.00
7.  A3 / Classic Blue / Portrait - £55.00
8.  A3 / Classic Blue / Landscape - £55.00
9.  A3 / Minimal Grey / Portrait - £55.00
10. A3 / Minimal Grey / Landscape - £55.00
11. A3 / Vintage Brown / Portrait - £55.00
12. A3 / Vintage Brown / Landscape - £55.00
13. A2 / Classic Blue / Portrait - £75.00
14. A2 / Classic Blue / Landscape - £75.00
15. A2 / Minimal Grey / Portrait - £75.00
16. A2 / Minimal Grey / Landscape - £75.00
17. A2 / Vintage Brown / Portrait - £75.00
18. A2 / Vintage Brown / Landscape - £75.00
```

### Pricing Structure

- **A4**: £35.00
- **A3**: £55.00
- **A2**: £75.00

*(Same price regardless of style or orientation)*

### Creating Variants in Shopify

**Option 1: Manual Creation**
1. Go to product > Variants section
2. Add 3 variant options: Size, Style, Orientation
3. Shopify will auto-generate all 18 combinations
4. Set prices for each size tier

**Option 2: Bulk Import**
Create CSV with all variants and import:
```csv
Handle,Title,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant Price
map-event-name,Event Name Print,Size,A4,Style,Classic Blue,Orientation,Portrait,35.00
map-event-name,Event Name Print,Size,A4,Style,Classic Blue,Orientation,Landscape,35.00
...
```

---

## 5. Image Requirements

### Image Specifications

Each product needs **6 images** (one for each style × orientation combination):

**Image Dimensions:**
- **Portrait**: 2480 × 3508 pixels (A4 ratio at 300 DPI)
- **Landscape**: 3508 × 2480 pixels (rotated)

**File Format**: JPG or PNG
**File Size**: Optimized to < 500 KB per image
**Color Mode**: RGB
**Resolution**: 72-150 PPI for web display

### Image Naming Convention

```
[event-slug]-[style]-[orientation].jpg

Examples:
fred-whitton-classic-blue-portrait.jpg
fred-whitton-classic-blue-landscape.jpg
fred-whitton-minimal-grey-portrait.jpg
fred-whitton-minimal-grey-landscape.jpg
fred-whitton-vintage-brown-portrait.jpg
fred-whitton-vintage-brown-landscape.jpg
```

### Image Alt Text Template

```
[Event Name] cycling route map - [Style] style in [Orientation] orientation
```

Examples:
- "Fred Whitton Challenge cycling route map - Classic Blue style in Portrait orientation"
- "Alpe d'Huez cycling route map - Minimal Grey style in Landscape orientation"

### Placeholder Images (Temporary)

Until real images are ready, use placeholder images with:
- Event name text overlay
- "Coming Soon - Route Map Preview" watermark
- Approximate route visualization (if available)
- Correct aspect ratio (portrait/landscape)

**Placeholder Generation:**
Use Canva, Figma, or design tool:
1. Create artboard at correct dimensions
2. Add background color (blue/grey/brown based on style)
3. Add event name as title
4. Add "Preview - Final Design Coming Soon" text
5. Export at web resolution

---

## 6. Page Setup

### Step 1: Create Sportive Prints Page

Navigate to: **Online Store > Pages > Add page**

- **Title**: Sportive Prints
- **Handle**: sportive-prints
- **Template**: page.sportive-prints
- **Content**: Leave blank or add introductory text

### Step 2: Configure Sportive Grid Section

In the Theme Editor:
1. Navigate to the Sportive Prints page
2. Find "Sportive Prints Grid" section
3. Configure settings:
   - **Title**: "All Sportive Prints" (or leave blank)
   - **Collection**: Select "Sportive Prints"
   - **Products to show**: 24

### Step 3: Add to Navigation

Navigate to: **Online Store > Navigation**

Add to main menu:
- **Menu item**: Sportive Prints
- **Link**: /pages/sportive-prints

Optional: Create submenu with categories:
```
Sportive Prints
├─ All Prints (/pages/sportive-prints)
├─ European Classics (/collections/european-classics)
├─ Sportive Events (/collections/sportive-events)
├─ Iconic Climbs (/collections/iconic-climbs)
└─ Global Challenges (/collections/global-challenges)
```

### Step 4: Assign Product Template

For each sportive print product:
1. Go to product page in Shopify Admin
2. In Theme Templates section (right sidebar)
3. Select **product.sportive-print** template
4. Save

---

## 7. Testing Checklist

### Product Page Testing

- [ ] Product title displays correctly
- [ ] Event category badge shows
- [ ] Event stats cards display (distance, elevation, location, country, year)
- [ ] All 18 variants are available
- [ ] Price updates when changing size
- [ ] Product images switch when selecting different styles
- [ ] Portrait/Landscape images display correctly
- [ ] Add to cart works with all variant combinations
- [ ] Event details collapsible tab shows metafield data
- [ ] Print specifications tab displays
- [ ] Shipping & delivery tab displays
- [ ] Related products section shows other maps
- [ ] Mobile responsive layout works

### Collection Page Testing

- [ ] Sportive Prints page loads with correct template
- [ ] Product grid displays properly (4 columns on desktop)
- [ ] Product cards show image, title, and price
- [ ] Hover effects work on product cards
- [ ] Category sections display
- [ ] Category links navigate to subcollections
- [ ] Mobile responsive (2 columns on mobile)
- [ ] Pagination works if more than 24 products

### Navigation Testing

- [ ] Sportive Prints menu item appears
- [ ] Link navigates to correct page
- [ ] Submenu (if created) displays correctly
- [ ] Breadcrumbs work correctly
- [ ] Back navigation functions properly

### Checkout Testing

- [ ] Product can be added to cart
- [ ] Cart displays correct variant selection
- [ ] Price is accurate in cart
- [ ] Checkout completes successfully
- [ ] Order confirmation shows correct product details

### Performance Testing

- [ ] Page load time < 3 seconds
- [ ] Images load progressively
- [ ] No console errors
- [ ] Mobile performance acceptable
- [ ] Images are optimized (< 500 KB each)

---

## Pilot Products (First 5 to Create)

### 1. Fred Whitton Challenge
**Metafields:**
- Name: Fred Whitton Challenge
- Year: 2024
- Distance: 180 km
- Elevation: 3,211 m
- Location: Lake District
- Country: England
- Category: European Classics
- Description: The UK's toughest sportive, tackling all of the Lake District's major passes in one brutal 180km circuit.

### 2. Alpe d'Huez
**Metafields:**
- Name: Alpe d'Huez
- Year: 2024
- Distance: 13.8 km
- Elevation: 1,071 m
- Location: French Alps
- Country: France
- Category: Iconic Climbs
- Description: The most iconic climb in cycling, featuring 21 legendary hairpin bends and average gradients of 8.1%.

### 3. Paris-Roubaix
**Metafields:**
- Name: Paris-Roubaix
- Year: 2024
- Distance: 257 km
- Elevation: 550 m
- Location: Northern France
- Country: France
- Category: Sportive Events
- Description: The Hell of the North, featuring 29 brutal cobbled sectors across 55km of bone-shaking pavé.

### 4. Cape Town Cycle Tour
**Metafields:**
- Name: Cape Town Cycle Tour
- Year: 2024
- Distance: 109 km
- Elevation: 871 m
- Location: Cape Town
- Country: South Africa
- Category: Global & Epic Challenges
- Description: The world's largest individually timed cycling event, circumnavigating the Cape Peninsula with stunning ocean views.

### 5. L'Etape du Tour
**Metafields:**
- Name: L'Etape du Tour
- Year: 2024
- Distance: 165 km
- Elevation: 3,650 m
- Location: French Alps
- Country: France
- Category: Sportive Events
- Description: Ride a stage of the Tour de France, tackling the same mountains as the pros including legendary climbs.

---

## CSV Template for Bulk Product Creation

```csv
Handle,Title,Body (HTML),Vendor,Product Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant Price,Variant SKU,Image Src,Image Position,Image Alt Text,Gift Card,Template Suffix
map-fred-whitton,Fred Whitton Challenge Cycling Map Print,"Celebrate Fred Whitton Challenge with this beautifully designed cycling route map...",Print My Ride,Map Print,"fred-whitton,england,european-classics,featured",TRUE,Size,A4,Style,Classic Blue,Orientation,Portrait,35.00,FW-A4-CB-P,https://cdn.shopify.com/.../fred-whitton-classic-blue-portrait.jpg,1,Fred Whitton Challenge cycling route map - Classic Blue style in Portrait orientation,FALSE,sportive-print
```

---

## Support & Troubleshooting

### Common Issues

**Q: Metafields not displaying on product page**
- Ensure metafield definitions are created correctly
- Check namespace and key match exactly: `event.name`, `event.year`, etc.
- Verify metafield values are populated for the product

**Q: Product template not applying**
- Check template is assigned in product settings (right sidebar)
- Template file must be named `product.sportive-print.json`
- Clear theme cache and refresh

**Q: Variants not showing all combinations**
- Ensure all 3 options are configured: Size, Style, Orientation
- Check variant limits (Shopify max: 100 variants per product)
- Verify variant generation completed

**Q: Images not switching with variant selection**
- Check image alt text includes style and orientation keywords
- Ensure JavaScript file is loaded: `sportive-variant-selector.js`
- Verify CSS file is loaded: `sportive-prints-product.css`

**Q: Collection page not displaying products**
- Confirm products are added to collection
- Check collection is selected in section settings
- Verify products are published and available

---

## Next Steps After Setup

1. **Create remaining products** from the event list (50+ events)
2. **Generate actual map images** using the map export system
3. **Replace placeholder images** with final designs
4. **Optimize SEO** - product descriptions, meta titles, meta descriptions
5. **Set up email marketing** - new product announcements
6. **Create blog content** - event guides, route highlights
7. **Add customer reviews** section for social proof
8. **Configure shipping rates** for print products
9. **Set up analytics** tracking for product performance
10. **Launch marketing campaigns** to promote collection

---

## File Reference

**Templates:**
- `/shopify-theme/dawn/templates/page.sportive-prints.json`
- `/shopify-theme/dawn/templates/product.sportive-print.json`

**Sections:**
- `/shopify-theme/dawn/sections/sportive-prints-grid.liquid`
- `/shopify-theme/dawn/sections/sportive-event-stats.liquid`

**Assets:**
- `/shopify-theme/dawn/assets/sportive-prints-product.css`
- `/shopify-theme/dawn/assets/sportive-variant-selector.js`

**Documentation:**
- `/SPORTIVE_PRINTS_SETUP_GUIDE.md` (this file)

---

**Last Updated**: 2024
**Version**: 1.0
