import type { Word } from '../types/word';

export type DiffOpKind = 'equal' | 'missing' | 'extra' | 'swapped' | 'wrong';

export interface DiffSegment {
  kind: DiffOpKind;
  expected?: string; // canonical character(s) expected
  actual?: string; // character(s) learner typed
}

export interface AnswerCheckResult {
  isCorrect: boolean;
  isEmpty: boolean;
  matchedVariant?: string;
  closestTarget: string;
  normalizedInput: string;
  diff: DiffSegment[];
  summaryCounts: {
    missing: number;
    extra: number;
    swapped: number;
    wrong: number;
  };
}

const MAX_DIFF_CHARS = 120;

/**
 * Normalizes learner input and candidate target answers per Spec Section 4.3:
 * - Case-insensitive
 * - Trim leading/trailing whitespace
 * - Strip trailing punctuation (e.g. mobile keyboard double-space period `.`)
 * - Treat hyphens/dashes (`-`, `–`, `—`) and spaces as equal
 * - Collapse repeated spaces into a single space
 * - Normalize curly smart apostrophes (`’`, `‘`) to straight ASCII `'`
 */
export function normalizeAnswerString(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\u2018\u2019\u02BC`]/g, "'")
    .trim()
    .replace(/[.,;:!?…]+$/g, '')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function foldDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Optimal String Alignment (Damerau–Levenshtein) character diff:
 * Produces minimal edit script between `actual` and `expected`, explicitly
 * detecting adjacent transposed letter pairs (`swapped`, e.g. "recieve" <-> "receive")
 * alongside `missing`, `extra`, and `wrong` (substituted) characters.
 */
export function computeCharacterDiff(
  actualRaw: string,
  expectedRaw: string
): { distance: number; segments: DiffSegment[] } {
  const a = actualRaw.slice(0, MAX_DIFF_CHARS);
  const b = expectedRaw.slice(0, MAX_DIFF_CHARS);
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  const eq = (chA: string, chB: string) => {
    if (chA.toLowerCase() === chB.toLowerCase()) return true;
    // Treat space and hyphen as equivalent during alignment too
    if ((chA === ' ' || chA === '-') && (chB === ' ' || chB === '-')) {
      return true;
    }
    return false;
  };

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = eq(a[i - 1], b[j - 1]) ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1, // extra char in actual
        dp[i][j - 1] + 1, // missing char from expected
        dp[i - 1][j - 1] + cost // match or substitution
      );

      if (
        i > 1 &&
        j > 1 &&
        eq(a[i - 1], b[j - 2]) &&
        eq(a[i - 2], b[j - 1]) &&
        !eq(a[i - 1], b[j - 1])
      ) {
        best = Math.min(best, dp[i - 2][j - 2] + 1); // adjacent swap!
      }
      dp[i][j] = best;
    }
  }

  // Backtrack optimal path
  const rawSteps: DiffSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (
      i > 1 &&
      j > 1 &&
      eq(a[i - 1], b[j - 2]) &&
      eq(a[i - 2], b[j - 1]) &&
      !eq(a[i - 1], b[j - 1]) &&
      dp[i][j] === dp[i - 2][j - 2] + 1
    ) {
      rawSteps.push({
        kind: 'swapped',
        actual: `${a[i - 2]}${a[i - 1]}`,
        expected: `${b[j - 2]}${b[j - 1]}`,
      });
      i -= 2;
      j -= 2;
    } else if (i > 0 && j > 0 && eq(a[i - 1], b[j - 1]) && dp[i][j] === dp[i - 1][j - 1]) {
      rawSteps.push({
        kind: 'equal',
        actual: a[i - 1],
        expected: b[j - 1],
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
      rawSteps.push({
        kind: 'missing',
        expected: b[j - 1],
      });
      j -= 1;
    } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
      rawSteps.push({
        kind: 'extra',
        actual: a[i - 1],
      });
      i -= 1;
    } else {
      rawSteps.push({
        kind: 'wrong',
        actual: a[i - 1],
        expected: b[j - 1],
      });
      i -= 1;
      j -= 1;
    }
  }

  rawSteps.reverse();

  // Merge adjacent identical non-swapped segment kinds for cleaner visual reading
  const merged: DiffSegment[] = [];
  for (const step of rawSteps) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === step.kind && step.kind !== 'swapped') {
      prev.actual = (prev.actual ?? '') + (step.actual ?? '');
      prev.expected = (prev.expected ?? '') + (step.expected ?? '');
    } else {
      merged.push({ ...step });
    }
  }

  return { distance: dp[m][n], segments: merged };
}

/**
 * Evaluates a learner's answer strictly against `word.text` and `word.alt`.
 * Picks the closest accepted spelling when building a diff so UK/US learners see
 * exact feedback relative to the variant they were trying to write.
 */
export function evaluateSpellingAttempt(
  rawAttempt: string,
  word: Word
): AnswerCheckResult {
  const normalizedInput = normalizeAnswerString(rawAttempt);

  if (!normalizedInput) {
    return {
      isCorrect: false,
      isEmpty: true,
      closestTarget: word.text,
      normalizedInput: '',
      diff: [],
      summaryCounts: { missing: 0, extra: 0, swapped: 0, wrong: 0 },
    };
  }

  const candidates = [word.text, ...(word.alt ?? [])];
  for (const candidate of candidates) {
    const normCandidate = normalizeAnswerString(candidate);
    if (
      normalizedInput === normCandidate ||
      foldDiacritics(normalizedInput) === foldDiacritics(normCandidate)
    ) {
      return {
        isCorrect: true,
        isEmpty: false,
        matchedVariant: candidate,
        closestTarget: candidate,
        normalizedInput,
        diff: [{ kind: 'equal', actual: candidate, expected: candidate }],
        summaryCounts: { missing: 0, extra: 0, swapped: 0, wrong: 0 },
      };
    }
  }

  // Near-miss or wrong answer: align against the closest candidate (ties favor `word.text`)
  const cleanDisplayInput = rawAttempt
    .trim()
    .replace(/[.,;:!?…]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_DIFF_CHARS);

  let bestTarget = word.text;
  let bestDiff = computeCharacterDiff(cleanDisplayInput, word.text);

  for (const altCandidate of word.alt ?? []) {
    const candidateDiff = computeCharacterDiff(cleanDisplayInput, altCandidate);
    if (candidateDiff.distance < bestDiff.distance) {
      bestTarget = altCandidate;
      bestDiff = candidateDiff;
    }
  }

  const summaryCounts = { missing: 0, extra: 0, swapped: 0, wrong: 0 };
  for (const seg of bestDiff.segments) {
    if (seg.kind === 'missing') summaryCounts.missing += seg.expected?.length ?? 1;
    else if (seg.kind === 'extra') summaryCounts.extra += seg.actual?.length ?? 1;
    else if (seg.kind === 'swapped') summaryCounts.swapped += 1;
    else if (seg.kind === 'wrong') summaryCounts.wrong += seg.expected?.length ?? 1;
  }

  return {
    isCorrect: false,
    isEmpty: false,
    closestTarget: bestTarget,
    normalizedInput,
    diff: bestDiff.segments,
    summaryCounts,
  };
}

/**
 * Progressive Hint Generator (Spec Sections 4.2 & 4.3):
 * - Level 0: reveals nothing at all.
 * - Level 1: reveals first letter of phrase + masked slots + word lengths + optional meaning clue.
 * - Level 2: reveals ~35% letters (including initial letter of every word).
 * - Level 3: reveals ~65% letters while still leaving final characters to recall.
 */
export interface ProgressiveHintInfo {
  level: number;
  maxLevel: number;
  maskedPattern: string;
  metaCaption: string;
  meaningClue?: string;
}

export function buildProgressiveHint(
  word: Word,
  level: number
): ProgressiveHintInfo | null {
  if (level <= 0) return null;
  const clampedLevel = Math.min(3, level);
  const text = word.text;
  const wordParts = text.split(/(\s+|-|\/)/);
  const lexicalWords = text
    .split(/[\s\-/]+/)
    .filter(Boolean);

  const lengthSummary =
    lexicalWords.length > 1
      ? `${lexicalWords.length} words (${lexicalWords.map((w) => w.length).join(', ')} letters)`
      : `${text.length} letters`;

  let globalLetterIdx = 0;
  const masked = wordParts
    .map((part) => {
      if (/^(\s+|-|\/)$/.test(part)) {
        return part === ' ' ? '   ' : ` ${part} `;
      }
      return [...part]
        .map((ch, idxInWord) => {
          const isPunct = ch === "'";
          const idx = globalLetterIdx++;
          if (isPunct) return "'";

          let reveal = false;
          if (clampedLevel === 1) {
            reveal = idx === 0;
          } else if (clampedLevel === 2) {
            reveal = idxInWord === 0 || idx % 3 === 0;
          } else {
            reveal = idxInWord === 0 || idx % 3 !== 2;
          }
          return reveal ? ch : '_';
        })
        .join(' ');
    })
    .join('');

  return {
    level: clampedLevel,
    maxLevel: 3,
    maskedPattern: masked,
    metaCaption: `Hint ${clampedLevel}/3 · ${lengthSummary}`,
    meaningClue: word.hint,
  };
}
