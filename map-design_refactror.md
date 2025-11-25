
📊 Current State Analysis

File Overview
Location: shopify-theme/dawn/assets/map-design.js
Size: 3,857 lines
Role: Main orchestrator for 3-step map design workflow
Backend Integration: Communicates with /api/maps/generate endpoint
Current Responsibilities (Too Many!)
Constructor & Initialization - Map setup and configuration
Step Management - 3-step workflow control (style, preview, export)
Style Management - Color schemes, themes, map styles
Preview Generation - Preview creation and display
Export & Purchase - High-resolution export and Shopify flow
State Management - Design configuration persistence
Backend Integration - API communication
Event Handling - All UI event listeners
Validation - Configuration validation
Error Handling - Error management and display
Key Problems Identified
Single Responsibility Violation: One file doing 10+ distinct jobs
Testability: Impossible to unit test individual features
Maintainability: Changes in one area risk breaking others
Code Reusability: Logic locked in monolithic structure
Performance: Entire file loaded even if only using partial features
Collaboration: Multiple developers can't work on different features simultaneously
🎯 Proposed New Architecture

Module Structure Overview

map-design/
├── core/
│   ├── MapDesignController.js         (200-250 lines) - Main orchestrator
│   ├── MapDesignConfig.js             (150-200 lines) - Configuration management
│   └── MapDesignState.js              (200-250 lines) - State management
├── workflow/
│   ├── StepManager.js                 (250-300 lines) - Step navigation
│   ├── StepValidator.js               (150-200 lines) - Step validation
│   └── WorkflowEventBus.js            (100-150 lines) - Event coordination
├── style/
│   ├── StyleManager.js                (300-350 lines) - Style orchestration
│   ├── ColorSchemeHandler.js          (200-250 lines) - Color management
│   ├── ThemeApplicator.js             (200-250 lines) - Theme application
│   └── TextOverlayManager.js          (150-200 lines) - Title/subtitle handling
├── preview/
│   ├── PreviewGenerator.js            (250-300 lines) - Preview creation
│   ├── PreviewRenderer.js             (200-250 lines) - Preview display
│   └── PreviewErrorHandler.js         (150-200 lines) - Preview error handling
├── export/
│   ├── ExportManager.js               (250-300 lines) - Export orchestration
│   ├── ExportConfigBuilder.js         (150-200 lines) - Export configuration
│   └── PurchaseFlowHandler.js         (200-250 lines) - Shopify integration
├── ui/
│   ├── UIEventManager.js              (300-350 lines) - All event listeners
│   ├── UIStateRenderer.js             (200-250 lines) - UI updates
│   └── LoadingStateManager.js         (100-150 lines) - Loading indicators
├── api/
│   ├── MapAPIClient.js                (250-300 lines) - Backend communication
│   └── APIErrorHandler.js             (150-200 lines) - API error handling
└── utils/
   ├── MapDesignValidator.js          (200-250 lines) - Validation logic
   └── MapDesignHelpers.js            (150-200 lines) - Utility functions

Total: ~16 files, averaging 200-250 lines each
📝 Detailed Module Breakdown

1. Core Modules
MapDesignController.js (Main Orchestrator)

Purpose: Lightweight coordinator that initializes and connects all modules

Responsibilities:

Initialize all sub-modules
Provide public API for external consumption
Coordinate communication between modules
Handle high-level lifecycle events
Key Methods:

javascript


// Constructor & Initialization
constructor(options)
init()
destroy()

// Module Access
getStyleManager()
getPreviewGenerator()
getExportManager()
getStepManager()

// High-level Actions
start()
reset()
getCurrentConfiguration()
Dependencies:

All other modules (as composition)
mapbox-integration.js
MapDesignConfig.js
MapDesignState.js
MapDesignConfig.js (Configuration Management)

Purpose: Centralized configuration loading and validation

Responsibilities:

Load initial configuration options
Validate configuration parameters
Provide configuration getters
Handle configuration updates
Merge default and custom configs
Key Methods:

javascript


constructor(options)
loadConfig()
validateConfig()
getConfig()
updateConfig(updates)
resetToDefaults()
getDefaultConfig()
Configuration Structure:

