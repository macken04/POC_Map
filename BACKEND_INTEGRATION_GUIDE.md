# 🚀 Backend Integration Guide for Shopify Strava Pages

**Complete instructions for integrating the backend with the newly created Shopify pages**

---

## 📋 **Integration Overview**

### What We've Built
1. **Shopify Pages**: Two complete pages for Strava login and activity selection
2. **Backend Integration**: JavaScript classes that communicate with your existing API
3. **Full User Flow**: Login → Authentication → Activity Selection → Map Creation

### Current Project Status
- ✅ **Backend Server**: Fully functional with robust authentication
- ✅ **Strava API**: OAuth flow and activity fetching working
- ✅ **Environment**: Configured with persistent ngrok URL
- ✅ **Shopify Pages**: Created and styled, ready for deployment
- 🔄 **Integration**: Ready to test and deploy

---

## 🛠 **Step-by-Step Integration Instructions**

### **Step 1: Verify Environment Configuration**

Your environment has been updated to use the consistent ngrok URL. Verify the configuration:

```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/backend
node tests/config-test.js
```

**Expected Output**: All tests should pass with correct ngrok URL.

### **Step 2: Update Strava OAuth Redirect URI**

**Important**: Update your Strava app configuration with the consistent URL.

1. Go to [Strava Developers](https://developers.strava.com/)
2. Edit your application
3. Update **Authorization Callback Domain** to: `boss-hog-freely.ngrok-free.app`
4. Update **Redirect URI** to: `https://boss-hog-freely.ngrok-free.app/auth/strava/callback`

### **Step 3: Start Your Backend Services**

Start all required services in the correct order:

#### Terminal 1: Start ngrok tunnel
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/backend
npm run tunnel
```
**Expected Output**: 
```
Session Status: online
Forwarding: https://boss-hog-freely.ngrok-free.app -> http://localhost:3000
```

#### Terminal 2: Start backend server
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/backend
npm run dev
```
**Expected Output**:
```
Server running on port 3000 in development mode
Configuration loaded successfully
Health check available at: http://localhost:3000/health
```

#### Terminal 3: Start Shopify theme development
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/shopify-theme/dawn
shopify theme dev --store=print-my-ride-version-5.myshopify.com
```

### **Step 4: Test Backend Connectivity**

Before testing the Shopify pages, verify your backend is accessible:

#### Test 1: Health Check
```bash
curl https://boss-hog-freely.ngrok-free.app/health
```
**Expected**: JSON response with "healthy" status.

#### Test 2: CORS Configuration  
```bash
curl -H "Origin: https://print-my-ride-version-5.myshopify.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://boss-hog-freely.ngrok-free.app/api/shopify-integration/status
```
**Expected**: CORS headers in response.

#### Test 3: Shopify Integration Endpoint
```bash
curl https://boss-hog-freely.ngrok-free.app/api/test-shopify
```
**Expected**: JSON response confirming Shopify integration readiness.

---

## 🌐 **Deploy Pages to Shopify**

### **Option A: Push to Development Theme (Recommended)**
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/shopify-theme/dawn
shopify theme push --theme=183192945024 --store=print-my-ride-version-5.myshopify.com
```

### **Option B: Use Theme Development Mode**
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/shopify-theme/dawn  
shopify theme dev --store=print-my-ride-version-5.myshopify.com
```

---

## 🧪 **Testing the Complete Integration**

### **Test 1: Strava Login Page**

1. **Access the page**:
   ```
   https://print-my-ride-version-5.myshopify.com/pages/strava-login
   ```

2. **Expected Behavior**:
   - Page loads with "Connect Your Strava Account" heading
   - Status automatically checks connection (you'll see spinner)
   - Shows "Ready to Connect" if not authenticated
   - "Connect with Strava" button appears

3. **Test Authentication Flow**:
   - Click "Connect with Strava"
   - Should redirect to Strava OAuth
   - Grant permissions 
   - Should redirect back to Shopify page
   - Should show "Connected Successfully!" 
   - Should display user welcome card
   - "Continue to Activities" button should appear

### **Test 2: Activity Selection Page**

1. **Access the page** (after authentication):
   ```
   https://print-my-ride-version-5.myshopify.com/pages/activity-selector
   ```

2. **Expected Behavior**:
   - Page loads with user info bar at top
   - Shows loading spinner while fetching activities
   - Displays grid of activity cards with:
     - Activity names, dates, types
     - Distance, time, elevation stats
     - Route preview areas
     - "Select for Map" buttons

3. **Test Activity Selection**:
   - Search/filter activities work
   - Click "Select for Map" on any activity
   - Selection confirmation appears at bottom
   - "Create Map Print" button appears

---

## 🔧 **Configuration Details**

### **Backend Endpoints Used**
Your Shopify pages communicate with these existing backend endpoints:

#### Authentication Endpoints:
- `GET /auth/status` - Check authentication status
- `GET /auth/strava` - Initiate Strava OAuth
- `POST /auth/logout` - Logout user

#### Strava API Endpoints:
- `GET /api/strava/athlete` - Get user info
- `GET /api/strava/activities` - List activities
- `GET /api/strava/activities/:id` - Get activity details
- `GET /api/strava/activities/search` - Search activities

#### Shopify Integration Endpoints:
- `GET /api/shopify-integration/status` - Integration status
- `GET /api/shopify-integration/session-context` - Session info
- `GET /api/shopify-integration/health` - Health check

### **CORS Configuration**
Your backend is configured to allow requests from:
- `https://print-my-ride-version-5.myshopify.com` ✅
- `https://admin.shopify.com` ✅ 
- `https://boss-hog-freely.ngrok-free.app` ✅
- `http://localhost:3000` ✅

### **Session Management**
- **Storage**: Server-side sessions with secure cookies
- **Duration**: 24 hours
- **Security**: CSRF protection, secure headers
- **Cross-domain**: Configured for Shopify integration

---

## 🚨 **Troubleshooting Common Issues**

### **Issue 1: "Connection Error" on Strava Login Page**

**Symptoms**: Page shows connection error, can't reach backend
**Solutions**:
```bash
# Check if ngrok tunnel is running
curl https://boss-hog-freely.ngrok-free.app/health

# Restart ngrok if needed
npm run tunnel

# Check backend server is running
npm run dev
```

### **Issue 2: CORS Errors in Browser Console**

**Symptoms**: `Access to fetch at '...' has been blocked by CORS policy`
**Solutions**:
1. Verify CORS origins in `.env` file include your Shopify domain
2. Restart backend server after .env changes
3. Check browser developer tools for specific CORS error details

### **Issue 3: Strava OAuth Redirect Issues**

**Symptoms**: OAuth flow fails, redirect errors
**Solutions**:
1. **Check Strava app configuration**:
   - Authorization Callback Domain: `boss-hog-freely.ngrok-free.app`  
   - Redirect URI: `https://boss-hog-freely.ngrok-free.app/auth/strava/callback`

2. **Verify ngrok URL consistency**:
   ```bash
   # Check .env file
   grep NGROK_URL .env
   
   # Should show: NGROK_URL=https://boss-hog-freely.ngrok-free.app
   ```

### **Issue 4: Activities Not Loading**

**Symptoms**: Activity selector shows loading indefinitely
**Solutions**:
1. **Check Strava API tokens**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://www.strava.com/api/v3/athlete
   ```

2. **Test backend Strava endpoints directly**:
   ```bash
   # Test with browser (after authentication)
   https://boss-hog-freely.ngrok-free.app/api/strava/activities
   ```

3. **Check backend logs** for API errors

### **Issue 5: Shopify Page Not Found**

**Symptoms**: 404 error when accessing `/pages/strava-login`
**Solutions**:
1. **Verify page deployment**:
   ```bash
   shopify theme list --store=print-my-ride-version-5.myshopify.com
   ```

2. **Push pages to theme**:
   ```bash
   shopify theme push --theme=183192945024 --store=print-my-ride-version-5.myshopify.com
   ```

3. **Check template files exist**:
   - `templates/page.strava-login.json`
   - `templates/page.activity-selector.json`
   - `sections/strava-login.liquid`
   - `sections/activity-selector.liquid`

---

## 🎯 **Integration Verification Checklist**

Before considering integration complete, verify these items:

### ✅ **Backend Services**
- [ ] ngrok tunnel running on persistent URL
- [ ] Backend server running and accessible via ngrok
- [ ] Health check endpoint responds successfully
- [ ] CORS configured for Shopify domain
- [ ] Environment variables properly set

### ✅ **Strava Configuration**
- [ ] Strava app redirect URI updated with correct ngrok URL
- [ ] OAuth flow completes successfully
- [ ] User authentication persists in session
- [ ] Activity API calls return data

### ✅ **Shopify Deployment**
- [ ] New page templates pushed to Shopify
- [ ] CSS and JavaScript assets deployed
- [ ] Pages accessible via Shopify URLs
- [ ] No 404 errors or missing resources

### ✅ **Cross-Domain Communication**
- [ ] JavaScript successfully calls backend API
- [ ] No CORS errors in browser console
- [ ] Session cookies work cross-domain
- [ ] Authentication state preserved

### ✅ **User Experience**
- [ ] Login page loads and functions correctly
- [ ] Authentication flow works end-to-end
- [ ] Activities load and display properly
- [ ] Activity selection works as expected
- [ ] Error states display helpful messages

---

## 🚀 **Next Steps After Integration**

Once the integration is complete and tested, your next development priorities should be:

### **Immediate (High Priority)**
1. **Map Customization Page**: Create the third page for map styling and preview
2. **High-Resolution Export**: Implement the 300 DPI map generation
3. **Shopify Product Integration**: Connect selected activities to Shopify cart
4. **Error Handling**: Enhance error messages and recovery flows

### **Short Term (Medium Priority)**  
1. **Activity Filtering**: Advanced search and filtering options
2. **Map Styles**: Multiple map style options (terrain, satellite, etc.)
3. **Preview System**: Real-time map preview with activity overlay
4. **Performance Optimization**: Lazy loading, caching, compression

### **Long Term (Future Features)**
1. **Batch Processing**: Multiple activity map generation
2. **Custom Annotations**: User-added text, markers, routes
3. **Print Templates**: Pre-designed layout options
4. **Social Sharing**: Share maps before purchasing

---

## 📞 **Support Information**

### **Logs and Debugging**
- **Backend Logs**: Check terminal where `npm run dev` is running
- **ngrok Logs**: Available at `http://localhost:4040` when tunnel is active
- **Browser Logs**: Chrome DevTools Console and Network tabs
- **Shopify Logs**: Theme development console output

### **Configuration Files**
- **Environment**: `/Users/davedev/Desktop/dev/map_site_vibe/.env`
- **Backend Config**: `/Users/davedev/Desktop/dev/map_site_vibe/backend/config/`
- **Package Config**: `/Users/davedev/Desktop/dev/map_site_vibe/backend/package.json`

### **Test Commands**
```bash
# Test backend configuration
cd backend && npm run test:config

# Test Strava integration  
cd backend && npm run test:integration

# Test all backend functionality
cd backend && npm test
```

---

**🎉 Congratulations!** Once you complete these steps, you'll have a fully integrated Shopify + Backend system for Strava authentication and activity selection. Your users can now seamlessly log in with Strava and select activities directly from your Shopify store!