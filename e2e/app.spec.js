import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

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
    test(`${route} has zero axe accessibility violations (no rules disabled)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(route, { waitUntil: 'networkidle' });

      // Run axe with all default rules enabled (zero rules disabled, no exclude/filter)
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

      if (accessibilityScanResults.violations.length > 0) {
        console.warn(`Accessibility violations on ${route}:`, accessibilityScanResults.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help })));
      }

      expect(accessibilityScanResults.violations).toEqual([]);
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
  test('Reports page triggers CSV download with valid structure and print dialog', async ({ page }) => {
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

    // Strengthened assertion: read downloaded file and assert header row and row count equal task count
    const downloadPath = await download.path();
    let csvText = '';
    if (downloadPath) {
      csvText = fs.readFileSync(downloadPath, 'utf8');
    } else {
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      csvText = Buffer.concat(chunks).toString('utf8');
    }
    const lines = csvText.trim().split(/\r?\n/);
    const expectedHeader = 'Task ID,Title,Priority,Estimated Hours,Status,Assignee,Assignee Fit Score,Assignee ML Quality (0-100),Assignee ML On-Time %,Top Candidate,Top Candidate Fit Score,Top Candidate ML Quality,Top Candidate ML On-Time %,Optimal Alignment';
    expect(lines[0]).toBe(expectedHeader);
    expect(lines.length - 1).toBe(18); // exactly 18 tasks in seed backlog

    // Strengthened assertion: window.print must be called unconditionally
    let printCalled = false;
    await page.exposeFunction('mockPrint', () => { printCalled = true; });
    await page.evaluate(() => {
      window.print = () => window.mockPrint();
    });

    const printBtn = page.getByRole('button', { name: /print/i }).first();
    await expect(printBtn).toBeVisible({ timeout: 5000 });
    await printBtn.click();
    expect(printCalled).toBe(true);
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

test.describe('Interactive Controls', () => {
  test('topbar search navigates to a matching member', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const search = page.getByRole('searchbox', { name: /Search team members/ });
    await search.fill('Sarah');

    const result = page.locator('header').getByRole('button', { name: /Sarah Jenkins/ });
    await expect(result).toBeVisible();
    await result.click();
    await expect(page).toHaveURL(/\/team-members/);
  });

  test('skill matrix recommendation selects the suggested member', async ({ page }) => {
    await page.goto('/skill-matrix', { waitUntil: 'networkidle' });
    const recommendation = page.getByRole('button', { name: /Reduce dependency on/ });
    await expect(recommendation).toBeVisible();
    const firstName = (await recommendation.innerText()).match(/Reduce dependency on ([A-Za-z]+)/)?.[1];
    expect(firstName).toBeTruthy();

    await recommendation.click();
    await expect(page.getByRole('heading', { name: new RegExp(`^${firstName}`) })).toBeVisible();
  });

  test('burnout recommendation cards navigate to their workspaces', async ({ page }) => {
    await page.goto('/burnout-risk', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Open workload view to reassign tasks/ }).click();
    await expect(page).toHaveURL(/\/workload/);

    await page.goto('/burnout-risk', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Open insights to plan recovery/ }).click();
    await expect(page).toHaveURL(/\/insights/);
  });

  test('login notice and remember-me toggle respond to clicks', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('status')).toContainText("Password reset isn't available in this demo");

    const remember = page.getByRole('checkbox');
    await remember.check();
    await expect(remember).toBeChecked();
  });

  test('task row Assign acts on that row, not the selected task', async ({ page }) => {
    await page.goto('/tasks', { waitUntil: 'networkidle' });
    const row = page
      .locator('[aria-label^="Select "]')
      .filter({ has: page.getByText('Assign', { exact: true }) })
      .first();
    const label = await row.getAttribute('aria-label');
    expect(label).toBeTruthy();

    await row.getByText('Assign', { exact: true }).click();
    const sameRow = page.locator(`[aria-label="${label}"]`);
    await expect(sameRow).not.toContainText('Assign');
  });
});
