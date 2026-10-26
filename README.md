<div align="center">

# Lexicon Folio

**A free, offline-ready trainer for the 1,200 most repeated IELTS Listening words.**

[![Live Demo](https://img.shields.io/badge/demo-live-2ea44f)](https://ielts-vocab-henna.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-brightgreen)

[Live demo](https://ielts-vocab-henna.vercel.app) · [Report a bug](../../issues) · [Request a feature](../../issues)

<!-- Add a screenshot or GIF here: -->
<!-- ![Lexicon Folio screenshot](docs/screenshot.png) -->

</div>

---

## Why this exists

IELTS Listening punishes spelling mistakes. Most vocabulary tools are paid, need an account, or only test reading. Lexicon Folio trains **listening + spelling together**, works **offline**, and is **free**.

## Features

- **1,200 words** across **37 official IELTS topic categories**
- **4 practice modes**
  | Mode | What it trains |
  |---|---|
  | Listen & Spell | Dictation at IELTS pace, slow replay, letter hints, character-level error feedback, UK/US spelling accepted |
  | Flashcards | Audio prompt, tap or swipe to grade, keyboard shortcuts |
  | Spelling Choice | 4 options with auto-generated IELTS spelling traps (double consonants, `ie`/`ei`, transpositions) |
  | Read & Type | Brief flash, then spell from memory (also the fallback if no speech voices exist) |
- **Mistakes Bank** that fills on every wrong answer and clears after N correct answers (configurable), with manual pinning for exam-eve review
- **5-box Leitner spaced repetition**
- **Offline and private**: progress is saved in your browser, with JSON export/import and no account
- **Accessible design**: light and dark themes, WCAG AA contrast, responsive from 320px to 2560px, respects `prefers-reduced-motion`

## Quick start

```bash
git clone https://github.com/wouldubemine/IELTS-Vocab.git
cd IELTS-Vocab
npm install
npm run dev
```

Open `http://localhost:5173`.

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run unit and static checks (Vitest) |
| `npm run build` | Type-check and build for production |
| `npm run test:e2e` | Run Playwright end-to-end and accessibility tests |

## Customizing the vocabulary

No code changes needed. Edit [`words.json`](words.json) and every category is picked up automatically. To regenerate it from a PDF source:

```bash
python3 scripts/build_words.py
```

**Optional human audio:** put MP3 files at `public/audio/<word-id>.mp3`. The app plays recorded clips first and falls back to browser speech synthesis (`en-GB`, `en-AU`, then `en-US`).

## Tech stack

React 19 · TypeScript · Vite 6 · Web Speech API · localStorage · Vitest · Playwright · axe-core

## Project structure

```
src/            App source code
scripts/        Vocabulary build tools
e2e/            Playwright tests
words.json      Vocabulary data
docs/           QA report and data-cleaning notes
```

## Contributing

Contributions are welcome, especially new words, audio recordings, bug fixes, and translations. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
