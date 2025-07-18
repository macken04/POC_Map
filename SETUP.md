# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites Check
- ✅ Node.js v18+ installed
- ✅ Git installed
- ✅ Shopify Partner account
- ✅ Required API keys obtained

### 2. Clone & Install
```bash
git clone [repository-url]
cd map_site_vibe
npm install  # When package.json is available
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your keys
nano .env
```

Required environment variables:
```env
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
MAPBOX_ACCESS_TOKEN=your_mapbox_token
SESSION_SECRET=your_secure_random_string
```

### 4. Shopify CLI Setup
```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Authenticate
shopify auth login
```

### 5. Start Development
```bash
# Start theme development
cd shopify-theme/dawn
shopify theme dev --store=print-my-ride-version-5.myshopify.com

# In another terminal - start backend (when implemented)
npm run dev

# In another terminal - start ngrok tunnel
ngrok http 3000
```

## 📝 Daily Development Workflow

### Morning Setup
```bash
# Pull latest changes
git pull origin main

# Start development servers
shopify theme dev --store=print-my-ride-version-5.myshopify.com
npm run dev
ngrok http 3000
```

### Making Changes
1. **Theme Changes**: Edit files in `shopify-theme/dawn/`
2. **Backend Changes**: Edit files in `backend/` (when implemented)
3. **Test Changes**: Use development URLs
4. **Commit Changes**: Regular commits with descriptive messages

### End of Day
```bash
# Push changes
git add .
git commit -m "descriptive commit message"
git push origin feature/your-branch
```

## 🔧 Common Commands

### Shopify Theme Commands
```bash
# List themes
shopify theme list

# Push to development theme
shopify theme push --theme=183192945024

# Check theme quality
shopify theme check

# Pull latest from store
shopify theme pull --theme=183192945024
```

### Backend Commands (When Implemented)
```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Regular commits
git add .
git commit -m "Add feature description"

# Push branch
git push origin feature/your-feature-name

# Create pull request via GitHub
```

## 🔑 API Keys & Configuration

### Strava API Setup
1. Go to [Strava Developers](https://developers.strava.com/)
2. Create new application
3. Set redirect URI to your ngrok URL: `https://your-ngrok-url.ngrok.io/auth/strava/callback`
4. Copy Client ID and Client Secret

### Mapbox API Setup
1. Go to [Mapbox](https://www.mapbox.com/)
2. Create account and get access token
3. Copy access token to environment variables

### ngrok Setup
1. Sign up at [ngrok](https://ngrok.com/)
2. Install ngrok: `npm install -g ngrok`
3. Authenticate: `ngrok authtoken your-token`
4. Start tunnel: `ngrok http 3000`

## 📊 Store Information

### Development Store Details
- **Store Name**: print-my-ride-version-5
- **URL**: print-my-ride-version-5.myshopify.com
- **Admin**: printmyrideie@gmail.com
- **Live Theme ID**: 183078388096
- **Dev Theme ID**: 183192945024

### Theme Commands with Store
```bash
# Start development with specific store
shopify theme dev --store=print-my-ride-version-5.myshopify.com

# Push to development theme
shopify theme push --store=print-my-ride-version-5.myshopify.com --theme=183192945024

# Pull from development theme
shopify theme pull --store=print-my-ride-version-5.myshopify.com --theme=183192945024
```

## 🧪 Testing Your Setup

### 1. Theme Development Test
```bash
cd shopify-theme/dawn
shopify theme dev --store=print-my-ride-version-5.myshopify.com
```
- Should open browser to development URL
- Should show Dawn theme running
- Changes should auto-reload

### 2. Backend Test (When Implemented)
```bash
npm run dev
```
- Should start server on port 3000
- Should show "Server running" message
- Should be accessible via ngrok tunnel

### 3. API Integration Test
- Visit ngrok URL in browser
- Should redirect to Strava OAuth
- Should handle callback successfully
- Should display user data

## 🆘 Troubleshooting

### Common Issues

#### Shopify CLI Not Working
```bash
# Reinstall CLI
npm uninstall -g @shopify/cli @shopify/theme
npm install -g @shopify/cli @shopify/theme

# Clear cache
shopify auth logout
shopify auth login
```

#### ngrok Issues
```bash
# Check if tunnel is running
ngrok status

# Restart tunnel
ngrok http 3000
```

#### Environment Variables Not Loading
```bash
# Check .env file exists
ls -la .env

# Check file contents (remove sensitive data before sharing)
cat .env
```

#### Theme Not Updating
```bash
# Check if dev server is running
shopify theme dev --store=print-my-ride-version-5.myshopify.com

# Hard refresh browser (Cmd+Shift+R)
# Check browser console for errors
```

## 📚 Quick Reference

### File Structure
```
map_site_vibe/
├── shopify-theme/dawn/     # Theme files
├── backend/                # Backend code (when implemented)
├── .env                    # Environment variables
├── README.md              # Main documentation
├── DEVELOPMENT.md         # Technical details
└── SETUP.md               # This file
```

### Key Files to Edit
- `shopify-theme/dawn/sections/` - Theme sections
- `shopify-theme/dawn/assets/` - CSS/JS files
- `backend/routes/` - API routes (when implemented)
- `backend/services/` - Business logic (when implemented)

### Development URLs
- **Theme Dev**: Provided by `shopify theme dev`
- **Backend**: `http://localhost:3000`
- **ngrok**: `https://your-unique-id.ngrok.io`

## 🎯 Next Steps

1. **Complete Setup**: Follow all steps above
2. **Test Environment**: Verify all services work
3. **Review Code**: Understand project structure
4. **Start Development**: Begin working on assigned tasks
5. **Regular Commits**: Keep code updated and backed up

---

**Need Help?** Check the main README.md or DEVELOPMENT.md for detailed information, or ask team members for assistance.