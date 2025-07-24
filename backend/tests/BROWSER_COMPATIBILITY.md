# Browser Compatibility Guide for High-Resolution Map Export

## Overview

This document outlines browser compatibility considerations, limitations, and best practices for the high-resolution map export functionality in the Shopify Custom Map Printing Platform.

## Supported Browsers

### ✅ Fully Supported

| Browser | Version | Export Quality | WebGL Support | Canvas Support | Notes |
|---------|---------|----------------|---------------|----------------|-------|
| Chrome | 90+ | Excellent | ✅ | ✅ | Recommended browser |
| Edge | 90+ | Excellent | ✅ | ✅ | Chromium-based |
| Firefox | 88+ | Good | ✅ | ✅ | Some rendering differences |
| Safari | 14+ | Good | ✅ | ✅ | Memory limitations on mobile |

### ⚠️ Limited Support

| Browser | Version | Issues | Workarounds |
|---------|---------|--------|-------------|
| Chrome Mobile | 90+ | Memory limits, slower performance | Reduce DPI for mobile |
| Safari Mobile | 14+ | Memory constraints, WebGL limitations | Use JPEG format, lower quality |
| IE 11 | N/A | Not supported | Use modern browser |
| Older Chrome | < 90 | WebGL issues, canvas limitations | Update browser |

## Browser-Specific Features

### Chrome (Recommended)
- **Export Quality**: Excellent
- **Max Resolution**: 300 DPI A3 (3508x4961px)
- **Memory Limit**: ~2GB
- **Best Features**:
  - Superior WebGL performance
  - Accurate color rendering
  - Large canvas support
  - Efficient memory management

**Optimal Settings**:
```javascript
{
  exportFormat: 'png',
  qualityLevel: 'high',
  dpi: 300,
  antiAliasing: true
}
```

### Firefox
- **Export Quality**: Good
- **Max Resolution**: 300 DPI A3 (3508x4961px)
- **Memory Limit**: ~1.5GB
- **Known Issues**:
  - Slightly different text rendering
  - Color space variations
  - Slower canvas operations

**Recommended Settings**:
```javascript
{
  exportFormat: 'png',
  qualityLevel: 'medium',
  dpi: 300,
  antiAliasing: true
}
```

### Safari (Desktop)
- **Export Quality**: Good
- **Max Resolution**: 300 DPI A4 (2480x3508px)
- **Memory Limit**: ~1GB
- **Known Issues**:
  - More restrictive memory limits
  - WebGL context limitations
  - Different font rendering

**Recommended Settings**:
```javascript
{
  exportFormat: 'jpeg',
  qualityLevel: 'medium',
  dpi: 300,
  memoryOptimization: true,
  maxMemoryMB: 200
}
```

### Safari Mobile
- **Export Quality**: Limited
- **Max Resolution**: 150 DPI A4 (1240x1754px)
- **Memory Limit**: ~200MB
- **Critical Limitations**:
  - Severe memory constraints
  - WebGL context loss
  - Canvas size restrictions

**Mobile-Optimized Settings**:
```javascript
{
  exportFormat: 'jpeg',
  qualityLevel: 'low',
  dpi: 150,
  memoryOptimization: true,
  maxMemoryMB: 100
}
```

## Memory Management by Browser

### Memory Limits

| Browser | Desktop Limit | Mobile Limit | Canvas Limit |
|---------|---------------|--------------|--------------|
| Chrome | 2-4GB | 500MB | 32,767px |
| Firefox | 1.5-2GB | 300MB | 32,767px |
| Safari | 1-2GB | 200MB | 16,384px |
| Edge | 2-4GB | 500MB | 32,767px |

### Memory Optimization Strategies

#### For Desktop Browsers
```javascript
// High-quality export for desktop
const desktopConfig = {
  memoryOptimization: true,
  maxMemoryMB: 1000,
  dpi: 300,
  qualityLevel: 'high'
};
```

