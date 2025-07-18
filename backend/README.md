# Map Printing Backend

Backend server for the Shopify Custom Map Printing Platform.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with required environment variables:
   ```
   PORT=3000
   SESSION_SECRET=your-secret-key-here
   STRAVA_CLIENT_ID=your-strava-client-id
   STRAVA_CLIENT_SECRET=your-strava-client-secret
   MAPBOX_ACCESS_TOKEN=your-mapbox-token
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. Start the server:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Directory Structure

- `routes/` - Express route handlers
- `services/` - Business logic and external API integrations
- `middleware/` - Custom middleware functions
- `models/` - Data models (session-based, no database)
- `utils/` - Utility functions
- `config/` - Configuration files
- `tests/` - Test files
- `generated-maps/` - Generated map images (local storage)

## API Endpoints

- `GET /` - Health check
- Additional routes will be added as development progresses

## Dependencies

- Express.js - Web framework
- express-session - Session management
- cors - Cross-origin resource sharing
- dotenv - Environment variable management
- axios - HTTP client for API calls
- puppeteer - Headless browser for high-resolution map generation