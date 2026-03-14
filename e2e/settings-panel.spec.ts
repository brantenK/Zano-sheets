import { test, expect } from './fixtures';

async function recoverIfErrorOverlay(page: import('@playwright/test').Page) {
  const tryAgainButton = page.getByRole('button', { name: /try again/i });
  const hasOverlay = await tryAgainButton.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasOverlay) {
    const techDetailsButton = page.getByRole('button', { name: /technical details/i });
    const hasTechButton = await techDetailsButton.isVisible({ timeout: 500 }).catch(() => false);
    if (hasTechButton) {
      await techDetailsButton.click();
      const detailsText = await page.locator('body').innerText();
      console.log('[E2E overlay details]', detailsText);
    }
    await tryAgainButton.click();
    await page.waitForLoadState('networkidle');
  }
}

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.log('[E2E pageerror]', err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[E2E console.error]', msg.text());
      }
    });

    await page.goto('/taskpane.html');
    await page.evaluate(() => {
      try {
        localStorage.setItem('zanosheets-onboarding-complete', '2');
      } catch {}
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await recoverIfErrorOverlay(page);

    const skipTourButton = page.getByRole('button', { name: /skip for now|skip tour/i }).first();
    if (await skipTourButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipTourButton.click();
    }
  });

  test('should open settings panel', async ({ page }) => {
    const settingsTab = page.getByRole('tab', { name: /^settings$/i }).first();
    await settingsTab.click();
    await expect(page.getByText(/api configuration/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show provider selection', async ({ page }) => {
    const settingsTab = page.getByRole('tab', { name: /^settings$/i }).first();
    await settingsTab.click();

    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible({ timeout: 5000 });
  });

  test('should be dismissible', async ({ page }) => {
    const settingsTab = page.getByRole('tab', { name: /^settings$/i }).first();
    await settingsTab.click();
    await expect(page.getByText(/api configuration/i)).toBeVisible({ timeout: 5000 });

    const chatTab = page.getByRole('tab', { name: /^chat$/i }).first();
    await chatTab.click();
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  });

  test('should switch between chat and settings tabs', async ({ page }) => {
    const settingsTab = page
      .getByRole('tab', { name: /^settings$/i })
      .or(page.locator('button').filter({ hasText: /^Settings$/i }))
      .first();
    await settingsTab.click();

    await expect(page.getByText(/api configuration/i)).toBeVisible({ timeout: 5000 });

    const chatTab = page.getByRole('tab', { name: /^chat$/i }).first();
    await chatTab.click();

    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show custom endpoint fields when provider is set to custom', async ({ page }) => {
    const settingsTab = page
      .getByRole('tab', { name: /^settings$/i })
      .or(page.locator('button').filter({ hasText: /^Settings$/i }))
      .first();
    await settingsTab.click();

    const providerSelect = page.locator('select').first();

    await providerSelect.selectOption('custom');

    await expect(page.getByText('Base URL')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Model ID')).toBeVisible({ timeout: 5000 });
  });
});
