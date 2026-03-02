# End-to-End User Journey Tests

This directory contains end-to-end (E2E) tests for the Internal Developer Platform using Playwright.

## Overview

These tests validate complete user journeys through the UI, ensuring that critical workflows function correctly from the user's perspective.

## Test Scenarios

### 1. Service Creation Journey
**Path**: Login → Select Template → Fill Parameters → Create → Verify in Catalog

Tests the complete flow of creating a new service using Golden Path templates.

### 2. Cost Viewing Journey
**Path**: Login → Search Service → View Cost Data

Tests the ability to view cost information for services, including Kubernetes and AWS costs.

### 3. Deployment Status Journey
**Path**: Login → View Service → Check Deployment Status → Trigger Sync

Tests viewing deployment status across environments and triggering manual syncs.

### 4. Unified Search Journey
Tests the global search functionality across services, documentation, APIs, and teams.

### 5. Service Maturity Scorecard Journey
Tests viewing service maturity scorecards with all five categories.

## Prerequisites

1. **Node.js**: Version 20 or 22
2. **Yarn**: Latest version
3. **Playwright**: Installed via `yarn install`
4. **Running Platform**: Backend and frontend must be running

## Running the Tests

### Option 1: Run with Auto-Start (Recommended for Local Development)

The tests will automatically start the backend and frontend if they're not already running:

```bash
yarn test:e2e
```

### Option 2: Run Against Already Running Platform

If you already have the platform running in separate terminals:

```bash
# Terminal 1: Start backend
yarn start backend

# Terminal 2: Start frontend
yarn start app

# Terminal 3: Run E2E tests
PLAYWRIGHT_URL=http://localhost:3000 yarn test:e2e
```

### Run Specific Test

```bash
yarn test:e2e user-journeys.spec.ts
```

### Run in Headed Mode (See Browser)

```bash
yarn test:e2e --headed
```

### Run in Debug Mode

```bash
yarn test:e2e --debug
```

### Run with UI Mode (Interactive)

```bash
yarn test:e2e --ui
```

## Test Configuration

The tests are configured in `playwright.config.ts` at the root of the project.

### Key Configuration Options

- **Timeout**: 60 seconds per test
- **Base URL**: `http://localhost:3000` (configurable via `PLAYWRIGHT_URL`)
- **Retries**: 2 retries in CI, 0 in local development
- **Screenshots**: Captured on failure
- **Trace**: Captured on first retry

### Environment Variables

- `PLAYWRIGHT_URL`: Override the base URL (default: `http://localhost:3000`)
- `CI`: Set to enable CI mode (more retries, stricter checks)

## Test Structure

Each test follows the Arrange-Act-Assert pattern with clear steps:

```typescript
test('Test name', async ({ page }) => {
  await test.step('Step 1: Description', async () => {
    // Test actions
  });
  
  await test.step('Step 2: Description', async () => {
    // Test actions
  });
});
```

## Authentication

The tests include a helper function `ensureAuthenticated()` that handles authentication:

- For local development, it attempts to use guest mode if available
- For production, you may need to configure OAuth credentials
- Authentication state can be saved and reused across tests

## Troubleshooting

### Tests Fail with "Timeout"

- Ensure backend and frontend are running
- Increase timeout in `playwright.config.ts`
- Check network connectivity

### Tests Fail with "Element Not Found"

- The UI may have changed - update selectors
- Plugins may not be configured - check plugin installation
- Data may not be available - seed test data

### Authentication Issues

- Check if authentication is required
- Configure test credentials if needed
- Use guest mode for local testing

## Viewing Test Reports

After running tests, view the HTML report:

```bash
yarn playwright show-report e2e-test-report
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    yarn install
    yarn build:all
    yarn test:e2e
  env:
    CI: true
    PLAYWRIGHT_URL: http://localhost:7007
```

## Best Practices

1. **Keep Tests Independent**: Each test should be able to run independently
2. **Use Test Data**: Generate unique test data (e.g., timestamps in names)
3. **Clean Up**: Clean up test data after tests (if applicable)
4. **Stable Selectors**: Use data-testid attributes for stable selectors
5. **Wait Properly**: Use Playwright's auto-waiting, avoid arbitrary timeouts
6. **Handle Failures Gracefully**: Tests should handle missing features gracefully

## Adding New Tests

To add new user journey tests:

1. Add a new test case in `user-journeys.spec.ts`
2. Follow the existing pattern with clear steps
3. Use helper functions for common actions
4. Document the journey path in comments
5. Test locally before committing

## Related Documentation

- [Playwright Documentation](https://playwright.dev/)
- [Backstage E2E Testing](https://backstage.io/docs/plugins/testing)
- [Design Document - Testing Strategy](../.kiro/specs/internal-developer-platform/design.md#testing-strategy)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Playwright documentation
- Contact the platform team
