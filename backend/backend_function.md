# Backend Functionality Deep Dive

This document provides a detailed overview of the backend architecture for the map printing platform. It covers the core components, their functionalities, and the relationships between them, serving as a comprehensive guide for developers and agents.

## 1. High-Level Overview

The backend is a Node.js application built with the Express framework. Its primary responsibilities are:

- **User Authentication**: Handling OAuth2 authentication with Strava to access user activity data.
- **Map Generation**: Creating high-resolution, print-quality maps from Strava activity data.
- **Shopify Integration**: Managing the connection with the Shopify store, including handling webhooks for orders.
- **API Services**: Providing a set of APIs for the frontend to interact with, including fetching Strava data, generating map previews, and managing user sessions.

The backend is designed to be modular, with a clear separation of concerns between routes, services, and utilities.

## 2. Core Components

The backend is structured into the following main components:

- **`server.js`**: The main entry point of the application. It initializes the Express server, sets up middleware, and mounts the API routes.
- **`config/`**: Contains the application configuration for different environments (development, production, test).
- **`routes/`**: Defines the API endpoints for the application. Each file in this directory corresponds to a different area of functionality (e.g., `auth.js`, `strava.js`, `maps.js`).
- **`middleware/`**: Contains Express middleware for handling tasks like session security, error handling, and token refreshing.
- **`services/`**: Encapsulates the business logic of the application. Each service is responsible for a specific domain (e.g., `stravaService.js`, `mapService.js`, `tokenManager.js`).
- **`helpers/`**: Contains utility functions that support the main application logic.
- **`utils/`**: Contains more specific utility functions, often for data transformation or validation.

## 3. Service-by-Service Deep Dive

This section provides a detailed analysis of each service, which contains the core business logic of the application.

### 3.1. `tokenManager.js` and `tokenService.js`

**Overview**: These two services work together to manage user authentication tokens securely. `tokenService.js` handles the low-level encryption and decryption of tokens, while `tokenManager.js` provides a higher-level API for storing, retrieving, and managing tokens within the user's session.

#### `tokenService.js`

- **`encryptTokens(tokenData)`**: Encrypts the token data using AES-256-CBC. It generates a deterministic encryption key based on the session secret and environment, ensuring that tokens are encrypted with a consistent key.
- **`decryptTokens(encryptedData)`**: Decrypts the token data. It uses the same deterministic key to ensure that it can decrypt tokens encrypted by `encryptTokens`.

#### `tokenManager.js`

- **`storeTokens(req, tokenData)`**: Securely stores the OAuth tokens in the user's session. It first regenerates the session for security, then encrypts the tokens using `tokenService.encryptTokens` before storing them.
- **`getTokens(req)`**: Retrieves and decrypts the tokens from the user's session. It also validates that the session ID in the decrypted token data matches the current session ID to prevent session hijacking.
- **`isAuthenticated(req)`**: Checks if the user is authenticated by verifying the presence and validity of the tokens in the session.
- **`refreshAccessToken(req)`**: Refreshes an expired access token using the refresh token. It makes a request to the Strava API to get a new access token and then updates the tokens in the session.
- **`requireAuth(options)`**: A middleware factory that returns an Express middleware function to protect routes. It checks for a valid access token in the session and, if the token is expired, it can optionally allow the request to proceed or redirect the user to the login page.

### 3.2. `stravaService.js`

**Overview**: This service is the central point of interaction with the Strava API. It handles all API requests, caching, and data transformation related to Strava data.

- **`stravaApiRequest(url, accessToken)`**: A helper function that makes authenticated requests to the Strava API. It includes rate limiting and error handling.
- **`getAthlete(req)`**: Fetches the authenticated user's profile information from the Strava API. It uses the `cacheManager.js` to cache the response and reduce redundant API calls.
- **`getActivities(req, stravaParams, parsedParams)`**: Fetches a list of the user's activities. It supports pagination and filtering and uses caching to improve performance.
- **`getActivityDetails(req, activityId)`**: Fetches detailed information for a specific activity, including the full polyline needed for map generation.
- **`getActivityStreams(req, activityId, types)`**: Fetches activity streams, which contain detailed GPS and sensor data.
- **`processUploadedRouteFile(fileBuffer, filename, mimetype)`**: Processes uploaded GPX or TCX files. It uses the `gpxTcxParser.js` to parse the file and then standardizes the data for use in the application.

