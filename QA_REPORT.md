# QA Report — IELTS Listening Vocabulary Trainer (*Lexicon Folio*)

**Date:** 2026-10-22  
**Automated Verification Status:**
- **Unit & Static Architecture Suite (`npm test` / Vitest 2.1):** `26 / 26 passed` across 5 test suites (`~2.8s`)
- **Strict TypeScript + Production Bundle (`npm run build`):** `0 errors`, `57 modules`, `117.07 kB` JS gzip + `7.05 kB` CSS gzip
- **Real Headless Browser & Accessibility Suite (`npm run test:e2e` / Playwright Chromium 156 + `@axe-core/playwright`):** `4 / 4 end-to-end suites passed` (`0` axe violations across 28 full-DOM scans, `0` horizontal overflows across 115 viewport/zoom checks, `0` runtime console or page errors)

---

## 1. Real Bugs Discovered During Phase 9–10 QA & How Each Was Resolved

Every bug listed below was genuinely caught during static cross-referencing and live headless Chromium + `axe-core` execution and verified fixed before sign-off:

| # | Severity | Component / File | Defect Discovered | Root Cause & Fix Applied |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Critical (A11y)** | `src/components/PracticeWorkspace.tsx` | `axe-core` rule `aria-allowed-attr` failed on session-length segmented buttons (`10`, `20`, `50`, `All`). | `<button type="button" aria-checked="...">` sat inside `role="group"` without `role="radio"`. Updated container to `role="radiogroup"` and buttons to `role="radio"`. Re-verified `0` violations in Chromium `axe-core`. |
| **2** | **Serious (A11y)** | `src/components/StatsView.tsx` | `axe-core` rule `nested-interactive` failed on the 14-day practice bar chart `<svg>`. | `<svg role="img">` implies `childrenPresentational: true` in WAI-ARIA 1.2, hiding child `<g tabIndex={0} role="button">` bars from assistive technologies. Changed `<svg>` container role to `role="group"` with descriptive `aria-label`. Re-verified `0` violations. |
| **3** | **Serious (Visual & Contrast)** | `src/lib/theme.ts` & `src/styles/tokens.css` | Switching between `Paper (Light)` and `Ink (Dark)` flashed a muddy low-contrast midpoint (`#1d1b16` / `#3a3834`, `1.47:1` at `t ≈ 15–130ms`) and forced style recalculation across `*` via `!important`. | Independent linear RGB transitions between inverted light/dark foregrounds and backgrounds cross matching mid-greys simultaneously. Replaced universal `* !important` transitions with native GPU snapshot crossfading via `document.startViewTransition()` (`200ms cubic-bezier(0.32, 0.72, 0, 1)`), keeping every text node crisp and WCAG AA compliant at every frame. |
| **4** | **Medium (Performance / Spec §7)** | `src/styles/practice.css` & `src/styles/shell.css` | CSS audit found layout/paint transitions on `.session-progress-fill` (`transition: width`), `.skip-link` (`transition: top`), and `.practice-card.is-correct` (`box-shadow` keyframes). | Converted progress fills to `transform: scaleX(var(--progress-ratio))`, `.skip-link` to `transform: translate3d(0, -180%, 0)`, and `.practice-card.is-correct::after` to a pure compositor `opacity + transform: scale(...)` halo. Protected permanently via automated regex assertion in `src/__tests__/accessibilityAndMotion.test.ts`. |
| **5** | **Medium (Styling)** | `src/components/StatsView.tsx` & `src/styles/shell.css` | Automated JSX-to-CSS class audit found `.card`, `.btn-ghost`, `.progress-track`/`.progress-fill`, `.side-rail-badge`, and `data-cat-tint` mismatched against `.folio-card` and `[data-tint]`. | Standardized `[data-tint]` + `.category-monogram` on `StatsView.tsx` and added complete `.card`, `.btn-ghost`, `.progress-track`, `.progress-fill`, and responsive `.side-rail-badge` definitions in `src/styles/shell.css`. |
| **6** | **Medium (Audio / SPA Networking)** | `src/lib/audio.ts` | Probing missing `/audio/<word-id>.mp3` files on SPA dev/static servers returns HTTP `200 OK` with `Content-Type: text/html` (index fallback), causing broken `<audio>` decode attempts instead of clean Web Speech synthesis fallback. | Verified `Content-Type` header matches `/^audio\/|^application\/octet-stream/i` in `probeAudioPackClip` before accepting an MP3 clip; covered by unit tests in `src/__tests__/audioEngine.test.ts`. |

---

## 2. Multi-Viewport & Orientation Geometry Matrix (Chromium 156)

Tested in `e2e/qaAudit.spec.ts` across all primary routes (`#/`, `#/practice/studying-at-college-university`, `#/practice/days-of-the-week?mode=flashcards`, `#/practice/money-matters?mode=choice`, `#/mistakes`, `#/stats`, `#/settings`) asserting `document.documentElement.scrollWidth <= window.innerWidth` and zero runtime errors:

