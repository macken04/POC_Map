# Sportive Prints - Quick Start Guide

## 🚀 Get Started in 30 Minutes

Follow these steps to launch your first pilot products and test the new Sportive Prints section.

---

## Step 1: Deploy Theme Files (5 minutes)

All code is ready in your theme. Deploy to your Shopify store using the Shopify CLI:

```bash
# Navigate to theme directory
cd shopify-theme/dawn

# Start dev server to preview changes
shopify theme dev

# When ready, push to your storex 
shopify theme push --theme=183192945024  # Your development theme ID
```

**Files Deployed:**
- ✅ `templates/page.sportive-prints.json`
- ✅ `templates/product.sportive-print.json`
- ✅ `sections/sportive-event-stats.liquid`
- ✅ `assets/sportive-prints-product.css`
- ✅ `assets/sportive-variant-selector.js`
- ✅ `sections/sportive-prints-grid.liquid` (already exists)

---

## Step 2: Create Metafield Definitions (10 minutes)

**Go to**: Shopify Admin > Settings > Custom data > Products > Add definition

Create these **9 metafields** (copy-paste for speed):

### Quick Reference Table:

| Namespace.Key | Name | Type | Description |
|---------------|------|------|-------------|
| `event.name` | Event Name | Single line text | Full event name |
| `event.year` | Event Year | Integer | Year (e.g., 2024) |
| `event.distance_km` | Distance (km) | Decimal | Distance in kilometers |
| `event.elevation_m` | Elevation Gain (m) | Integer | Elevation in meters |
| `event.location` | Location | Single line text | Location/region |
| `event.country` | Country | Single line text | Country name |
| `event.category` | Event Category | Single line text | One of: European Classics, Sportive Events, Iconic Climbs, Global & Epic Challenges |
| `event.description` | Event Description | Multi-line text | Brief description |
| `event.route_highlights` | Route Highlights | Multi-line text | Key route features |

---

## Step 3: Create Collections (5 minutes)

**Go to**: Products > Collections > Create collection

Create **5 collections**:

1. **Sportive Prints** (main)
   - Handle: `sportive-prints`
   - Type: Manual

2. **European Classics**
   - Handle: `european-classics`
   - Type: Manual

3. **Sportive Events**
   - Handle: `sportive-events`
   - Type: Manual

4. **Iconic Climbs**
   - Handle: `iconic-climbs`
   - Type: Manual

5. **Global & Epic Challenges**
   - Handle: `global-challenges`
   - Type: Manual

---

## Step 4: Create Sportive Prints Page (2 minutes)

**Go to**: Online Store > Pages > Add page

- **Title**: Sportive Prints
- **Content**: (leave blank for now)
- **Template**: `page.sportive-prints` ⚠️ IMPORTANT: Select this template!
- **Save**

Then customize:
- **Go to**: Online Store > Themes > Customize
- Navigate to "Sportive Prints" page
- Find "Sportive Prints Grid" section
- Set **Collection**: Sportive Prints
- Set **Products to show**: 24
- **Save**

---

## Step 5: Create First Product (8 minutes)

**Go to**: Products > Add product

### Fred Whitton Challenge (Pilot Product #1)

**Basic Info:**
- Title: `Fred Whitton Challenge Cycling Map Print`
- Description:
```
Celebrate the Fred Whitton Challenge with this beautifully designed cycling route map.

The UK's toughest sportive, tackling all of the Lake District's major passes in one brutal 180km circuit including Hardknott Pass, Wrynose Pass, and Kirkstone Pass.

Available in three sizes and multiple styles, each print is professionally produced on museum-grade archival paper with fade-resistant inks.

Perfect for commemorating your personal achievement, inspiring your next cycling challenge, or decorating your home, office, or pain cave.
```
- Product type: `Map Print`
- Vendor: `Print My Ride`

