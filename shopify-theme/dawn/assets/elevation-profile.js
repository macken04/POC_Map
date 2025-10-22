/**
 * Elevation Profile Visualization Component for Shopify Dawn Theme
 * Provides interactive elevation profile charts that synchronize with map route display
 * 
 * Depends on:
 * - Chart.js (loaded via CDN)
 * - mapbox-integration.js (for map synchronization)
 * 
 * Usage:
 * const elevationProfile = new ElevationProfile('elevation-chart-container');
 * elevationProfile.renderProfile(elevationData);
 */

class ElevationProfile {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.chart = null;
    this.mapIntegration = null;
    this.elevationData = null;
    this.isInitialized = false;
    this.hoveredPoint = null;
    
    // Configuration options
    this.options = {
      responsive: true,
      maintainAspectRatio: false,
      height: options.height || 300,
      showGradient: options.showGradient !== false,
      showDistanceMarkers: options.showDistanceMarkers !== false,
      units: options.units || 'metric', // 'metric' or 'imperial'
      ...options
    };

    this.init();
  }

  init() {
    if (!this.container) {
      console.warn(`ElevationProfile: Container with ID '${this.containerId}' not found`);
      return;
    }

    if (typeof Chart === 'undefined') {
      console.error('ElevationProfile: Chart.js is required but not loaded');
      return;
    }

    this.createChartCanvas();
    this.isInitialized = true;
  }

  createChartCanvas() {
    // Create canvas element for Chart.js
    const canvas = document.createElement('canvas');
    canvas.id = `${this.containerId}-canvas`;
    canvas.style.width = '100%';
    canvas.style.height = `${this.options.height}px`;
    
    // Clear container and add canvas
    this.container.innerHTML = '';
    this.container.appendChild(canvas);
    
    return canvas;
  }

  /**
   * Render elevation profile from processed elevation data
   * @param {Object} data - Elevation data object
   * @param {Array} data.elevation - Array of {index, elevation_meters, elevation_feet, distance_km, distance_miles}
   * @param {Object} data.stats - Statistics {gain, loss, min, max, avg}
   */
  renderProfile(data) {
    if (!this.isInitialized) {
      console.warn('ElevationProfile: Component not initialized');
      return;
    }

    if (!data || !data.elevation || !Array.isArray(data.elevation)) {
      console.warn('ElevationProfile: Invalid elevation data provided');
      return;
    }

    this.elevationData = data;
    this.createChart();
  }

  createChart() {
    const canvas = this.container.querySelector('canvas');
    if (!canvas) {
      console.error('ElevationProfile: Canvas element not found');
      return;
    }

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chartData = this.prepareChartData(ctx);  // Pass ctx to prepareChartData
    const chartConfig = this.getChartConfig(chartData);

    this.chart = new Chart(ctx, chartConfig);
  }

  prepareChartData(ctx) {
    const elevationUnit = this.options.units === 'metric' ? 'elevation_meters' : 'elevation_feet';
    const distanceUnit = this.options.units === 'metric' ? 'distance_km' : 'distance_miles';
    const unitLabel = this.options.units === 'metric' ? 'm' : 'ft';
    const distanceLabel = this.options.units === 'metric' ? 'km' : 'mi';

    // Prepare data points for Chart.js
    const dataPoints = this.elevationData.elevation.map(point => ({
      x: point[distanceUnit] || (point.index * 0.01), // Use distance if available, fallback to index
      y: point[elevationUnit],
      index: point.index
    }));

    // Create gradient colors based on elevation
    const elevations = dataPoints.map(p => p.y);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    
    const borderColors = dataPoints.map(point => {
      const ratio = (point.y - minElevation) / (maxElevation - minElevation);
      return this.getElevationColor(ratio);
    });

    return {
      labels: dataPoints.map(p => p.x.toFixed(1)),
      datasets: [{
        label: `Elevation (${unitLabel})`,
        data: dataPoints,
        borderColor: this.options.showGradient ? borderColors[0] : '#4A90E2',
        backgroundColor: this.options.showGradient ? 
          this.createGradientFill(ctx, dataPoints, borderColors) : 
          'rgba(74, 144, 226, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#ffffff',
        segment: this.options.showGradient ? {
          borderColor: (ctx) => {
            const ratio = (ctx.p1.parsed.y - minElevation) / (maxElevation - minElevation);
            return this.getElevationColor(ratio);
          }
        } : undefined
      }]
    };
  }

  createGradientFill(ctx, dataPoints, colors) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.options.height);
    gradient.addColorStop(0, 'rgba(74, 144, 226, 0.3)');
    gradient.addColorStop(1, 'rgba(74, 144, 226, 0.05)');
    return gradient;
  }

  getElevationColor(ratio) {
    // Create color gradient from green (low) to red (high)
    const colors = [
      { r: 76, g: 175, b: 80 },   // Green (low elevation)
      { r: 255, g: 235, b: 59 },  // Yellow (medium elevation)
      { r: 244, g: 67, b: 54 }    // Red (high elevation)
    ];

    let colorIndex, localRatio;
    if (ratio < 0.5) {
      colorIndex = 0;
      localRatio = ratio * 2;
    } else {
      colorIndex = 1;
      localRatio = (ratio - 0.5) * 2;
    }

    const color1 = colors[colorIndex];
    const color2 = colors[colorIndex + 1];

    const r = Math.round(color1.r + (color2.r - color1.r) * localRatio);
    const g = Math.round(color1.g + (color2.g - color1.g) * localRatio);
    const b = Math.round(color1.b + (color2.b - color1.b) * localRatio);

    return `rgb(${r}, ${g}, ${b})`;
  }

  getChartConfig(chartData) {
    const distanceLabel = this.options.units === 'metric' ? 'Distance (km)' : 'Distance (mi)';
    const elevationLabel = this.options.units === 'metric' ? 'Elevation (m)' : 'Elevation (ft)';

    return {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Elevation Profile',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (tooltipItems) => {
                const point = tooltipItems[0];
                return `${distanceLabel.split(' ')[0]}: ${point.label}`;
              },
              label: (context) => {
                return `${elevationLabel}: ${context.parsed.y.toFixed(0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: distanceLabel
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: elevationLabel
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        onHover: (event, activeElements) => {
          this.handleChartHover(event, activeElements);
        },
        onClick: (event, activeElements) => {
          this.handleChartClick(event, activeElements);
        }
      }
    };
  }

  handleChartHover(event, activeElements) {
    if (activeElements.length > 0) {
      const element = activeElements[0];
      const dataIndex = element.index;
      const elevationPoint = this.elevationData.elevation[dataIndex];
      
      this.hoveredPoint = elevationPoint;
      
      // Trigger map synchronization if map integration is available
      if (this.mapIntegration && this.mapIntegration.highlightRoutePoint) {
        this.mapIntegration.highlightRoutePoint(elevationPoint.index);
      }
      
      // Dispatch custom event for other components to listen
      this.dispatchEvent('elevation:hover', {
        point: elevationPoint,
        index: dataIndex
      });
    } else {
      this.hoveredPoint = null;
      
      // Clear map highlight
      if (this.mapIntegration && this.mapIntegration.clearRouteHighlight) {
        this.mapIntegration.clearRouteHighlight();
      }
      
      this.dispatchEvent('elevation:hover:clear');
    }
  }

  handleChartClick(event, activeElements) {
    if (activeElements.length > 0) {
      const element = activeElements[0];
      const dataIndex = element.index;
      const elevationPoint = this.elevationData.elevation[dataIndex];
      
      // Dispatch click event
      this.dispatchEvent('elevation:click', {
        point: elevationPoint,
        index: dataIndex
      });
      
      // Pan map to clicked point if map integration is available
      if (this.mapIntegration && this.mapIntegration.panToRoutePoint) {
        this.mapIntegration.panToRoutePoint(elevationPoint.index);
      }
    }
  }

  /**
   * Set map integration for bidirectional synchronization
   * @param {MapboxIntegration} mapIntegration - MapboxIntegration instance
   */
  setMapIntegration(mapIntegration) {
    this.mapIntegration = mapIntegration;
  }

  /**
   * Highlight a specific point on the elevation profile
   * @param {number} index - Point index to highlight
   */
  highlightPoint(index) {
    if (!this.chart || !this.elevationData) return;
    
    // Update chart to show highlighted point
    const meta = this.chart.getDatasetMeta(0);
    if (meta.data[index]) {
      meta.data.forEach((point, i) => {
        point.options.pointRadius = i === index ? 6 : 0;
      });
      this.chart.update('none');
    }
  }

  /**
   * Clear all point highlights
   */
  clearHighlight() {
    if (!this.chart) return;
    
    const meta = this.chart.getDatasetMeta(0);
    meta.data.forEach(point => {
      point.options.pointRadius = 0;
    });
    this.chart.update('none');
  }

  /**
   * Update elevation data and re-render chart
   * @param {Object} data - New elevation data
   */
  updateData(data) {
    this.elevationData = data;
    if (this.chart) {
      const chartData = this.prepareChartData();
      this.chart.data = chartData;
      this.chart.update();
    }
  }

  /**
   * Resize chart to fit container
   */
  resize() {
    if (this.chart) {
      this.chart.resize();
    }
  }

  /**
   * Destroy chart and clean up
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.isInitialized = false;
  }

  /**
   * Dispatch custom events
   */
  dispatchEvent(eventName, detail = null) {
    const event = new CustomEvent(eventName, { 
      detail,
      bubbles: true,
      cancelable: true 
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Get current elevation statistics
   */
  getStats() {
    return this.elevationData ? this.elevationData.stats : null;
  }

  /**
   * Export chart as image
   * @param {string} format - Image format ('png', 'jpeg')
   * @returns {string} Base64 image data URL
   */
  exportAsImage(format = 'png') {
    if (!this.chart) {
      console.warn('ElevationProfile: No chart available for export');
      return null;
    }
    
    return this.chart.toBase64Image(`image/${format}`, 1.0);
  }
}

// Make ElevationProfile globally available
window.ElevationProfile = ElevationProfile;

// Auto-initialize elevation profiles on page load
document.addEventListener('DOMContentLoaded', () => {
  const elevationContainers = document.querySelectorAll('[data-elevation-profile]');
  
  elevationContainers.forEach(container => {
    const options = {
      units: container.dataset.units || 'metric',
      height: parseInt(container.dataset.height) || 300,
      showGradient: container.dataset.gradient !== 'false',
      showDistanceMarkers: container.dataset.markers !== 'false'
    };
    
    const elevationProfile = new ElevationProfile(container.id, options);
    
    // Store instance on container for external access
    container.elevationProfile = elevationProfile;
  });
});