/**
 * Helper utilities for E2E tests
 * 
 * This file contains reusable helper functions for Playwright E2E tests.
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for page to fully load including network requests
 */
export async function waitForPageLoad(page: Page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Handle authentication flow
 * Supports guest mode and OAuth flows
 */
export async function ensureAuthenticated(page: Page) {
  // Check if we're on the login page
  const isLoginPage = await page.locator('text=Sign in').isVisible().catch(() => false);
  
  if (isLoginPage) {
    console.log('Authentication required - attempting guest mode');
    
    // Try guest authentication
    const guestButton = page.locator('text=Enter').or(page.locator('text=Guest'));
    if (await guestButton.isVisible().catch(() => false)) {
      await guestButton.click();
      await waitForPageLoad(page);
      return;
    }
    
    // If guest mode not available, check for configured auth
    const signInButton = page.locator('button:has-text("Sign in")');
    if (await signInButton.isVisible().catch(() => false)) {
      console.log('OAuth authentication required - configure test credentials');
      // In a real scenario, handle OAuth flow here
    }
  }
}

/**
 * Navigate to a specific page and wait for it to load
 */
export async function navigateTo(page: Page, path: string, baseUrl: string) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  await page.goto(url);
  await waitForPageLoad(page);
}

/**
 * Search for an entity in the catalog
 */
export async function searchInCatalog(page: Page, searchTerm: string) {
  const searchInput = page.locator('input[placeholder*="search" i]').or(
    page.locator('input[type="search"]')
  ).first();
  
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(1000); // Wait for search results
    return true;
  }
  
  return false;
}

/**
 * Click on a tab by name
 */
export async function clickTab(page: Page, tabName: string) {
  const tab = page.locator(`button:has-text("${tabName}")`).or(
    page.locator(`[role="tab"]:has-text("${tabName}")`)
  );
  
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await waitForPageLoad(page);
    return true;
  }
  
  return false;
}

/**
 * Select the first service from the catalog
 */
export async function selectFirstService(page: Page) {
  const serviceLink = page.locator('[data-testid="entity-link"]').or(
    page.locator('a[href*="/catalog/"]')
  ).first();
  
  if (await serviceLink.isVisible().catch(() => false)) {
    await serviceLink.click();
    await waitForPageLoad(page);
    return true;
  }
  
  return false;
}

/**
 * Generate a unique test identifier
 */
export function generateTestId(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if an element is visible with a timeout
 */
export async function isElementVisible(
  page: Page, 
  selector: string, 
  timeout = 5000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for any of multiple selectors to be visible
 */
export async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeout = 10000
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    for (const selector of selectors) {
      if (await isElementVisible(page, selector, 100)) {
        return selector;
      }
    }
    await page.waitForTimeout(500);
  }
  
  return null;
}

/**
 * Fill a form field by name or placeholder
 */
export async function fillFormField(
  page: Page,
  fieldName: string,
  value: string
): Promise<boolean> {
  const input = page.locator(`input[name="${fieldName}"]`).or(
    page.locator(`textarea[name="${fieldName}"]`).or(
      page.locator(`input[placeholder*="${fieldName}" i]`)
    )
  ).first();
  
  if (await input.isVisible().catch(() => false)) {
    await input.fill(value);
    return true;
  }
  
  return false;
}

/**
 * Click a button by text
 */
export async function clickButton(
  page: Page,
  buttonText: string
): Promise<boolean> {
  const button = page.locator(`button:has-text("${buttonText}")`);
  
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    return true;
  }
  
  return false;
}

/**
 * Wait for a success message to appear
 */
export async function waitForSuccessMessage(
  page: Page,
  timeout = 10000
): Promise<boolean> {
  const successSelectors = [
    'text=success',
    'text=Success',
    'text=created successfully',
    'text=completed',
    '[data-testid="success-message"]',
    '.MuiAlert-standardSuccess'
  ];
  
  const foundSelector = await waitForAnySelector(page, successSelectors, timeout);
  return foundSelector !== null;
}

/**
 * Wait for an error message to appear
 */
export async function waitForErrorMessage(
  page: Page,
  timeout = 10000
): Promise<boolean> {
  const errorSelectors = [
    'text=error',
    'text=Error',
    'text=failed',
    '[data-testid="error-message"]',
    '.MuiAlert-standardError'
  ];
  
  const foundSelector = await waitForAnySelector(page, errorSelectors, timeout);
  return foundSelector !== null;
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  path = 'screenshots'
) {
  const timestamp = Date.now();
  await page.screenshot({ 
    path: `${path}/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Log a test step for better debugging
 */
export function logStep(stepName: string, details?: any) {
  console.log(`[E2E Test] ${stepName}`, details || '');
}

/**
 * Retry an action multiple times
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if a feature/plugin is available
 */
export async function isFeatureAvailable(
  page: Page,
  featureName: string
): Promise<boolean> {
  // Check for tab, button, or link with feature name
  const featureIndicators = [
    page.locator(`button:has-text("${featureName}")`),
    page.locator(`a:has-text("${featureName}")`),
    page.locator(`[role="tab"]:has-text("${featureName}")`)
  ];
  
  for (const indicator of featureIndicators) {
    if (await indicator.isVisible().catch(() => false)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get text content from an element
 */
export async function getTextContent(
  page: Page,
  selector: string
): Promise<string | null> {
  try {
    const element = page.locator(selector).first();
    return await element.textContent();
  } catch {
    return null;
  }
}

/**
 * Verify multiple elements are visible
 */
export async function verifyElementsVisible(
  page: Page,
  selectors: string[],
  timeout = 5000
): Promise<{ selector: string; visible: boolean }[]> {
  const results = [];
  
  for (const selector of selectors) {
    const visible = await isElementVisible(page, selector, timeout);
    results.push({ selector, visible });
  }
  
  return results;
}