**Media:**
- Upload 6 placeholder images (or use Shopify's placeholder)
- Alt text format: "Fred Whitton Challenge cycling route map - [Style] style in [Orientation] orientation"

**Pricing:**
- Add 3 options:
  - Option 1: Size (A4, A3, A2)
  - Option 2: Style (Classic Blue, Minimal Grey, Vintage Brown)
  - Option 3: Orientation (Portrait, Landscape)
- Shopify will generate 18 variants automatically
- Set prices:
  - A4 variants: £35.00
  - A3 variants: £55.00
  - A2 variants: £75.00

**Collections:**
- Add to "Sportive Prints"
- Add to "European Classics"

**Tags:**
- `fred-whitton`
- `england`
- `european-classics`
- `featured`

**Metafields** (scroll down to Metafields section):
```
event.name = Fred Whitton Challenge
event.year = 2024
event.distance_km = 180
event.elevation_m = 3211
event.location = Lake District
event.country = England
event.category = European Classics
event.description = The UK's toughest sportive, tackling all of the Lake District's major passes in one brutal 180km circuit.
event.route_highlights = Includes Hardknott Pass, Wrynose Pass, Kirkstone Pass, and five other major climbs. Known as one of the most challenging single-day rides in Britain with over 3,000m of climbing through stunning Lakeland scenery.
```

**Template:**
- In right sidebar, find "Theme templates"
- Select: `product.sportive-print` ⚠️ IMPORTANT
- **Save**

---

## Step 6: Test Everything (5 minutes)

### Test Collection Page
1. Visit: `https://your-store.myshopify.com/pages/sportive-prints`
2. ✅ Check product grid displays
3. ✅ Check categories section shows
4. ✅ Click on product card

### Test Product Page
1. Product page should display:
   - ✅ Event stats cards (distance, elevation, etc.)
   - ✅ Category badge at top
   - ✅ 18 variants available
   - ✅ Price updates with size selection
   - ✅ "Event Details" collapsible tab with metafields
2. Test variant selection:
   - ✅ Click different sizes
   - ✅ Price should update
3. Test add to cart:
   - ✅ Select any variant
   - ✅ Click "Add to Cart"
   - ✅ Check cart shows correct variant

### Test Mobile
1. Open on mobile device or use Chrome DevTools
2. ✅ Check responsive layout
3. ✅ Test variant selection on mobile
4. ✅ Test navigation

---

## Step 7: Add to Navigation (2 minutes)

**Go to**: Online Store > Navigation > Main menu

Add new menu item:
- **Label**: Sportive Prints
- **Link**: Pages > Sportive Prints

**Save menu**

Test: Refresh your store and check the menu displays the link.

---

## ✅ You're Done!

You now have:
- ✅ Working collection page at `/pages/sportive-prints`
- ✅ Your first preconfigured product (Fred Whitton Challenge)
- ✅ Enhanced product page with event stats
- ✅ 18 variants ready to purchase
- ✅ Navigation link in main menu

---

## 🎯 Next Steps

### Add More Pilot Products (2-3 hours)

Repeat Step 5 for these 9 products. All data is in `PILOT_PRODUCTS_DATA.md`:

**European Classics:**
2. RideLondon Classique
3. Dragon Ride

**Sportive Events:**
4. Paris-Roubaix Challenge
5. Tour of Flanders
6. L'Etape du Tour

**Iconic Climbs:**
7. Alpe d'Huez
8. Mont Ventoux

**Global Challenges:**
9. Cape Town Double Century
10. Leadville Trail 100

### Generate Real Map Images

Replace placeholder images with actual map exports:
1. Use your map generation system
2. Create 3 styles: Classic Blue, Minimal Grey, Vintage Brown
3. Export 2 orientations: Portrait (2480×3508px), Landscape (3508×2480px)
4. Optimize to < 500 KB per image
5. Upload to products

### Scale to Full Catalog (50+ products)

Use your CSV file to create all remaining products:
- 12 more European Classics
- 9 more Sportive Events
- 13 more Iconic Climbs
- 8 more Global Challenges

---

## 📚 Full Documentation

For detailed information, see:

- **`SPORTIVE_PRINTS_SETUP_GUIDE.md`** - Complete setup instructions
- **`PILOT_PRODUCTS_DATA.md`** - Detailed data for 10 pilot products
- **`SPORTIVE_PRINTS_IMPLEMENTATION_SUMMARY.md`** - Technical overview

---

## 🆘 Troubleshooting

**Product page not showing event stats?**
- Check template is set to `product.sportive-print`
- Verify metafields are filled in
- Clear browser cache

**Collection page showing no products?**
- Check product is added to "Sportive Prints" collection
- Verify collection is selected in theme customizer
- Ensure product is published (not draft)

**Variants not generating?**
- Make sure you created 3 options (not variants manually)
- Shopify auto-generates combinations from options
- You should have 18 variants (3×3×2)

**Template not appearing in dropdown?**
- Files must be pushed to Shopify via CLI
- Check file is in `templates/` folder
- Refresh Shopify admin page

---

## ⏱️ Time Breakdown

- **Step 1** (Deploy): 5 min
- **Step 2** (Metafields): 10 min
- **Step 3** (Collections): 5 min
- **Step 4** (Page): 2 min
- **Step 5** (Product): 8 min
- **Step 6** (Testing): 5 min
- **Step 7** (Navigation): 2 min

**Total: ~37 minutes** to launch first product!

---

**Ready to go?** Start with Step 1! 🚀
