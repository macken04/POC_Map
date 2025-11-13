# Deployment Fix - Metafield References

## What Happened

The initial push failed because the product template referenced metafields that don't exist yet in Shopify. Shopify's theme validator checks for metafield existence during deployment.

## What Was Changed

Modified `templates/product.sportive-print.json` to be deployment-safe:

### Changes Made:
1. **Caption field**: Changed from `{{ product.metafields.event.category.value }}` to `{{ product.type }}`
   - Will display "Map Print" instead of category
   - Can be updated later after metafields are created

2. **Event Details tab**: Changed from metafield references to placeholder text
   - Original had: distance, elevation, location, country, year from metafields
   - Now has: "Complete event statistics and route information will be displayed here once product metafields are configured."

3. **Route Highlights section**: Removed entirely
   - This section directly referenced `product.metafields.event.route_highlights.value`
   - Can be re-added after metafields are created

### What Still Works:
- ✅ **Event Stats Section** (`sportive-event-stats.liquid`): This section has proper Liquid conditionals and will gracefully handle missing metafields
- ✅ All other sections function normally
- ✅ Product page layout and styling
- ✅ Variant selection
- ✅ Add to cart functionality

## How to Deploy Now

The template is now safe to push:

```bash
cd shopify-theme/dawn
shopify theme push
```

This should complete without errors.

## After Metafields Are Created

Once you've created all 9 metafield definitions in Shopify (see QUICK_START.md Step 2), you have two options:

### Option 1: Keep Current Setup (Recommended Initially)
- The `sportive-event-stats` section will automatically display metafields
- Event details will show in the stats cards section
- Products without metafields will still display correctly

### Option 2: Restore Full Metafield Integration
Update the template to restore metafield references:

1. **Caption field** - Restore category badge:
```json
"caption": {
  "type": "text",
  "settings": {
    "text": "{{ product.metafields.event.category.value }}",
    "text_style": "uppercase"
  }
}
```

2. **Event Details tab** - Restore full details:
```json
"collapsible-row-0": {
  "type": "collapsible_tab",
  "settings": {
    "heading": "Event Details",
    "icon": "clipboard",
    "content": "<p><strong>Distance:</strong> {{ product.metafields.event.distance_km.value }} km</p><p><strong>Elevation:</strong> {{ product.metafields.event.elevation_m.value }} m</p><p><strong>Location:</strong> {{ product.metafields.event.location.value }}, {{ product.metafields.event.country.value }}</p><p><strong>Year:</strong> {{ product.metafields.event.year.value }}</p>",
    "page": ""
  }
}
```

3. **Add Route Highlights section back** - Insert before "related-products":
```json
"route-highlights": {
  "type": "rich-text",
  "blocks": {
    "heading": {
      "type": "heading",
      "settings": {
        "heading": "Route Highlights",
        "heading_size": "h2"
      }
    },
    "text": {
      "type": "text",
      "settings": {
        "text": "<p>{{ product.metafields.event.route_highlights.value }}</p>"
      }
    }
  },
  "block_order": ["heading", "text"],
  "settings": {
    "desktop_content_position": "center",
    "content_alignment": "center",
    "color_scheme": "scheme-1",
    "full_width": true,
    "padding_top": 40,
    "padding_bottom": 52
  }
}
```

And update the order array:
```json
"order": [
  "main",
  "event-stats",
  "route-highlights",
  "related-products"
]
```

## Better Alternative: Create a Snippet (Advanced)

Create a custom snippet that handles metafields with conditionals:

**File**: `snippets/sportive-event-details.liquid`
```liquid
{%- if product.metafields.event.distance_km.value != blank -%}
  <p><strong>Distance:</strong> {{ product.metafields.event.distance_km.value }} km</p>
{%- endif -%}

{%- if product.metafields.event.elevation_m.value != blank -%}
  <p><strong>Elevation:</strong> {{ product.metafields.event.elevation_m.value }} m</p>
{%- endif -%}

{%- if product.metafields.event.location.value != blank -%}
  <p><strong>Location:</strong> {{ product.metafields.event.location.value }}
  {%- if product.metafields.event.country.value != blank -%}, {{ product.metafields.event.country.value }}{%- endif -%}
  </p>
{%- endif -%}

{%- if product.metafields.event.year.value != blank -%}
  <p><strong>Year:</strong> {{ product.metafields.event.year.value }}</p>
{%- endif -%}
```

Then use the snippet in the collapsible tab:
```json
"collapsible-row-0": {
  "type": "collapsible_tab",
  "settings": {
    "heading": "Event Details",
    "icon": "clipboard",
    "content": "{% render 'sportive-event-details' %}",
    "page": ""
  }
}
```

## Current Product Page Features

Even without metafield restoration, the product page includes:

✅ **Event Stats Cards** (sportive-event-stats section)
- Displays all event metafields when present
- Gracefully hides when metafields are empty
- Professional card-based layout

✅ **Standard Product Features**
- Title and price
- Variant selection (18 variants)
- Product description
- Image gallery
- Add to cart
- Related products

✅ **Collapsible Tabs**
- Event Details (placeholder until restored)
- Print Specifications
- Shipping & Delivery
- Care Instructions

## Timeline

1. **Now**: Deploy with safe template ✅
2. **Next (10 min)**: Create metafield definitions in Shopify
3. **Then (5 min)**: Create first product with metafields
4. **Test**: Verify sportive-event-stats section displays metafields correctly
5. **Later (optional)**: Restore full metafield integration in template

## Notes

- The `sportive-event-stats` section is the primary way event data will be displayed
- It already handles all 9 metafields with proper conditionals
- Products will look professional even without restoring template metafields
- You can mix and match: some products with metafields, some without

---

**Next Step**: Run `shopify theme push` again - it should work now! ✅
