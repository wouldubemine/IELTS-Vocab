import type { Word } from '../types/word';
import {
  createEmptyWordProgress,
  getWordStatus,
  type LeitnerBox,
  type SessionLengthOption,
  type WordProgress,
} from './storage';

export interface AnswerTransitionOptions {
  isCorrect: boolean;
  bankClearThreshold: number;
  now?: number;
}

/**
 * Pure Leitner 5-box + Mistakes Bank transition (Spec Sections 4.4 & 4.5):
 * - New word starts in box 1.
 * - Correct -> move up one box (capped at box 5), increment `streak`.
 *   If in mistakes bank: increment `bankStreak`; clear `inBank` once
 *   `bankStreak >= bankClearThreshold` UNLESS the learner explicitly `pinned` it.
 * - Wrong -> back to box 1, `streak = 0`, enter mistakes bank (`inBank = true`),
 *   `bankStreak = 0`, update `lastMissAt`.
 */
export function applyWordAnswer(
  previous: WordProgress | undefined,
  wordId: string,
  options: AnswerTransitionOptions
): WordProgress {
  const now = options.now ?? Date.now();
  const base = previous ?? createEmptyWordProgress(wordId);

  if (options.isCorrect) {
    const nextBox = Math.min(5, base.box + 1) as LeitnerBox;
    const nextStreak = base.streak + 1;
    const nextBankStreak = base.inBank ? base.bankStreak + 1 : 0;
    const staysInBank = base.inBank
      ? base.pinned || nextBankStreak < options.bankClearThreshold
      : false;

    return {
      ...base,
      id: wordId,
      box: nextBox,
      attempts: base.attempts + 1,
      correct: base.correct + 1,
      streak: nextStreak,
      lastSeen: now,
      inBank: staysInBank,
      bankStreak: staysInBank ? nextBankStreak : 0,
    };
  }

  return {
    ...base,
    id: wordId,
    box: 1,
    attempts: base.attempts + 1,
    wrong: base.wrong + 1,
    streak: 0,
    lastSeen: now,
    inBank: true,
    bankStreak: 0,
    lastMissAt: now,
  };
}

/**
 * Manual bank actions (Spec Section 4.4):
 * - Pinning puts/keeps a word in the bank (`inBank = true, pinned = true`).
 * - Unpinning removes the pin; if it already reached `bankClearThreshold` (or had 0 misses),
 *   it leaves the bank cleanly; otherwise it stays until remaining clears complete.
 * - Removing manually clears `inBank`, `pinned`, and `bankStreak`.
 */
export function togglePinWord(
  previous: WordProgress | undefined,
  wordId: string,
  bankClearThreshold: number
): WordProgress {
  const base = previous ?? createEmptyWordProgress(wordId);
  const nextPinned = !base.pinned;
  if (nextPinned) {
    return {
      ...base,
      id: wordId,
      inBank: true,
      pinned: true,
    };
  }
  const shouldRemainInBank =
    base.inBank && base.wrong > 0 && base.bankStreak < bankClearThreshold;
  return {
    ...base,
    id: wordId,
    pinned: false,
    inBank: shouldRemainInBank,
    bankStreak: shouldRemainInBank ? base.bankStreak : 0,
  };
}

export function removeWordFromBank(
  previous: WordProgress | undefined,
  wordId: string
): WordProgress {
  const base = previous ?? createEmptyWordProgress(wordId);
  return {
    ...base,
    id: wordId,
    inBank: false,
    pinned: false,
    bankStreak: 0,
  };
}

/**
 * Re-evaluates bank membership if the learner lowers `bankClearThreshold` in Settings
 * (e.g., changing threshold from 4 -> 2 clears unpinned bank words already at streak 2/3).
 */
export function reconcileBankWithThreshold(
  words: Record<string, WordProgress>,
  newThreshold: number
): Record<string, WordProgress> {
  let changed = false;
  const next: Record<string, WordProgress> = {};
  for (const [id, rec] of Object.entries(words)) {
    if (rec.inBank && !rec.pinned && rec.bankStreak >= newThreshold) {
      changed = true;
      next[id] = { ...rec, inBank: false, bankStreak: 0 };
    } else {
      next[id] = rec;
    }
  }
  return changed ? next : words;
}

/* ==========================================================================
   Weighted Leitner Session Queue Builder (Spec Section 4.5 & 4.6)
   Priority order with controlled randomness so sessions never feel predictable:
   1. Mistakes bank words (`inBank === true`)
   2. Lower Leitner boxes (`box 1` > `box 2` > `box 3` > `box 4` / learning `box 5`)
   3. Unseen `new` words (`attempts === 0`)
   4. Rare review of `mastered` words (~10% cap while unmastered words remain;
      fills gracefully if category is nearly/fully mastered)
   ========================================================================== */

export interface BuildSessionOptions {
  candidates: Word[];
  progressMap: Record<string, WordProgress>;
  lengthOption: SessionLengthOption;
  rng?: () => number;
  now?: number;
}

function deduplicateWordsById(words: Word[]): Word[] {
  const seen = new Set<string>();
  const unique: Word[] = [];
  for (const w of words) {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      unique.push(w);
    }
  }
  return unique;
}