javascript


{
 containerId: string,
 mapboxToken: string,
 backendApiUrl: string,
 stepConfig: { ... },
 styleConfig: { ... },
 exportConfig: { ... },
 uiConfig: { ... }
}
Dependencies:

None (pure configuration)
MapDesignState.js (State Management)

Purpose: Centralized state management with pub/sub pattern

Responsibilities:

Maintain current application state
Provide state getters and setters
Emit state change events
Persist state to session/local storage
Handle state validation
Key State Properties:

javascript


{
 currentStep: string,           // 'style' | 'preview' | 'export'
 activityData: object,          // Strava activity data
 styleSettings: object,         // Color schemes, themes, etc.
 mapSettings: object,           // Map type, route thickness, etc.
 textOverlays: object,          // Titles, subtitles
 previewData: object,           // Preview ID, URL, status
 exportSettings: object,        // Format, size, DPI
 validationErrors: array,       // Current validation errors
 isLoading: boolean,            // Loading state
 error: object | null           // Error state
}
Key Methods:

javascript


constructor()
getState()
setState(updates)
resetState()
subscribe(callback)
unsubscribe(callback)
persistState()
restoreState()
validateState()
Events Emitted:

state:changed - Any state change
state:step-changed - Step navigation
state:style-updated - Style changes
state:preview-ready - Preview generated
state:error - Error occurred
Dependencies:

MapDesignValidator.js
2. Workflow Modules
StepManager.js (Step Navigation)

Purpose: Manage 3-step workflow navigation and progression

Responsibilities:

Handle step transitions (next, previous, jump)
Validate step completion requirements
Update step indicators
Emit step change events
Prevent invalid step transitions
Key Methods:

javascript


constructor(stateManager, validator)
init()
showStep(stepName)
nextStep()
prevStep()
canProceedToNext()
canGoToPrevious()
getCurrentStep()
updateStepIndicators()
validateCurrentStep()
Step Definitions:

javascript


{
 STEPS: {
   STYLE: {
     name: 'style',
     order: 1,
     requiredFields: ['mapStyle', 'colorScheme'],
     nextStep: 'preview'
   },
   PREVIEW: {
     name: 'preview',
     order: 2,
     requiredFields: ['previewData'],
     nextStep: 'export'
   },
   EXPORT: {
     name: 'export',
     order: 3,
     requiredFields: ['exportFormat', 'exportSize'],
     nextStep: null
   }
 }
}
Dependencies:

MapDesignState.js
StepValidator.js
WorkflowEventBus.js
StepValidator.js (Step Validation)

Purpose: Validate step completion and requirements

Responsibilities:

Validate each step's required fields
Check data completeness
Validate data formats
Return validation errors
Suggest fixes for validation failures
Key Methods:

javascript


constructor()
validateStep(stepName, state)
validateStyleStep(state)
validatePreviewStep(state)
validateExportStep(state)
getValidationRules(stepName)
formatValidationErrors(errors)
Validation Rules:

javascript


{
 style: {
   mapStyle: { required: true, type: 'string', enum: [...] },
   colorScheme: { required: true, type: 'object' },
   routeThickness: { required: true, type: 'number', min: 1, max: 10 }
 },
 preview: {
   previewData: { required: true, type: 'object' },
   'previewData.id': { required: true, type: 'string' }
 },
 export: {
   exportFormat: { required: true, enum: ['A3', 'A4'] },
   exportSize: { required: true, type: 'object' }
 }
}
Dependencies:

MapDesignValidator.js (shared validation utilities)
WorkflowEventBus.js (Event Coordination)

Purpose: Centralized event bus for workflow coordination

Responsibilities:

Coordinate events between workflow modules
Provide event subscription interface
Handle event queuing and ordering
Debug event flow
Key Methods:

javascript


constructor()
emit(eventName, data)
on(eventName, callback)
off(eventName, callback)
once(eventName, callback)
clearAll()
getEventHistory() // For debugging
Events:

javascript


{
 'workflow:step-changed': { from: string, to: string },
 'workflow:step-validated': { step: string, valid: boolean },
 'workflow:completed': { configuration: object },
 'workflow:reset': {}
}
Dependencies:

