import { test, expect } from '@playwright/test';

/**
 * Resources Tests
 * Tests for file browser functionality
 */

test.describe('Resources', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/resources');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Resources - Authenticated', () => {
  test.skip('should display resources page', async ({ page }) => {
    await page.goto('/resources');

    await expect(page.locator('h1:has-text("Resources")')).toBeVisible();
    await expect(page.locator('text=Access course materials')).toBeVisible();
  });

  test.skip('should display search input', async ({ page }) => {
    await page.goto('/resources');

    const searchInput = page.locator('input[placeholder="Search files..."]');
    await expect(searchInput).toBeVisible();
  });

  test.skip('should display breadcrumb navigation', async ({ page }) => {
    await page.goto('/resources');

    // Home button should be visible
    const homeButton = page.locator('button:has(svg.lucide-home)');
    await expect(homeButton).toBeVisible();
  });

  test.skip('should filter resources on search', async ({ page }) => {
    await page.goto('/resources');

    const searchInput = page.locator('input[placeholder="Search files..."]');
    await searchInput.fill('test');

    // Wait for filtering
    await page.waitForTimeout(300);

    // Results should update
    // (depends on data)
  });

  test.skip('should navigate into folder on click', async ({ page }) => {
    await page.goto('/resources');

    // Click on first folder (if exists)
    const folderButton = page.locator('button').filter({ has: page.locator('svg.lucide-folder') }).first();
    if (await folderButton.isVisible()) {
      const folderName = await folderButton.textContent();
      await folderButton.click();

      // Breadcrumb should update
      await expect(page.locator(`text=${folderName}`)).toBeVisible();
    }
  });

  test.skip('should show back button when in folder', async ({ page }) => {
    await page.goto('/resources');

    const folderButton = page.locator('button').filter({ has: page.locator('svg.lucide-folder') }).first();
    if (await folderButton.isVisible()) {
      await folderButton.click();

      const backButton = page.locator('button:has-text("Back")');
      await expect(backButton).toBeVisible();
    }
  });
});

test.describe('Resources - File Actions', () => {
  test.skip('should show download button on file hover', async ({ page }) => {
    await page.goto('/resources');

    const fileRow = page.locator('[data-type="file"]').first();
    if (await fileRow.isVisible()) {
      await fileRow.hover();

      const downloadButton = fileRow.locator('button:has(svg.lucide-download)');
      await expect(downloadButton).toBeVisible();
    }
  });

  test.skip('should show preview button for PDF files', async ({ page }) => {
    await page.goto('/resources');

    const pdfFile = page.locator('[data-file-type="pdf"]').first();
    if (await pdfFile.isVisible()) {
      await pdfFile.hover();

      const previewButton = pdfFile.locator('button:has(svg.lucide-eye)');
      await expect(previewButton).toBeVisible();
    }
  });
});