function weightedShuffle<T>(
  items: T[],
  getWeight: (item: T) => number,
  rng: () => number
): T[] {
  // Efraimidis–Spirakis weighted random sampling without replacement: key = u^(1 / weight)
  return items
    .map((item) => {
      const w = Math.max(0.05, getWeight(item));
      const u = Math.min(0.999999, Math.max(0.000001, rng()));
      return { item, score: Math.pow(u, 1 / w) };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

export function buildSessionQueue({
  candidates,
  progressMap,
  lengthOption,
  rng = Math.random,
  now = Date.now(),
}: BuildSessionOptions): Word[] {
  const uniquePool = deduplicateWordsById(candidates);
  if (uniquePool.length === 0) return [];

  const targetCount =
    lengthOption === 'all'
      ? uniquePool.length
      : Math.min(lengthOption, uniquePool.length);

  const bankBucket: Word[] = [];
  const learningBucket: Word[] = [];
  const unseenBucket: Word[] = [];
  const masteredBucket: Word[] = [];

  for (const word of uniquePool) {
    const rec = progressMap[word.id];
    const status = getWordStatus(rec);
    if (rec?.inBank) {
      bankBucket.push(word);
    } else if (status === 'learning') {
      learningBucket.push(word);
    } else if (status === 'new') {
      unseenBucket.push(word);
    } else {
      masteredBucket.push(word);
    }
  }

  const recencyBoost = (lastSeen: number | null) => {
    if (!lastSeen) return 1.15;
    const hoursAgo = Math.max(0, (now - lastSeen) / 3_600_000);
    return 1 + Math.min(1.5, hoursAgo / 24);
  };

  const orderedBank = weightedShuffle(
    bankBucket,
    (w) => {
      const r = progressMap[w.id];
      const misses = Math.min(6, r?.wrong ?? 1);
      return (10 + misses * 1.8 + (r?.pinned ? 2 : 0)) * recencyBoost(r?.lastSeen ?? null);
    },
    rng
  );

  const BOX_WEIGHTS: Record<LeitnerBox, number> = {
    1: 9.0,
    2: 6.2,
    3: 4.0,
    4: 2.4,
    5: 1.5,
  };

  const orderedLearning = weightedShuffle(
    learningBucket,
    (w) => {
      const r = progressMap[w.id]!;
      return BOX_WEIGHTS[r.box] * recencyBoost(r.lastSeen);
    },
    rng
  );

  const orderedUnseen = weightedShuffle(unseenBucket, () => 1, rng);

  const orderedMastered = weightedShuffle(
    masteredBucket,
    (w) => recencyBoost(progressMap[w.id]?.lastSeen ?? null),
    rng
  );

  // Reserve a small rare-review slice (~10%, e.g. 1 word in a 10-word session) for mastered words
  const nonMasteredAvailable =
    orderedBank.length + orderedLearning.length + orderedUnseen.length;
  const rareMasteredQuota =
    orderedMastered.length > 0 && nonMasteredAvailable > 0
      ? Math.min(orderedMastered.length, Math.floor(targetCount * 0.1))
      : 0;

  const coreTarget = Math.max(0, targetCount - rareMasteredQuota);
  const selected: Word[] = [];

  for (const bucket of [orderedBank, orderedLearning, orderedUnseen]) {
    for (const word of bucket) {
      if (selected.length >= coreTarget) break;
      selected.push(word);
    }
    if (selected.length >= coreTarget) break;
  }

  // Add rare mastered review items + fill any remaining capacity if unmastered pool was smaller than target
  for (const word of orderedMastered) {
    if (selected.length >= targetCount) break;
    selected.push(word);
  }

  // Final light interleave so rare review or transitions feel natural rather than strictly grouped blocks,
  // while keeping urgent bank items front-loaded in the first half of the session.
  return weightedShuffle(
    selected,
    (w) => {
      const r = progressMap[w.id];
      if (r?.inBank) return 6;
      const st = getWordStatus(r);
      if (st === 'learning') return 3.2;
      if (st === 'new') return 2.2;
      return 1.0;
    },
    rng
  );
}

/**
 * Summary statistics helpers across categories & full lexicon
 */
export interface CategoryProgressStats {
  categoryId: string;
  total: number;
  mastered: number;
  learning: number;
  unseen: number;
  inBank: number;
  attempts: number;
  correct: number;
  accuracy: number | null; // 0..100 when attempts > 0
}

export function computeCategoryStats(
  categoryId: string,
  categoryWords: Word[],
  progressMap: Record<string, WordProgress>
): CategoryProgressStats {
  let mastered = 0;
  let learning = 0;
  let unseen = 0;
  let inBank = 0;
  let attempts = 0;
  let correct = 0;

  for (const w of categoryWords) {
    const rec = progressMap[w.id];
    const st = getWordStatus(rec);
    if (st === 'mastered') mastered += 1;
    else if (st === 'learning') learning += 1;
    else unseen += 1;

    if (rec?.inBank) inBank += 1;
    if (rec) {
      attempts += rec.attempts;
      correct += rec.correct;
    }
  }

  return {
    categoryId,
    total: categoryWords.length,
    mastered,
    learning,
    unseen,
    inBank,
    attempts,
    correct,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
  };
}
