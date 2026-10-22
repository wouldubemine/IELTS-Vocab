import { describe, expect, it } from 'vitest';
import {
  buildProgressiveHint,
  evaluateSpellingAttempt,
  normalizeAnswerString,
} from '../lib/answerCheck';
import type { Word } from '../types/word';

const NEIGHBOR_WORD: Word = {
  id: 'neighborhood',
  text: 'neighborhood',
  category: 'homes',
  alt: ['neighbourhood'],
};

const HYPHEN_WORD: Word = {
  id: 'interest-free-credit',
  text: 'interest-free credit',
  category: 'money-matters',
};

describe('Phase 5 — Exact Answer Checking, Edge Cases & Letter-Level Diff', () => {
  it('handles case, extra spaces, hyphen-vs-space equivalence, smart quotes, and trailing punctuation', () => {
    expect(normalizeAnswerString('  Interest-Free   Credit. ')).toBe(
      'interest free credit'
    );

    expect(
      evaluateSpellingAttempt('interest free credit', HYPHEN_WORD).isCorrect
    ).toBe(true);
    expect(
      evaluateSpellingAttempt('  INTEREST-FREE   CREDIT! ', HYPHEN_WORD).isCorrect
    ).toBe(true);

    const registrar: Word = {
      id: 'registrars-office',
      text: "registrar's office",
      category: 'studying-at-college-university',
      alt: ['registrars office'],
    };
    // iOS smart apostrophe `’` matches ASCII `'`
    expect(
      evaluateSpellingAttempt('Registrar’s office', registrar).isCorrect
    ).toBe(true);
  });

  it('accepts British/American `alt` variants and picks the closest variant when showing a miss diff', () => {
    expect(
      evaluateSpellingAttempt('neighbourhood', NEIGHBOR_WORD).isCorrect
    ).toBe(true);
    expect(
      evaluateSpellingAttempt('neighborhood', NEIGHBOR_WORD).isCorrect
    ).toBe(true);

    // Near-miss closer to British variant ("neigbourhood" missing 'h') compares against "neighbourhood"!
    const ukMiss = evaluateSpellingAttempt('neigbourhood', NEIGHBOR_WORD);
    expect(ukMiss.isCorrect).toBe(false);
    expect(ukMiss.closestTarget).toBe('neighbourhood');
    expect(ukMiss.summaryCounts.missing).toBe(1);
    expect(ukMiss.summaryCounts.wrong).toBe(0);
  });

  it('accurately pinpoints missing, extra, swapped (transposed), and wrong letters', () => {
    const receive: Word = { id: 'receive', text: 'receive', category: 'verbs' };
    const swappedRes = evaluateSpellingAttempt('recieve', receive);
    expect(swappedRes.isCorrect).toBe(false);
    expect(swappedRes.summaryCounts.swapped).toBe(1);
    expect(swappedRes.diff.some((s) => s.kind === 'swapped')).toBe(true);

    const accomm: Word = {
      id: 'accommodation',
      text: 'accommodation',
      category: 'places',
    };
    const missingRes = evaluateSpellingAttempt('accomodation', accomm);
    expect(missingRes.isCorrect).toBe(false);
    expect(missingRes.summaryCounts.missing).toBe(1);

    const extraRes = evaluateSpellingAttempt('accommmodation', accomm);
    expect(extraRes.isCorrect).toBe(false);
    expect(extraRes.summaryCounts.extra).toBe(1);
  });

  it('guards empty whitespace submissions and huge pasted inputs without crashing or freezing', () => {
    const emptyRes = evaluateSpellingAttempt('   ', NEIGHBOR_WORD);
    expect(emptyRes.isEmpty).toBe(true);
    expect(emptyRes.isCorrect).toBe(false);

    const hugePaste = 'x'.repeat(25_000);
    const start = performance.now();
    const pasteRes = evaluateSpellingAttempt(hugePaste, NEIGHBOR_WORD);
    const elapsed = performance.now() - start;
    expect(pasteRes.isCorrect).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });

  it('never leaks letters at hint level 0 and progressively reveals letters across levels 1..3', () => {
    const word: Word = {
      id: 'stationery',
      text: 'stationery',
      category: 'studying-at-college-university',
      hint: 'writing paper, pens, and office supplies',
    };

    expect(buildProgressiveHint(word, 0)).toBeNull();

    const h1 = buildProgressiveHint(word, 1)!;
    const h2 = buildProgressiveHint(word, 2)!;
    const h3 = buildProgressiveHint(word, 3)!;

    const countUnderscores = (s: string) => (s.match(/_/g) ?? []).length;
    expect(countUnderscores(h1.maskedPattern)).toBe(9);
    expect(countUnderscores(h2.maskedPattern)).toBeLessThan(
      countUnderscores(h1.maskedPattern)
    );
    expect(countUnderscores(h3.maskedPattern)).toBeLessThan(
      countUnderscores(h2.maskedPattern)
    );
    expect(h1.meaningClue).toBe('writing paper, pens, and office supplies');
  });
});
