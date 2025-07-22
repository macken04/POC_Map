# 📱 Complete Shopify App Setup Guide

**Transform your Strava integration into a professional Shopify App**

---

## 🎯 **Overview: Why Create a Shopify App?**

### **Theme vs App Comparison**

| Feature | Current (Theme) | Shopify App |
|---------|----------------|-------------|
| **User Experience** | Good - custom pages | Excellent - embedded interface |
| **Installation** | Manual theme modification | One-click install from App Store |
| **Updates** | Manual theme updates | Automatic app updates |
| **Security** | Theme-level integration | App-level authentication |
| **Distribution** | Single store only | Multiple stores + App Store |
| **Professional Feel** | Good | Excellent |

### **Recommended Approach: Build Both**
1. **Keep current theme integration** for immediate functionality
2. **Build Shopify App** for professional distribution and better UX

---

## 🛠 **Step 1: Shopify Partner Setup**

### **Create Partner Account**
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Sign up with: `printmyrideie@gmail.com`
3. Complete partner account setup
4. Navigate to "Apps" → "Create App"

### **Create App in Partner Dashboard**
1. **App Name**: "Print My Ride - Strava Maps"
2. **App Type**: "Custom App" (initially) → "Public App" (for App Store)
3. **App URL**: `https://boss-hog-freely.ngrok-free.app`
4. **Allowed redirection URLs**: 
   - `https://boss-hog-freely.ngrok-free.app/auth/shopify/callback`
   - `https://boss-hog-freely.ngrok-free.app/auth/callback`

### **Get App Credentials**
Copy these values for your `.env` file:
- **API Key** (Client ID)
- **API Secret** (Client Secret)
- **Scopes**: `read_products,write_products,read_orders,write_orders`

---

## 🔧 **Step 2: Update Backend for Shopify App**

### **Update Environment Variables**
Add to your `/Users/davedev/Desktop/dev/map_site_vibe/.env`:

```env
# Shopify App Configuration (ADD THESE)
SHOPIFY_API_KEY=your_app_api_key_here
SHOPIFY_API_SECRET=your_app_api_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders
SHOPIFY_APP_URL=https://boss-hog-freely.ngrok-free.app

# Update existing Shopify values
SHOPIFY_STORE_URL=https://print-my-ride-version-5.myshopify.com
```

### **Install Shopify App Dependencies**
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/backend
npm install @shopify/shopify-api @shopify/admin-api-client
```

### **Create Shopify App Routes**
Create `/Users/davedev/Desktop/dev/map_site_vibe/backend/routes/shopifyApp.js`:

```javascript
const express = require('express');
const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
const router = express.Router();

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(','),
  hostName: process.env.SHOPIFY_APP_URL.replace(/https?:\\/\\//g, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

// App installation route
router.get('/install', async (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }

  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: '/auth/shopify/callback',
    isOnline: false,
  });

  res.redirect(authRoute);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;
    
    // Store session for later use
    req.session.shopifySession = session;
    
    // Redirect to app interface
    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
    
  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth callback failed' });
  }
});

// App interface (embedded in Shopify admin)
router.get('/', (req, res) => {
  const { shop, host } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print My Ride - Strava Maps</title>
      <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 1px solid #e1e3e5; padding-bottom: 16px; margin-bottom: 24px; }
        .strava-section { background: white; border-radius: 8px; border: 1px solid #e1e3e5; padding: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚴 Print My Ride - Strava Maps</h1>
          <p>Create custom map prints from Strava activities</p>
        </div>
        
        <div class="strava-section" id="app-content">
          <iframe 
            src="${process.env.SHOPIFY_APP_URL}/app/strava-interface?shop=${shop}&host=${host}"
            width="100%" 
            height="800"
            frameborder="0"
            id="strava-iframe">
          </iframe>
        </div>
      </div>

      <script>
        const AppBridge = window['app-bridge'];
        const createApp = AppBridge.default;
        
        const app = createApp({
          apiKey: '${process.env.SHOPIFY_API_KEY}',
          host: '${host}',
          forceRedirect: true
        });
      </script>
    </body>
    </html>
  `);
});

module.exports = router;
```

### **Create App Interface Route**
Add to `/Users/davedev/Desktop/dev/map_site_vibe/backend/routes/shopifyApp.js`:

```javascript
// Strava interface for app
router.get('/strava-interface', (req, res) => {
  const { shop, host } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Strava Integration</title>
      <link href="${process.env.SHOPIFY_APP_URL}/shopify-theme/dawn/assets/strava-pages.css" rel="stylesheet">
      <script src="${process.env.SHOPIFY_APP_URL}/shopify-theme/dawn/assets/strava-integration.js"></script>
    </head>
    <body>
      <div class="strava-app-container">
        <!-- Embed your existing Strava login/activity selector here -->
        <div id="strava-login-section">
          <!-- Copy content from strava-login.liquid -->
        </div>
        
        <div id="strava-activities-section" style="display: none;">
          <!-- Copy content from activity-selector.liquid -->
        </div>
      </div>
      
      <script>
        // Initialize Strava integration
        const stravaLogin = new StravaLogin();
        const activitySelector = new ActivitySelector();
        
        stravaLogin.init().then(() => {
          if (stravaLogin.state.authenticated) {
            document.getElementById('strava-login-section').style.display = 'none';
            document.getElementById('strava-activities-section').style.display = 'block';
            activitySelector.init();
          }
        });
      </script>
    </body>
    </html>
  `);
});
```

### **Update Main Server**
Add to `/Users/davedev/Desktop/dev/map_site_vibe/backend/server.js`:

```javascript
// Add after existing route imports
const shopifyAppRoutes = require('./routes/shopifyApp');