None (pure event bus)
3. Style Modules
StyleManager.js (Style Orchestration)

Purpose: Coordinate all style-related operations

Responsibilities:

Initialize style controls
Coordinate color, theme, and overlay changes
Apply combined styles to map
Emit style change events
Validate style combinations
Key Methods:

javascript


constructor(stateManager, mapboxIntegration)
init()
initializeStyleControls()
applyColorScheme(scheme)
applyTheme(theme)
updateMapStyle(style)
updateRouteThickness(thickness)
getCurrentStyle()
resetStyles()
Dependencies:

MapDesignState.js
ColorSchemeHandler.js
ThemeApplicator.js
TextOverlayManager.js
mapbox-integration.js
ColorSchemeHandler.js (Color Management)

Purpose: Handle color scheme selection and application

Responsibilities:

Load available color schemes
Apply color schemes to map layers
Generate color variations
Preview color schemes
Validate color combinations
Key Methods:

javascript


constructor(mapboxIntegration)
loadColorSchemes()
applyColorScheme(schemeId)
getColorScheme(schemeId)
getAllColorSchemes()
previewColorScheme(schemeId)
validateColorScheme(scheme)
Color Scheme Structure:

javascript


{
 id: string,
 name: string,
 colors: {
   background: string,
   route: string,
   routeOutline: string,
   text: string,
   markers: string,
   accent: string
 },
 preview: string // Base64 or URL
}
Dependencies:

mapbox-integration.js
MapDesignState.js
ThemeApplicator.js (Theme Application)

Purpose: Apply complete themes to maps

Responsibilities:

Load theme definitions
Apply themes (includes colors + map style + layout)
Handle theme transitions
Manage theme customization
Save custom themes
Key Methods:

javascript


constructor(styleManager, colorSchemeHandler)
loadThemes()
applyTheme(themeId)
getTheme(themeId)
getAllThemes()
createCustomTheme(baseTheme, customizations)
saveCustomTheme(theme)
deleteCustomTheme(themeId)
Theme Structure:

javascript


{
 id: string,
 name: string,
 baseMapStyle: string,
 colorScheme: object,
 routeStyle: object,
 textOverlays: object,
 layout: object
}
Dependencies:

ColorSchemeHandler.js
StyleManager.js
MapDesignState.js
TextOverlayManager.js (Title/Subtitle Handling)

Purpose: Manage text overlays on maps

Responsibilities:

Add/remove/update titles and subtitles
Position text overlays
Style text (font, size, color)
Validate text content
Preview text overlays
Key Methods:

javascript


constructor(mapboxIntegration)
addTitle(text, options)
updateTitle(text, options)
removeTitle()
addSubtitle(text, options)
updateSubtitle(text, options)
removeSubtitle()
positionOverlay(overlayId, position)
styleOverlay(overlayId, styles)
getAllOverlays()
Text Overlay Structure:

javascript


{
 id: string,
 type: 'title' | 'subtitle',
 text: string,
 position: { x: number, y: number },
 style: {
   fontFamily: string,
   fontSize: number,
   color: string,
   alignment: string,
   shadow: boolean
 }
}
Dependencies:

mapbox-integration.js
MapDesignState.js
4. Preview Modules
PreviewGenerator.js (Preview Creation)

Purpose: Generate map previews via backend API

Responsibilities:

Build preview request payload
Call backend preview API
Handle preview generation progress
Store preview data
Retry on failure
Key Methods:

javascript


constructor(apiClient, stateManager)
generatePreview()
buildPreviewPayload()
handlePreviewResponse(response)
handlePreviewProgress(progress)
cancelPreviewGeneration()
retryPreviewGeneration()
Preview Flow:



1. Collect current state (style, activity, settings)
2. Build API payload
3. POST to /api/maps/generate
4. Handle progress updates via WebSocket
5. Store preview data (ID, URL) in state
6. Emit preview-ready event
Dependencies:

MapAPIClient.js
MapDesignState.js
PreviewErrorHandler.js
PreviewRenderer.js (Preview Display)

Purpose: Display generated previews in UI

Responsibilities:

Render preview images
Handle zoom/pan on preview
Show preview metadata
Handle preview loading states
Manage preview cache
Key Methods:

