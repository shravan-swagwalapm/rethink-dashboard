import { test, expect } from '@playwright/test';

/**
 * Dashboard Tests
 * Tests for the main dashboard functionality
 */

test.describe('Dashboard', () => {
  // Note: These tests require authentication
  // In a real scenario, we'd set up auth state before tests

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display login page UI correctly', async ({ page }) => {
    await page.goto('/login');

    // Verify branding
    await expect(page.locator('text=Rethink Systems')).toBeVisible();
    await expect(page.locator('text=Learning Dashboard')).toBeVisible();

    // Verify gradient orbs (decorative elements)
    const gradientOrbs = page.locator('.blur-3xl');
    await expect(gradientOrbs.first()).toBeVisible();
  });
});

test.describe('Dashboard - Authenticated', () => {
  // These tests would use authenticated session

  test.skip('should display welcome banner', async ({ page }) => {
    // Would require auth setup
    await page.goto('/dashboard');
    await expect(page.locator('text=Good')).toBeVisible(); // Good morning/afternoon/evening
  });

  test.skip('should display stats cards', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('text=Total Students')).toBeVisible();
    await expect(page.locator('text=Attendance')).toBeVisible();
    await expect(page.locator('text=Current Rank')).toBeVisible();
    await expect(page.locator('text=Upcoming Sessions')).toBeVisible();
  });

  test.skip('should display sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Calendar')).toBeVisible();
    await expect(page.locator('text=My Learnings')).toBeVisible();
    await expect(page.locator('text=Resources')).toBeVisible();
  });

  test.skip('should toggle sidebar collapse', async ({ page }) => {
    await page.goto('/dashboard');

    const collapseButton = page.locator('button:has(svg.lucide-chevron-left)');
    await collapseButton.click();

    // Sidebar should be collapsed
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/w-16/);
  });

  test.skip('should toggle theme', async ({ page }) => {
    await page.goto('/dashboard');

    const themeButton = page.locator('button:has(svg.lucide-sun), button:has(svg.lucide-moon)');
    await themeButton.click();

    // Theme should toggle
    const html = page.locator('html');
    // Check class changed
    await expect(html).not.toHaveClass(/dark/);
  });
});
