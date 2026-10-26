# Contributing to Lexicon Folio

Thanks for helping IELTS learners! Contributions of any size are welcome.

## Ways to help

- **Add or fix words** in `words.json` (spelling, category, UK/US alternatives)
- **Record audio**: add MP3 clips as `public/audio/<word-id>.mp3`
- **Report bugs** or suggest features via [Issues](../../issues)
- **Improve code, tests, or accessibility**

## Getting started

```bash
git clone https://github.com/wouldubemine/IELTS-Vocab.git
cd IELTS-Vocab
npm install
npm run dev
```

## Before opening a pull request

1. Create a branch: `git checkout -b feature/short-description`
2. Keep changes focused. One topic per pull request.
3. Make sure everything passes:
   ```bash
   npm test
   npm run build
   npm run test:e2e
   ```
4. Describe what you changed and why in the pull request.

## Vocabulary guidelines

- Use the most common IELTS spelling and list valid UK/US alternatives.
- Put each word in exactly one of the existing categories (or propose a new one in an issue).
- Don't add copyrighted text or audio you don't have the right to share.

## Reporting bugs

Please include your browser and device, steps to reproduce, and what you expected to happen.

## Code of conduct

Be respectful and constructive. Harassment or discrimination is not tolerated.
