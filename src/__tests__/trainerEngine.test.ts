import { describe, expect, it } from 'vitest';
import { CATALOG, WORDS } from '../data/catalog';
import {
  applyWordAnswer,
  buildSessionQueue,
  computeCategoryStats,
  reconcileBankWithThreshold,
  removeWordFromBank,
  togglePinWord,
} from '../lib/scheduler';
import {
  BACKUP_STORAGE_KEY,
  createDefaultState,
  getEffectiveCurrentStreak,
  getRemainingBankClears,
  getWordStatus,
  loadPersistedState,
  recordDailyActivity,
  savePersistedState,
  serializeExportPayload,
  STORAGE_KEY,
  validateImportJson,
  type WordProgress,
} from '../lib/storage';
import type { Word } from '../types/word';

/** Deterministic linear-congruential pseudo-RNG for reproducible scheduler tests */
function createSeededRng(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

class MemoryStorage {
  private map = new Map<string, string>();
  public throwOnRead = false;
  public throwOnWrite = false;

  getItem(key: string): string | null {
    if (this.throwOnRead) throw new DOMException('Blocked', 'SecurityError');
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new DOMException('Full', 'QuotaExceededError');
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  rawMap(): Map<string, string> {
    return this.map;
  }
}

describe('Phase 1 & 3 — Catalog Integrity & Cross-Category Shared Progress', () => {
  it('loads all 37 canonical categories in order with clean ASCII canonical text', () => {
    expect(CATALOG.categories).toHaveLength(37);
    expect(CATALOG.categories[0].name).toBe('Days of the week');
    expect(CATALOG.categories[36].name).toBe('Other');
    expect(WORDS.length).toBe(923);
    expect(CATALOG.uniqueWordCount).toBe(919);

    for (const w of WORDS) {
      expect(w.id.length).toBeGreaterThan(0);
      expect(w.text.length).toBeGreaterThan(0);
      // Verify zero un-typeable Unicode ligatures or smart apostrophes remain in `text`
      expect([...w.text].every((ch) => ch.charCodeAt(0) <= 127)).toBe(true);
    }
  });

  it('shares mastery and mistakes progress across duplicate cross-category words via normalized id', () => {
    let rec: WordProgress | undefined;
    // Master "accommodation" once across 4 consecutive right answers
    for (let i = 0; i < 4; i++) {
      rec = applyWordAnswer(rec, 'accommodation', {
        isCorrect: true,
        bankClearThreshold: 3,
        now: 1_000 + i,
      });
    }
    expect(getWordStatus(rec)).toBe('mastered');

    const progressMap = { accommodation: rec! };
    const uniStats = computeCategoryStats(
      'studying-at-college-university',
      CATALOG.wordsByCategory.get('studying-at-college-university')!,
      progressMap
    );
    const placesStats = computeCategoryStats(
      'places',
      CATALOG.wordsByCategory.get('places')!,
      progressMap
    );

    expect(uniStats.mastered).toBe(1);
    expect(placesStats.mastered).toBe(1);
  });
});

describe('Leitner 5-Box State Machine & Word Status', () => {
  it('progresses new -> learning -> mastered at box 5 with >=2 consecutive right answers', () => {
    expect(getWordStatus(undefined)).toBe('new');

    let rec = applyWordAnswer(undefined, 'stationery', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 100,
    });
    expect(rec.box).toBe(2);
    expect(rec.streak).toBe(1);
    expect(getWordStatus(rec)).toBe('learning');

    rec = applyWordAnswer(rec, 'stationery', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 200,
    });
    expect(rec.box).toBe(3);
    expect(getWordStatus(rec)).toBe('learning');

    rec = applyWordAnswer(rec, 'stationery', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 300,
    });
    expect(rec.box).toBe(4);
    expect(getWordStatus(rec)).toBe('learning');

    rec = applyWordAnswer(rec, 'stationery', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 400,
    });
    expect(rec.box).toBe(5);
    expect(rec.streak).toBe(4);
    expect(getWordStatus(rec)).toBe('mastered');

    // Stays capped at box 5 on further right answers
    rec = applyWordAnswer(rec, 'stationery', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 500,
    });
    expect(rec.box).toBe(5);
    expect(rec.streak).toBe(5);
    expect(getWordStatus(rec)).toBe('mastered');
  });

  it('drops back to box 1, resets streak, and enters mistakes bank immediately on a wrong answer', () => {
    let rec: WordProgress | undefined;
    for (let i = 0; i < 4; i++) {
      rec = applyWordAnswer(rec, 'archaeology', {
        isCorrect: true,
        bankClearThreshold: 3,
        now: 100 * (i + 1),
      });
    }
    expect(getWordStatus(rec)).toBe('mastered');

    rec = applyWordAnswer(rec, 'archaeology', {
      isCorrect: false,
      bankClearThreshold: 3,
      now: 999,
    });
    expect(rec.box).toBe(1);
    expect(rec.streak).toBe(0);
    expect(rec.inBank).toBe(true);
    expect(rec.bankStreak).toBe(0);
    expect(rec.wrong).toBe(1);
    expect(rec.lastMissAt).toBe(999);
    expect(getWordStatus(rec)).toBe('learning');
  });
});

