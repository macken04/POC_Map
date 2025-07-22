# Mapbox Integration Testing Procedures

## Overview

This document outlines the comprehensive testing procedures for validating the Mapbox GL JS integration in the Print My Ride application. The testing framework ensures map functionality, performance, and high-resolution export capabilities work correctly.

## Test Suite Structure

### 1. Integration Tests (`mapbox-integration-test.js`)
Validates core Mapbox functionality and system integration.

**Test Coverage:**
- ✅ Dependencies Installation
- ✅ Environment Configuration 
- ✅ File Structure Validation
- ✅ MapService Initialization
- ✅ Theme Integration
- ✅ Map Generation Validation
- ✅ Performance Testing
- ✅ Browser Compatibility

**Usage:**
```bash
cd backend
node tests/mapbox-integration-test.js
```

### 2. DPI Export Validation (`dpi-export-validation.js`)
Ensures 300 DPI export functionality meets print quality requirements.

**Test Coverage:**
- ✅ Print Dimensions (A4/A3 at 300 DPI)
- ✅ Device Pixel Ratio Calculations
- ✅ Export Configuration
- ✅ Export Workflow Validation
- ✅ File Size Estimations

**Usage:**
```bash
cd backend
node tests/dpi-export-validation.js
```

### 3. Browser-Based Testing (`mapbox-browser-test.html`)
Manual testing page for in-browser validation.

**Test Coverage:**
- Map rendering with different styles
- Canvas export functionality
- Route display and markers
- WebGL support detection
- High-DPI export testing

**Usage:**
1. Open `tests/mapbox-browser-test.html` in a web browser
2. Run each test section manually
3. Verify all tests show green status indicators

### 4. Master Test Runner (`test-runner.js`)
Comprehensive test orchestration with reporting.

**Features:**
- Runs all automated tests
- Generates JSON and Markdown reports
- Provides comprehensive test statistics
- Environment information capture

**Usage:**
```bash
cd backend
node tests/test-runner.js
```

## Running Tests

### Quick Test (Integration Only)
```bash
cd backend
node tests/mapbox-integration-test.js
```

### Full Automated Suite
```bash
cd backend
node tests/test-runner.js
```

### Manual Browser Testing
```bash
# Serve the test file (using any local server)
cd backend/tests
python -m http.server 8080
# Then visit: http://localhost:8080/mapbox-browser-test.html
```

## Test Results and Reports

### Generated Files
- `mapbox-integration-test-report.json` - Detailed integration test results
- `comprehensive-test-report.json` - Complete test suite results
- `test-summary.md` - Human-readable summary

### Success Criteria

**Integration Tests:**
- All 8 tests must pass (100% success rate)
- MapService initialization successful
- Browser connection established
- Performance within acceptable limits

**DPI Export Validation:**
- Print dimensions accurate within 2 pixels
- Device pixel ratio calculations correct
- Export workflow completely implemented
- File size estimates reasonable

**Browser Tests (Manual):**
- Map renders correctly in browser
- Canvas export produces valid image data
- Route display with markers works
- WebGL support confirmed

## Troubleshooting

### Common Issues

#### 1. Puppeteer Connection Errors
**Symptoms:** "socket hang up" errors during MapService initialization

**Solutions:**
- Restart the test suite
- Check Chrome/Chromium installation
- Verify system permissions for browser execution

#### 2. Missing Dependencies
**Symptoms:** Module not found errors

**Solutions:**
```bash
cd backend
npm install
```

#### 3. Environment Configuration
**Symptoms:** Mapbox token validation failures

**Solutions:**
- Verify `.env` file exists in project root
- Confirm `MAPBOX_ACCESS_TOKEN` is set correctly
- Check token format starts with `pk.`

#### 4. Browser Test Page Issues
**Symptoms:** Maps not loading in browser

**Solutions:**
- Check browser console for errors
- Verify Mapbox token is valid in HTML file
- Ensure network connectivity

### Performance Benchmarks

**Acceptable Performance Thresholds:**
- MapService initialization: < 5 seconds
- Status check operations: < 100ms
- Canvas export: < 30 seconds for high-res
- Memory usage: < 500MB during export

### Browser Compatibility

**Supported Browsers:**
- Chrome 90+
- Firefox 85+
- Safari 14+
- Edge 90+

**Required Features:**
- WebGL support
- Canvas API
- High-resolution display support

## Continuous Integration

### GitHub Actions Workflow
The project includes a comprehensive CI pipeline at `.github/workflows/ci.yml` that automatically runs on:
- Push to master, main, or develop branches  
- Pull requests to master or main branches

### CI Pipeline Structure

#### 1. Main Test Job
- **Matrix Testing**: Node.js 18.x, 20.x, and 22.x
- **Environment Validation**: Configuration and environment variable testing
- **Unit Tests**: OAuth components, token management, and utilities  
- **Security Tests**: CSRF protection and token security validation
- **Integration Tests**: Full OAuth flow with running server

#### 2. Mapbox Test Job
- **Mapbox Integration**: Core Mapbox GL JS functionality
- **DPI Export Validation**: High-resolution export capabilities
- **WebGL Support**: Browser compatibility testing

#### 3. Security Test Job  
- **Security Improvements**: Comprehensive security validation
- **API Key Management**: Secure token handling verification

### Available CI Scripts
```bash
# Run CI test suite (without server dependencies)
npm run test:ci

# Run Mapbox-specific tests  
npm run test:mapbox

# Run security tests
npm run test:security

# Run complete test suite
npm run test:all
```

### Required CI Environment Variables
Configure these secrets in your GitHub repository:
- `STRAVA_CLIENT_ID` - Strava API client ID
- `STRAVA_CLIENT_SECRET` - Strava API client secret
- `STRAVA_REDIRECT_URI` - OAuth callback URL  
- `SESSION_SECRET` - Session encryption secret (minimum 32 characters)
- `MAPBOX_ACCESS_TOKEN` - Mapbox API access token

### CI Test Artifacts
The pipeline automatically uploads test reports as artifacts:
- `test-reports-{node-version}` - Main test suite results
- `mapbox-test-reports` - Mapbox integration test results
- `security-test-reports` - Security validation results

### Test Coverage Goals
- 100% pass rate for integration tests
- All DPI validation checks passing
- Security tests must pass (critical for deployment)
- Manual browser tests verified quarterly

## Maintenance

### Regular Tasks
1. **Monthly:** Run comprehensive test suite
2. **Before releases:** Full manual browser testing
3. **After dependency updates:** Complete test validation
4. **Environment changes:** Re-verify configuration tests

### Updating Tests
When modifying Mapbox integration:
1. Update relevant test cases
2. Run full test suite
3. Update documentation
4. Verify browser compatibility

## Security Considerations

### API Key Management
- Never commit real API keys to tests
- Use environment variables for sensitive data
- Rotate test tokens regularly

### Test Data
- Use Dublin test route coordinates (public domain)
- No sensitive user data in test fixtures
- Mock external API responses when possible

## Performance Monitoring

### Metrics to Track
- Test execution time trends
- Memory usage patterns
- Browser compatibility changes
- API response times

### Alerting Thresholds
- Test suite execution > 5 minutes
- Success rate < 95%
- Memory usage > 1GB
- Crash/hang incidents

## Documentation Updates

This document should be updated when:
- New tests are added
- Test procedures change
- Performance thresholds are modified
- Browser support requirements change

---

**Last Updated:** July 21, 2025  
**Test Suite Version:** 1.0  
**Mapbox GL JS Version:** 3.13.0