# OAuth Implementation Test Suite

[![CI](https://github.com/your-username/map_site_vibe/workflows/CI/badge.svg)](https://github.com/your-username/map_site_vibe/actions)

Comprehensive testing suite for the Shopify Custom Map Printing Platform OAuth implementation with Strava API integration.

## Overview

This test suite provides complete coverage of OAuth functionality including:
- Unit tests for individual components
- Integration tests for full OAuth flow
- Security tests for CSRF protection
- Token refresh mechanism testing
- Error handling verification
- Performance and edge case testing

## Test Structure

### Test Files

| File | Purpose | Test Type |
|------|---------|-----------|
| `oauth-test-runner.js` | Main test runner for all suites | Runner |
| `oauth-unit-tests.js` | Component-level unit tests | Unit |
| `oauth-integration-tests.js` | Full OAuth flow integration tests | Integration |
| `oauth-token-refresh-enhanced.js` | Enhanced token refresh testing | Functional |
| `oauth-csrf-protection-test.js` | CSRF protection security tests | Security |
| `oauth-error-handling-test.js` | Comprehensive error handling tests | Error |
| `config-test.js` | Configuration validation tests | Unit |
| `token-test.js` | Token storage security tests | Security |

### Test Categories

#### 🧪 Unit Tests (`oauth-unit-tests.js`)
Tests individual OAuth components and functions:
- Token service validation and encryption
- Token manager operations
- Session security middleware
- Error handler functions
- Rate limiting middleware

#### 🔗 Integration Tests (`oauth-integration-tests.js`)
Tests OAuth flow integration with Express server:
- Authorization endpoint functionality
- Callback endpoint processing
- Session persistence across requests
- Authentication status management
- Logout flow integration

#### 🔄 Enhanced Token Refresh Tests (`oauth-token-refresh-enhanced.js`)
Comprehensive token refresh mechanism testing:
- Expired token detection
- Automatic token refresh
- Failed refresh scenarios
- Race condition handling
- Token update persistence

#### 🛡️ CSRF Protection Tests (`oauth-csrf-protection-test.js`)
Security tests for Cross-Site Request Forgery protection:
- State parameter generation and validation
- Session-state binding verification
- CSRF attack prevention
- Timing attack protection
- Entropy and uniqueness testing

#### ⚠️ Error Handling Tests (`oauth-error-handling-test.js`)
Comprehensive error scenario testing:
- OAuth error responses (user denial, invalid requests)
- Network error handling
- Rate limiting scenarios
- Security error handling
- Browser error pages

## Quick Start

### Prerequisites
1. Server must be running on `http://localhost:3000`
2. Environment variables configured in `.env`
3. All dependencies installed (`npm install`)

### Running Tests

```bash
# Run all OAuth tests (recommended)
npm test

# Run individual test suites
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests (requires server)
npm run test:token-refresh     # Token refresh tests
npm run test:csrf             # CSRF protection tests
npm run test:error-handling   # Error handling tests
npm run test:config           # Configuration tests
npm run test:tokens           # Token storage tests
```

### Test Execution Flow

1. **Start your server**: `npm run dev` (in separate terminal)
2. **Run tests**: `npm test`
3. **Review reports**: Check generated report files

## Test Reports

### Generated Files

| File | Content |
|------|---------|
| `oauth-comprehensive-test-report.json` | Detailed JSON report with all test results |
| `oauth-test-summary.md` | Human-readable markdown summary |
| `oauth-*-test-report.json` | Individual test suite reports |

### Report Structure

```json
{
  "overview": {
    "testDate": "2025-07-20T...",
    "totalDuration": 5432,
    "totalTests": 45,
    "totalPassed": 43,
    "totalFailed": 2,
    "overallSuccessRate": "95.6"
  },
  "suiteResults": [...],
  "recommendations": [...],
  "environment": {...}
}
```

## Test Configuration

### Environment Requirements

Tests require the following environment variables:
```bash
# Strava API Configuration
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=your_callback_url

# Session Configuration
SESSION_SECRET=your_session_secret_minimum_32_chars

# Server Configuration
NODE_ENV=development
PORT=3000
```

### Server Dependencies

Some tests require a running server:
- Integration tests
- CSRF protection tests
- Error handling tests

Unit tests can run without a server.

## Understanding Test Results

### Success Indicators
- ✅ All tests pass
- High success rate (>95%)
- No security vulnerabilities detected
- Fast execution times

### Common Issues

#### Server Not Running
```
❌ Server not running. Start server with: npm run dev
```
**Solution**: Start your Express server before running integration tests.

#### Configuration Errors
```
❌ Configuration validation failed
```
**Solution**: Check your `.env` file has all required variables.

#### Network Timeouts
```
❌ Request error: timeout
```
**Solution**: Increase timeout values or check server responsiveness.

### Test Failure Analysis

#### Unit Test Failures
- Review component implementations
- Check token service encryption
- Verify middleware functionality

#### Integration Test Failures
- Check Express server configuration
- Verify route implementations
- Review middleware stack

#### Security Test Failures
- **Critical**: Fix immediately if CSRF tests fail
- Review state parameter implementation
- Check session security

## Development Workflow

### Before Committing Code
```bash
# Run full test suite
npm test

# Verify no failures
echo $?  # Should return 0
```

### Continuous Testing
```bash
# Watch mode (manual)
nodemon --exec "npm test" --watch routes --watch services --watch middleware
```

### Test-Driven Development
1. Write failing test
2. Implement feature
3. Run tests until passing
4. Refactor if needed

## Advanced Usage

### Custom Test Configuration

Modify test parameters in individual test files:

```javascript
// oauth-integration-tests.js
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 15000,
  retryAttempts: 3
};
```

### Adding New Tests

1. Create test file following naming convention
2. Extend appropriate base class or create new one
3. Add to test runner in `oauth-test-runner.js`
4. Update package.json scripts
5. Document in this README

### Mock Configuration

For unit tests requiring external service mocking:

```javascript
// Mock Strava API responses
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: 'mock_token' })
  })
);
```

## Troubleshooting

### Common Error Patterns

#### "Cannot read property of undefined"
- Check environment variable loading
- Verify configuration object structure

#### "ECONNREFUSED"
- Server not running
- Wrong port configuration
- Network connectivity issues

#### "Invalid session"
- Session configuration problems
- Cookie handling issues
- Session storage problems

### Debug Mode

Enable detailed logging:
```bash
DEBUG=oauth:* npm test
```

Add debug output to tests:
```javascript
console.log('Debug:', { request: req.session, tokens: tokenManager.getTokens(req) });
```

## Security Considerations

### Test Data
- Tests use mock data only
- No real Strava tokens in tests
- Sensitive data properly sanitized

### Rate Limiting
- Tests respect API rate limits
- Includes delays between requests
- Uses test-specific rate limit configurations

### CSRF Protection
- Critical security tests included
- State parameter validation tested
- Session binding verification

## Contributing

### Adding Tests
1. Follow existing patterns
2. Include both positive and negative test cases
3. Add comprehensive error handling
4. Document test purpose and expectations

### Test Naming
- Use descriptive test names
- Include expected behavior
- Group related tests logically

### Code Coverage
Current test coverage focuses on:
- OAuth flow completeness
- Security vulnerabilities
- Error handling robustness
- Integration points

## Performance Benchmarks

### Expected Test Times
- Unit tests: < 1 second
- Integration tests: 2-5 seconds
- CSRF tests: 3-7 seconds
- Error handling tests: 5-10 seconds
- Complete suite: < 30 seconds

### Resource Usage
- Memory: < 100MB during test execution
- Network: Minimal (only to localhost)
- CPU: Low to moderate

## Release Checklist

Before releasing OAuth implementation:
- [ ] All tests pass (100% success rate)
- [ ] No security vulnerabilities detected
- [ ] Performance within acceptable limits
- [ ] Documentation updated
- [ ] Error handling comprehensive
- [ ] Token refresh mechanism working
- [ ] CSRF protection verified

---

*Generated for Shopify Custom Map Printing Platform - OAuth Test Suite v1.0*