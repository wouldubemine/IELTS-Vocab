import type { Word } from '../types/word';
import { normalizeAnswerString } from './answerCheck';

export interface SpellingChoiceOption {
  text: string;
  isCorrect: boolean;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeSeededRng(seedStr: string): () => number {
  let s = hashSeed(seedStr) || 123456789;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Matches capitalization pattern of original word token so distractors never
 * betray themselves via broken initial casing (e.g. "Wednesday" -> "Wensday", "VISA" -> "VIZA").
 */
function matchCasePattern(source: string, mutated: string): string {
  if (!source || !mutated) return mutated;
  if (source.length > 1 && source === source.toUpperCase() && /[A-Z]/.test(source)) {
    return mutated.toUpperCase();
  }
  if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return mutated[0].toUpperCase() + mutated.slice(1);
  }
  return mutated;
}

const COMMON_CONFUSIONS: Array<[RegExp, string]> = [
  [/ie/i, 'ei'],
  [/ei/i, 'ie'],
  [/tion\b/i, 'sion'],
  [/sion\b/i, 'tion'],
  [/ence\b/i, 'ance'],
  [/ance\b/i, 'ence'],
  [/ent\b/i, 'ant'],
  [/ant\b/i, 'ent'],
  [/ery\b/i, 'ary'],
  [/ary\b/i, 'ery'],
  [/able\b/i, 'ible'],
  [/ible\b/i, 'able'],
  [/ph/i, 'f'],
  [/ae/i, 'ea'],
  [/ea/i, 'ee'],
  [/ee/i, 'ea'],
  [/ou/i, 'o'],
  [/au/i, 'aw'],
  [/ck/i, 'k'],
  [/qu/i, 'kw'],
  [/sc(?=[eiy])/i, 's'],
  [/ght/i, 'gt'],
];

const VOWEL_SWAPS: Record<string, string[]> = {
  a: ['e', 'o', 'u'],
  e: ['i', 'a'],
  i: ['e', 'y'],
  o: ['a', 'u'],
  u: ['o', 'a'],
};

const DOUBLEABLE_CONSONANTS = new Set([
  'b', 'c', 'd', 'f', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't', 'z',
]);

function generateMutationsForSingleWord(token: string, rng: () => number): string[] {
  const lower = token.toLowerCase();
  const candidates: string[] = [];

  const pushCandidate = (rawMutated: string) => {
    if (!rawMutated || rawMutated.length < 2) return;
    candidates.push(matchCasePattern(token, rawMutated));
  };

  // Family 1: Double-letter simplify (`mm` -> `m`) or gemination (`l` -> `ll`)
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1] && /[a-z]/.test(lower[i])) {
      pushCandidate(lower.slice(0, i) + lower.slice(i + 1));
    }
  }
  for (let i = 1; i < lower.length - 1; i++) {
    const ch = lower[i];
    if (
      DOUBLEABLE_CONSONANTS.has(ch) &&
      lower[i - 1] !== ch &&
      lower[i + 1] !== ch
    ) {
      pushCandidate(lower.slice(0, i) + ch + lower.slice(i));
    }
  }

  // Family 2: Orthographic / phonetic English traps (`ie`/`ei`, `-ence`/`-ance`, `-ery`/`-ary`, etc.)
  for (const [pattern, replacement] of COMMON_CONFUSIONS) {
    if (pattern.test(lower)) {
      pushCandidate(lower.replace(pattern, replacement));
    }
  }

  // Family 3: Adjacent interior letter swap (transposition)
  for (let i = 1; i < lower.length - 1; i++) {
    if (
      /[a-z]/.test(lower[i]) &&
      /[a-z]/.test(lower[i + 1]) &&
      lower[i] !== lower[i + 1]
    ) {
      pushCandidate(
        lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2)
      );
    }
  }
  // Also allow index 0..1 swap for short words <= 4 chars
  if (lower.length >= 3 && lower[0] !== lower[1] && /[a-z]/.test(lower[1])) {
    pushCandidate(lower[1] + lower[0] + lower.slice(2));
  }

  // Family 4: Omission of medial letter & unstressed vowel substitution
  if (lower.length >= 5) {
    for (let i = 1; i < lower.length - 1; i++) {
      if (/[a-z]/.test(lower[i])) {
        pushCandidate(lower.slice(0, i) + lower.slice(i + 1));
      }
    }
  }

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const swaps = VOWEL_SWAPS[ch];
    if (swaps) {
      for (const v of swaps) {
        pushCandidate(lower.slice(0, i) + v + lower.slice(i + 1));
      }
    }
  }

  // Deterministic fallback padding for ultra-short consonant/acronym tokens (e.g. "gym", "TV", "VISA")
  const extraFallbacks = [
    lower.replace(/s/g, 'z'),
    lower.replace(/z/g, 's'),
    lower.replace(/c/g, 'k'),
    lower.replace(/y/g, 'i'),
    `${lower}${lower[lower.length - 1]}`,
    `${lower}e`,
    `${lower}s`,
  ];
  for (const fb of extraFallbacks) {
    pushCandidate(fb);
  }

  // Deterministic shuffle using seeded PRNG while keeping highest-plausibility families near front
  const topSlice = candidates.slice(0, 8);
  const restSlice = candidates.slice(8);

  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return [...shuffle(topSlice), ...shuffle(restSlice)];
}

/**
 * Generates `count` (default 4) multiple-choice spelling options:
 * - 1 canonical `word.text`
 * - `count - 1` distinct, plausible human misspellings
 * - Strictly excludes `word.text` AND all `word.alt` spellings from distractors
 * - Deterministic per `(word.id, seedKey)` so UI re-renders never reshuffle choices mid-question
 */
export function generateSpellingChoices(
  word: Word,
  seedKey = word.id,
  count = 4
): SpellingChoiceOption[] {
  const rng = makeSeededRng(`${word.id}::${seedKey}`);

  const forbiddenNormalized = new Set<string>(
    [word.text, ...(word.alt ?? [])].map((s) => normalizeAnswerString(s))
  );

  // Split phrase into parts preserving separators (` `, `-`, `/`)
  const parts = word.text.split(/(\s+|-|\/)/);
  const wordIndices: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (/[A-Za-z]/.test(parts[i])) {
      wordIndices.push(i);
    }
  }

  // Prefer mutating longer content words in multi-word phrases (e.g. "student accommodation" -> mutate "accommodation", not "a" or "the"!)
  const sortedWordIndices = [...wordIndices].sort(
    (a, b) => parts[b].length - parts[a].length
  );

  const distractors: string[] = [];
  const usedNormalized = new Set<string>(forbiddenNormalized);

  for (const targetPartIdx of sortedWordIndices) {
    const mutations = generateMutationsForSingleWord(parts[targetPartIdx], rng);
    for (const mutatedPart of mutations) {
      const rebuilt = parts
        .map((p, idx) => (idx === targetPartIdx ? mutatedPart : p))
        .join('');
      const norm = normalizeAnswerString(rebuilt);
      if (norm && !usedNormalized.has(norm)) {
        usedNormalized.add(norm);
        distractors.push(rebuilt);
        if (distractors.length >= count + 4) break;
      }
    }
    if (distractors.length >= count + 4) break;
  }

  const chosenDistractors = distractors.slice(0, count - 1);

  const options: SpellingChoiceOption[] = [
    { text: word.text, isCorrect: true },
    ...chosenDistractors.map((d) => ({ text: d, isCorrect: false })),
  ];

  // Deterministically shuffle the 4 final options
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}