javascript


constructor(stateManager)
displayPreview(previewData)
renderPreviewImage(imageUrl)
showPreviewMetadata(metadata)
enableZoom()
disableZoom()
clearPreview()
cachePreview(previewData)
Dependencies:

MapDesignState.js
LoadingStateManager.js
PreviewErrorHandler.js (Preview Error Handling)

Purpose: Handle preview generation errors

Responsibilities:

Categorize preview errors
Display user-friendly error messages
Suggest recovery actions
Log errors for debugging
Retry logic coordination
Key Methods:

javascript


constructor()
handlePreviewError(error)
categorizeError(error)
getErrorMessage(errorType)
getRecoveryActions(errorType)
logError(error)
shouldRetry(error)
Error Categories:

javascript


{
 NETWORK_ERROR: 'Network connectivity issue',
 VALIDATION_ERROR: 'Invalid map configuration',
 RENDER_ERROR: 'Map rendering failed',
 TIMEOUT_ERROR: 'Preview generation timed out',
 SERVER_ERROR: 'Backend service error'
}
Dependencies:

APIErrorHandler.js
5. Export Modules
ExportManager.js (Export Orchestration)

Purpose: Coordinate high-resolution map export

Responsibilities:

Initiate export process
Coordinate with backend
Handle export progress
Download final files
Manage export history
Key Methods:

javascript


constructor(apiClient, stateManager)
handleExport()
initiateExport()
buildExportPayload()
handleExportProgress(progress)
downloadExportedMap(downloadUrl)
cancelExport()
getExportHistory()
Export Flow:



1. Validate export settings (format, size, DPI)
2. Build export payload from state
3. POST to /api/maps/export
4. Handle progress (0-100%)
5. Receive download URL
6. Trigger browser download
7. Store export record
Dependencies:

MapAPIClient.js
ExportConfigBuilder.js
MapDesignState.js
ExportConfigBuilder.js (Export Configuration)

Purpose: Build export configuration from state

Responsibilities:

Validate export settings
Calculate print dimensions
Build API payload
Handle format-specific requirements
Generate configuration summary
Key Methods:

javascript


constructor()
buildExportConfig(state)
validateExportConfig(config)
calculatePrintDimensions(format, orientation)
getFormatRequirements(format)
getConfigurationSummary(config)
Export Configuration Structure:

javascript


{
 format: 'A3' | 'A4',
 orientation: 'portrait' | 'landscape',
 dpi: 300,
 dimensions: { width: number, height: number },
 style: object,
 routeData: object,
 textOverlays: array,
 quality: 'high'
}
Dependencies:

MapDesignValidator.js
PurchaseFlowHandler.js (Shopify Integration)

Purpose: Handle transition to Shopify purchase flow

Responsibilities:

Save configuration for order fulfillment
Add product to Shopify cart
Pass configuration to checkout
Handle variant selection
Track purchase initiation
Key Methods:

javascript


constructor(stateManager)
proceedToPurchase()
saveConfigurationForOrder()
addToCart(variant, configuration)
buildCheckoutPayload()
redirectToCheckout()
trackPurchaseEvent()
Purchase Flow:



1. Save complete configuration with preview ID
2. Determine product variant (A3/A4, portrait/landscape)
3. Build Shopify cart payload with configuration metadata
4. Add to cart via Shopify API
5. Redirect to checkout
6. Backend webhook handles order fulfillment
Dependencies:

MapDesignState.js
Shopify Ajax API
6. UI Modules
UIEventManager.js (Event Listeners)

Purpose: Centralize all DOM event binding

Responsibilities:

Bind all UI event listeners
Delegate events to appropriate modules
Handle keyboard shortcuts
Manage touch events
Clean up listeners on destroy
Key Methods:

javascript


constructor(controller, stateManager)
init()
setupEventListeners()
bindStepNavigation()
bindStyleControls()
bindPreviewControls()
bindExportControls()
handleKeyboardShortcuts(event)
destroy()
Event Mapping:

javascript


