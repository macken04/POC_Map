/**
 * MapboxControls.js - Map Controls and User Interface Management
 * 
 * Handles:
 * - Standard map controls (navigation, fullscreen, scale, geolocation)
 * - Advanced style switcher with presets and customization
 * - Export control with format options
 * - Mobile-optimized control layouts
 * - Keyboard accessibility enhancements
 * - Custom control components
 * 
 * Dependencies:
 * - MapboxCore (for map instance and configuration)
 * - MapboxExport (for export functionality)
 */

class MapboxControls {
  constructor(core, exportModule, options = {}) {
    this.core = core;
    this.exportModule = exportModule;
    this.map = null; // Will be set when core is initialized
    this.config = null; // Will be set from core
    
    // Control instances
    this.controls = {
      navigation: null,
      fullscreen: null,
      scale: null,
      geolocation: null,
      styleSwitcher: null,
      export: null
    };

    // Default options
    this.options = {
      showControls: true,
      enableGeolocation: true,
      enableScale: true,
      enableExport: true,
      mobileOptimized: true,
      controlPositions: {
        navigation: 'top-right',
        fullscreen: 'top-right', 
        geolocation: 'top-right',
        scale: 'bottom-left',
        style: 'top-left',
        export: 'top-right'
      },
      ...options
    };

    // Style management
    this.styleSettings = {};
    this.currentPreset = 'default';

    // Bind methods
    this.addMapControls = this.addMapControls.bind(this);
    this.removeMapControls = this.removeMapControls.bind(this);
    this.addStyleSwitcher = this.addStyleSwitcher.bind(this);
    this.addExportControl = this.addExportControl.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize controls functionality
   * @param {mapboxgl.Map} map - Map instance
   * @param {Object} config - Map configuration
   */
  init(map, config) {
    this.map = map;
    this.config = config;

    // Load saved style settings
    this.loadStyleSettings();

    console.log('MapboxControls: Controls functionality initialized');
    return this;
  }

  /**
   * Add all standard map controls
   */
  addMapControls() {
    if (!this.options.showControls) {
      console.log('MapboxControls: Controls disabled');
      return;
    }

    if (!this.options.controlPositions) {
      console.error('MapboxControls: Control positions not configured');
      return;
    }

    const positions = this.options.controlPositions;

    // Navigation controls (zoom, rotate)
    this.addNavigationControl(positions.navigation);

    // Fullscreen control
    this.addFullscreenControl(positions.fullscreen);

    // Scale control
    if (this.options.enableScale) {
      this.addScaleControl(positions.scale);
    }

    // Geolocation control
    if (this.options.enableGeolocation) {
      this.addGeolocationControl(positions.geolocation);
    }

    // Style switcher control
    this.addStyleSwitcher(positions.style);

    // Export control
    if (this.options.enableExport && this.exportModule) {
      this.addExportControl(positions.export);
    }

    // Enhance keyboard accessibility
    this.enhanceKeyboardAccessibility();

    // Add mobile-specific enhancements
    if (this.options.mobileOptimized) {
      this.addMobileEnhancements();
    }

    console.log('MapboxControls: All controls added successfully');
  }

  /**
   * Add navigation control (zoom, rotate)
   * @param {string} position - Control position
   */
  addNavigationControl(position) {
    const navControl = new mapboxgl.NavigationControl({ 
      showCompass: !this.options.mobileOptimized || this.isDesktop(), 
      showZoom: true,
      visualizePitch: true
    });
    
    this.map.addControl(navControl, position);
    this.controls.navigation = navControl;
    
    console.log('MapboxControls: Navigation control added');
  }

  /**
   * Add fullscreen control
   * @param {string} position - Control position
   */
  addFullscreenControl(position) {
    const fullscreenControl = new mapboxgl.FullscreenControl();
    
    this.map.addControl(fullscreenControl, position);
    this.controls.fullscreen = fullscreenControl;
    
    console.log('MapboxControls: Fullscreen control added');
  }

  /**
   * Add scale control
   * @param {string} position - Control position
   */
  addScaleControl(position) {
    const scaleControl = new mapboxgl.ScaleControl({
      maxWidth: this.options.mobileOptimized && !this.isDesktop() ? 80 : 100,
      unit: 'metric'
    });
    
    this.map.addControl(scaleControl, position);
    this.controls.scale = scaleControl;
    
    console.log('MapboxControls: Scale control added');
  }

  /**
   * Add geolocation control with enhanced features
   * @param {string} position - Control position
   */
  addGeolocationControl(position) {
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 300000
      },
      trackUserLocation: true,
      showAccuracyCircle: true,
      showUserHeading: true
    });

    // Enhanced error handling
    geolocateControl.on('error', (error) => {
      console.warn('MapboxControls: Geolocation error:', error);
      this.showNotification('Location access failed. Please enable location permissions.', 'warning');
    });

    geolocateControl.on('geolocate', (position) => {
      console.log('MapboxControls: User location found:', position.coords);
      this.showNotification('Location found successfully!', 'success', 2000);
    });

    this.map.addControl(geolocateControl, position);
    this.controls.geolocation = geolocateControl;
    
    console.log('MapboxControls: Geolocation control added');
  }

  /**
   * Add advanced style switcher control
   * @param {string} position - Control position
   */
  addStyleSwitcher(position = 'top-left') {
    const styles = this.config ? this.config.getAvailableStyles() : this.getDefaultStyles();
    const self = this;
    
    class AdvancedStyleControl {
      constructor() {
        this.isExpanded = false;
        this.currentPreset = self.currentPreset;
        this.styleSettings = self.styleSettings;
      }

      onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapbox-style-switcher';
        
        // Main toggle button
        this.button = document.createElement('button');
        this.button.className = 'mapboxgl-ctrl-icon mapbox-style-btn';
        this.button.type = 'button';
        this.button.title = 'Change map style';
        this.button.innerHTML = '🎨';
        
        // Style panel
        this.panel = document.createElement('div');
        this.panel.className = 'mapbox-style-panel';
        this.panel.style.display = 'none';
        
        this.createStylePanel();
        
        this.container.appendChild(this.button);
        this.container.appendChild(this.panel);
        
        // Event listeners
        this.button.addEventListener('click', () => this.togglePanel());
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
          if (!this.container.contains(e.target)) {
            this.closePanel();
          }
        });
        
        return this.container;
      }

      createStylePanel() {
        this.panel.innerHTML = `
          <div class="style-header">
            <h4>Map Styles</h4>
          </div>
          <div class="style-presets">
            ${Object.entries(styles).map(([key, style]) => `
              <button class="style-preset ${key === self.currentPreset ? 'active' : ''}" 
                      data-style="${key}">
                <div class="style-preview" style="background-color: ${style.previewColor || '#ccc'}"></div>
                <span class="style-name">${style.name}</span>
              </button>
            `).join('')}
          </div>
          <div class="style-actions">
            <button class="reset-btn">Reset to Default</button>
          </div>
        `;

        // Add event listeners
        this.panel.querySelectorAll('.style-preset').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const styleKey = e.currentTarget.dataset.style;
            this.selectStyle(styleKey);
          });
        });

        this.panel.querySelector('.reset-btn').addEventListener('click', () => {
          this.resetToDefault();
        });
      }

      togglePanel() {
        this.isExpanded = !this.isExpanded;
        this.panel.style.display = this.isExpanded ? 'block' : 'none';
        this.button.classList.toggle('active', this.isExpanded);
      }

      closePanel() {
        this.isExpanded = false;
        this.panel.style.display = 'none';
        this.button.classList.remove('active');
      }

      selectStyle(styleKey) {
        if (!styles[styleKey]) {
          console.warn('MapboxControls: Unknown style:', styleKey);
          return;
        }

        try {
          // Update map style
          const styleUrl = self.config.getStyleUrl(styleKey);
          self.map.setStyle(styleUrl);
          
          // Update UI
          this.updateActiveStyle(styleKey);
          
          // Save setting
          self.currentPreset = styleKey;
          self.saveStyleSettings('currentPreset', styleKey);
          
          // Close panel
          this.closePanel();
          
          console.log(`MapboxControls: Style changed to ${styleKey}`);
          
        } catch (error) {
          console.error('MapboxControls: Error changing style:', error);
          self.showNotification('Failed to change map style', 'error');
        }
      }

      updateActiveStyle(styleKey) {
        this.panel.querySelectorAll('.style-preset').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.style === styleKey);
        });
      }

      resetToDefault() {
        this.selectStyle('outdoors');
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    }

    const styleControl = new AdvancedStyleControl();
    this.map.addControl(styleControl, position);
    this.controls.styleSwitcher = styleControl;
    
    console.log('MapboxControls: Style switcher control added');
  }

  /**
   * Add export control with format options
   * @param {string} position - Control position
   */
  addExportControl(position = 'top-right') {
    const self = this;

    class ExportControl {
      onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon mapbox-export-btn';
        button.type = 'button';
        button.title = 'Export map';
        button.innerHTML = '📥';

        button.addEventListener('click', () => {
          self.showExportDialog();
        });

        this.container.appendChild(button);
        return this.container;
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    }

    const exportControl = new ExportControl();
    this.map.addControl(exportControl, position);
    this.controls.export = exportControl;
    
    console.log('MapboxControls: Export control added');
  }

  /**
   * Show export dialog with format options
   */
  showExportDialog() {
    // Remove existing dialog if present
    const existingDialog = document.getElementById('export-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'export-dialog';
    dialog.innerHTML = `
      <div class="export-dialog-overlay">
        <div class="export-dialog-content">
          <h3>Export Map</h3>
          <div class="export-options">
            <div class="export-format">
              <label>Format:</label>
              <select id="export-format">
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="A3">A3 (297 × 420 mm)</option>
              </select>
            </div>
            <div class="export-orientation">
              <label>Orientation:</label>
              <select id="export-orientation">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div class="export-quality">
              <label>Quality:</label>
              <select id="export-quality">
                <option value="150">Draft (150 DPI)</option>
                <option value="300" selected>Print (300 DPI)</option>
                <option value="600">High (600 DPI)</option>
              </select>
            </div>
          </div>
          <div class="export-actions">
            <button id="export-cancel" class="btn-secondary">Cancel</button>
            <button id="export-start" class="btn-primary">Export</button>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    dialog.querySelector('.export-dialog-overlay').style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    dialog.querySelector('.export-dialog-content').style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      min-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    document.body.appendChild(dialog);

    // Event listeners
    dialog.querySelector('#export-start').addEventListener('click', async () => {
      const format = dialog.querySelector('#export-format').value;
      const orientation = dialog.querySelector('#export-orientation').value;
      const quality = parseInt(dialog.querySelector('#export-quality').value);

      try {
        if (this.exportModule) {
          const dataURL = await this.exportModule.exportHighResolution(format, quality, { orientation });
          this.exportModule.downloadImage(dataURL, `map-${format}-${orientation}-${quality}dpi.png`);
        } else {
          console.warn('MapboxControls: Export module not available');
        }
      } catch (error) {
        console.error('MapboxControls: Export failed:', error);
        this.showNotification('Export failed. Please try again.', 'error');
      }

      document.body.removeChild(dialog);
    });

    dialog.querySelector('#export-cancel').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }

  /**
   * Enhance keyboard accessibility
   */
  enhanceKeyboardAccessibility() {
    // Add keyboard navigation for controls
    const controls = this.map.getContainer().querySelectorAll('.mapboxgl-ctrl button');
    
    controls.forEach((control, index) => {
      control.tabIndex = index + 1;
      control.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          control.click();
        }
      });
    });

    console.log('MapboxControls: Keyboard accessibility enhanced');
  }

  /**
   * Add mobile-specific enhancements
   */
  addMobileEnhancements() {
    if (!this.isMobile()) return;

    // Add touch-friendly styles
    const style = document.createElement('style');
    style.textContent = `
      .mapboxgl-ctrl button {
        min-width: 44px !important;
        min-height: 44px !important;
        font-size: 16px !important;
      }
      .mapbox-style-panel {
        max-height: 70vh;
        overflow-y: auto;
      }
    `;
    document.head.appendChild(style);

    console.log('MapboxControls: Mobile enhancements applied');
  }

  /**
   * Device detection helpers
   */
  isDesktop() {
    return window.innerWidth >= 769;
  }

  isMobile() {
    return window.innerWidth <= 480;
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
      satellite: { name: 'Satellite', previewColor: '#4a6741' }
    };
  }

  /**
   * Load saved style settings
   */
  loadStyleSettings() {
    try {
      const saved = localStorage.getItem('mapbox-style-settings');
      if (saved) {
        this.styleSettings = JSON.parse(saved);
        this.currentPreset = this.styleSettings.currentPreset || 'outdoors';
      }
    } catch (error) {
      console.warn('MapboxControls: Could not load style settings:', error);
      this.styleSettings = {};
    }
  }

  /**
   * Save style settings to localStorage
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  saveStyleSettings(key, value) {
    try {
      this.styleSettings[key] = value;
      localStorage.setItem('mapbox-style-settings', JSON.stringify(this.styleSettings));
    } catch (error) {
      console.warn('MapboxControls: Could not save style settings:', error);
    }
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('success', 'warning', 'error', 'info')
   * @param {number} duration - Duration in milliseconds
   */
  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `mapbox-notification mapbox-notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getNotificationColor(type)};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  /**
   * Get notification color based on type
   * @param {string} type - Notification type
   * @returns {string} CSS color
   */
  getNotificationColor(type) {
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3'
    };
    return colors[type] || colors.info;
  }

  /**
   * Remove all map controls
   */
  removeMapControls() {
    Object.entries(this.controls).forEach(([name, control]) => {
      if (control && this.map) {
        this.map.removeControl(control);
        this.controls[name] = null;
      }
    });

    console.log('MapboxControls: All controls removed');
  }

  /**
   * Update control positions
   * @param {Object} newPositions - New control positions
   */
  updateControlPositions(newPositions) {
    this.options.controlPositions = { ...this.options.controlPositions, ...newPositions };
    
    // Re-add controls with new positions
    this.removeMapControls();
    this.addMapControls();

    console.log('MapboxControls: Control positions updated');
  }

  /**
   * Get current control state
   * @returns {Object} Control state information
   */
  getControlState() {
    return {
      enabled: this.options.showControls,
      positions: this.options.controlPositions,
      currentStyle: this.currentPreset,
      controls: Object.keys(this.controls).reduce((state, name) => {
        state[name] = !!this.controls[name];
        return state;
      }, {})
    };
  }

  /**
   * Clean up controls functionality
   */
  cleanup() {
    console.log('MapboxControls: Starting cleanup...');
    
    // Remove all controls
    this.removeMapControls();
    
    // Remove any existing dialogs
    const exportDialog = document.getElementById('export-dialog');
    if (exportDialog) exportDialog.remove();
    
    // Reset state
    this.map = null;
    this.config = null;
    this.styleSettings = {};
    this.currentPreset = 'default';
    
    console.log('MapboxControls: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxControls;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxControls; });
} else {
  window.MapboxControls = MapboxControls;
}