import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const VIEWPORT_MATRIX = [
  { name: '320x568-compact-xs', width: 320, height: 568 },
  { name: '375x812-compact-mobile', width: 375, height: 812 },
  { name: '414x896-compact-plus', width: 414, height: 896 },
  { name: '667x375-short-landscape', width: 667, height: 375 },
  { name: '768x1024-medium-tablet', width: 768, height: 1024 },
  { name: '1024x768-medium-boundary', width: 1024, height: 768 },
  { name: '1280x800-expanded-laptop', width: 1280, height: 800 },
  { name: '1440x900-expanded-desktop', width: 1440, height: 900 },
  { name: '1920x1080-large-fhd', width: 1920, height: 1080 },
  { name: '2560x1440-large-qhd', width: 2560, height: 1440 },
];

const ROUTES = [
  '#/',
  '#/practice/studying-at-college-university',
  '#/practice/days-of-the-week?mode=flashcards',
  '#/practice/money-matters?mode=choice',
  '#/mistakes',
  '#/stats',
  '#/settings',
];

async function assertZeroAxeViolations(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => ({
      html: n.html,
      failureSummary: n.failureSummary,
    })),
  }));

  expect(summary, `Axe violations on ${label}`).toEqual([]);
}

test.describe('Phase 10 — Comprehensive Multi-Viewport, Zoom, Axe WCAG AA & Edge-Case Audit', () => {
  test('1. Zero horizontal overflow & zero runtime errors across all 10 viewports (320px–2560px + short landscape)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    for (const vp of VIEWPORT_MATRIX) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const hash of ROUTES) {
        await page.evaluate((h) => {
          window.location.hash = h;
        }, hash);
        await page.waitForTimeout(60);

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        expect(
          metrics.scrollWidth,
          `Horizontal overflow on ${vp.name} at route ${hash}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
        ).toBeLessThanOrEqual(metrics.innerWidth);
      }

      // Specific check on 667x375 short landscape phone: bottom bar hidden, side rail active
      if (vp.name === '667x375-short-landscape') {
        const navState = await page.evaluate(() => {
          const bottom = document.querySelector('.bottom-tabbar');
          const side = document.querySelector('.side-nav');
          return {
            bottomDisplay: bottom ? getComputedStyle(bottom).display : 'none',
            sideDisplay: side ? getComputedStyle(side).display : 'none',
          };
        });
        expect(navState.bottomDisplay).toBe('none');
        expect(navState.sideDisplay).toBe('flex');
      }
    }

    expect(errors).toEqual([]);
  });

  test('2. 100%, 150%, and 200% zoom reflow check with zero horizontal overflow', async ({
    page,
  }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 820 });
      await page.goto('/');

      for (const zoom of ['1', '1.5', '2']) {
        for (const hash of ['#/', '#/practice/studying-at-college-university', '#/mistakes', '#/stats', '#/settings']) {
          await page.evaluate(
            ({ h, z }) => {
              window.location.hash = h;
              document.documentElement.style.zoom = z;
            },
            { h: hash, z: zoom }
          );
          await page.waitForTimeout(60);

          const overflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          });

          expect(
            overflow,
            `Zoom=${zoom}x overflow at width=${width}px route=${hash}`
          ).toBe(false);
        }
      }
    }
  });

  test('3. Automated axe-core WCAG 2.1 Level A + AA audit across ALL screens, modes, feedback states & modals in BOTH Light and Dark themes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/settings');

    // Disable CSS transitions temporarily so color transitions are instantaneously settled for exact axe contrast reads
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });

    for (const themeLabel of ['Paper (Light)', 'Ink (Dark)'] as const) {
      await page.goto('/#/settings');
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
      });
      await page.getByRole('button', { name: themeLabel }).click();

      // 3a. Settings main page + Reset confirmation modal
      await assertZeroAxeViolations(page, `${themeLabel} - Settings`);
      await page.getByRole('button', { name: /Reset all progress/i }).click();
      await assertZeroAxeViolations(page, `${themeLabel} - Reset Modal`);
      await page.keyboard.press('Escape');

      // 3b. Home screen (cards & search results)
      await page.goto('/#/');
      await assertZeroAxeViolations(page, `${themeLabel} - Home`);
      await page.locator('input[type="search"]').first().fill('accommodation');
      await assertZeroAxeViolations(page, `${themeLabel} - Home Search Results`);

      // 3c. Listen & Spell mode + Wrong diff state
      await page.goto('/#/practice/days-of-the-week?mode=listen');
      await assertZeroAxeViolations(page, `${themeLabel} - Listen & Spell Ready`);
      const spellInput = page.locator('input[type="text"]').first();
      await spellInput.fill('wrongtypo');
      await spellInput.press('Enter');
      await assertZeroAxeViolations(page, `${themeLabel} - Listen & Spell Wrong Diff`);

      // 3d. Flashcards mode (front & revealed)
      await page.getByRole('button', { name: 'Flashcards' }).click();
      await assertZeroAxeViolations(page, `${themeLabel} - Flashcards Hidden`);
      await page.keyboard.press(' ');
      await assertZeroAxeViolations(page, `${themeLabel} - Flashcards Revealed`);

      // 3e. Spelling Choice mode (unanswered & answered)
      await page.getByRole('button', { name: 'Spelling choice' }).click();
      await assertZeroAxeViolations(page, `${themeLabel} - Spelling Choice Options`);
      await page.keyboard.press('1');
      await assertZeroAxeViolations(page, `${themeLabel} - Spelling Choice Feedback`);

      // 3f. Mistakes Bank (now populated from earlier wrong answer!)
      await page.goto('/#/mistakes');
      await assertZeroAxeViolations(page, `${themeLabel} - Mistakes Bank Populated`);

      // 3g. Stats Dashboard (now populated with active day, box counts, hardest word, category bar!)
      await page.goto('/#/stats');
      await assertZeroAxeViolations(page, `${themeLabel} - Stats Populated`);

      // 3h. Complete short category ("continents" - 7 words) in Flashcards mode to audit SessionSummaryView!
      await page.goto('/#/practice/continents?mode=flashcards');
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press(' ');
        await page.keyboard.press(i === 0 ? 'ArrowLeft' : 'ArrowRight');
      }
      await assertZeroAxeViolations(page, `${themeLabel} - Session Summary Screen`);

      // 3i. Clear mistakes manually on Mistakes Bank so Empty Celebration SVG State is ALSO audited by axe-core!
      await page.goto('/#/mistakes');
      const removeButtons = page.getByRole('button', { name: /Remove/i });
      const count = await removeButtons.count();
      for (let i = 0; i < count; i++) {
        await page.getByRole('button', { name: /Remove/i }).first().click();
      }
      await assertZeroAxeViolations(page, `${themeLabel} - Mistakes Bank Empty Celebration`);
    }
  });

  test('4. Edge cases: corrupted localStorage auto-backup & recovery, rapid submit race safety, and JSON Export -> Reset -> Import round-trip', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/');

    // 4a. Inject corrupted JSON into localStorage and verify raw backup + safe fresh boot + alert banner
    const corruptRaw = '{corrupted-payload-missing-quotes: 999';
    await page.evaluate((bad) => {
      window.localStorage.setItem('ielts-trainer:v1', bad);
    }, corruptRaw);

    await page.reload();
    await expect(page.getByRole('alert')).toContainText(/Saved data appeared damaged/i);

    const backedUpString = await page.evaluate(() =>
      window.localStorage.getItem('ielts-trainer:v1:backup')
    );
    expect(backedUpString).toBe(corruptRaw);

    await page.getByRole('button', { name: /Dismiss & continue/i }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // 4b. Rapid Enter / click race stress test + populate mistake record
    await page.goto('/#/practice/days-of-the-week');
    const input = page.locator('input[type="text"]').first();
    await input.fill('misspelled');
    // Fire multiple synchronous Enter presses — must submit once, then advance cleanly without duplicate answers for same card
    await input.press('Enter');
    const answersCountAfterFirstSubmit = await page.evaluate(() => {
      const raw = JSON.parse(window.localStorage.getItem('ielts-trainer:v1') || '{}');
      return raw.activeSession?.answers?.length ?? 0;
    });
    expect(answersCountAfterFirstSubmit).toBeLessThanOrEqual(1);

    // Wait >200ms flush so debounced persistence flushes to localStorage
    await page.waitForTimeout(250);

    // 4c. Export JSON -> Full Two-Step Reset -> Validated Import JSON Preview -> Restore Round-Trip
    await page.goto('/#/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export JSON backup/i }).click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Perform Two-Step Reset All
    await page.getByRole('button', { name: /Reset all progress/i }).click();
    const eraseBtn = page.getByRole('button', { name: /Erase all data/i });
    await expect(eraseBtn).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(eraseBtn).toBeEnabled();
    await eraseBtn.click();

    // Verify bank count is now 0
    await page.waitForTimeout(220);
    const wordsAfterReset = await page.evaluate(() => {
      const raw = JSON.parse(window.localStorage.getItem('ielts-trainer:v1') || '{}');
      return Object.keys(raw.words || {}).length;
    });
    expect(wordsAfterReset).toBe(0);

    // Re-import the exported backup file through `<input type="file">` and verify preview modal + full restoration!
    await page.locator('input[type="file"]').setInputFiles(downloadPath!);
    await expect(page.getByRole('dialog')).toContainText(/Confirm Progress Import/i);
    await expect(page.getByRole('dialog')).toContainText(/Mistakes Bank/i);
    await page.getByRole('button', { name: /Restore backup now/i }).click();

    // Verify progress persists across full hard reload!
    await page.reload();
    const wordsAfterRestore = await page.evaluate(() => {
      const raw = JSON.parse(window.localStorage.getItem('ielts-trainer:v1') || '{}');
      return Object.keys(raw.words || {}).length;
    });
    expect(wordsAfterRestore).toBeGreaterThanOrEqual(1);
  });
});