#### For Mobile Browsers
```javascript
// Memory-constrained export for mobile
const mobileConfig = {
  memoryOptimization: true,
  maxMemoryMB: 200,
  dpi: 150,
  qualityLevel: 'medium',
  exportFormat: 'jpeg'
};
```

## Format Support Matrix

### PNG Export

| Browser | Support | Quality | File Size | Performance |
|---------|---------|---------|-----------|-------------|
| Chrome | ✅ Excellent | Perfect | Large | Fast |
| Firefox | ✅ Good | Perfect | Large | Medium |
| Safari | ✅ Good | Perfect | Large | Slow |
| Mobile | ⚠️ Limited | Good | Large | Very Slow |

### JPEG Export

| Browser | Support | Quality | File Size | Performance |
|---------|---------|---------|-----------|-------------|
| Chrome | ✅ Excellent | Very Good | Small | Fast |
| Firefox | ✅ Good | Very Good | Small | Medium |
| Safari | ✅ Good | Very Good | Small | Medium |
| Mobile | ✅ Good | Good | Small | Fast |

## Known Issues and Workarounds

### Issue 1: Memory Errors on Large Exports

**Symptoms**: Browser crashes, "Out of memory" errors
**Affected**: All browsers, especially mobile
**Workaround**:
```javascript
// Reduce memory usage
const safeConfig = {
  dpi: Math.min(dpi, 200),
  memoryOptimization: true,
  maxMemoryMB: 300,
  exportFormat: 'jpeg',
  qualityLevel: 'medium'
};
```

### Issue 2: WebGL Context Loss

**Symptoms**: Black or corrupted exports
**Affected**: Safari, mobile browsers
**Workaround**:
```javascript
// Check WebGL support before export
const hasWebGL = !!map.getCanvas().getContext('webgl');
if (!hasWebGL) {
  // Use fallback rendering or notify user
  showWebGLWarning();
}
```

### Issue 3: Color Space Differences

**Symptoms**: Colors appear different between browsers
**Affected**: Firefox, Safari
**Workaround**:
```javascript
// Force sRGB color space
const canvas = map.getCanvas();
const ctx = canvas.getContext('2d', {
  colorSpace: 'srgb'
});
```

### Issue 4: Font Rendering Inconsistencies

**Symptoms**: Text appears different across browsers
**Affected**: All browsers
**Workaround**:
```javascript
// Use web fonts consistently
const fontConfig = {
  fontFamily: 'Arial, sans-serif',
  textOptimization: true,
  antiAliasing: true
};
```

## Browser Detection and Adaptation

### Automatic Browser Detection

```javascript
class BrowserDetector {
  static detect() {
    const userAgent = navigator.userAgent;
    
    return {
      isChrome: /Chrome/.test(userAgent) && !/Edge/.test(userAgent),
      isFirefox: /Firefox/.test(userAgent),
      isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
      isEdge: /Edge/.test(userAgent),
      isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      memoryLimit: this.estimateMemoryLimit(),
      webglSupport: this.checkWebGLSupport()
    };
  }
  
  static estimateMemoryLimit() {
    if (performance.memory) {
      return performance.memory.jsHeapSizeLimit / (1024 * 1024); // MB
    }
    
    // Conservative estimates
    const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
    return isMobile ? 200 : 1000;
  }
  
  static checkWebGLSupport() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  }
}
```

### Adaptive Configuration

```javascript
function getOptimalExportConfig(userPreferences) {
  const browser = BrowserDetector.detect();
  
  let config = { ...userPreferences };
  
  // Mobile optimizations
  if (browser.isMobile) {
    config.dpi = Math.min(config.dpi, 150);
    config.exportFormat = 'jpeg';
    config.qualityLevel = 'medium';
    config.maxMemoryMB = 100;
  }
  
  // Safari optimizations
  if (browser.isSafari) {
    config.maxMemoryMB = Math.min(config.maxMemoryMB, 400);
    if (browser.isMobile) {
      config.dpi = Math.min(config.dpi, 150);
    }
  }
  
  // Firefox optimizations
  if (browser.isFirefox) {
    config.maxMemoryMB = Math.min(config.maxMemoryMB, 600);
  }
  
  // Memory-based optimizations
  if (browser.memoryLimit < 500) {
    config.exportFormat = 'jpeg';
    config.qualityLevel = 'medium';
    config.dpi = Math.min(config.dpi, 200);
  }
  
  return config;
}
```

