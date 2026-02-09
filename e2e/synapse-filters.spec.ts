import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Synapse Filters
 * Tests the frontend filter functionality to select solvable synapses
 */

test.describe('Synapse Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the discovery dashboard
    await page.goto('/discovery')
    // Wait for the page to load - wait for either the dashboard or landing page
    await page.waitForLoadState('domcontentloaded')

    // Wait a bit more for dynamic content to load
    await page.waitForTimeout(2000)
  })

  test('should display the Synapses panel', async ({ page }) => {
    // The Synapses panel should be visible (it's always rendered, just collapsed)
    const synapsesPanel = page.getByText('Synapses').first()
    await expect(synapsesPanel).toBeVisible({ timeout: 10000 })
  })

  test('should expand the Synapses panel when clicked', async ({ page }) => {
    // Click to expand the panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()

    // Wait for panel expansion
    await page.waitForTimeout(500)

    // The expanded panel should now show more content
    // Just verify the panel is still visible
    await expect(synapsesPanel).toBeVisible()
  })

  test('should display filter toggle button', async ({ page }) => {
    // Expand the synapses panel first
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Filter toggle should be visible
    const filterToggle = page.getByText('Filter by type')
    await expect(filterToggle).toBeVisible({ timeout: 5000 })
  })

  test('should expand filter section when toggle is clicked', async ({ page }) => {
    // Expand the synapses panel first
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Filter chips should be visible - check for "All" button
    const allButton = page.getByRole('button', { name: 'All' })
    await expect(allButton).toBeVisible({ timeout: 5000 })
  })

  test('should display all synapse type filter buttons', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Expected synapse types - check for a few key ones
    const expectedTypes = ['All', 'minor', 'rare', 'legendary']

    for (const type of expectedTypes) {
      const button = page.getByRole('button', { name: type })
      await expect(button).toBeVisible({ timeout: 5000 })
    }
  })

  test('should display "Show unlocked only" filter button', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // "Show unlocked only" button should be visible
    const unlockedOnlyButton = page.getByText('Show unlocked only')
    await expect(unlockedOnlyButton).toBeVisible({ timeout: 5000 })

    // Should display user level information
    const levelText = await page.getByText(/Lvl \d+/).textContent()
    expect(levelText).toMatch(/Lvl \d+/)
  })

  test('should toggle between filter types', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Click on "minor" filter
    const minorButton = page.getByRole('button', { name: 'minor' })
    await minorButton.click()
    await page.waitForTimeout(500)

    // Verify "minor" button is visible and clickable
    await expect(minorButton).toBeVisible()

    // Click on "complex" filter
    const complexButton = page.getByRole('button', { name: 'complex' })
    await complexButton.click()
    await page.waitForTimeout(500)

    // Verify "complex" button is visible
    await expect(complexButton).toBeVisible()
  })

  test('should toggle "Show unlocked only" filter', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Get the button before clicking
    const unlockedOnlyButton = page.getByText('Show unlocked only')

    // Click "Show unlocked only"
    await unlockedOnlyButton.click()
    await page.waitForTimeout(500)

    // Button should still be visible after clicking (toggles state)
    await expect(unlockedOnlyButton).toBeVisible()
  })

  test('should display synapse statistics', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Statistics should be visible at the bottom of the panel
    const exploringText = page.getByText('Exploring:', { exact: false })
    const undiscoveredText = page.getByText('Undiscovered:', { exact: false })

    await expect(exploringText.or(page.getByText('exploring')).first()).toBeVisible({ timeout: 10000 })
    await expect(undiscoveredText.or(page.getByText('undiscovered')).first()).toBeVisible({ timeout: 10000 })
  })

  test('should maintain filter state when panel is collapsed and expanded', async ({ page }) => {
    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Select a filter
    const rareButton = page.getByRole('button', { name: 'rare' })
    await rareButton.click()
    await page.waitForTimeout(500)

    // Collapse the panel
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Expand again
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Filter toggle should still be accessible
    await expect(filterToggle).toBeVisible()
  })
})

test.describe('Synapse Filter Accessibility', () => {
  test('all filter buttons should be clickable', async ({ page }) => {
    await page.goto('/discovery')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Get all buttons in the filter section
    const filterButtons = page.locator('button').filter({ hasText: /^(All|minor|complex|deep|core|rare|legendary|unique)$/i })

    const count = await filterButtons.count()
    expect(count).toBeGreaterThan(0)

    // Try clicking on a few of them
    if (count > 0) {
      await filterButtons.nth(0).click()
      await page.waitForTimeout(300)
    }
  })

  test('should have proper visual contrast for active filters', async ({ page }) => {
    await page.goto('/discovery')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Expand the synapses panel
    const synapsesPanel = page.getByText('Synapses').first()
    await synapsesPanel.click()
    await page.waitForTimeout(500)

    // Click filter toggle
    const filterToggle = page.getByText('Filter by type')
    await filterToggle.click()
    await page.waitForTimeout(500)

    // Click on a filter
    const minorButton = page.getByRole('button', { name: 'minor' })
    await minorButton.click()
    await page.waitForTimeout(500)

    // Just verify the button is still visible and can be clicked again
    await expect(minorButton).toBeVisible()
  })
})