### 3.3. `mapService.js`

**Overview**: This is the core service responsible for generating the high-resolution map images. It uses Puppeteer to launch a headless Chrome browser, renders the map using Mapbox GL JS, and then takes a screenshot of the map.

- **`initialize()`**: Initializes the Puppeteer browser instance. It includes platform-specific optimizations, especially for macOS ARM64, to ensure that the browser launches correctly.
- **`generateMapWithBrowser(mapOptions)`**: The main function for generating a map. It takes a comprehensive set of options, including the route coordinates, map style, dimensions, and DPI. It performs the following steps:
    1.  **Launches a new browser page**: It creates a new page in the headless browser.
    2.  **Calculates dimensions**: It determines the correct dimensions for the map image based on the desired format (e.g., A4, A3) and DPI.
    3.  **Generates HTML**: It generates an HTML document that contains the Mapbox GL JS code to render the map. This HTML is customized with the provided map options.
    4.  **Sets page content**: It loads the generated HTML into the browser page.
    5.  **Waits for the map to load**: It waits for a signal from the page that the map has been fully rendered.
    6.  **Takes a screenshot**: It takes a screenshot of the map element, which is then returned as a buffer.
- **`getPrintDimensions(format, orientation)`**: A helper function that returns the pixel dimensions for a given print format and orientation at 300 DPI.
- **`calculatePosterBounds(...)`**: Calculates the map bounds needed to center the route within the poster, with a specified margin.

### 3.4. `orderMapService.js`

**Overview**: This service is responsible for generating maps from Shopify order data. It is designed to be robust and to work without an active user session, as it is triggered by a webhook from Shopify.

- **`generateMapFromOrder(orderData, lineItem, webhookTopic)`**: The main function of the service. It orchestrates the map generation process for a given order.
- **`extractMapConfiguration(orderData, lineItem)`**: This is a critical function that robustly reconstructs the map configuration from a Shopify order. It uses a multi-tier fallback strategy to ensure the map can be generated even in different scenarios:
    1.  **Primary Method (Configuration ID)**:
        - **How**: Looks for a `Configuration ID` in the line item's custom properties.
        - **Logic**: This ID corresponds to a JSON file saved by the frontend when the user added the map to their cart. The file contains the exact map style, route data, zoom, center, and all other options.
        - **Reliability**: Highest. This is the source of truth.
    2.  **Fallback 1 (Preview ID / Session)**:
        - **How**: If no Configuration ID is found, it looks for a `Preview ID`.
        - **Logic**: This ID is used to find the map configuration that was stored in the user's server-side session.
        - **Reliability**: Medium. This is less reliable because user sessions can expire. It's a safeguard for older or incomplete order data.
    3.  **Fallback 2 (Strava Activity ID)**:
        - **How**: If both above methods fail, it looks for a `Strava Activity ID`.
        - **Logic**: It re-fetches the activity data directly from the Strava API and generates the map using a default style.
        - **Reliability**: Lowest. This method loses all user customizations (zoom, pan, style changes) and serves as a last-resort to fulfill the order with a basic map of the correct route.
- **`generateHighResolutionMap(config)`**: Once the map configuration is obtained, this function calls the `mapService.js` to generate the high-resolution map image.
- **`storeGenerationRecord(...)`**: After the map is generated, this function stores a record of the generation, including the order ID, map file path, and other relevant details.

### 3.5. File Management Services

- **`fileStorageService.js`**: Manages the hierarchical file storage system for generated maps. It provides functions for saving, moving, deleting, and retrieving files and their metadata.
- **`fileCleanupService.js`**: Automatically cleans up old and expired files based on configurable retention policies. This is crucial for managing storage space.
- **`fileMonitoringService.js`**: Tracks file operations, storage usage, and performance metrics. It provides insights and alerts for file storage management.

### 3.6. `canvasProcessor.js`