// Add after existing route mounts
app.use('/app', shopifyAppRoutes);
app.use('/auth/shopify', shopifyAppRoutes);
```

---

## 📦 **Step 3: Create App Directory Structure**

### **Create Shopify App Directory**
```bash
mkdir -p /Users/davedev/Desktop/dev/map_site_vibe/shopify-app
cd /Users/davedev/Desktop/dev/map_site_vibe/shopify-app
```

### **App Configuration File**
Create `/Users/davedev/Desktop/dev/map_site_vibe/shopify-app/shopify.app.toml`:

```toml
# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "print-my-ride-strava-maps"
client_id = "your_app_api_key_here"
application_url = "https://boss-hog-freely.ngrok-free.app"
embedded = true

[access_scopes]
scopes = "read_products,write_products,read_orders,write_orders"

[auth]
redirect_urls = [
  "https://boss-hog-freely.ngrok-free.app/auth/shopify/callback",
  "https://boss-hog-freely.ngrok-free.app/auth/callback"
]

[webhooks]
api_version = "2024-01"

[pos]
embedded = false
```

### **App Block Extensions**
Create `/Users/davedev/Desktop/dev/map_site_vibe/shopify-app/extensions/strava-map-block/shopify.extension.toml`:

```toml
type = "theme_app_extension"
name = "Strava Map Block"

[extension_points]
  [extension_points.theme_app_extension]
    name = "Strava Map Creator"
```

### **App Block Liquid Template**
Create `/Users/davedev/Desktop/dev/map_site_vibe/shopify-app/extensions/strava-map-block/blocks/strava-map.liquid`:

```liquid
<div class="strava-map-app-block" data-app-block="strava-map">
  <div class="app-block-container">
    <h3>{{ block.settings.heading }}</h3>
    
    <div class="strava-embed-container">
      <iframe 
        src="{{ app.api_url }}/app/strava-interface?shop={{ shop.permanent_domain }}&embedded=true"
        width="100%" 
        height="{{ block.settings.height }}"
        frameborder="0"
        loading="lazy">
      </iframe>
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Strava Map Creator",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Create Your Custom Map Print"
    },
    {
      "type": "range",
      "id": "height",
      "label": "Height (px)",
      "min": 400,
      "max": 1000,
      "step": 50,
      "default": 600
    }
  ]
}
{% endschema %}
```

---

## 🚀 **Step 4: Deploy and Test Shopify App**

### **Install Shopify CLI (if not already installed)**
```bash
npm install -g @shopify/cli @shopify/theme
shopify auth login
```

### **Generate App (Alternative: Use CLI)**
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe
shopify app init shopify-app
cd shopify-app
```

### **Deploy App**
```bash
cd /Users/davedev/Desktop/dev/map_site_vibe/shopify-app
shopify app deploy
```

### **Install App on Development Store**
1. **Get installation URL** from CLI output
2. **Install on your store**: `print-my-ride-version-5.myshopify.com`
3. **Grant permissions** when prompted
4. **Access app** from Shopify Admin → Apps

---

## 🧪 **Step 5: Test App Integration**

### **Test App Installation**
1. Go to `https://admin.shopify.com/store/print-my-ride-version-5/apps`
2. Click "Print My Ride - Strava Maps"
3. Should load app interface
4. Test Strava authentication flow
5. Test activity selection