{
 // Step navigation
 '#next-step-btn': 'click' -> stepManager.nextStep(),
 '#prev-step-btn': 'click' -> stepManager.prevStep(),
 
 // Style controls
 '#color-scheme-select': 'change' -> styleManager.applyColorScheme(),
 '#map-style-select': 'change' -> styleManager.updateMapStyle(),
 
 // Preview controls
 '#generate-preview-btn': 'click' -> previewGenerator.generatePreview(),
 
 // Export controls
 '#export-btn': 'click' -> exportManager.handleExport(),
 '#purchase-btn': 'click' -> purchaseFlowHandler.proceedToPurchase()
}
Dependencies:

All feature modules (via controller)
MapDesignState.js
UIStateRenderer.js (UI Updates)

Purpose: Update UI based on state changes

Responsibilities:

Subscribe to state changes
Update UI elements
Show/hide sections
Enable/disable controls
Update progress indicators
Key Methods:

javascript


constructor(stateManager)
init()
onStateChange(state)
updateStepIndicators(currentStep)
updateStyleControls(styleSettings)
updatePreviewSection(previewData)
updateExportSection(exportSettings)
enableControls(controlIds)
disableControls(controlIds)
UI Update Mapping:

javascript


{
 'state:step-changed': updateStepIndicators(),
 'state:style-updated': updateStyleControls(),
 'state:preview-ready': updatePreviewSection(),
 'state:loading-started': showLoadingState(),
 'state:loading-finished': hideLoadingState(),
 'state:error': showErrorState()
}
Dependencies:

MapDesignState.js
LoadingStateManager.js
LoadingStateManager.js (Loading Indicators)

Purpose: Manage loading states and spinners

Responsibilities:

Show/hide loading indicators
Update loading messages
Show progress bars
Handle timeout warnings
Display operation status
Key Methods:

javascript


constructor()
showLoading(message)
hideLoading()
updateProgress(percent, message)
showTimeout Warning(timeRemaining)
setLoadingState(elementId, isLoading)
Loading States:

javascript


{
 INITIALIZING: 'Initializing map designer...',
 LOADING_ACTIVITY: 'Loading activity data...',
 GENERATING_PREVIEW: 'Generating preview...',
 EXPORTING: 'Generating high-resolution map...',
 SAVING: 'Saving configuration...'
}
Dependencies:

None (pure UI management)
7. API Modules
MapAPIClient.js (Backend Communication)

Purpose: Handle all backend API communication

Responsibilities:

Make authenticated API requests
Handle request/response transformation
Manage API rate limiting
Handle timeout and retries
WebSocket for progress updates
Key Methods:

javascript


constructor(config)
generateMap(payload)
generatePreview(payload)
exportMap(payload)
uploadRoute(file)
getMapStatus(mapId)
downloadMap(mapId)
setupProgressWebSocket(mapId, callback)
API Endpoints:

javascript


{
 generateMap: 'POST /api/maps/generate',
 getPreview: 'GET /api/maps/preview/:id',
 exportMap: 'POST /api/maps/export',
 uploadRoute: 'POST /api/maps/upload',
 downloadMap: 'GET /api/maps/download/:id'
}
Dependencies:

APIErrorHandler.js
auth-utils.js (for session token)
APIErrorHandler.js (API Error Handling)

Purpose: Handle API errors consistently

Responsibilities:

Parse API error responses
Categorize error types
Retry failed requests
Provide user-friendly messages
Log errors for debugging
Key Methods:

javascript


constructor()
handleAPIError(error, endpoint)
parseErrorResponse(response)
categorizeError(error)
shouldRetry(error)
getRetryDelay(attemptNumber)
getUserMessage(error)
logAPIError(error)
Error Categories:

javascript


{
 NETWORK_ERROR: { retryable: true, userMessage: '...' },
 AUTHENTICATION_ERROR: { retryable: false, userMessage: '...' },
 VALIDATION_ERROR: { retryable: false, userMessage: '...' },
 RATE_LIMIT_ERROR: { retryable: true, userMessage: '...' },
 SERVER_ERROR: { retryable: true, userMessage: '...' },
 TIMEOUT_ERROR: { retryable: true, userMessage: '...' }
}
Dependencies:

error-manager.js
8. Utility Modules
MapDesignValidator.js (Validation Logic)

