# Development Guide

## Technical Implementation Details

### High-Resolution Map Export

The platform generates print-quality maps using Mapbox GL JS with specific requirements:

#### Canvas Export Configuration
```javascript
// 300 DPI export for A4 format
const canvas = map.getCanvas();
const devicePixelRatio = window.devicePixelRatio || 1;
const targetDPR = 300 / 72; // 300 DPI target

// Set canvas size for A4 at 300 DPI
canvas.width = 2480 * targetDPR;
canvas.height = 3508 * targetDPR;
```

#### Print Format Specifications
- **A4**: 2,480 x 3,508 pixels (210 x 297 mm at 300 DPI)
- **A3**: 3,508 x 4,961 pixels (297 x 420 mm at 300 DPI)
- **Color Space**: sRGB for consistent print reproduction
- **File Format**: PNG with transparency support

### Strava Integration

#### OAuth Flow Implementation
1. **Authorization Request**: Redirect to Strava OAuth
2. **Callback Handling**: Process authorization code
3. **Token Exchange**: Get access token and refresh token
4. **Session Storage**: Store tokens in server-side session

#### API Integration Points
```javascript
// Strava API endpoints used
const STRAVA_ENDPOINTS = {
  auth: 'https://www.strava.com/oauth/authorize',
  token: 'https://www.strava.com/oauth/token',
  athlete: 'https://www.strava.com/api/v3/athlete',
  activities: 'https://www.strava.com/api/v3/athlete/activities',
  activity: 'https://www.strava.com/api/v3/activities/:id'
};
```

### Map Customization Features

#### Interactive Map Controls
- **Pan/Zoom**: Standard map navigation
- **Activity Overlay**: GPX track visualization
- **Style Selection**: Multiple map styles
- **Crop Tool**: Print area selection
- **Text Overlay**: Custom labels and titles

#### Map Styling Options
- **Terrain**: Topographic with elevation
- **Satellite**: High-resolution imagery
- **Street**: Detailed road networks
- **Minimal**: Clean, print-optimized design

### Session Management

