/**
 * MapboxCustomization.js - Map Style Management and UI Customization
 * 
 * Handles:
 * - Map style selection and management
 * - Route color and style customization
 * - Annotation and marker tools
 * - Text labeling system
 * - Customization state persistence
 * - UI components for customization controls
 * 
 * Dependencies:
 * - MapboxCore (for map instance and configuration)
 * - MapboxRoutes (for route style updates)
 */

class MapboxCustomization {
  constructor(core, routesModule, integration, options = {}) {
    this.core = core;
    this.routesModule = routesModule;
    this.integration = integration; // MapboxIntegration instance for route preservation
    this.map = null; // Will be set when core is initialized
    this.config = null; // Will be set from core
    
    // Customization state
    this.customizationState = {
      selectedTheme: 'classic', // Currently selected theme (classic, minimal, bubble)
      selectedColor: 'classic', // Currently selected color within theme
      routeColor: '#FF4444',
      routeWidth: 3,
      annotations: [],
      textLabels: [],
      showWaypoints: false,
      elevationProfile: false
    };

    // Undo/redo stack for customizations
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 20;

    // UI components
    this.customizationPanel = null;
    this.colorPicker = null;

    // Default options
    this.options = {
      enableCustomization: true,
      enableUndoRedo: true,
      enableAnnotations: true,
      enableTextLabels: true,
      persistState: true,
      ...options
    };

    // Available customization tools
    this.tools = {
      stylePicker: null,
      colorPicker: null,
      annotationTool: null,
      textTool: null,
      waypointToggle: null
    };

    // Bind methods
    this.initMapCustomization = this.initMapCustomization.bind(this);
    this.setMapStyle = this.setMapStyle.bind(this);
    this.updateRouteStyle = this.updateRouteStyle.bind(this);
    this.saveCustomizationState = this.saveCustomizationState.bind(this);
    this.loadCustomizationState = this.loadCustomizationState.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize customization functionality
   * @param {mapboxgl.Map} map - Map instance
   * @param {Object} config - Map configuration
   */
  init(map, config) {
    this.map = map;
    this.config = config;

    // Load saved customization state
    this.loadCustomizationState();

    console.log('MapboxCustomization: Customization functionality initialized');
    return this;
  }

  /**
   * Initialize map customization interface
   * @param {Object} options - Customization options
   */
  initMapCustomization(options = {}) {
    if (!this.options.enableCustomization) {
      console.log('MapboxCustomization: Customization disabled');
      return;
    }

    // Create customization panel
    this.createCustomizationPanel();

    // Initialize color picker
    this.initializeColorPicker();

    // Initialize annotation tools
    if (this.options.enableAnnotations) {
      this.initializeAnnotationTools();
    }

    // Initialize text labeling
    if (this.options.enableTextLabels) {
      this.initializeTextTools();
    }

    // Apply saved customizations
    this.applyCustomizationState();

    console.log('MapboxCustomization: Customization interface initialized');
  }

  /**
   * Create main customization panel
   */
  createCustomizationPanel() {
    this.customizationPanel = document.createElement('div');
    this.customizationPanel.id = 'mapbox-customization-panel';
    this.customizationPanel.className = 'mapbox-customization-panel';
    
    this.customizationPanel.innerHTML = `
      <div class="customization-header">
        <h3>Customize Map</h3>
        <button class="close-btn" id="customization-close">×</button>
      </div>
      <div class="customization-content">
        <div class="customization-section">
          <h4>Map Style</h4>
          <div id="style-selector"></div>
        </div>
        <div class="customization-section">
          <h4>Route Style</h4>
          <div id="route-customization">
            <div class="control-group">
              <label>Color:</label>
              <div id="color-picker"></div>
            </div>
            <div class="control-group">
              <label>Width:</label>
              <input type="range" id="route-width" min="1" max="10" value="3">
              <span id="route-width-value">3px</span>
            </div>
          </div>
        </div>
        <div class="customization-section">
          <h4>Route Features</h4>
          <div id="route-features">
            <label>
              <input type="checkbox" id="show-waypoints"> Show Waypoints
            </label>
            <label>
              <input type="checkbox" id="elevation-profile"> Elevation Profile
            </label>
          </div>
        </div>
        <div class="customization-section">
          <h4>Annotations</h4>
          <div id="annotation-tools"></div>
        </div>
        <div class="customization-actions">
          <button id="reset-customization" class="btn-secondary">Reset</button>
          <button id="save-customization" class="btn-primary">Save</button>
        </div>
      </div>
    `;

    // Apply styles
    this.customizationPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 80vh;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      overflow-y: auto;
      display: none;
    `;

    document.body.appendChild(this.customizationPanel);

    // Add event listeners
    this.setupCustomizationPanelEvents();

    // Render sub-components
    this.renderStyleSelector('style-selector');
    this.renderColorPicker('color-picker');
    this.renderAnnotationTools('annotation-tools');
  }

  /**
   * Setup event listeners for customization panel
   */
  setupCustomizationPanelEvents() {
    // Close panel
    this.customizationPanel.querySelector('#customization-close').addEventListener('click', () => {
      this.hideCustomizationPanel();
    });

    // Route width slider
    const widthSlider = this.customizationPanel.querySelector('#route-width');
    const widthValue = this.customizationPanel.querySelector('#route-width-value');
    
    widthSlider.addEventListener('input', (e) => {
      const width = parseInt(e.target.value);
      widthValue.textContent = `${width}px`;
      this.updateRouteStyle({ routeWidth: width });
    });

    // Feature toggles
    this.customizationPanel.querySelector('#show-waypoints').addEventListener('change', (e) => {
      this.customizationState.showWaypoints = e.target.checked;
      this.saveToUndoStack('waypoints', { showWaypoints: !e.target.checked });
      this.saveCustomizationState();
    });

    this.customizationPanel.querySelector('#elevation-profile').addEventListener('change', (e) => {
      this.customizationState.elevationProfile = e.target.checked;
      this.saveToUndoStack('elevation', { elevationProfile: !e.target.checked });
      this.saveCustomizationState();
    });

    // Action buttons
    this.customizationPanel.querySelector('#reset-customization').addEventListener('click', () => {
      this.resetCustomization();
    });

    this.customizationPanel.querySelector('#save-customization').addEventListener('click', () => {
      this.saveCustomizationState();
      this.showNotification('Customization saved!', 'success');
    });
  }

  /**
   * Render style selector component with two-tier selection
   * @param {string} containerId - Container element ID
   */
  renderStyleSelector(containerId) {
    const container = this.customizationPanel.querySelector(`#${containerId}`);
    const themeStyles = this.getThemeStyles();

    container.innerHTML = `
      <div class="style-selector-wrapper">
        <div class="map-type-section">
          <h5 class="selector-label">Choose Your Theme</h5>
          <div class="map-type-grid" id="map-theme-selector">
            ${Object.entries(themeStyles).map(([themeKey, themeInfo]) => `
              <button class="map-type-option ${themeKey === this.customizationState.selectedTheme ? 'active' : ''}" 
                      data-theme="${themeKey}">
                <div class="type-icon">
                  ${this.getThemeIcon(themeKey)}
                </div>
                <div class="type-info">
                  <span class="type-name">${themeInfo.name}</span>
                  <span class="type-description">${themeInfo.description}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="map-style-section">
          <h5 class="selector-label">Choose Your Color</h5>
          <div class="map-style-grid" id="map-color-selector">
            ${this.renderThemeColorOptions(this.customizationState.selectedTheme)}
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupStyleSelectorEvents(container);
  }

  /**
   * Render theme color options for selected theme
   * @param {string} selectedTheme - Currently selected theme
   * @returns {string} HTML for color options
   */
  renderThemeColorOptions(selectedTheme) {
    const themeStyles = this.getThemeStyles();
    const themeColors = themeStyles[selectedTheme]?.colors || {};

    return Object.entries(themeColors).map(([colorKey, colorInfo]) => `
      <button class="style-option ${colorKey === this.customizationState.selectedColor ? 'active' : ''}" 
              data-color="${colorKey}">
        <div class="style-preview" style="background-color: ${colorInfo.previewColor || '#ccc'}"></div>
        <span class="style-name">${colorInfo.name}</span>
      </button>
    `).join('');
  }

  /**
   * Render map style options for selected type (backward compatibility)
   * @param {string} selectedType - Currently selected map type
   * @returns {string} HTML for style options
   */
  renderMapStyleOptions(selectedType) {
    return this.renderThemeColorOptions(selectedType);
  }

  /**
   * Get icon SVG for theme
   * @param {string} theme - Theme key
   * @returns {string} SVG icon
   */
  getThemeIcon(theme) {
    const icons = {
      classic: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20,8 L20,20 L4,20 L4,8 L12,2 L20,8 Z M6,18 L18,18 L18,10 L12,5 L6,10 L6,18 Z"/>
        <rect x="8" y="12" width="2" height="4"/>
        <rect x="14" y="12" width="2" height="4"/>
      </svg>`,
      minimal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
      </svg>`,
      bubble: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.7"/>
        <circle cx="16" cy="8" r="2" fill="currentColor" opacity="0.5"/>
        <circle cx="12" cy="16" r="4" fill="currentColor" opacity="0.8"/>
      </svg>`
    };
    return icons[theme] || icons.classic;
  }

  /**
   * Get icon SVG for map type (backward compatibility)
   * @param {string} type - Map type key
   * @returns {string} SVG icon
   */
  getMapTypeIcon(type) {
    return this.getThemeIcon(type);
  }

  /**
   * Setup event listeners for style selector
   * @param {HTMLElement} container - Style selector container
   */
  setupStyleSelectorEvents(container) {
    // Theme selection
    container.querySelectorAll('.map-type-option').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const themeKey = e.currentTarget.dataset.theme || e.currentTarget.dataset.type;
        await this.setTheme(themeKey);
      });
    });

    // Color selection
    container.querySelectorAll('.style-option').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const colorKey = e.currentTarget.dataset.color || e.currentTarget.dataset.style;
        await this.setThemeColor(colorKey);
      });
    });
  }

  /**
   * Set theme and update available colors
   * @param {string} themeKey - Theme key (classic, minimal, bubble)
   */
  async setTheme(themeKey) {
    // Save previous state for undo
    this.saveToUndoStack('theme', { selectedTheme: this.customizationState.selectedTheme });
    
    // Update state
    this.customizationState.selectedTheme = themeKey;
    
    // Update UI - refresh the color selector
    const colorContainer = this.customizationPanel.querySelector('#map-color-selector');
    if (colorContainer) {
      colorContainer.innerHTML = this.renderThemeColorOptions(themeKey);
      
      // Re-attach event listeners for new color options
      colorContainer.querySelectorAll('.style-option').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const colorKey = e.currentTarget.dataset.color;
          await this.setThemeColor(colorKey);
        });
      });
    }
    
    // Update theme selector UI
    const themeContainer = this.customizationPanel.querySelector('#map-theme-selector');
    if (themeContainer) {
      themeContainer.querySelectorAll('.map-type-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeKey);
      });
    }
    
    // Get the first available color for this theme and set it as default
    const themeStyles = this.getThemeStyles();
    const themeColors = themeStyles[themeKey]?.colors || {};
    const firstColorKey = Object.keys(themeColors)[0];
    
    if (firstColorKey && firstColorKey !== this.customizationState.selectedColor) {
      await this.setThemeColor(firstColorKey);
    }
    
    // Save state
    this.saveCustomizationState();
    
    console.log(`MapboxCustomization: Theme changed to ${themeKey}`);
  }

  /**
   * Set theme color and update map style
   * @param {string} colorKey - Color key within current theme
   */
  async setThemeColor(colorKey) {
    // Save previous state for undo
    this.saveToUndoStack('color', { selectedColor: this.customizationState.selectedColor });
    
    // Update state
    this.customizationState.selectedColor = colorKey;
    
    // Get the style URL for this theme and color combination
    const styleUrl = this.getThemeStyleUrl();
    
    if (styleUrl) {
      try {
        console.log(`MapboxCustomization: Setting style to ${this.customizationState.selectedTheme}_${colorKey}`);
        
        // Use the integration's setStyle method which preserves routes
        if (this.integration && this.integration.setStyle) {
          await this.integration.setStyle(styleUrl);
          this.showNotification('Map style updated successfully', 'success');
        } else if (this.core && this.core.setStyle) {
          await this.core.setStyle(styleUrl);
          this.showNotification('Map style updated successfully', 'success');
        } else {
          console.warn('MapboxCustomization: No route preservation available, using direct map.setStyle');
          this.map.setStyle(styleUrl);
          this.showNotification('Map style updated (route may need to be reloaded)', 'warning');
        }
        
        // Update color selector UI
        const colorContainer = this.customizationPanel.querySelector('#map-color-selector');
        if (colorContainer) {
          colorContainer.querySelectorAll('.style-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === colorKey);
          });
        }
        
        // Save state
        this.saveCustomizationState();
        
        console.log(`MapboxCustomization: Color changed to ${colorKey}`);
        
      } catch (error) {
        console.error('MapboxCustomization: Error setting theme color:', error);
        this.showNotification(`Failed to update map style: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Get current theme style URL
   * @returns {string} Style URL for current theme and color
   */
  getThemeStyleUrl() {
    if (this.config && this.config.getThemeStyleUrl) {
      return this.config.getThemeStyleUrl(this.customizationState.selectedTheme, this.customizationState.selectedColor);
    }
    
    // Fallback: get from theme styles
    const themeStyles = this.getThemeStyles();
    const theme = themeStyles[this.customizationState.selectedTheme];
    if (theme && theme.colors[this.customizationState.selectedColor]) {
      return theme.colors[this.customizationState.selectedColor].url;
    }
    
    return null;
  }

  /**
   * Set map type and update available styles (backward compatibility)
   * @param {string} typeKey - Map type key
   */
  async setMapType(typeKey) {
    return await this.setTheme(typeKey);
  }

  /**
   * Render color picker component
   * @param {string} containerId - Container element ID
   */
  renderColorPicker(containerId) {
    const container = this.customizationPanel.querySelector(`#${containerId}`);
    
    // Create color input
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = this.customizationState.routeColor;
    colorInput.className = 'color-input';

    // Create preset colors
    const presetColors = ['#FF4444', '#4444FF', '#44FF44', '#FFFF44', '#FF44FF', '#44FFFF', '#000000', '#FFFFFF'];
    const presetsContainer = document.createElement('div');
    presetsContainer.className = 'color-presets';
    
    presetColors.forEach(color => {
      const preset = document.createElement('button');
      preset.className = 'color-preset';
      preset.style.backgroundColor = color;
      preset.addEventListener('click', () => {
        colorInput.value = color;
        this.updateRouteStyle({ routeColor: color });
      });
      presetsContainer.appendChild(preset);
    });

    container.appendChild(colorInput);
    container.appendChild(presetsContainer);

    // Add event listener
    colorInput.addEventListener('change', (e) => {
      this.updateRouteStyle({ routeColor: e.target.value });
    });

    this.colorPicker = colorInput;
  }

  /**
   * Render annotation tools
   * @param {string} containerId - Container element ID
   */
  renderAnnotationTools(containerId) {
    const container = this.customizationPanel.querySelector(`#${containerId}`);
    
    container.innerHTML = `
      <div class="annotation-buttons">
        <button class="annotation-btn" data-tool="marker">📍 Add Marker</button>
        <button class="annotation-btn" data-tool="text">📝 Add Text</button>
        <button class="annotation-btn" data-tool="clear">🗑️ Clear All</button>
      </div>
      <div class="annotation-list" id="annotation-list">
        <!-- Annotations will be listed here -->
      </div>
    `;

    // Add event listeners
    container.querySelectorAll('.annotation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.handleAnnotationTool(tool);
      });
    });
  }