**Overview**: This service handles the creation of high-resolution images from map data provided by the frontend. While `mapService.js` generates maps from scratch using Puppeteer, `canvasProcessor.js` takes an existing map image (captured from the user's browser) and enhances it to print quality.

-   **`createHighResImage(canvasData, options)`**: The core function. It receives a base64 data URL from the frontend. It uses a server-side canvas implementation to upscale the image, apply sharpening, and overlay text and graphics at a high resolution to avoid pixelation. This ensures that while the map *view* comes from the user, the final *quality* is controlled by the backend.

## 4. Key Workflows

### 4.1. Workflow: High-Resolution Map from Frontend Customization

1.  **User Action**: The user finalizes their map design in the browser and clicks an "Export" or "Download" button.
2.  **Canvas Capture**: The frontend captures the current state of the Mapbox GL canvas, including all user customizations (colors, line styles, etc.), likely as a base64-encoded image data URL.
3.  **API Request**: The frontend sends this data, along with desired output parameters (e.g., DPI, dimensions, format), to the `/api/maps/export-map` endpoint.
4.  **Backend Processing (`canvasProcessor.js`)**: The request is handled by the `maps.js` route, which passes the data to the `canvasProcessor.js` service. This service:
    -   Decodes the base64 data into an image buffer.
    -   Uses a server-side graphics library (like Node-Canvas or Sharp) to create a new, high-resolution canvas.
    -   Draws the received map image onto this canvas.
    -   Overlays any additional server-side elements (e.g., high-quality text, logos, borders) that are not part of the Mapbox canvas.
5.  **File Storage**: The final high-resolution image is saved to a temporary location using `fileStorageService.js`.
6.  **Response**: The backend returns the image file to the user for download or provides a link to it.

### 4.2. Workflow: High-Resolution Map Generation from a Shopify Order

1.  **Webhook Trigger**: Shopify sends a webhook to the `/api/shopify-integration/webhook/order` endpoint when an order is paid.
2.  **Webhook Verification**: The backend verifies the authenticity of the webhook using the HMAC signature.
3.  **Order Processing**: The `shopifyIntegration.js` route handler parses the order data and enqueues a job with the `backgroundJobManager.js`.
4.  **Background Job**: The `backgroundJobManager.js` picks up the job from its persistent queue.
5.  **Configuration Extraction**: The `orderMapService` is called by the job processor. It extracts the map configuration from the order data using its multi-tier fallback strategy.
6.  **Map Generation**: The `orderMapService` calls the `mapService.generateHighResFromPreviewConfig` function with the extracted configuration. The `mapService` then uses Puppeteer to generate the map image.
7.  **File Storage**: The generated map image is saved to the file system using the `fileStorageService.js`.
8.  **Order Update**: The `orderUpdateService.js` is called to update the Shopify order with the map file information, typically by adding a metafield to the order.

## 5. Frontend-Backend Interaction

The frontend and backend communicate via a REST API. The key interactions are:

- **Authentication**: The frontend initiates the authentication flow, and the backend handles the redirects and token exchange with Strava.
- **Data Fetching**: The frontend fetches Strava data (activities, athlete profile) from the backend's `/api/strava` endpoints.
- **Map Preview**: The frontend sends a request to the `/api/maps/preview` endpoint to get a map preview. The backend generates the preview and returns it as an image.
- **Map Export**: The frontend uses the `/api/maps/export-map` endpoint to send a canvas blob of the user-customized map to the backend, which then processes it into a high-resolution image.

## 6. Cross-Cutting Concerns

This section details system-wide functionalities that support the core application logic.

### 6.1. Data Persistence Strategy

The application employs a file-based persistence strategy, avoiding a traditional database to simplify deployment and infrastructure.

- **Session Storage**: User sessions are managed by `express-session` with `session-file-store`. Authenticated user sessions, including encrypted tokens and map preview configurations, are stored as individual JSON files in the `/sessions` directory.
- **Map Configurations**: When a user adds a map to the cart, the frontend serializes the complete map configuration (style, routes, zoom, etc.) and saves it as a JSON file in the `/map-configurations/active` directory. The ID of this configuration is passed to Shopify. This is the primary method for retrieving map details post-purchase.
- **Background Job Queue**: The `backgroundJobManager.js` service maintains a persistent queue for asynchronous map generation. The state of all jobs (pending, processing, completed, failed) is stored in a single JSON file at `/jobs/generation-queue.json`. This ensures that jobs are not lost if the server restarts.

### 6.2. Error Handling and Logging

The system uses a multi-layered approach to error handling and logging to ensure robustness and provide clear diagnostics.

- **OAuth Error Handling**: The `middleware/errorHandler.js` is dedicated to handling errors within the OAuth flow. It categorizes errors (e.g., network error, invalid grant, user denial) and serves user-friendly HTML error pages for browser-based requests or structured JSON for API requests.
- **General Error Handling**: The `services/errorHandlingService.js` provides a sophisticated framework for handling errors in critical operations like image processing. Its key features include:
    - **Error Classification**: Errors are categorized (e.g., `NETWORK_ERROR`, `MEMORY_ERROR`, `CANVAS_PROCESSING_ERROR`) to determine the appropriate response.
    - **Automatic Retries**: For retryable errors, the service automatically re-attempts the failed operation using configurable strategies like exponential or jittered backoff.
    - **Graceful Degradation**: For certain errors (e.g., out of memory), the system can automatically retry with lower-quality settings to salvage the operation.
    - **Circuit Breaker**: To prevent system overload from repeatedly failing operations, the service implements a circuit breaker pattern that temporarily disables a failing operation after a certain threshold of consecutive failures.
- **Logging**: Logging is handled by `morgan` for HTTP requests and `console` statements throughout the application. The log level and format are configurable via environment variables.

### 6.3. Configuration and Environment Variables

Application configuration is centralized in `config/index.js` and driven by environment variables, which are loaded from a `.env` file in the project root.

- **Loading**: `dotenv` loads variables from the `.env` file. The `config/index.js` file reads these variables using `process.env` and structures them into a configuration object.
- **Validation**: A utility `utils/envValidator.js` checks for the presence of critical environment variables on startup to prevent runtime errors due to misconfiguration.
- **Key Variables**: Essential variables include:
    - `NODE_ENV`: The application environment (e.g., `development`, `production`).
    - `PORT`, `HOST`: Server binding configuration.
    - `SESSION_SECRET`: The secret key for signing session ID cookies.
    - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`: Credentials for the Strava API.
    - `MAPBOX_ACCESS_TOKEN`: The token for Mapbox services.
    - `SHOPIFY_API_KEY`, `SHOPIFY_SECRET_KEY`, `SHOPIFY_WEBHOOK_SECRET`: Credentials for Shopify integration.
    - `NGROK_URL`: The public URL for receiving webhooks in a local development environment.

### 6.4. Background Jobs

To avoid blocking user requests and to handle long-running tasks reliably, the application uses a background job system for post-purchase map generation.

- **Service**: `services/backgroundJobManager.js` manages the job lifecycle.
- **Queue**: Jobs are added to a persistent, file-backed queue. This ensures that even if the server restarts, pending map generations will be processed.
- **Processing**: The manager processes jobs one at a time to manage resource consumption (CPU/memory). It retrieves the map configuration, invokes the `mapService` to generate the high-resolution image, and updates the job status.
- **Retries**: The job manager includes a retry mechanism with a configurable maximum number of retries for failed jobs, enhancing the reliability of order fulfillment.

### 6.5. Testing Strategy

The project maintains a comprehensive suite of tests located in the `/tests` directory. The testing strategy focuses on targeted, script-based execution rather than a monolithic test runner.

- **Framework**: The tests are written as plain Node.js scripts, using the built-in `assert` module and other standard libraries. There is no third-party test runner like Jest or Mocha.
- **Execution**: Test suites are defined as scripts in `package.json` (e.g., `test:unit`, `test:integration`, `test:security`). This allows for running specific sets of tests.
    - `npm run test:unit`: Executes unit tests for isolated modules.
    - `npm run test:integration`: Runs tests for interactions between different services.
    - `npm run test:ci`: A composite script that runs a battery of non-interactive tests suitable for a Continuous Integration environment.
- **Philosophy**: This approach keeps the testing dependency-free and gives developers fine-grained control over which tests to run. Each test file is self-contained and can be executed directly with `node`.

This detailed breakdown should provide a comprehensive understanding of the backend's functionality, enabling developers and agents to work with the codebase more effectively.