describe('Mistakes Bank Rules — Thresholds, Streak Resets, Pinning & Manual Removal', () => {
  it('clears from bank only after N consecutive correct answers and resets bankStreak on an intervening miss', () => {
    let rec = applyWordAnswer(undefined, 'yoghurt', {
      isCorrect: false,
      bankClearThreshold: 3,
      now: 1_000,
    });
    expect(rec.inBank).toBe(true);
    expect(getRemainingBankClears(rec, 3)).toBe(3);

    // 1st correct -> 2 remaining
    rec = applyWordAnswer(rec, 'yoghurt', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 2_000,
    });
    expect(rec.inBank).toBe(true);
    expect(getRemainingBankClears(rec, 3)).toBe(2);

    // 2nd correct -> 1 remaining
    rec = applyWordAnswer(rec, 'yoghurt', {
      isCorrect: true,
      bankClearThreshold: 3,
      now: 3_000,
    });
    expect(rec.inBank).toBe(true);
    expect(getRemainingBankClears(rec, 3)).toBe(1);

    // Miss right before clearing -> resets bankStreak to 0 (back to 3 remaining!)
    rec = applyWordAnswer(rec, 'yoghurt', {
      isCorrect: false,
      bankClearThreshold: 3,
      now: 4_000,
    });
    expect(rec.inBank).toBe(true);
    expect(rec.bankStreak).toBe(0);
    expect(rec.wrong).toBe(2);
    expect(getRemainingBankClears(rec, 3)).toBe(3);

    // Now answer 3 consecutive times accurately -> leaves bank!
    for (let i = 0; i < 3; i++) {
      rec = applyWordAnswer(rec, 'yoghurt', {
        isCorrect: true,
        bankClearThreshold: 3,
        now: 5_000 + i * 100,
      });
    }
    expect(rec.inBank).toBe(false);
    expect(rec.bankStreak).toBe(0);
    expect(getRemainingBankClears(rec, 3)).toBe(0);
  });

  it('keeps pinned words in bank past threshold and handles unpin / manual removal cleanly', () => {
    let rec = applyWordAnswer(undefined, 'cheque', {
      isCorrect: false,
      bankClearThreshold: 2,
    });
    rec = togglePinWord(rec, 'cheque', 2);
    expect(rec.pinned).toBe(true);
    expect(rec.inBank).toBe(true);

    // Answer right 4 times — remains in bank while pinned
    for (let i = 0; i < 4; i++) {
      rec = applyWordAnswer(rec, 'cheque', {
        isCorrect: true,
        bankClearThreshold: 2,
      });
    }
    expect(rec.inBank).toBe(true);
    expect(rec.pinned).toBe(true);

    // Unpinning once threshold was already met lets it clear cleanly
    rec = togglePinWord(rec, 'cheque', 2);
    expect(rec.pinned).toBe(false);
    expect(rec.inBank).toBe(false);

    // Manual removal clears both bank and pinned flags immediately
    rec = togglePinWord(rec, 'cheque', 2);
    rec = removeWordFromBank(rec, 'cheque');
    expect(rec.inBank).toBe(false);
    expect(rec.pinned).toBe(false);
  });

  it('reconciles bank membership when user lowers bankClearThreshold in Settings', () => {
    let rec = applyWordAnswer(undefined, 'millennium', {
      isCorrect: false,
      bankClearThreshold: 4,
    });
    rec = applyWordAnswer(rec, 'millennium', {
      isCorrect: true,
      bankClearThreshold: 4,
    });
    rec = applyWordAnswer(rec, 'millennium', {
      isCorrect: true,
      bankClearThreshold: 4,
    });
    expect(rec.inBank).toBe(true);
    expect(rec.bankStreak).toBe(2);

    const reconciled = reconcileBankWithThreshold({ millennium: rec }, 2);
    expect(reconciled.millennium.inBank).toBe(false);
  });
});

