# Shopify Custom Map Printing Platform

## Project Overview
A Shopify-based e-commerce platform that allows users to connect their Strava account, select cycling activities, and generate custom high-resolution maps for printing. The platform replicates the functionality of englishcyclist.com with local development capabilities.

## Architecture

### Technical Stack
- **Frontend**: Shopify Dawn theme with custom JavaScript components
- **Backend**: Local Node.js/Express server with session-based authentication
- **Maps**: Mapbox GL JS for both interactive display and high-resolution export
- **High-Resolution Export**: Mapbox GL JS Canvas Export + Puppeteer for print-quality maps
- **APIs**: Strava API v3 for session-based authentication and activity data
- **Storage**: Local file system for generated map images
- **Development**: ngrok for external access to local server

### Key Features
- **Strava Integration**: OAuth login, activity selection, route data import
- **Interactive Map Preview**: Real-time map visualization with Mapbox GL JS
- **High-Resolution Export**: 300 DPI print-ready maps for A3/A4 formats
- **Map Customization**: Style selection, route colors, annotations, sizing
- **Shopify Integration**: Seamless cart/checkout experience
- **Local Development**: All processing runs locally with ngrok access

## Print Requirements & Technical Solution

### Print Specifications
- **A4 Format**: 2,480 x 3,508 pixels at 300 DPI
- **A3 Format**: 3,508 x 4,961 pixels at 300 DPI
- **Quality**: Professional print quality at 300 DPI resolution

### High-Resolution Export Implementation
Since Mapbox Static API is limited to 1,280x1,280px, we use:

1. **Mapbox GL JS Canvas Export** with `preserveDrawingBuffer: true`
2. **Device Pixel Ratio Manipulation**: `Object.defineProperty(window, 'devicePixelRatio', { get: function() {return 300 / 96} });`
3. **Canvas Export**: `map.getCanvas().toDataURL()` for high-resolution image export
4. **Puppeteer Integration**: Headless browser rendering for server-side generation

## Implementation Phases

### Phase 1: Foundation & External Access (High Priority)
1. Set up Shopify Dawn theme development environment
2. Create Node.js backend server with session-based authentication
3. Set up ngrok for external access (required for OAuth testing)
4. Implement Strava OAuth integration with session storage only
5. Set up Mapbox account and configure API keys
6. Install and configure Puppeteer for headless rendering

### Phase 2: Core Mapping & Export (High Priority)
7. Create Strava API integration to fetch user activities
8. Build map visualization component using Mapbox GL JS
9. Implement route rendering from Strava GPX/TCX data on Mapbox GL
10. Create local file system for storing generated maps
11. Configure Mapbox GL JS for high-resolution export (`preserveDrawingBuffer: true`)
12. Implement devicePixelRatio manipulation for 300 DPI rendering
13. Build canvas export system using `map.getCanvas().toDataURL()`
14. Implement A3/A4 print sizing at 300 DPI (3508x4961 / 2480x3508 pixels)

### Phase 3: Customization & Integration (Medium Priority)
15. Create map customization interface (style, colors, annotations)
16. Build Shopify app integration for seamless store embedding
17. Create product pages in Shopify for custom maps
18. Implement cart integration and checkout flow
19. Set up local map serving endpoint for Shopify integration

## User Flow

1. **User visits Shopify store** → Custom map product page
2. **Connect to Strava** → OAuth authentication (session-based)
3. **Select Activity** → Choose from user's Strava activities
4. **Customize Map** → Style, colors, annotations, size selection
5. **Preview Map** → Interactive preview with Mapbox GL JS
6. **Generate Print** → High-resolution export via canvas/Puppeteer
7. **Add to Cart** → Shopify native checkout process
8. **Order Processing** → Shopify handles customer data and fulfillment

## Project Structure

```
shopify-map-printing/
├── backend/
│   ├── server.js                 # Express server
│   ├── routes/
│   │   ├── auth.js              # Strava OAuth routes
│   │   ├── strava.js            # Strava API integration
│   │   └── maps.js              # Map generation routes
│   ├── services/
│   │   ├── stravaService.js     # Strava API calls
│   │   └── mapService.js        # Map generation logic
│   ├── generated-maps/          # Local map storage
│   └── package.json
├── shopify-theme/
│   ├── assets/
│   ├── sections/
│   ├── templates/
│   └── (Dawn theme files)
├── shopify-app/
│   └── (App integration files)
└── docs/
    └── PROJECT_PLAN.md
```

## Key Benefits

- **Pure Mapbox Solution**: All map rendering and export within Mapbox GL JS ecosystem
- **High-Resolution Native**: Canvas export supports any resolution needed for professional printing
- **Consistent Styling**: Same engine for preview and print ensures WYSIWYG experience
- **Cost Effective**: No additional mapping services required beyond Mapbox
- **Session-Based**: No user data storage - all authentication via sessions
- **Local Development**: Complete control over processing and storage

## Development Notes

- **Session Storage**: All user authentication is session-based (no database required)
- **Local Processing**: All map generation happens locally via ngrok-accessible server
- **Shopify Integration**: Use Shopify's native order processing and customer management
- **Testing**: ngrok required early for OAuth callback testing
- **Print Quality**: Focus on 300 DPI output for professional printing standards

## Next Steps

1. Begin with Phase 1 foundation setup
2. Establish ngrok tunnel for development
3. Configure Strava OAuth with proper callback URLs
4. Set up Mapbox account and test high-resolution export
5. Build core mapping functionality before Shopify integration

---

*This document serves as the master plan for the Shopify Custom Map Printing Platform build. Update as needed throughout development.*