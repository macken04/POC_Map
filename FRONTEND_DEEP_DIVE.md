# Frontend Deep Dive

This document provides a detailed overview of the frontend architecture of the Sportive Prints web application. The frontend is built on the Shopify platform, utilizing the Dawn theme as a base, but with significant customizations to support the core functionality of creating custom maps from Strava activities.

## Technical Architecture

The frontend architecture is a modular system built with vanilla JavaScript, CSS, and Shopify's Liquid templating engine. The core of the application's custom functionality resides in a set of JavaScript modules that manage the Mapbox integration and the user workflow for creating custom maps.

### Core Technologies

*   **Shopify Liquid:** Used for templating and rendering the theme's structure and content.
*   **JavaScript (ES6+):** The primary language for frontend logic, organized into a modular system.
*   **Mapbox GL JS:** The core mapping library used to render and interact with the maps.
*   **CSS3:** Used for styling, with a combination of Shopify's base styles and custom stylesheets for the map and Strava components.

### File Structure Overview

The main frontend files are located in the `shopify-theme/dawn` directory. The key directories are:

*   `assets`: Contains all the custom JavaScript and CSS files.
*   `layout`: Contains the main theme layout file (`theme.liquid`).
*   `sections`: Contains Shopify sections, which are reusable modules of content.
*   `snippets`: Contains smaller reusable pieces of code.
*   `templates`: Contains the main page templates.

## File-by-File Breakdown

This section provides a detailed overview of the most important files in the frontend.

### JavaScript Modules (`assets/`)

The JavaScript code is organized into a set of modules, each responsible for a specific aspect of the map functionality.

*   **`mapbox-integration.js`**: This is the main orchestrator for the Mapbox functionality. It initializes and coordinates all the other Mapbox-related modules. It provides a single entry point for the rest of the application to interact with the map.

*   **`MapboxCore.js`**: This module is responsible for the fundamental setup of the Mapbox map. It handles the initialization of the `mapboxgl.Map` object, including setting the container, initial style, and other core options.

*   **`MapboxControls.js`**: This module manages all the user interface controls for the map, such as zoom buttons, fullscreen toggle, and geolocation.

*   **`MapboxCustomization.js`**: This module handles the logic for customizing the appearance of the map and the route. This includes changing the map style, route color, and route width.

*   **`MapboxExport.js`**: This module provides the functionality to export the map as a high-resolution image. It handles the creation of a temporary, larger map canvas to render the map at a high DPI.

*   **`MapboxPerformance.js`**: This module is responsible for monitoring and optimizing the performance of the map, including FPS tracking and memory management.

*   **`MapboxResponsive.js`**: This module manages the responsive behavior of the map, ensuring it adapts to different screen sizes and orientations.

*   **`MapboxRoutes.js`**: This module is responsible for rendering the Strava activity routes on the map. It takes GeoJSON data and draws the route line, start/end markers, and waypoints.

*   **`strava-integration.js`** and **`strava-activities.js`**: These files handle the communication with the backend's Strava API. They manage the authentication flow and fetch the user's activities.

*   **`map-design.js`**: This is the main script for the map design page. It initializes the `MapboxIntegration` and manages the user's workflow through the different steps of creating a custom map.

*   **`global.js`**: This file contains global helper functions and utilities used across the theme.

### CSS Files (`assets/`)

*   **`base.css`**: The base stylesheet for the Dawn theme. It provides the foundational styles for the entire site.
*   **`map-design.css`**: This file contains all the custom styles for the map design page, including the layout of the sidebar, the map container, and the customization controls.
*   **`strava-activities.css`**: This file styles the Strava activities page, including the activity cards and filter controls.
*   **`strava-pages.css`**: This file contains styles for the Strava-related pages, such as the login page.

### Shopify Liquid Files

*   **`layout/theme.liquid`**: This is the main layout file for the entire theme. It includes the `<head>` section, loads all the necessary CSS and JavaScript files, and defines the overall structure of the pages.

*   **`sections/map-design.liquid`**: This section file defines the HTML structure for the map design page. It includes the map container, the sidebar with the customization controls, and the step-by-step workflow.

*   **`sections/strava-activities.liquid`**: This section defines the layout for the page that displays the user's Strava activities.

*   **`sections/strava-login.liquid`**: This section provides the user interface for the Strava login process.

*   **`templates/page.map-design.json`**: This template file assigns the `map-design` section to a specific page in Shopify.

## Key Frontend Logic

### Map Initialization and Orchestration

The `map-design.js` script is the entry point for the map creation process. It creates an instance of `MapboxIntegration`, which in turn initializes all the other Mapbox modules. This modular approach allows for a clean separation of concerns and makes the code easier to maintain and extend.

### Strava Integration

The `strava-activities.js` script handles the fetching and display of the user's Strava activities. It communicates with the backend to get the activity data and then dynamically creates the activity cards on the page. When a user selects an activity, the data is stored in `localStorage` and the user is redirected to the map design page.

### Map Customization Workflow

The map design page is structured as a step-by-step workflow, allowing the user to customize the map in a structured manner. The `map-design.js` script manages the state of the workflow, showing and hiding the different steps as the user progresses. The `MapboxCustomization.js` module handles the application of the selected styles to the map.

### High-Resolution Export

The `MapboxExport.js` module implements a clever solution for creating high-resolution prints. When the user clicks the export button, it creates a hidden, off-screen map container with dimensions calculated to produce a 300 DPI image at the desired print size. It then copies the current map's style and route data to this new map, waits for it to render, and then captures the canvas as a data URL, which is then downloaded by the user.
