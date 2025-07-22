# Shopify Map Printing Platform

A custom Shopify platform that enables users to create and purchase high-quality prints of their Strava activity maps. The platform integrates Strava API authentication, interactive map customization, and high-resolution export capabilities for professional printing.

## 🏗️ Architecture Overview

### Core Technologies
- **Frontend**: Shopify Dawn theme with custom JavaScript components
- **Backend**: Node.js/Express server with session-based authentication
- **Maps**: Mapbox GL JS for interactive display and high-resolution export
- **High-Resolution Export**: Canvas export with device pixel ratio manipulation for 300 DPI print quality
- **Authentication**: Strava API v3 OAuth flow with hybrid session + cross-domain token system
- **E-commerce**: Shopify Store-Level App (private app integration)
- **Development**: ngrok for local development tunneling

### Print Specifications
- **A4 Format**: 2,480 x 3,508 pixels at 300 DPI
- **A3 Format**: 3,508 x 4,961 pixels at 300 DPI
- **Export Quality**: Professional print-ready with 300 DPI resolution

## 📋 Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **npm**: v8 or higher
- **Shopify CLI**: Latest version
- **Git**: Version control system

### Required Accounts & API Keys
- **Shopify Partner Account**: For theme development and app deployment
- **Strava API Account**: For user authentication and activity data
- **Mapbox Account**: For map rendering and export capabilities
- **ngrok Account**: For local development tunneling (free tier available)

### Development Store
- **Store Name**: print-my-ride-version-5
- **Store URL**: print-my-ride-version-5.myshopify.com
- **Admin Access**: Available to development team
- **Themes**: 
  - Dawn (live theme) - ID: #183078388096
  - Development (f18404-MacBook-Pro-4) - ID: #183192945024

## 🚀 Quick Start

### 1. Clone and Setup
```bash
# Clone the repository
git clone [repository-url]
cd map_site_vibe

# Install dependencies (when backend is implemented)
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install Shopify CLI
```bash
npm install -g @shopify/cli @shopify/theme
```

### 3. Authenticate with Shopify
```bash
shopify auth login
```

### 4. Theme Development
```bash
# Navigate to theme directory
cd shopify-theme/dawn

# Start development server
shopify theme dev --store=print-my-ride-version-5.myshopify.com

# Or use specific theme ID
shopify theme dev --store=print-my-ride-version-5.myshopify.com --theme=183192945024
```

### 5. Backend Development (When Implemented)
```bash
# Start local backend server
npm run dev

# Start ngrok tunnel
ngrok http 3000
```

## 📁 Project Structure

```
map_site_vibe/
├── shopify-theme/
│   └── dawn/                    # Shopify Dawn theme
│       ├── assets/             # CSS, JS, images
│       ├── config/             # Theme configuration
│       ├── layout/             # Theme layout files
│       ├── sections/           # Theme sections
│       ├── snippets/           # Reusable code snippets
│       ├── templates/          # Page templates
│       └── locales/            # Translation files
├── backend/                     # Node.js backend (to be implemented)
│   ├── server.js               # Express server
│   ├── routes/                 # API routes
│   │   ├── auth.js            # Strava OAuth routes
│   │   ├── strava.js          # Strava API integration
│   │   └── maps.js            # Map generation routes
│   ├── services/              # Business logic
│   │   ├── stravaService.js   # Strava API calls
│   │   ├── mapService.js      # Map generation logic
│   │   ├── tokenManager.js    # Session-based token management
│   │   └── crossDomainTokenStore.js # Cross-domain authentication
│   └── generated-maps/        # Local map storage
├── shopify-app/               # Shopify app configuration (to be implemented)
├── docs/                      # Documentation
└── .taskmaster/               # Task management system
```

## 🎨 Theme Development

### Dawn Theme Customization
The project uses Shopify's Dawn theme as the foundation. All customizations should follow these principles:

#### Development Workflow
1. **Start Development Server**: `shopify theme dev`
2. **Make Changes**: Edit theme files in `shopify-theme/dawn/`
3. **Test Changes**: View changes at the development URL
4. **Deploy**: Push changes to development theme

#### Key Customization Areas
- **Assets**: Custom CSS/JS for map integration
- **Sections**: Map customization interface
- **Templates**: Product pages for map prints
- **Snippets**: Reusable map components

### Theme Commands
```bash
# List available themes
shopify theme list --store=print-my-ride-version-5.myshopify.com