describe('Weighted Session Builder', () => {
  it('prioritizes bank words > lower boxes > unseen > rare mastered reviews and deduplicates IDs', () => {
    const samplePool: Word[] = Array.from({ length: 30 }, (_, idx) => ({
      id: `word-${idx}`,
      text: `word ${idx}`,
      category: 'other',
    }));
    // Add duplicate cross-category word id
    const poolWithDup = [...samplePool, { ...samplePool[0], category: 'places' }];

    const progressMap: Record<string, WordProgress> = {};
    // 3 bank words (0..2)
    for (let i = 0; i < 3; i++) {
      progressMap[`word-${i}`] = applyWordAnswer(undefined, `word-${i}`, {
        isCorrect: false,
        bankClearThreshold: 3,
      });
    }
    // 4 learning words (3..6)
    for (let i = 3; i < 7; i++) {
      progressMap[`word-${i}`] = applyWordAnswer(undefined, `word-${i}`, {
        isCorrect: true,
        bankClearThreshold: 3,
      });
    }
    // 10 mastered words (20..29)
    for (let i = 20; i < 30; i++) {
      let r: WordProgress | undefined;
      for (let k = 0; k < 4; k++) {
        r = applyWordAnswer(r, `word-${i}`, {
          isCorrect: true,
          bankClearThreshold: 3,
        });
      }
      progressMap[`word-${i}`] = r!;
    }

    const queue = buildSessionQueue({
      candidates: poolWithDup,
      progressMap,
      lengthOption: 10,
      rng: createSeededRng(777),
    });

    expect(queue).toHaveLength(10);
    // Unique IDs only
    expect(new Set(queue.map((w) => w.id)).size).toBe(10);

    const chosenIds = new Set(queue.map((w) => w.id));
    // All 3 bank words and all 4 learning words are included ahead of the large pool of mastered words
    expect(chosenIds.has('word-0')).toBe(true);
    expect(chosenIds.has('word-1')).toBe(true);
    expect(chosenIds.has('word-2')).toBe(true);
    expect(chosenIds.has('word-3')).toBe(true);

    // Mastered words appear only rarely (1 slot in a 10-word session)
    const masteredIncluded = queue.filter((w) =>
      w.id.match(/^word-2\d$/)
    ).length;
    expect(masteredIncluded).toBeLessThanOrEqual(1);
  });

  it('still builds a full session gracefully when 100% of category words are already mastered', () => {
    const nineDays = CATALOG.wordsByCategory.get('days-of-the-week')!;
    const progressMap: Record<string, WordProgress> = {};
    for (const w of nineDays) {
      let r: WordProgress | undefined;
      for (let k = 0; k < 4; k++) {
        r = applyWordAnswer(r, w.id, { isCorrect: true, bankClearThreshold: 3 });
      }
      progressMap[w.id] = r!;
    }

    const queue = buildSessionQueue({
      candidates: nineDays,
      progressMap,
      lengthOption: 10,
      rng: createSeededRng(99),
    });
    expect(queue).toHaveLength(9);
  });
});

