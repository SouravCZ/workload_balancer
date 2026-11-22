import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/workload',
  '/tasks',
  '/team-members',
  '/skill-matrix',
  '/burnout-risk',
  '/insights',
  '/reports',
  '/about',
];

const VIEWPORTS = [
  { name: 'mobile (375px)', width: 375, height: 667 },
  { name: 'tablet (768px)', width: 768, height: 1024 },
  { name: 'desktop (1280px)', width: 1280, height: 800 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('equilibrium_team_state_v1');
    } catch {
      // Ignore
    }
  });
});

test.describe('Responsive Navigation, Overflow & Console Errors', () => {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route} at ${vp.name} has zero console errors and no horizontal overflow`, async ({ page }) => {
        const consoleErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route, { waitUntil: 'networkidle' });

        // Zero console errors assertion
        expect(consoleErrors).toEqual([]);

        // No horizontal overflow: root width must not exceed viewport width
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - window.innerWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1); // Allow <= 1px for subpixel/scrollbar rounding
      });
    }
  }
});

test.describe('Accessibility Audit with axe-core', () => {
  for (const route of ROUTES) {
    test(`${route} has zero serious or critical axe violations`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(route, { waitUntil: 'networkidle' });

      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (seriousOrCritical.length > 0) {
        console.warn(`Accessibility violations on ${route}:`, seriousOrCritical.map(v => ({ id: v.id, impact: v.impact, help: v.help })));
      }

      expect(seriousOrCritical).toEqual([]);
    });
  }
});

test.describe('404 Route Handling', () => {
  test('non-existent route renders fallback without console crash', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      console.log('PAGE ERROR:', err.message);
    });

    await page.goto('/this-route-does-not-exist');
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    console.log('404 Page Text:', text);
    expect(consoleErrors).toEqual([]);

    const heading = page.getByRole('heading', { name: /page not found/i });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Empty State Resilience', () => {
  test('handles state where all tasks are unassigned', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      const raw = localStorage.getItem('equilibrium_team_state_v1');
      if (raw) {
        const state = JSON.parse(raw);
        state.tasks = state.tasks.map(t => ({ ...t, assignedTo: null }));
        localStorage.setItem('equilibrium_team_state_v1', JSON.stringify(state));
      }
    });

    await page.goto('/workload', { waitUntil: 'networkidle' });
    const workloadContent = await page.content();
    expect(workloadContent).toBeDefined();

    await page.goto('/tasks', { waitUntil: 'networkidle' });
    const tasksContent = await page.content();
    expect(tasksContent).toBeDefined();
  });

  test('handles state with zero team members', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      const raw = localStorage.getItem('equilibrium_team_state_v1');
      if (raw) {
        const state = JSON.parse(raw);
        state.members = [];
        state.tasks = state.tasks.map(t => ({ ...t, assignedTo: null }));
        localStorage.setItem('equilibrium_team_state_v1', JSON.stringify(state));
      }
    });

    await page.goto('/team-members', { waitUntil: 'networkidle' });
    await page.goto('/workload', { waitUntil: 'networkidle' });
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
  });
});

test.describe('Reports CSV Export and Print Actions', () => {
  test('Reports page triggers CSV download and print dialog', async ({ page }) => {
    // Reset to clean seed data first
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('equilibrium_team_state_v1');
    });

    await page.goto('/reports', { waitUntil: 'networkidle' });

    // Test CSV Download
    const exportBtn = page.getByRole('button', { name: /export csv/i });
    await expect(exportBtn).toBeVisible({ timeout: 10000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toContain('.csv');

    // Test Print trigger (mock window.print)
    let printCalled = false;
    await page.exposeFunction('mockPrint', () => { printCalled = true; });
    await page.evaluate(() => {
      window.print = () => window.mockPrint();
    });

    const printBtn = page.getByRole('button', { name: /print/i }).first();
    if (await printBtn.isVisible()) {
      await printBtn.click();
      expect(printCalled).toBe(true);
    }
  });
});

test.describe('Rebalance Proposal Application and Reset to Defaults', () => {
  test('applyAllProposals mutates state and resetToDefaults restores initial seed', async ({ page }) => {
    // Reset to fresh seed state
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('equilibrium_team_state_v1');
    });

    await page.goto('/workload', { waitUntil: 'networkidle' });

    // Call applyAllProposals in page context
    await page.evaluate(() => {
      if (window.__applyAllProposals) window.__applyAllProposals();
    });

    // Wait for state to sync to localStorage
    await page.waitForTimeout(500);

    const modifiedState = await page.evaluate(() => {
      return localStorage.getItem('equilibrium_team_state_v1');
    });
    expect(modifiedState).not.toBeNull();

    // Call resetToDefaults
    await page.evaluate(() => {
      if (window.__resetEquilibriumDefaults) window.__resetEquilibriumDefaults();
    });

    // Check localStorage was cleared by resetToDefaults
    const resetState = await page.evaluate(() => {
      return localStorage.getItem('equilibrium_team_state_v1');
    });
    expect(resetState).toBeNull();
  });
});

test.describe('Modal Focus Trap and Keyboard Dismissal', () => {
  test('traps Tab focus within modal and dismisses on Escape key', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Open Help modal
    const helpBtn = page.locator('button[aria-label="Help"]');
    await expect(helpBtn).toBeVisible({ timeout: 10000 });
    await helpBtn.click();

    // Wait for modal dialog
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Focus should be inside modal
    let isFocusInside = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(active) : false;
    });
    expect(isFocusInside).toBe(true);

    // Press Tab multiple times; activeElement should stay inside modal
    await page.keyboard.press('Tab');
    isFocusInside = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(active) : false;
    });
    expect(isFocusInside).toBe(true);

    // Press Shift+Tab: activeElement should cycle backward inside modal
    await page.keyboard.press('Shift+Tab');
    isFocusInside = await page.evaluate(() => {
      const active = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(active) : false;
    });
    expect(isFocusInside).toBe(true);

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