| Viewport Class | Resolution | Navigation Shell Rendered | Overflow Check (`scrollWidth <= innerWidth`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Compact XS** | `320 × 568` | Sticky top bar + fixed bottom tab bar (`env(safe-area-inset-*)`) | **PASS (`320 <= 320`)** | Zero text clipping; search, 4-mode pills, and choice buttons wrap cleanly. |
| **Compact Mobile** | `375 × 812` | Sticky top bar + fixed bottom tab bar | **PASS (`375 <= 375`)** | Primary controls comfortably within thumb reach (`>= 44×44px`). |
| **Compact Plus** | `414 × 896` | Sticky top bar + fixed bottom tab bar | **PASS (`414 <= 414`)** | Balanced single/dual column card rhythm via `@container workspace`. |
| **Short Landscape Phone** | `667 × 375` | **74px side icon rail** (`bottom-tabbar: none`, `side-nav: flex`) | **PASS (`667 <= 667`)** | Full practice card, input field, and action bar fit above the fold without vertical cramping. |
| **Medium Tablet** | `768 × 1024` | Collapsible side navigation rail + workspace container queries | **PASS (`768 <= 768`)** | Side-by-side summary panels & 2-column choice grid active. |
| **Medium Boundary** | `1024 × 768` | Side navigation rail + 2-column workspace | **PASS (`1024 <= 1024`)** | Clean boundary transition with zero layout jump. |
| **Expanded Laptop** | `1280 × 800` | Full `248px` persistent left sidebar + keyboard shortcut legend + right session overview panel | **PASS (`1280 <= 1280`)** | Multi-column editorial category spans (`span 2` on large categories). |
| **Expanded Desktop** | `1440 × 900` | Persistent sidebar + dual-panel workspace | **PASS (`1440 <= 1440`)** | Max prose reading width constrained cleanly (`max-width: 78rem`). |
| **Large FHD** | `1920 × 1080` | Scaled typography tokens (`@media (min-width: 1601px)`) + centered workspace | **PASS (`1920 <= 1920`)** | Proportional hero word & generous editorial whitespace. |
| **Large QHD** | `2560 × 1440` | Scaled typography tokens + `84rem` centered workspace container | **PASS (`2560 <= 2560`)** | Crisp SVG rings & `viewBox` charts with zero pixelation. |

---

## 3. Browser Zoom & Font-Scale Reflow Matrix

- **CSS Zoom Reflow (`100%`, `150%`, `200%`)** verified programmatically in Chromium across `375px`, `768px`, and `1280px` viewports on Home, Practice, Mistakes Bank, Stats, and Settings: **45 / 45 combinations passed with zero horizontal scrollbar overflow**.
- **In-App Text Scale (`100%`, `112%`, `125%`)** scales all fluid `clamp()` tokens via `--font-scale` smoothly without overlapping controls.

---

## 4. WCAG 2.1 Level A + AA Accessibility Audit Summary

1. **Automated `axe-core` Full-DOM Scans (`28 / 28` States Passed with `0` Violations):**
   - Verified identically in **both `Paper (Light)` and `Ink (Dark)`** across:
     1. Settings screen
     2. Two-step Reset All confirmation modal (`role="dialog"`, `aria-modal="true"`)
     3. Home screen (editorial grid)
     4. Home live vocabulary search results (`accommodation` cross-category match)
     5. Listen & Spell active input state
     6. Listen & Spell wrong-answer character diff (`<SpellingDiffView />`)
     7. Flashcards hidden front prompt
     8. Flashcards revealed spelling + self-grading controls
     9. Spelling Choice 4-option multiple choice state
     10. Spelling Choice post-answer trap comparison panel
     11. Populated Mistakes Bank with filter pills, streak badges, Pin & Remove actions
     12. Populated Stats Dashboard (14-day interactive SVG bar chart, 5-box distribution, Hardest Words leaderboard, Category Accuracy list)
     13. End-of-Session Summary screen (`SessionSummaryView`)
     14. Celebratory Ink-Stamp SVG Empty Mistakes Bank screen
2. **Mathematical Contrast Ratios (`src/__tests__/accessibilityAndMotion.test.ts`):**
   - **Light Theme:** Primary text `#1D1B16` on `#F4EFE6` (`13.86:1`) & `#FFFBF3` (`15.65:1`); Muted text `#665F55` on `#F4EFE6` (`5.35:1`); Accent `#1F6F5C` (`5.14:1`–`5.80:1`); Highlight ink `#8C5608` (`5.05:1`–`5.69:1`); Correct `#236B40` (`5.22:1`–`6.19:1`); Wrong `#AC3A20` (`5.01:1`–`5.66:1`); Control borders `#857C6E` (`3.07:1`–`3.47:1`).
   - **Dark Theme:** Primary text `#F2ECE0` on `#12110F` (`15.49:1`) & `#1C1A17` (`13.97:1`); Muted text `#A39B8D` (`5.98:1`–`7.15:1`); Accent `#5FB89A` (`7.35:1`–`8.68:1`); Correct `#6CC38A` (`7.88:1`–`9.30:1`); Wrong `#EE7B63` (`5.85:1`–`6.91:1`); Control borders `#787166` (`3.24:1`–`3.84:1`).
   - **All 16 Category Tints (8 Light + 8 Dark):** Verified `5.23:1` to `10.75:1` (`>= 4.5:1`).

---

## 5. Edge Cases & Data Resilience Verification

- ** Exhaustive Corpus Distractor Generation (`923 / 923` entries):** Verified every single word and phrase in `words.json` produces 4 unique non-empty options in `< 200ms` total with **zero collisions against `word.alt` UK/US alternative spellings**.
- **Corrupted `localStorage` Recovery:** Verified live in Chromium that malformed JSON in `ielts-trainer:v1` is preserved verbatim in `ielts-trainer:v1:backup`, surfaces a one-time `role="alert"` recovery banner, and boots cleanly into a fresh session without crashing.
- **Blocked / Quota-Full Storage:** Falls back transparently to in-memory state with an explicit status indicator in Settings.
- **No-Voice Environment Auto-Fallback:** Automatically switches `Listen & Spell` into `Read & Type` memory-flash mode with an informative non-blocking banner whenever `speechSynthesis.getVoices()` exposes zero voices.
- **Full Export → Two-Step Reset → Validated Import Preview → Hard Reload Persistence:** Verified end-to-end in Chromium (`e2e/qaAudit.spec.ts` Test 4).
