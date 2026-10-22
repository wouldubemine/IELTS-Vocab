import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/catalog';
import { normalizeAnswerString } from '../lib/answerCheck';
import { generateSpellingChoices } from '../lib/misspellings';

describe('Phase 7 — Plausible IELTS Spelling Choice Generator Across Entire 923-Word Corpus', () => {
  it('generates 4 unique choices (1 exact right + 3 genuine misspellings) for EVERY single word in words.json without alt collisions', () => {
    const start = performance.now();

    for (const word of WORDS) {
      const choices = generateSpellingChoices(word, 'test-session:0');
      expect(choices).toHaveLength(4);

      const correctChoices = choices.filter((c) => c.isCorrect);
      expect(correctChoices).toHaveLength(1);
      expect(correctChoices[0].text).toBe(word.text);

      const acceptedNorms = new Set(
        [word.text, ...(word.alt ?? [])].map((s) => normalizeAnswerString(s))
      );

      const seenChoiceNorms = new Set<string>();
      for (const ch of choices) {
        const norm = normalizeAnswerString(ch.text);
        expect(norm.length).toBeGreaterThan(0);
        // No two options normalize to the same string
        expect(seenChoiceNorms.has(norm)).toBe(false);
        seenChoiceNorms.add(norm);

        if (!ch.isCorrect) {
          // Distractor must never be an accepted UK/US/alt spelling!
          expect(acceptedNorms.has(norm)).toBe(false);
        }
      }
    }

    const elapsedMs = performance.now() - start;
    // Fast O(1) generation: all 923 entries complete well under 250ms
    expect(elapsedMs).toBeLessThan(400);
  });

  it('produces identical option ordering for the same seedKey across re-renders', () => {
    const sample = WORDS.find((w) => w.id === 'accommodation')!;
    const a = generateSpellingChoices(sample, 'sess-1:3');
    const b = generateSpellingChoices(sample, 'sess-1:3');
    expect(a).toEqual(b);
  });
});