### **Test App Blocks**
1. Go to Shopify Admin → Online Store → Themes
2. Click "Customize" on your theme
3. Add new section
4. Look for "Strava Map Creator" in Apps section
5. Add to page and test functionality

### **Test Product Integration**
```javascript
// Add to your app interface
const createMapProduct = async (activityData) => {
  const response = await fetch('/app/create-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activity: activityData,
      shop: shopDomain
    })
  });
  
  const product = await response.json();
  // Redirect to product page or add to cart
};
```

---

## 📈 **Step 6: Advanced App Features**

### **Product Creation Integration**
Add to your backend routes:

```javascript
// Create Shopify product from selected activity
router.post('/create-product', async (req, res) => {
  const { activity, shop } = req.body;
  
  try {
    const client = new shopify.clients.Rest({ session: req.session.shopifySession });
    
    const product = await client.post({
      path: 'products',
      data: {
        product: {
          title: `Custom Map Print - ${activity.name}`,
          body_html: `<p>Custom map print of your Strava activity "${activity.name}"</p>
                     <p>Distance: ${(activity.distance / 1000).toFixed(1)}km</p>
                     <p>Activity Date: ${new Date(activity.start_date).toLocaleDateString()}</p>`,
          vendor: 'Print My Ride',
          product_type: 'Map Print',
          tags: 'strava,map,custom,cycling',
          variants: [
            {
              title: 'A4 Print',
              price: '29.99',
              inventory_quantity: 100,
              requires_shipping: true
            },
            {
              title: 'A3 Print', 
              price: '39.99',
              inventory_quantity: 100,
              requires_shipping: true
            }
          ],
          metafields: [
            {
              namespace: 'strava',
              key: 'activity_id',
              value: activity.id.toString(),
              type: 'single_line_text_field'
            }
          ]
        }
      }
    });
    
    res.json({ 
      success: true, 
      product: product.body.product,
      redirectUrl: `https://${shop}/products/${product.body.product.handle}`
    });
    
  } catch (error) {
    console.error('Product creation failed:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});
```

### **Webhook Handlers**
Add order processing webhooks:

```javascript
// Handle new orders with Strava maps
router.post('/webhooks/orders/create', express.raw({ type: 'application/json' }), (req, res) => {
  const order = JSON.parse(req.body);
  
  // Process map generation for Strava products
  order.line_items.forEach(async (item) => {
    const stravaActivityId = item.properties?.find(p => p.name === 'strava_activity_id')?.value;
    
    if (stravaActivityId) {
      // Generate high-res map
      await generateMapForOrder(order, item, stravaActivityId);
    }
  });
  
  res.status(200).send('OK');
});
```

---

## 📋 **App vs Theme Comparison Summary**

### **Current Theme Integration**
- ✅ **Quick Setup**: Already working
- ✅ **Direct Access**: `/pages/strava-login` URLs
- ✅ **Full Control**: Complete customization
- ❌ **Manual Installation**: Theme editing required
- ❌ **Single Store**: Can't distribute easily

### **New Shopify App**  
- ✅ **Professional**: App Store quality
- ✅ **Easy Install**: One-click for merchants
- ✅ **Auto Updates**: App updates automatically
- ✅ **Better Security**: App-level authentication
- ✅ **Distribution**: Multiple stores + App Store
- ❌ **More Complex**: Additional development needed
- ❌ **App Review**: App Store approval process

---

## 🎯 **Recommended Development Strategy**

### **Phase 1: Immediate (Keep Current Theme)**
- Your theme integration is working perfectly
- Use it for immediate testing and development
- Perfect for your current single-store needs

### **Phase 2: Build App (2-4 weeks)**
- Create Shopify App alongside theme
- Test app functionality thoroughly
- Prepare for wider distribution

### **Phase 3: Launch Strategy**
- **Private App**: For your store only
- **Public App**: Submit to Shopify App Store
- **Keep Both**: Theme for power users, App for easy adoption

---

## 🆘 **Troubleshooting App Issues**

### **App Not Loading**
```bash
# Check app URL is accessible
curl https://boss-hog-freely.ngrok-free.app/app

# Verify ngrok tunnel
ngrok status

# Check Shopify app credentials
shopify app info
```

### **OAuth Errors**
- Verify redirect URLs match exactly
- Check API key and secret are correct
- Ensure ngrok tunnel is stable

### **Embedded App Issues**
- Test in incognito mode (cookies)
- Check Content Security Policy
- Verify App Bridge implementation

**🎉 With both theme and app integration, you'll have the most flexible and professional Strava mapping solution for Shopify!**