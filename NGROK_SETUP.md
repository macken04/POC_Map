# ngrok Setup Guide for Print My Ride

Complete guide for setting up and troubleshooting ngrok for the Shopify Custom Map Printing Platform development environment.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Detailed Setup](#detailed-setup)
3. [Project Integration](#project-integration)
4. [Troubleshooting](#troubleshooting)
5. [Security Considerations](#security-considerations)
6. [Team Workflow](#team-workflow)
7. [Automation Tools](#automation-tools)

## Quick Start

### Prerequisites
- Node.js installed
- Express server configured (port 3000)
- Strava API credentials

### 1. Install ngrok
```bash
# Install globally
npm install -g ngrok

# Or install locally in project
npm install ngrok --save-dev
```

### 2. Authenticate ngrok
```bash
# Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok authtoken YOUR_AUTH_TOKEN
```

### 3. Start the Express Server
```bash
cd backend
npm start
# Server should be running on http://localhost:3000
```

### 4. Start ngrok Tunnel
```bash
# Using the project's ngrok.yml configuration
ngrok start map-printing-backend

# Or manually
ngrok http 3000
```

### 5. Update Environment Variables (Automated)
```bash
# Use the automated capture script
node backend/scripts/capture-ngrok.js
```

### 6. Update Strava API Settings
1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Update "Authorization Callback Domain" with your new ngrok URL
3. Set "Authorization Callback URL" to: `https://your-ngrok-url.ngrok-free.app/auth/strava/callback`

## Detailed Setup

### ngrok Configuration File

The project includes a pre-configured `ngrok.yml` file:

```yaml
version: "2"
log_level: info
log_format: logfmt

tunnels:
  map-printing-backend:
    addr: 3000
    proto: http
    hostname: boss-hog-freely.ngrok-free.app  # Your reserved domain
    inspect: true

web_addr: localhost:4040
```

### Environment Variables Setup

Required environment variables in `backend/.env`:

```env
# Server Configuration
PORT=3000
SESSION_SECRET=your-secure-session-secret
NODE_ENV=development

# Strava API Configuration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/auth/strava/callback

# Mapbox Configuration
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-ngrok-url.ngrok-free.app,https://print-my-ride-version-5.myshopify.com

# ngrok URL (updated automatically by capture script)
NGROK_URL=https://your-ngrok-url.ngrok-free.app
```

### Manual Environment Update

If not using the automation script:

1. **Copy the ngrok URL** from terminal output or ngrok inspector
2. **Update `.env` file**:
   ```bash
   NGROK_URL=https://your-new-url.ngrok-free.app
   STRAVA_REDIRECT_URI=https://your-new-url.ngrok-free.app/auth/strava/callback
   ALLOWED_ORIGINS=http://localhost:3000,https://your-new-url.ngrok-free.app,https://print-my-ride-version-5.myshopify.com
   ```
3. **Restart your Express server** to pick up new environment variables

## Project Integration

### Express Routes Configuration

The project uses specific routes that depend on ngrok URLs:

#### Authentication Routes (`backend/routes/auth.js`)
- **Strava OAuth Initiation**: `GET /auth/strava`
- **OAuth Callback**: `GET /auth/strava/callback` ← **Critical ngrok dependency**
- **Auth Status Check**: `GET /auth/status`
- **Logout**: `POST /auth/logout`

#### Strava API Routes (`backend/routes/strava.js`)
- All routes require authenticated session established via ngrok callback

#### Map Generation Routes (`backend/routes/maps.js`)
- High-resolution map export functionality
- Requires authenticated Strava session

### Shopify Store Integration

**Store Details:**
- **Store URL**: `print-my-ride-version-5.myshopify.com`
- **CORS Requirements**: ngrok URL must be in ALLOWED_ORIGINS

**Theme Integration Points:**
- Custom JavaScript in Shopify theme communicates with ngrok backend
- Map customization interface sends requests to ngrok-exposed APIs
- Cart integration for map products

### Session Management

The application uses Express sessions with ngrok considerations:

```javascript
// Session configuration (from auth.js)
req.session.strava = {
  accessToken: tokenData.access_token,
  refreshToken: tokenData.refresh_token,
  expiresAt: tokenData.expires_at,
  athlete: tokenData.athlete
};
```

**Important**: Sessions are tied to the ngrok URL domain. Changing ngrok URLs will invalidate existing sessions.

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use
**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm start
# Then update ngrok: ngrok http 3001
```

#### 2. ngrok Tunnel Not Starting
**Problem**: `ngrok` command not found or tunnel fails to start

**Solutions**:
```bash
# Verify ngrok installation
which ngrok
ngrok version

# Re-authenticate
ngrok authtoken YOUR_TOKEN

# Check ngrok dashboard for active tunnels
open https://dashboard.ngrok.com/status/tunnels

# Try alternative start method
ngrok http 3000 --log=stdout
```

#### 3. Strava OAuth Callback Failures
**Problem**: Authentication redirects to error page or times out

**Debugging Steps**:
1. **Check ngrok URL is accessible**:
   ```bash
   curl https://your-ngrok-url.ngrok-free.app/auth/status
   ```

2. **Verify Strava API configuration**:
   - Authorization Callback Domain matches ngrok domain
   - Authorization Callback URL: `https://your-ngrok-url.ngrok-free.app/auth/strava/callback`

3. **Check environment variables**:
   ```bash
   grep STRAVA backend/.env
   grep NGROK backend/.env
   ```

4. **Monitor ngrok inspector**: Open `http://localhost:4040` to see incoming requests

#### 4. CORS Issues with Shopify Store
**Problem**: Shopify theme cannot communicate with ngrok backend

**Solutions**:
1. **Verify ALLOWED_ORIGINS includes all required URLs**:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,https://your-ngrok-url.ngrok-free.app,https://print-my-ride-version-5.myshopify.com
   ```

2. **Check CORS configuration in Express server**

3. **Test from Shopify store**:
   ```javascript
   // Browser console in Shopify admin or storefront
   fetch('https://your-ngrok-url.ngrok-free.app/auth/status')
     .then(response => response.json())
     .then(data => console.log(data));
   ```

#### 5. Session Authentication Failures
**Problem**: User appears authenticated but API calls fail

**Debugging**:
1. **Check session expiration**:
   ```bash
   # Call auth status endpoint
   curl https://your-ngrok-url.ngrok-free.app/auth/status
   ```

2. **Verify session cookie domain** matches ngrok URL

3. **Check server logs** for session-related errors

#### 6. Firewall/Network Blocking
**Problem**: ngrok tunnel shows as online but not accessible externally

**Solutions**:
- **Corporate firewalls**: May block ngrok domains
- **Alternative**: Use ngrok's custom domain feature
- **VPN issues**: Disconnect VPN temporarily for testing
- **Local firewall**: Allow port 3000 and ngrok process

#### 7. High Latency or Timeouts
**Problem**: Requests to ngrok URL are slow or timing out

**Solutions**:
- **Use closest ngrok region**:
  ```bash
  ngrok http 3000 --region=us  # or eu, ap, au, sa, jp, in
  ```
- **Check ngrok status**: Visit [ngrok status page](https://status.ngrok.com/)
- **Monitor with ngrok inspector**: `http://localhost:4040`

### Advanced Debugging

#### Using ngrok Inspector
1. **Access the inspector**: `http://localhost:4040`
2. **Monitor live requests** to your tunnel
3. **Inspect request/response headers and bodies**
4. **Replay requests** for debugging

#### Log Analysis
```bash
# Express server logs
npm start 2>&1 | tee server.log

# ngrok logs (if configured)
ngrok http 3000 --log=stdout --log-level=debug
```

#### Testing Connectivity
```bash
# Test ngrok tunnel externally
curl -I https://your-ngrok-url.ngrok-free.app

# Test specific endpoints
curl https://your-ngrok-url.ngrok-free.app/auth/status

# Test from different networks
# Use your phone's mobile data to test external access
```

## Security Considerations

### HTTPS Enforcement
- **Always use HTTPS tunnels** for OAuth callbacks
- Strava requires HTTPS for production applications
- Configure ngrok for HTTPS by default

### Environment Variable Protection
- **Never commit .env files** with real credentials
- **Use .env.example** for team reference
- **Rotate credentials** if accidentally exposed

### ngrok Security Best Practices
1. **Use authentication** for sensitive tunnels:
   ```bash
   ngrok http 3000 --basic-auth="username:password"
   ```

2. **Restrict access by IP** (paid feature):
   ```bash
   ngrok http 3000 --cidr-allow="192.168.1.0/24"
   ```

3. **Use reserved domains** for consistent URLs (paid feature)

4. **Monitor tunnel usage** via ngrok dashboard

### Session Security
- **Secure session configuration** in production:
  ```javascript
  app.use(session({
    secret: process.env.SESSION_SECRET,
    secure: true,  // HTTPS only
    httpOnly: true,
    sameSite: 'strict'
  }));
  ```

## Team Workflow

### Daily Development Setup

#### Individual Developer Setup
1. **Start Express server**:
   ```bash
   cd backend
   npm start
   ```

2. **Start ngrok tunnel**:
   ```bash
   ngrok start map-printing-backend
   ```

3. **Update environment variables**:
   ```bash
   node backend/scripts/capture-ngrok.js
   ```

4. **Restart server with new config**:
   ```bash
   # Stop server (Ctrl+C) and restart
   npm start
   ```

#### Sharing Tunnels for Testing

**For team collaboration**:
1. **Share your ngrok URL** with team members
2. **Temporary access**: Others can test your local development
3. **Coordinate Strava app settings**: Only one developer can have active OAuth callbacks

**Best practices**:
- **Use reserved domains** (paid) for consistent URLs
- **Document current active tunnel** in team chat
- **Coordinate Strava app updates** to avoid conflicts

### Testing Workflow

#### End-to-End Testing
1. **Start complete stack**:
   ```bash
   # Terminal 1: Express server
   cd backend && npm start
   
   # Terminal 2: ngrok tunnel
   ngrok start map-printing-backend
   
   # Terminal 3: Update environment
   node backend/scripts/capture-ngrok.js
   ```

2. **Test authentication flow**:
   - Visit: `https://your-ngrok-url.ngrok-free.app/auth/strava`
   - Complete Strava OAuth
   - Verify session: `https://your-ngrok-url.ngrok-free.app/auth/status`

3. **Test Shopify integration**:
   - Access Shopify store admin or storefront
   - Test API calls to ngrok backend
   - Verify CORS configuration

#### Integration Testing
- **Strava API**: Test activity fetching and authentication
- **Mapbox integration**: Test map rendering and export
- **Shopify communication**: Test cart integration and product customization

## Automation Tools

### Automated ngrok URL Capture

The project includes `backend/scripts/capture-ngrok.js` for automatic environment updates:

#### Features
- **Automatic URL detection** from ngrok API
- **Environment file updates** (.env)
- **CORS configuration** updates
- **Strava redirect URI** updates
- **Retry logic** with error handling

#### Usage
```bash
# Run manually
node backend/scripts/capture-ngrok.js

# Sample output:
# 🚀 Starting ngrok URL capture...
# ✅ Found ngrok tunnel: https://boss-hog-freely.ngrok-free.app
# ✅ Updated .env file:
#    NGROK_URL: (not set) → https://boss-hog-freely.ngrok-free.app
#    STRAVA_REDIRECT_URI: https://boss-hog-freely.ngrok-free.app/auth/strava/callback
#    ALLOWED_ORIGINS: Added https://boss-hog-freely.ngrok-free.app
# ✅ ngrok URL capture completed successfully!
```

#### Integration with Development Workflow
```bash
# Add to package.json scripts
{
  "scripts": {
    "dev": "npm start",
    "tunnel": "ngrok start map-printing-backend",
    "update-ngrok": "node scripts/capture-ngrok.js",
    "dev-full": "npm run tunnel & npm run update-ngrok && npm run dev"
  }
}
```

### Automated Setup Script (Optional Enhancement)

Consider creating a complete setup script:

```bash
#!/bin/bash
# setup-dev.sh

echo "🚀 Starting Print My Ride development environment..."

# Start ngrok in background
echo "📡 Starting ngrok tunnel..."
ngrok start map-printing-backend &
NGROK_PID=$!

# Wait for ngrok to initialize
sleep 5

# Update environment variables
echo "🔧 Updating environment variables..."
node scripts/capture-ngrok.js

# Start Express server
echo "🖥️  Starting Express server..."
npm start

# Cleanup on exit
trap "kill $NGROK_PID" EXIT
```

## Troubleshooting Checklist

When encountering issues, work through this checklist:

### ✅ Basic Connectivity
- [ ] Express server running on port 3000
- [ ] ngrok tunnel active and accessible
- [ ] ngrok inspector available at localhost:4040
- [ ] Environment variables updated with current ngrok URL

### ✅ Authentication Flow
- [ ] Strava API credentials configured
- [ ] Strava app callback URL matches ngrok URL
- [ ] Environment variables include correct STRAVA_REDIRECT_URI
- [ ] Session configuration allows cross-domain cookies

### ✅ CORS Configuration
- [ ] ALLOWED_ORIGINS includes ngrok URL
- [ ] ALLOWED_ORIGINS includes Shopify store URL
- [ ] Express CORS middleware properly configured
- [ ] No browser console CORS errors

### ✅ Network Issues
- [ ] Firewall allows ngrok connections
- [ ] VPN not interfering with tunnel
- [ ] Internet connection stable
- [ ] ngrok service status operational

### ✅ Development Environment
- [ ] Node.js version compatible
- [ ] All npm dependencies installed
- [ ] Environment file exists and readable
- [ ] File permissions correct for scripts

## Getting Help

### Resources
- **ngrok Documentation**: [https://ngrok.com/docs](https://ngrok.com/docs)
- **Strava API Documentation**: [https://developers.strava.com](https://developers.strava.com)
- **Project Documentation**: `DEVELOPMENT.md`, `SETUP.md`

### Team Support
- **Check team chat** for current active tunnels
- **Review git commits** for recent environment changes
- **Ask for pair debugging** with more experienced team members

### External Support
- **ngrok Support**: Available for paid accounts
- **Strava Developer Forum**: Community support for API issues
- **GitHub Issues**: For project-specific problems

---

*This documentation should be updated whenever significant changes are made to the ngrok configuration or development workflow.*