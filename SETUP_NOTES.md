# Setup Notes for Map Preview Fix

## Required Shopify Admin Setup

To complete the implementation, you need to create a page in Shopify Admin:

### Create Map Preview Page

1. Go to Shopify Admin → Pages
2. Click "Add page"
3. Set the following:
   - **Title**: `Map Preview`
   - **Handle**: `map-preview` (should auto-generate)
   - **Content**: Leave empty or add basic description
   - **Template**: Select `page.map-preview` (our custom template)
   - **Visibility**: Hidden from navigation (since users access via direct link)

### Verification

Once the page is created, users should be able to access:
- `/pages/map-preview` - The preview approval page

## Files Created/Modified

### New Files:
- `assets/auth-utils.js` - Centralized authentication utility
- `templates/page.map-preview.liquid` - Page template for preview approval
- `sections/map-preview-approval.liquid` - Main preview approval section
- `assets/map-preview-approval.css` - Styling for preview page
- `assets/map-preview-approval.js` - JavaScript functionality

### Modified Files:
- `sections/map-design.liquid` - Added auth-utils.js script
- `sections/strava-activities.liquid` - Added auth-utils.js script
- `assets/map-design.js` - Updated authentication and redirect flow
- `assets/strava-activities.js` - Updated to use AuthUtils

## Testing Flow

1. Start with authentication: `/pages/strava-login`
2. Select activity: `/pages/strava-activities`
3. Design map: `/pages/map-design`
4. Click "Preview Poster" → Should redirect to `/pages/map-preview`
5. Review and approve → Should redirect to Shopify cart

## Expected Behavior

- **Authentication**: Cross-domain tokens properly managed across all pages
- **Preview Generation**: Backend API called with proper authentication
- **Redirect Flow**: Seamless transition from design → preview → purchase
- **Error Handling**: Clear error messages with fallback options

## Troubleshooting

If preview page shows 404:
1. Verify the Shopify page was created with handle `map-preview`
2. Check that template `page.map-preview.liquid` exists
3. Ensure template is selected in page settings

If authentication fails:
1. Check browser console for AuthUtils errors
2. Verify backend is running on correct URL
3. Check that all JS files are loading properly