#### Session Configuration
```javascript
// Express session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

#### Session Data Structure
```javascript
const sessionData = {
  stravaTokens: {
    access_token: 'token',
    refresh_token: 'token',
    expires_at: timestamp
  },
  athlete: {
    id: 'athlete_id',
    firstname: 'name',
    lastname: 'name'
  },
  currentActivity: {
    id: 'activity_id',
    name: 'activity_name',
    polyline: 'encoded_polyline'
  }
};
```

## Development Environment Setup

### Local Development Server
```javascript
// server.js structure
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/strava', require('./routes/strava'));
app.use('/api/maps', require('./routes/maps'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### ngrok Configuration
```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3000

# Configure Strava app redirect URI
# Use the ngrok URL: https://abc123.ngrok.io/auth/strava/callback
```

### Environment Variables
```env
# Required for development
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=https://your-ngrok-url.ngrok.io/auth/strava/callback

MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

SESSION_SECRET=your_secure_session_secret
NODE_ENV=development
PORT=3000

# Optional for enhanced features
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_SECRET_KEY=your_shopify_secret_key
```

## Shopify Theme Integration

### Custom Assets Structure
```
shopify-theme/dawn/assets/
├── mapbox-integration.js      # Map functionality
├── strava-auth.js            # Authentication handling
├── map-customization.js      # Interactive controls
├── print-preview.js          # High-res export
├── map-styles.css           # Custom styling
└── loading-states.css       # UI feedback
```

### Theme Section Development
```liquid
<!-- sections/map-customization.liquid -->
<div class="map-customization-section">
  <div class="map-container" id="map-container">
    <div id="map" class="interactive-map"></div>
    <div class="map-controls">
      <button id="zoom-in">+</button>
      <button id="zoom-out">-</button>
      <select id="map-style">
        <option value="terrain">Terrain</option>
        <option value="satellite">Satellite</option>
        <option value="street">Street</option>
      </select>
    </div>
  </div>
  
  <div class="customization-panel">
    <h3>Customize Your Map</h3>
    <div class="activity-selector">
      <!-- Activity selection UI -->
    </div>
    <div class="print-options">
      <select id="print-format">
        <option value="a4">A4 (210 x 297 mm)</option>
        <option value="a3">A3 (297 x 420 mm)</option>
      </select>
    </div>
  </div>
</div>
```

### Product Integration
```javascript
// Add map to cart as Shopify product
const addMapToCart = async (mapConfig) => {
  const cartData = {
    id: 'map-print-product-id',
    quantity: 1,
    properties: {
      'Map Configuration': JSON.stringify(mapConfig),
      'Print Format': mapConfig.format,
      'Activity Name': mapConfig.activityName
    }
  };
  
  await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cartData)
  });
};
```

## Testing Implementation

### Unit Testing
```javascript
// Test map export functionality
describe('Map Export', () => {
  test('generates correct DPI for A4', async () => {
    const mapExport = new MapExporter();
    const canvas = await mapExport.exportA4(mapConfig);
    
    expect(canvas.width).toBe(2480);
    expect(canvas.height).toBe(3508);
  });
});
```

### Integration Testing
```javascript
// Test Strava OAuth flow
describe('Strava Authentication', () => {
  test('completes OAuth flow', async () => {
    const authResult = await stravaAuth.authenticate(authCode);
    
    expect(authResult.access_token).toBeDefined();
    expect(authResult.athlete).toBeDefined();
  });
});
```

### Performance Testing
```javascript
// Test map rendering performance
describe('Map Performance', () => {
  test('renders within acceptable time', async () => {
    const startTime = Date.now();
    await mapRenderer.render(largeActivityData);
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(3000); // 3 seconds max
  });
});
```

## Deployment Considerations

### Production Environment
- **HTTPS Required**: For OAuth callbacks
- **Session Storage**: Redis for production
- **File Storage**: Cloud storage for generated maps
- **CDN**: For static assets and map tiles

### Performance Optimization
- **Map Tile Caching**: Local cache for frequently used tiles
- **Image Optimization**: Compress generated map images
- **Lazy Loading**: Load maps only when needed
- **Progressive Enhancement**: Fallback for slow connections

### Security Considerations
- **HTTPS Enforcement**: All communications encrypted
- **API Key Protection**: Server-side API calls only
- **Session Security**: Secure cookie configuration
- **Input Validation**: Sanitize all user inputs

## Troubleshooting Guide

### Common Issues

#### Map Not Rendering
- Check Mapbox access token validity
- Verify network connectivity
- Inspect browser console for errors
- Check if container has proper dimensions

#### Strava Authentication Fails
- Verify OAuth configuration
- Check redirect URI matches exactly
- Ensure ngrok tunnel is active
- Validate client ID and secret

#### Low Quality Exports
- Verify DPI calculation
- Check device pixel ratio handling
- Ensure canvas dimensions are correct
- Validate image format settings

### Development Tips

1. **Use Browser Dev Tools**: Monitor network requests and console errors
2. **Test with Real Data**: Use actual Strava activities for testing
3. **Validate Print Quality**: Test exports at actual print sizes
4. **Monitor Performance**: Use Lighthouse for performance audits
5. **Cross-Browser Testing**: Ensure compatibility across browsers

## Code Quality Standards

### JavaScript Standards
- Use ES6+ features where appropriate
- Implement proper error handling
- Follow async/await patterns
- Use meaningful variable names
- Add comprehensive comments

### Liquid Template Standards
- Use semantic HTML structure
- Implement proper accessibility
- Follow Shopify theme conventions
- Optimize for performance
- Test responsive design

### CSS Standards
- Use CSS Grid/Flexbox for layouts
- Implement mobile-first design
- Use CSS custom properties
- Follow BEM methodology
- Optimize for print media queries