describe('Storage Resilience, Migrations, Streak Math & Import/Export Validation', () => {
  it('handles empty, blocked, quota-full, and corrupted JSON storage cleanly while saving a :backup copy', () => {
    // 1. Empty storage
    const emptyMem = new MemoryStorage();
    const resEmpty = loadPersistedState(emptyMem);
    expect(resEmpty.corrupted).toBe(false);
    expect(resEmpty.storageAvailable).toBe(true);

    // 2. Blocked / private mode throwing SecurityError
    const blockedMem = new MemoryStorage();
    blockedMem.throwOnRead = true;
    const resBlocked = loadPersistedState(blockedMem);
    expect(resBlocked.storageAvailable).toBe(false);
    expect(resBlocked.corrupted).toBe(false);

    // 3. Corrupted JSON -> backs up raw string to `ielts-trainer:v1:backup` and flags `corrupted: true`
    const corruptMem = new MemoryStorage();
    corruptMem.setItem(STORAGE_KEY, '{broken_json:::true');
    const resCorrupt = loadPersistedState(corruptMem);
    expect(resCorrupt.corrupted).toBe(true);
    expect(resCorrupt.backupSaved).toBe(true);
    expect(corruptMem.getItem(BACKUP_STORAGE_KEY)).toBe('{broken_json:::true');

    // 4. Schema migration from v0 -> v1 saves a backup before migrating
    const legacyMem = new MemoryStorage();
    legacyMem.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: { theme: 'dark', speechRate: 9.9, bankClearThreshold: 99 },
      })
    );
    const resMigrated = loadPersistedState(legacyMem);
    expect(resMigrated.corrupted).toBe(false);
    expect(resMigrated.migratedFrom).toBe(0);
    expect(resMigrated.backupSaved).toBe(true);
    expect(resMigrated.state.settings.theme).toBe('dark');
    // Clamped out-of-range settings
    expect(resMigrated.state.settings.speechRate).toBe(1.2);
    expect(resMigrated.state.settings.bankClearThreshold).toBe(5);

    // 5. Quota full on write returns false instead of throwing
    const fullMem = new MemoryStorage();
    fullMem.throwOnWrite = true;
    expect(savePersistedState(createDefaultState(), fullMem)).toBe(false);
  });

  it('tracks daily streaks accurately across consecutive and non-consecutive calendar days', () => {
    const day1 = new Date(2026, 9, 20, 14, 0, 0).getTime(); // Oct 20
    const day1Later = new Date(2026, 9, 20, 21, 30, 0).getTime();
    const day2 = new Date(2026, 9, 21, 9, 0, 0).getTime(); // Oct 21
    const day5 = new Date(2026, 9, 24, 9, 0, 0).getTime(); // Oct 24 (missed Oct 22-23)

    let streak = recordDailyActivity(createDefaultState().streak, true, day1);
    streak = recordDailyActivity(streak, false, day1Later);
    expect(streak.currentStreak).toBe(1);

    streak = recordDailyActivity(streak, true, day2);
    expect(streak.currentStreak).toBe(2);
    expect(streak.longestStreak).toBe(2);
    expect(getEffectiveCurrentStreak(streak, day2)).toBe(2);

    // Effective streak drops to 0 if read after a 3-day gap before practicing
    expect(getEffectiveCurrentStreak(streak, day5)).toBe(0);

    // Practicing again on day 5 starts fresh streak = 1 while retaining longestStreak = 2
    streak = recordDailyActivity(streak, true, day5);
    expect(streak.currentStreak).toBe(1);
    expect(streak.longestStreak).toBe(2);
  });

  it('round-trips Export -> Validate Import Preview and rejects malformed / foreign files', () => {
    const state = createDefaultState();
    state.words.stationery = applyWordAnswer(undefined, 'stationery', {
      isCorrect: false,
      bankClearThreshold: 3,
      now: 12345,
    });

    const exported = serializeExportPayload(state);
    const preview = validateImportJson(
      exported,
      new Set(WORDS.map((w) => w.id))
    );
    expect(preview.valid).toBe(true);
    if (preview.valid) {
      expect(preview.mistakesBankCount).toBe(1);
      expect(preview.trackedWordsCount).toBe(1);
      expect(preview.totalAttempts).toBe(1);
    }

    expect(validateImportJson('not json').valid).toBe(false);
    expect(validateImportJson('[]').valid).toBe(false);
    expect(
      validateImportJson(JSON.stringify({ app: 'other-app', foo: 1 })).valid
    ).toBe(false);
    expect(validateImportJson(JSON.stringify({ unrelated: 123 })).valid).toBe(
      false
    );
  });
});
