# Lexicon Folio — IELTS Listening Vocabulary Trainer

A tactile, offline-ready web application for mastering the **1,200 most commonly repeated IELTS Listening words** across all **37 official topic categories**, built with React 19, TypeScript, Vite 6, custom *Paper & Ink* design tokens, Web Speech pronunciation synthesis, 5-box Leitner spaced repetition, and an automatic **Mistakes Bank**.

---

## Features

- **4 Complete Practice Modes** across any Category, Mixed Test, or Mistakes Bank drill:
  1. **Listen & Spell** — Dictation at clear IELTS pacing (`~0.9×`), normal & slow (`0.68×`) replay, progressive letter hints, Damerau–Levenshtein character-level diff feedback (`missing`, `extra`, `swapped`, `wrong`), and automatic UK/US alternative spelling acceptance (`alt`).
  2. **Flashcards** — Audio prompt, tap/`Space` reveal, touch drag-swipe left/right physics, and `←` / `→` keyboard self-grading.
  3. **Spelling Choice** — 4-option multiple choice powered by an automatic IELTS spelling-trap generator (double consonants, `ie`/`ei` & suffix confusions, transpositions, medial omissions) that strictly excludes valid alternative spellings.
  4. **Read & Type** — Brief visual flash followed by spelling recall from memory (also acts as automatic fallback on devices without speech synthesis voices).
- **Automatic Mistakes Bank & 5-Box Leitner Scheduler** — Every wrong answer enters the Mistakes Bank immediately, clears after `N` consecutive right answers (`2–5`, configurable in Settings), and supports manual **Pinning** for permanent exam-eve review.
- **Full Offline Persistence & Portability** — Versioned `localStorage` (`ielts-trainer:v1`) with corruption backup (`ielts-trainer:v1:backup`), cross-tab `storage` sync, JSON backup export, validated import preview dialog, and two-step full reset.
- **Paper & Ink Visual System** — Warm archival Light & Dark themes (`>= 4.9:1` WCAG AA contrast verified across all tokens), fluid 4-tier responsive layout (`320px` to `2560px` + short landscape phones + `visualViewport` mobile keyboard inset handling), and 60fps GPU-only motion respecting `prefers-reduced-motion`.

---

## Extending Vocabulary & Optional Pre-Recorded Audio

- **Adding words or categories (zero code changes required):**
  Edit `/words.json` directly (or regenerate from PDF via `python3 scripts/build_words.py`). Every category present in `words.json` is automatically discovered and surfaced with deterministic editorial monograms and equal-lightness tints.
- **Optional human audio pack drop-in:**
  Place MP3 recordings at `/public/audio/<word-id>.mp3` (for example, `public/audio/accommodation.mp3`). The audio engine automatically probes and plays pre-recorded clips first, seamlessly falling back to quality-ranked British (`en-GB`), Australian (`en-AU`), or American (`en-US`) Web Speech synthesis.

---

## Development & Verification Scripts

```bash
npm install
npm run dev        # Start live dev server on 0.0.0.0:5173
npm test           # Run all 26 Vitest unit & static WCAG/CSS checks
npm run build      # Strict tsc -b typecheck + production Vite bundle
npm run test:e2e   # Run Playwright Chromium multi-viewport, 200% zoom, & axe-core AA suite
```
