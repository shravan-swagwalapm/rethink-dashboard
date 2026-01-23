import { test, expect } from '@playwright/test';

/**
 * Calendar Tests
 * Tests for calendar view and RSVP functionality
 */

test.describe('Calendar', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Calendar - Authenticated', () => {
  // These tests would use authenticated session

  test.skip('should display calendar page', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.locator('h1:has-text("Calendar")')).toBeVisible();
    await expect(page.locator('text=View and RSVP to upcoming sessions')).toBeVisible();
  });

  test.skip('should display month navigation', async ({ page }) => {
    await page.goto('/calendar');

    // Month name should be visible
    const monthYear = page.locator('text=/[A-Z][a-z]+ \\d{4}/');
    await expect(monthYear).toBeVisible();

    // Navigation buttons
    await expect(page.locator('button:has(svg.lucide-chevron-left)')).toBeVisible();
    await expect(page.locator('button:has(svg.lucide-chevron-right)')).toBeVisible();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
  });

  test.skip('should display weekday headers', async ({ page }) => {
    await page.goto('/calendar');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const day of days) {
      await expect(page.locator(`text=${day}`)).toBeVisible();
    }
  });

  test.skip('should navigate to previous month', async ({ page }) => {
    await page.goto('/calendar');

    const prevButton = page.locator('button:has(svg.lucide-chevron-left)');
    const monthText = page.locator('h3, h2').filter({ hasText: /[A-Z][a-z]+ \d{4}/ });

    const initialMonth = await monthText.textContent();
    await prevButton.click();

    await expect(monthText).not.toHaveText(initialMonth!);
  });

  test.skip('should navigate to next month', async ({ page }) => {
    await page.goto('/calendar');

    const nextButton = page.locator('button:has(svg.lucide-chevron-right)');
    const monthText = page.locator('h3, h2').filter({ hasText: /[A-Z][a-z]+ \d{4}/ });

    const initialMonth = await monthText.textContent();
    await nextButton.click();

    await expect(monthText).not.toHaveText(initialMonth!);
  });

  test.skip('should toggle UTC timezone', async ({ page }) => {
    await page.goto('/calendar');

    const utcToggle = page.locator('button[role="switch"]').first();
    await utcToggle.click();

    // Toggle should be checked
    await expect(utcToggle).toHaveAttribute('data-state', 'checked');
  });

  test.skip('should display legend', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page.locator('text=Attending')).toBeVisible();
    await expect(page.locator('text=Not attending')).toBeVisible();
    await expect(page.locator('text=Pending RSVP')).toBeVisible();
  });
});

test.describe('Calendar - RSVP', () => {
  test.skip('should open session details dialog', async ({ page }) => {
    await page.goto('/calendar');

    // Click on a session (if exists)
    const sessionButton = page.locator('button').filter({ hasText: /AM|PM/ }).first();
    if (await sessionButton.isVisible()) {
      await sessionButton.click();

      // Dialog should open
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test.skip('should display RSVP buttons in dialog', async ({ page }) => {
    await page.goto('/calendar');

    const sessionButton = page.locator('button').filter({ hasText: /AM|PM/ }).first();
    if (await sessionButton.isVisible()) {
      await sessionButton.click();

      await expect(page.locator('button:has-text("Yes")')).toBeVisible();
      await expect(page.locator('button:has-text("Can\'t make it")')).toBeVisible();
    }
  });
});