  /**
   * Initialize color picker functionality
   */
  initializeColorPicker() {
    // Color picker is initialized in renderColorPicker
    console.log('MapboxCustomization: Color picker initialized');
  }

  /**
   * Initialize annotation tools
   */
  initializeAnnotationTools() {
    // Enable click-to-add annotations on map
    this.map.on('click', (e) => {
      if (this.currentTool === 'marker') {
        this.addAnnotationMarker({
          coordinates: [e.lngLat.lng, e.lngLat.lat],
          title: 'Custom Marker',
          description: 'Added via customization'
        });
      }
    });

    console.log('MapboxCustomization: Annotation tools initialized');
  }

  /**
   * Initialize text labeling tools
   */
  initializeTextTools() {
    // Text tools are part of annotation tools
    console.log('MapboxCustomization: Text tools initialized');
  }

  /**
   * Set map style with route preservation (backward compatibility)
   * @param {string} styleId - Style identifier
   */
  async setMapStyle(styleId) {
    console.log(`MapboxCustomization: setMapStyle called with ${styleId} (backward compatibility mode)`);
    
    // For backward compatibility, try to find the style in the new theme structure
    const themeStyles = this.getThemeStyles();
    
    // Look for the style in all themes
    for (const themeKey in themeStyles) {
      for (const colorKey in themeStyles[themeKey].colors) {
        if (colorKey === styleId) {
          console.log(`MapboxCustomization: Found ${styleId} in theme ${themeKey}, setting theme and color`);
          // Update state to match
          this.customizationState.selectedTheme = themeKey;
          this.customizationState.selectedColor = colorKey;
          await this.setThemeColor(colorKey);
          return;
        }
      }
    }
    
    // If not found in themes, treat as a color within current theme
    console.log(`MapboxCustomization: ${styleId} not found in themes, treating as color in current theme`);
    await this.setThemeColor(styleId);
  }