## Testing Procedures

### Manual Testing Checklist

#### For Each Supported Browser:

1. **Basic Export Test**
   - [ ] A4 Portrait PNG at 300 DPI
   - [ ] A4 Landscape JPEG at 300 DPI
   - [ ] A3 Portrait PNG at 300 DPI

2. **Quality Tests**
   - [ ] High quality PNG export
   - [ ] Medium quality JPEG export
   - [ ] Low quality JPEG export
   - [ ] Visual comparison between browsers

3. **Memory Tests**
   - [ ] Maximum supported resolution
   - [ ] Memory optimization enabled
   - [ ] Multiple consecutive exports

4. **Error Handling**
   - [ ] Memory limit exceeded
   - [ ] WebGL context loss
   - [ ] Network interruption

### Automated Testing

Run the cross-browser test suite:
```bash
node backend/tests/cross-browser-export-test.js
```

Run visual regression tests:
```bash
node backend/tests/visual-regression-test.js
```

## Performance Benchmarks

### Desktop Performance (Chrome 120)

| Format | Size | DPI | Time | Memory | File Size |
|--------|------|-----|------|--------|-----------|
| A4 PNG | 2480x3508 | 300 | 8.2s | 450MB | 12.3MB |
| A4 JPEG | 2480x3508 | 300 | 6.1s | 320MB | 3.8MB |
| A3 PNG | 3508x4961 | 300 | 15.4s | 720MB | 24.1MB |
| A3 JPEG | 3508x4961 | 300 | 11.7s | 540MB | 7.2MB |

### Mobile Performance (Safari iOS 17)

| Format | Size | DPI | Time | Memory | File Size |
|--------|------|-----|------|--------|-----------|
| A4 JPEG | 1240x1754 | 150 | 12.3s | 120MB | 1.2MB |
| A4 PNG | 1240x1754 | 150 | 18.7s | 180MB | 3.8MB |

## Troubleshooting Guide

### Common Error Messages

#### "Canvas memory limit exceeded"
- **Cause**: Trying to create canvas larger than browser limit
- **Solution**: Reduce DPI or use memory optimization
- **Code**: Set `maxMemoryMB` parameter

#### "WebGL context lost"
- **Cause**: GPU memory exhaustion or browser limits
- **Solution**: Reload page or use smaller export settings
- **Code**: Implement WebGL context restoration

#### "Export failed: timeout"
- **Cause**: Large export taking too long
- **Solution**: Increase timeout or reduce complexity
- **Code**: Set higher timeout values

### Debug Mode

Enable debug logging:
```javascript
const exportConfig = {
  debug: true,
  logLevel: 'verbose'
};
```

## Best Practices

### For Developers

1. **Always check browser capabilities before export**
2. **Implement graceful fallbacks for unsupported features**
3. **Use memory optimization for all mobile devices**
4. **Provide user feedback during long exports**
5. **Test across all supported browsers regularly**

### For Users

1. **Use Chrome for best results**
2. **Close other tabs for large exports**
3. **Use JPEG format for smaller files**
4. **Reduce DPI on mobile devices**
5. **Wait for export completion before navigating away**

## Future Improvements

### Planned Enhancements

1. **WebAssembly Optimization**: Improve performance for complex exports
2. **Progressive Export**: Break large exports into chunks
3. **Service Worker Caching**: Cache map tiles for offline export
4. **Format Detection**: Automatically choose optimal format
5. **Memory Prediction**: Estimate export feasibility before starting

### Browser Support Roadmap

- **Chrome 130+**: Enhanced WebGL support
- **Firefox 125+**: Improved memory management
- **Safari 18+**: Better mobile performance
- **Progressive Web App**: Enhanced offline capabilities

---

*Last updated: 2025-01-23*
*Version: 1.0*