# Push to development theme
shopify theme push --store=print-my-ride-version-5.myshopify.com --theme=183192945024

# Pull latest changes
shopify theme pull --store=print-my-ride-version-5.myshopify.com --theme=183192945024

# Check theme for issues
shopify theme check
```

## 🔧 Backend Development

### API Integration Flow
1. **Strava OAuth**: User authenticates with Strava
2. **Activity Selection**: User selects activities to map
3. **Map Customization**: Interactive map editing interface
4. **High-Res Export**: Generate 300 DPI print-ready images
5. **Shopify Integration**: Add to cart and checkout process

### Environment Configuration
```env
# Strava API
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://your-ngrok-url.ngrok.io/auth/strava/callback

# Mapbox
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Session
SESSION_SECRET=your_session_secret

# Server
PORT=3000
NODE_ENV=development
```

### Development Server
```bash
# Start backend server
npm run dev

# Start with specific port
PORT=3001 npm run dev

# Start with debugging
DEBUG=* npm run dev
```

## 📱 Shopify App Integration

### Store-Level App Configuration
- **App Type**: Private app for single store
- **Scope**: Product management, order processing
- **Webhooks**: Order creation, payment processing
- **API Access**: Admin API for product creation

### App Development
```bash
# Initialize Shopify app (when ready)
shopify app init

# Start app development server
shopify app dev

# Deploy app
shopify app deploy
```

## 🧪 Testing Strategy

### Theme Testing
1. **Visual Testing**: Cross-browser compatibility
2. **Performance Testing**: Lighthouse audits
3. **Theme Check**: Code quality validation
4. **Responsive Testing**: Mobile and tablet compatibility

### Backend Testing
1. **API Testing**: Strava integration endpoints
2. **Map Generation**: High-resolution export quality
3. **Session Management**: Authentication flow
4. **Error Handling**: Graceful failure modes

### Integration Testing
1. **End-to-End**: Complete user journey
2. **Payment Flow**: Shopify checkout process
3. **Print Quality**: DPI validation
4. **Performance**: Load testing

## 🚦 Deployment Workflow

### Development Branch Strategy
- **main**: Production-ready code
- **staging**: Pre-production testing
- **development**: Active development
- **feature/**: Feature-specific branches

### Deployment Process
1. **Development**: Local development with ngrok
2. **Staging**: Deploy to staging environment
3. **Testing**: Comprehensive testing suite
4. **Production**: Deploy to live store

### Theme Deployment
```bash
# Deploy to development theme
shopify theme push --store=print-my-ride-version-5.myshopify.com --theme=183192945024

# Deploy to live theme (production)
shopify theme push --store=print-my-ride-version-5.myshopify.com --theme=183078388096 --allow-live
```

## 🔍 Development Tools

### Shopify CLI
- **Theme Development**: `shopify theme dev`
- **App Development**: `shopify app dev`
- **Store Management**: `shopify store list`

### Theme Check
- **Validation**: `shopify theme check`
- **VS Code Extension**: Auto-validation during development

### Lighthouse CI
- **Performance Monitoring**: Automated performance audits
- **GitHub Actions**: Continuous integration testing

## 📚 Additional Resources

### Documentation
- [Shopify Theme Development](https://shopify.dev/themes)
- [Dawn Theme Documentation](https://github.com/Shopify/dawn)
- [Strava API Documentation](https://developers.strava.com/)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)

### Community
- [Shopify Partners](https://partners.shopify.com/)
- [Shopify Theme Store](https://themes.shopify.com/)
- [GitHub Discussions](https://github.com/Shopify/dawn/discussions)

## 📞 Support

For development questions or issues:
1. Check existing documentation
2. Review project task management system
3. Consult team members
4. Create GitHub issues for bugs

## 📄 License

This project is licensed under the terms specified in the LICENSE file.

---

**Note**: This is a development platform for creating high-quality map prints from Strava activities. Ensure all API keys and sensitive information are properly secured and never committed to version control.