Purpose: Reusable validation utilities

Responsibilities:

Validate configuration objects
Check required fields
Validate data types
Validate value ranges
Format validation errors
Key Methods:

javascript


validateConfiguration(config)
validateRequired(value, fieldName)
validateType(value, expectedType, fieldName)
validateEnum(value, allowedValues, fieldName)
validateRange(value, min, max, fieldName)
validateObject(obj, schema)
formatValidationError(field, message)
Dependencies:

None (pure validation logic)
MapDesignHelpers.js (Utility Functions)

Purpose: Shared helper functions

Responsibilities:

DOM manipulation utilities
Data transformation helpers
Format conversion utilities
Deep clone/merge functions
Debounce/throttle utilities
Key Methods:

javascript


deepClone(obj)
deepMerge(target, source)
debounce(func, delay)
throttle(func, limit)
formatFileSize(bytes)
formatDuration(seconds)
getElementOffset(element)
scrollToElement(element)
Dependencies:

None (pure utilities)
🔗 File Dependencies & Integration Points

Files That Will Require Adjustment
1. Liquid Template (sections/map-design.liquid)

Changes Required:

Update <script> tags to load new modular files
Update initialization code to use new MapDesignController
Update HTML structure IDs/classes if needed for new event bindings
Add loading strategy (defer/async) for performance
Before:

liquid


<script src="{{ 'map-design.js' | asset_url }}" defer></script>
<script>
 document.addEventListener('DOMContentLoaded', function() {
   const mapDesign = new MapDesign({
     containerId: 'map-container',
     // ... options
   });
   mapDesign.init();
 });
</script>
After:

liquid


<!-- Core -->
<script src="{{ 'map-design/core/MapDesignController.js' | asset_url }}" defer></script>
<script src="{{ 'map-design/core/MapDesignConfig.js' | asset_url }}" defer></script>
<script src="{{ 'map-design/core/MapDesignState.js' | asset_url }}" defer></script>

<!-- Workflow -->
<script src="{{ 'map-design/workflow/StepManager.js' | asset_url }}" defer></script>
<script src="{{ 'map-design/workflow/StepValidator.js' | asset_url }}" defer></script>
<script src="{{ 'map-design/workflow/WorkflowEventBus.js' | asset_url }}" defer></script>

<!-- ... other modules ... -->

<script>
 document.addEventListener('DOMContentLoaded', function() {
   const controller = new MapDesignController({
     containerId: 'map-container',
     // ... options
   });
   controller.init();
 });
</script>
Alternative: Bundle Approach:

liquid


<!-- Single bundled file created during build -->
<script src="{{ 'map-design-bundle.js' | asset_url }}" defer></script>
<script>
 document.addEventListener('DOMContentLoaded', function() {
   const controller = new MapDesignBundle.MapDesignController({
     containerId: 'map-container',
     // ... options
   });
   controller.init();
 });
</script>
2. Mapbox Integration (assets/mapbox-integration.js)

Changes Required:

Ensure API compatibility with new style modules
Update any direct references to map-design.js
Verify event listeners for style/theme changes
Ensure map instance access methods are stable
Integration Points:

javascript


// StyleManager needs these methods from mapbox-integration:
mapboxIntegration.updateMapStyle(style)
mapboxIntegration.addRouteLayer(routeData)
mapboxIntegration.updateRouteStyle(styleConfig)

// PreviewGenerator needs:
mapboxIntegration.getMapCanvas()
mapboxIntegration.fitMapToRoute()

// ExportManager needs:
mapboxIntegration.exportMap(options)
Potential Issues:

If map-design.js was calling internal methods not exposed in API
Need to ensure all required methods are public
Action Items:

Audit all mapboxIntegration method calls in current map-design.js
Create interface contract document
Add missing methods to mapbox-integration.js public API if needed
3. Strava Integration (assets/strava-integration.js)

Changes Required:

Update activity data format if needed
Ensure activity selection event handling compatible
Verify route data structure matches expectations
Integration Points:

javascript


// MapDesignController needs to receive activity data:
stravaIntegration.on('activity-selected', (activityData) => {
 controller.loadActivity(activityData);
});
Action Items:

Verify activity data structure
Ensure event names are consistent
Add activity validation if needed
4. Backend API Routes (backend/routes/maps.js)

Changes Required:

Verify API request/response formats match new modules
Ensure backward compatibility during transition
Update API documentation
API Contracts to Verify:

Preview Generation:

javascript


// Request
POST /api/maps/generate
{
 activityData: object,
 styleSettings: object,
 mapSettings: object,
 textOverlays: array
}

// Response
{
 previewId: string,
 previewUrl: string,
 status: 'processing' | 'complete' | 'error'
}
Map Export:

javascript


// Request
POST /api/maps/export
{
 previewId: string,
 exportFormat: 'A3' | 'A4',
 orientation: 'portrait' | 'landscape',
 dpi: 300
}

// Response
{
 exportId: string,
 downloadUrl: string,
 fileSize: number,
 expiresAt: string
}
Action Items:

Document API contracts
Add API versioning if needed
Create integration tests
5. CSS Stylesheets (assets/map-design.css)

Changes Required:

May need to update CSS selectors if HTML structure changes
Ensure loading state styles work with new LoadingStateManager
Verify step indicator styles work with new StepManager
Potential Issues:

If JavaScript was dynamically adding classes not in CSS
If CSS selectors are too tightly coupled to old structure
Action Items:

Audit CSS selectors
Create CSS component library
Document CSS class conventions
6. Error Manager (assets/error-manager.js)

Changes Required:

Integrate with new APIErrorHandler and PreviewErrorHandler
Ensure error display methods are compatible
Add any new error types
Integration Points:

javascript


// New error handlers should use existing error-manager:
import { showError, logError } from './error-manager.js';

// APIErrorHandler:
handleAPIError(error) {
 const userMessage = this.getUserMessage(error);
 showError(userMessage);
 logError(error);
}
Action Items:

Ensure consistent error handling patterns
Create error handling documentation
Add error tracking integration
7. Authentication Utilities (assets/auth-utils.js)

Changes Required:

Integrate with MapAPIClient for authenticated requests
Ensure session token handling is consistent
Add token refresh if needed
Integration Points:

javascript


// MapAPIClient needs:
import { getSessionToken, isAuthenticated } from './auth-utils.js';

// Before each API call:
if (!isAuthenticated()) {
 throw new AuthenticationError('User not authenticated');
}

const token = getSessionToken();
// Add to request headers
Action Items:

Audit authentication flows
Add authentication middleware
Test authentication edge cases
8. DPI Manager (assets/dpi-manager.js)

Changes Required:

Integrate with ExportConfigBuilder
Ensure DPI calculations are consistent
Verify print dimension calculations
Integration Points:

javascript


// ExportConfigBuilder needs:
import { calculateDPI, getOptimalDPI } from './dpi-manager.js';

// When building export config:
const dpi = getOptimalDPI(format, printQuality);
const dimensions = calculateDPI(format, dpi);
Action Items:

Verify DPI calculation accuracy
Test with different print formats
Document DPI requirements
9. Canvas Size Manager (assets/canvas-size-manager.js)

Changes Required:

Integrate with ExportConfigBuilder and PreviewRenderer
Ensure canvas sizing is accurate
Verify viewport scaling
Integration Points:

javascript


// Used by ExportConfigBuilder:
import { calculateCanvasSize, getViewportScale } from './canvas-size-manager.js';

// Calculate canvas dimensions for export:
const canvasSize = calculateCanvasSize(format, dpi);
const scale = getViewportScale(canvasSize);
Action Items:

Test canvas sizing accuracy
Verify print output matches preview
Document canvas calculation methods
10. Test Files

Changes Required:

Update test imports to use new modular files
Rewrite tests to test individual modules
Add integration tests for module interactions
Test Strategy:

javascript


// Unit tests for each module:
- test/map-design/core/MapDesignController.test.js
- test/map-design/workflow/StepManager.test.js
- test/map-design/style/StyleManager.test.js
// ... etc

// Integration tests:
- test/map-design/integration/workflow-integration.test.js
- test/map-design/integration/style-preview-integration.test.js
- test/map-design/integration/export-integration.test.js