  /**
   * Update style selector UI
   * @param {HTMLElement} container - Style selector container
   * @param {string} selectedStyleId - Selected style ID
   */
  updateStyleSelectorUI(container, selectedStyleId) {
    container.querySelectorAll('.style-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === selectedStyleId);
    });
  }

  /**
   * Update route style with preservation
   * @param {Object} customization - Style customization options
   */
  updateRouteStyle(customization) {
    if (!this.routesModule) {
      console.warn('MapboxCustomization: Routes module not available');
      return;
    }

    try {
      // Save previous state for undo
      if (customization.routeColor) {
        this.saveToUndoStack('routeColor', { routeColor: this.customizationState.routeColor });
        this.customizationState.routeColor = customization.routeColor;
      }

      if (customization.routeWidth) {
        this.saveToUndoStack('routeWidth', { routeWidth: this.customizationState.routeWidth });
        this.customizationState.routeWidth = customization.routeWidth;
      }

      // Capture current route state before making changes
      if (this.integration && this.integration.getCurrentRouteState) {
        const currentState = this.integration.getCurrentRouteState();
        if (currentState && currentState.hasRoute) {
          console.log('MapboxCustomization: Route state captured before style update');
        }
      }

      // Apply to routes module
      this.routesModule.updateRouteStyle(customization);
      
      // Save state
      this.saveCustomizationState();
      
      this.showNotification('Route style updated successfully', 'success');
      console.log('MapboxCustomization: Route style updated', customization);
      
    } catch (error) {
      console.error('MapboxCustomization: Error updating route style:', error);
      this.showNotification('Failed to update route style', 'error');
      
      // Revert state changes if they were made
      if (customization.routeColor && this.undoStack.length > 0) {
        const lastUndo = this.undoStack[this.undoStack.length - 1];
        if (lastUndo.type === 'routeColor') {
          this.customizationState.routeColor = lastUndo.data.routeColor;
        }
      }
      if (customization.routeWidth && this.undoStack.length > 0) {
        const lastUndo = this.undoStack[this.undoStack.length - 1];
        if (lastUndo.type === 'routeWidth') {
          this.customizationState.routeWidth = lastUndo.data.routeWidth;
        }
      }
    }
  }

  /**
   * Handle annotation tool selection
   * @param {string} tool - Tool name
   */
  handleAnnotationTool(tool) {
    switch (tool) {
      case 'marker':
        this.currentTool = 'marker';
        this.showNotification('Click on the map to add a marker', 'info');
        break;
      case 'text':
        this.currentTool = 'text';
        this.showNotification('Click on the map to add text', 'info');
        break;
      case 'clear':
        this.clearAllAnnotations();
        break;
    }
  }

  /**
   * Add annotation marker
   * @param {Object} annotation - Annotation data
   */
  addAnnotationMarker(annotation) {
    const marker = new mapboxgl.Marker()
      .setLngLat(annotation.coordinates)
      .setPopup(new mapboxgl.Popup().setHTML(`
        <strong>${annotation.title}</strong><br>
        ${annotation.description}
      `))
      .addTo(this.map);

    // Store annotation
    const annotationData = {
      id: Date.now().toString(),
      type: 'marker',
      coordinates: annotation.coordinates,
      title: annotation.title,
      description: annotation.description,
      marker: marker
    };

    this.customizationState.annotations.push(annotationData);
    this.saveToUndoStack('addAnnotation', annotationData);
    this.saveCustomizationState();
    
    console.log('MapboxCustomization: Annotation marker added');
  }

  /**
   * Add text label
   * @param {Object} label - Label data
   */
  addTextLabel(label) {
    // Implementation would add text labels to map
    const labelData = {
      id: Date.now().toString(),
      type: 'text',
      coordinates: label.coordinates,
      text: label.text,
      style: label.style || {}
    };

    this.customizationState.textLabels.push(labelData);
    this.saveToUndoStack('addLabel', labelData);
    this.saveCustomizationState();
    
    console.log('MapboxCustomization: Text label added');
  }

  /**
   * Clear all annotations
   */
  clearAllAnnotations() {
    // Remove markers from map
    this.customizationState.annotations.forEach(annotation => {
      if (annotation.marker) {
        annotation.marker.remove();
      }
    });

    // Save for undo
    this.saveToUndoStack('clearAnnotations', {
      annotations: [...this.customizationState.annotations],
      textLabels: [...this.customizationState.textLabels]
    });

    // Clear state
    this.customizationState.annotations = [];
    this.customizationState.textLabels = [];
    
    this.saveCustomizationState();
    this.showNotification('All annotations cleared', 'info');
    
    console.log('MapboxCustomization: All annotations cleared');
  }

  /**
   * Show customization panel
   */
  showCustomizationPanel() {
    if (this.customizationPanel) {
      this.customizationPanel.style.display = 'block';
    }
  }

  /**
   * Hide customization panel
   */
  hideCustomizationPanel() {
    if (this.customizationPanel) {
      this.customizationPanel.style.display = 'none';
    }
  }

  /**
   * Reset all customizations
   */
  resetCustomization() {
    // Save current state for undo
    this.saveToUndoStack('reset', { ...this.customizationState });

    // Reset to defaults
    this.customizationState = {
      mapType: 'street',
      mapStyle: 'grey',
      routeColor: '#FF4444',
      routeWidth: 3,
      annotations: [],
      textLabels: [],
      showWaypoints: false,
      elevationProfile: false
    };

    // Apply reset state
    this.applyCustomizationState();
    this.saveCustomizationState();
    
    this.showNotification('Customization reset to defaults', 'info');
    console.log('MapboxCustomization: Customization reset');
  }

  /**
   * Apply current customization state
   */
  applyCustomizationState() {
    // Apply map style
    this.setMapStyle(this.customizationState.mapStyle);

    // Apply route style
    if (this.routesModule) {
      this.routesModule.updateRouteStyle({
        routeColor: this.customizationState.routeColor,
        routeWidth: this.customizationState.routeWidth
      });
    }

    // Update UI controls
    if (this.colorPicker) {
      this.colorPicker.value = this.customizationState.routeColor;
    }

    console.log('MapboxCustomization: Customization state applied');
  }

  /**
   * Save customization state to storage
   */
  saveCustomizationState() {
    if (!this.options.persistState) return;

    try {
      localStorage.setItem('mapbox-customization-state', JSON.stringify(this.customizationState));
      console.log('MapboxCustomization: State saved to storage');
    } catch (error) {
      console.warn('MapboxCustomization: Could not save state:', error);
    }
  }

  /**
   * Load customization state from storage
   */
  loadCustomizationState() {
    if (!this.options.persistState) return;

    try {
      const saved = localStorage.getItem('mapbox-customization-state');
      if (saved) {
        this.customizationState = { ...this.customizationState, ...JSON.parse(saved) };
        console.log('MapboxCustomization: State loaded from storage');
      }
    } catch (error) {
      console.warn('MapboxCustomization: Could not load state:', error);
    }
  }

  /**
   * Save action to undo stack
   * @param {string} actionType - Type of action
   * @param {Object} actionData - Action data for undo
   */
  saveToUndoStack(actionType, actionData) {
    if (!this.options.enableUndoRedo) return;

    this.undoStack.push({
      type: actionType,
      data: actionData,
      timestamp: Date.now()
    });

    // Limit undo stack size
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }

    // Clear redo stack when new action is performed
    this.redoStack = [];
  }

  /**
   * Get theme styles from config
   * @returns {Object} Theme styles with their associated colors
   */
  getThemeStyles() {
    if (this.config && this.config.getThemeStyles) {
      return this.config.getThemeStyles();
    }
    
    // Fallback theme structure if config not available
    return {
      classic: {
        name: 'Classic',
        description: 'Traditional detailed maps with full street information',
        colors: {
          classic: { name: 'Classic', previewColor: '#f8f8f8' },
          grey: { name: 'Grey', previewColor: '#9ca3af' },
          dark: { name: 'Dark', previewColor: '#374151' },
          blue: { name: 'Blue', previewColor: '#3b82f6' },
          orange: { name: 'Orange', previewColor: '#f97316' },
          pink: { name: 'Pink', previewColor: '#ec4899' }
        }
      },
      minimal: {
        name: 'Minimal',
        description: 'Clean, simplified maps with essential details only',
        colors: {
          dark: { name: 'Dark', previewColor: '#1f2937' },
          pink: { name: 'Pink', previewColor: '#ec4899' },
          grey: { name: 'Grey', previewColor: '#6b7280' },
          sand: { name: 'Sand', previewColor: '#d4b896' },
          sage: { name: 'Sage', previewColor: '#84a584' }
        }
      },
      bubble: {
        name: 'Bubble',
        description: 'Unique bubble-style map design',
        colors: {
          bubble: { name: 'Bubble', previewColor: '#8b5cf6' }
        }
      }
    };
  }

  /**
   * Get organized map types and styles (backward compatibility)
   * @returns {Object} Map types with their associated styles
   */
  getMapTypeStyles() {
    // Convert new theme structure to old format for backward compatibility
    const themes = this.getThemeStyles();
    const mapTypes = {};
    
    for (const themeKey in themes) {
      const theme = themes[themeKey];
      mapTypes[themeKey] = {
        name: theme.name,
        description: theme.description,
        styles: {}
      };
      
      for (const colorKey in theme.colors) {
        const color = theme.colors[colorKey];
        mapTypes[themeKey].styles[colorKey] = {
          name: color.name,
          previewColor: color.previewColor
        };
      }
    }
    
    return mapTypes;
  }

  /**
   * Get default styles if config not available
   * @returns {Object} Default style definitions
   */
  getDefaultStyles() {
    return {
      streets: { name: 'Streets', previewColor: '#f8f8f8' },
      outdoors: { name: 'Outdoors', previewColor: '#e8f5e8' },
      light: { name: 'Light', previewColor: '#f0f0f0' },
      dark: { name: 'Dark', previewColor: '#2c2c2c' },
      satellite: { name: 'Satellite', previewColor: '#4a6741' },
      grey: { name: 'Grey', previewColor: '#808080' }
    };
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   */
  showNotification(message, type = 'info') {
    // Simple notification implementation
    console.log(`MapboxCustomization [${type.toUpperCase()}]: ${message}`);
  }

  /**
   * Get current customization state
   * @returns {Object} Current customization state
   */
  getCustomizationState() {
    return { ...this.customizationState };
  }

  /**
   * Clean up customization functionality
   */
  cleanup() {
    console.log('MapboxCustomization: Starting cleanup...');
    
    // Remove customization panel
    if (this.customizationPanel) {
      this.customizationPanel.remove();
      this.customizationPanel = null;
    }

    // Remove annotations
    this.clearAllAnnotations();
    
    // Reset state
    this.map = null;
    this.config = null;
    this.colorPicker = null;
    this.currentTool = null;
    
    console.log('MapboxCustomization: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxCustomization;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxCustomization; });
} else {
  window.MapboxCustomization = MapboxCustomization;
}