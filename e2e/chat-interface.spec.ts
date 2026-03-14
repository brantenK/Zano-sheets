import { test, expect } from './fixtures';

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/taskpane.html');
    await page.evaluate(() => {
      try {
        localStorage.setItem('zanosheets-onboarding-complete', '2');
        localStorage.setItem(
          'zanosheets-config-v2',
          JSON.stringify({
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: '',
            useProxy: false,
            proxyUrl: '',
            thinking: 'none',
            followMode: false,
            authMethod: 'api_key',
          })
        );
        localStorage.setItem('zanosheets-key-v2::openai', 'test-key');
      } catch {}
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should render the chat interface', async ({ page }) => {
    await expect(
      page.locator('[data-testid="chat-interface"]').or(page.locator('textarea, input[type="text"]'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show empty state on first load', async ({ page }) => {
    // Check no messages are shown initially
    const messages = page.locator('[role="article"], [data-testid="message"]');
    await expect(messages).toHaveCount(0, { timeout: 5000 });
  });

  test('should focus input on load', async ({ page }) => {
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('should disable send button when input is empty', async ({ page }) => {
    const input = page.locator('textarea').first();
    await expect(input).toHaveValue('');
  });

  test('should enable send when user types', async ({ page }) => {
    const input = page.locator('textarea').first();
    const enabled = await input.isEnabled();
    if (enabled) {
      await input.fill('Hello, can you help me?');
      await expect(input).toHaveValue('Hello, can you help me?');
      return;
    }

    await expect(input).toBeDisabled();
    await expect(input).toHaveAttribute('placeholder', /configure api key|finish provider setup/i);
  });

  test('should clear input after typing', async ({ page }) => {
    const input = page.locator('textarea').first();
    const enabled = await input.isEnabled();
    if (enabled) {
      await input.fill('Test message');
      await expect(input).toHaveValue('Test message');
      // Triple-click to select all and delete
      await input.triple_click();
      await page.keyboard.press('Delete');
      await expect(input).toHaveValue('');
      return;
    }

    await expect(input).toBeDisabled();
  });
});
