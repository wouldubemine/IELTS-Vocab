import type { PracticeMode, ThemePreference, Word } from '../types/word';

export const STORAGE_KEY = 'ielts-trainer:v1';
export const BACKUP_STORAGE_KEY = 'ielts-trainer:v1:backup';
export const CURRENT_SCHEMA_VERSION = 1;

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type WordStatus = 'new' | 'learning' | 'mastered';
export type VoiceAccent = 'en-GB' | 'en-AU' | 'en-US';
export type SessionLengthOption = 10 | 20 | 50 | 'all';
export type SessionSource = 'category' | 'mixed' | 'mistakes';

export interface WordProgress {
  id: string;
  box: LeitnerBox;
  attempts: number;
  correct: number;
  wrong: number;
  streak: number;
  lastSeen: number | null;
  inBank: boolean;
  bankStreak: number;
  lastMissAt: number | null;
  pinned: boolean;
}

export interface UserSettings {
  theme: ThemePreference;
  accent: VoiceAccent;
  voiceURI: string | null;
  speechRate: number; // 0.6 .. 1.2 (default 0.9)
  bankClearThreshold: number; // 2 .. 5 (default 3)
  autoPlayAudio: boolean;
  showHintButton: boolean;
  reduceMotion: boolean;
  textScale: number; // 0.9 .. 1.25 (default 1)
  defaultMode: PracticeMode;
  defaultSessionLength: SessionLengthOption;
}

export interface SessionAnswerRecord {
  wordId: string;
  text: string;
  category: string;
  attempt: string;
  isCorrect: boolean;
  skipped?: boolean;
  usedHint?: boolean;
  answeredAt: number;
}

export interface PersistedSession {
  id: string;
  source: SessionSource;
  categoryId?: string;
  mode: PracticeMode;
  lengthOption: SessionLengthOption;
  queue: Word[];
  currentIndex: number;
  answers: SessionAnswerRecord[];
  startedAt: number;
  elapsedMsBeforePause: number;
  lastActiveAt: number;
  completed: boolean;
}

export interface DailyActivity {
  practiced: number;
  correct: number;
  wrong: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD in local time
  history: Record<string, DailyActivity>;
}

export interface AppDataState {
  schemaVersion: number;
  words: Record<string, WordProgress>;
  settings: UserSettings;
  activeSession: PersistedSession | null;
  streak: StreakData;
  updatedAt: number;
}

export interface StorageLoadResult {
  state: AppDataState;
  corrupted: boolean;
  backupSaved: boolean;
  migratedFrom?: number;
  storageAvailable: boolean;
}

export interface ImportPreviewSummary {
  valid: true;
  state: AppDataState;
  schemaVersion: number;
  exportedAt?: string;
  trackedWordsCount: number;
  masteredCount: number;
  mistakesBankCount: number;
  totalAttempts: number;
  currentStreak: number;
  warnings: string[];
}

export interface ImportFailure {
  valid: false;
  error: string;
}

export type ImportValidationResult = ImportPreviewSummary | ImportFailure;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  accent: 'en-GB',
  voiceURI: null,
  speechRate: 0.9,
  bankClearThreshold: 3,
  autoPlayAudio: true,
  showHintButton: true,
  reduceMotion: false,
  textScale: 1,
  defaultMode: 'listen',
  defaultSessionLength: 10,
};

export function createEmptyStreak(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    history: {},
  };
}

export function createDefaultState(now = Date.now()): AppDataState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    words: {},
    settings: { ...DEFAULT_SETTINGS },
    activeSession: null,
    streak: createEmptyStreak(),
    updatedAt: now,
  };
}

export function createEmptyWordProgress(id: string): WordProgress {
  return {
    id,
    box: 1,
    attempts: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    lastSeen: null,
    inBank: false,
    bankStreak: 0,
    lastMissAt: null,
    pinned: false,
  };
}

/**
 * Word mastery status (Spec Section 4.5):
 * `new` -> `learning` -> `mastered` (box 5 and correct last 2 times).
 */
export function getWordStatus(record: WordProgress | undefined): WordStatus {
  if (!record || record.attempts === 0) return 'new';
  if (record.box === 5 && record.streak >= 2) return 'mastered';
  return 'learning';
}

export function getRemainingBankClears(
  record: WordProgress | undefined,
  threshold: number
): number {
  if (!record || !record.inBank) return 0;
  return Math.max(0, threshold - record.bankStreak);
}

/**
 * Local calendar YYYY-MM-DD formatter & day-diff helper (timezone-safe).
 */
export function toLocalDateKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffCalendarDays(earlierKey: string, laterKey: string): number {
  const [y1, m1, d1] = earlierKey.split('-').map(Number);
  const [y2, m2, d2] = laterKey.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function recordDailyActivity(
  prev: StreakData,
  isCorrect: boolean,
  now = Date.now()
): StreakData {
  const today = toLocalDateKey(now);
  const prevDayEntry = prev.history[today] ?? { practiced: 0, correct: 0, wrong: 0 };
  const nextHistory: Record<string, DailyActivity> = {
    ...prev.history,
    [today]: {
      practiced: prevDayEntry.practiced + 1,
      correct: prevDayEntry.correct + (isCorrect ? 1 : 0),
      wrong: prevDayEntry.wrong + (isCorrect ? 0 : 1),
    },
  };

  let nextCurrent = prev.currentStreak;
  if (!prev.lastActiveDate) {
    nextCurrent = 1;
  } else if (prev.lastActiveDate === today) {
    nextCurrent = Math.max(1, prev.currentStreak);
  } else {
    const gap = diffCalendarDays(prev.lastActiveDate, today);
    if (gap === 1) {
      nextCurrent = prev.currentStreak + 1;
    } else if (gap > 1) {
      nextCurrent = 1;
    } else {
      // System clock moved backward; preserve current streak safely
      nextCurrent = Math.max(1, prev.currentStreak);
    }
  }

  const nextLongest = Math.max(prev.longestStreak, nextCurrent);
  const nextLastDate =
    !prev.lastActiveDate || diffCalendarDays(prev.lastActiveDate, today) >= 0
      ? today
      : prev.lastActiveDate;

  return {
    currentStreak: nextCurrent,
    longestStreak: nextLongest,
    lastActiveDate: nextLastDate,
    history: nextHistory,
  };
}

/**
 * Computes effective streak on read: if more than 1 full calendar day has passed
 * since `lastActiveDate`, effective current streak is 0 (while preserving `longestStreak`).
 */
export function getEffectiveCurrentStreak(
  streak: StreakData,
  now = Date.now()
): number {
  if (!streak.lastActiveDate || streak.currentStreak === 0) return 0;
  const today = toLocalDateKey(now);
  const gap = diffCalendarDays(streak.lastActiveDate, today);
  if (gap > 1) return 0;
  return streak.currentStreak;
}

/* ==========================================================================
   Strict Field Sanitizers & Schema Migration Engine
   ========================================================================== */

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function nonNegInt(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.floor(val));
}

function sanitizeSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const s = raw as Record<string, unknown>;
  const theme: ThemePreference =
    s.theme === 'light' || s.theme === 'dark' || s.theme === 'system'
      ? s.theme
      : DEFAULT_SETTINGS.theme;
  const accent: VoiceAccent =
    s.accent === 'en-GB' || s.accent === 'en-AU' || s.accent === 'en-US'
      ? s.accent
      : DEFAULT_SETTINGS.accent;
  const voiceURI =
    typeof s.voiceURI === 'string' && s.voiceURI.length > 0 ? s.voiceURI : null;
  const speechRate = Number(
    clampNumber(s.speechRate, 0.6, 1.2, DEFAULT_SETTINGS.speechRate).toFixed(2)
  );
  const bankClearThreshold = Math.round(
    clampNumber(s.bankClearThreshold, 2, 5, DEFAULT_SETTINGS.bankClearThreshold)
  );
  const autoPlayAudio =
    typeof s.autoPlayAudio === 'boolean'
      ? s.autoPlayAudio
      : DEFAULT_SETTINGS.autoPlayAudio;
  const showHintButton =
    typeof s.showHintButton === 'boolean'
      ? s.showHintButton
      : DEFAULT_SETTINGS.showHintButton;
  const reduceMotion =
    typeof s.reduceMotion === 'boolean'
      ? s.reduceMotion
      : DEFAULT_SETTINGS.reduceMotion;
  const textScale = Number(
    clampNumber(s.textScale, 0.9, 1.25, DEFAULT_SETTINGS.textScale).toFixed(2)
  );
  const defaultMode: PracticeMode =
    s.defaultMode === 'listen' ||
    s.defaultMode === 'flashcards' ||
    s.defaultMode === 'choice' ||
    s.defaultMode === 'read'
      ? s.defaultMode
      : DEFAULT_SETTINGS.defaultMode;
  const defaultSessionLength: SessionLengthOption =
    s.defaultSessionLength === 10 ||
    s.defaultSessionLength === 20 ||
    s.defaultSessionLength === 50 ||
    s.defaultSessionLength === 'all'
      ? s.defaultSessionLength
      : DEFAULT_SETTINGS.defaultSessionLength;

  return {
    theme,
    accent,
    voiceURI,
    speechRate,
    bankClearThreshold,
    autoPlayAudio,
    showHintButton,
    reduceMotion,
    textScale,
    defaultMode,
    defaultSessionLength,
  };
}

function sanitizeWordRecord(id: string, raw: unknown): WordProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const boxNum = Math.round(clampNumber(r.box, 1, 5, 1)) as LeitnerBox;
  const correct = nonNegInt(r.correct, 0);
  const wrong = nonNegInt(r.wrong, 0);
  const attempts = Math.max(correct + wrong, nonNegInt(r.attempts, 0));
  const streak = nonNegInt(r.streak, 0);
  const lastSeen =
    typeof r.lastSeen === 'number' && Number.isFinite(r.lastSeen) && r.lastSeen > 0
      ? r.lastSeen
      : null;
  const pinned = typeof r.pinned === 'boolean' ? r.pinned : false;
  const inBank = pinned ? true : typeof r.inBank === 'boolean' ? r.inBank : false;
  const bankStreak = nonNegInt(r.bankStreak, 0);
  const lastMissAt =
    typeof r.lastMissAt === 'number' && Number.isFinite(r.lastMissAt) && r.lastMissAt > 0
      ? r.lastMissAt
      : null;

  return {
    id,
    box: boxNum,
    attempts,
    correct,
    wrong,
    streak,
    lastSeen,
    inBank,
    bankStreak,
    lastMissAt,
    pinned,
  };
}

function sanitizeWordObj(raw: unknown): Word | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  if (
    typeof w.id !== 'string' ||
    !w.id ||
    typeof w.text !== 'string' ||
    !w.text ||
    typeof w.category !== 'string' ||
    !w.category
  ) {
    return null;
  }
  const alt = Array.isArray(w.alt)
    ? w.alt.filter((x): x is string => typeof x === 'string')
    : undefined;
  const hint = typeof w.hint === 'string' ? w.hint : undefined;
  return { id: w.id, text: w.text, category: w.category, alt, hint };
}

function sanitizeSession(raw: unknown): PersistedSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || !Array.isArray(s.queue) || s.queue.length === 0) {
    return null;
  }
  const queue = s.queue.map(sanitizeWordObj).filter((w): w is Word => w !== null);
  if (queue.length === 0) return null;

  const source: SessionSource =
    s.source === 'category' || s.source === 'mixed' || s.source === 'mistakes'
      ? s.source
      : 'mixed';
  const mode: PracticeMode =
    s.mode === 'listen' ||
    s.mode === 'flashcards' ||
    s.mode === 'choice' ||
    s.mode === 'read'
      ? s.mode
      : 'listen';
  const lengthOption: SessionLengthOption =
    s.lengthOption === 10 ||
    s.lengthOption === 20 ||
    s.lengthOption === 50 ||
    s.lengthOption === 'all'
      ? s.lengthOption
      : 10;

  const answers: SessionAnswerRecord[] = Array.isArray(s.answers)
    ? s.answers
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({
          wordId: typeof a.wordId === 'string' ? a.wordId : '',
          text: typeof a.text === 'string' ? a.text : '',
          category: typeof a.category === 'string' ? a.category : '',
          attempt: typeof a.attempt === 'string' ? a.attempt : '',
          isCorrect: Boolean(a.isCorrect),
          skipped: Boolean(a.skipped),
          usedHint: Boolean(a.usedHint),
          answeredAt: typeof a.answeredAt === 'number' ? a.answeredAt : Date.now(),
        }))
        .filter((a) => Boolean(a.wordId && a.text))
    : [];

  const currentIndex = Math.min(queue.length, nonNegInt(s.currentIndex, 0));
  const completed = Boolean(s.completed) || currentIndex >= queue.length;

  return {
    id: s.id,
    source,
    categoryId: typeof s.categoryId === 'string' ? s.categoryId : undefined,
    mode,
    lengthOption,
    queue,
    currentIndex,
    answers,
    startedAt: typeof s.startedAt === 'number' ? s.startedAt : Date.now(),
    elapsedMsBeforePause: nonNegInt(s.elapsedMsBeforePause, 0),
    lastActiveAt: typeof s.lastActiveAt === 'number' ? s.lastActiveAt : Date.now(),
    completed,
  };
}

function sanitizeStreak(raw: unknown): StreakData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyStreak();
  }
  const st = raw as Record<string, unknown>;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const lastActiveDate =
    typeof st.lastActiveDate === 'string' && datePattern.test(st.lastActiveDate)
      ? st.lastActiveDate
      : null;

  const history: Record<string, DailyActivity> = {};
  if (st.history && typeof st.history === 'object' && !Array.isArray(st.history)) {
    for (const [k, v] of Object.entries(st.history as Record<string, unknown>)) {
      if (datePattern.test(k) && v && typeof v === 'object') {
        const entry = v as Record<string, unknown>;
        history[k] = {
          practiced: nonNegInt(entry.practiced, 0),
          correct: nonNegInt(entry.correct, 0),
          wrong: nonNegInt(entry.wrong, 0),
        };
      }
    }
  }

  const currentStreak = nonNegInt(st.currentStreak, 0);
  const longestStreak = Math.max(currentStreak, nonNegInt(st.longestStreak, 0));

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
    history,
  };
}

/**
 * Validates and migrates raw parsed payloads (v0 partial records -> v1 current schema).
 */
export function migrateAndValidateState(parsed: unknown): {
  state: AppDataState;
  migratedFrom?: number;
} | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  // Unwrap exported envelope `{ app: "ielts-listening-vocab-trainer", data: { ... } }` if passed directly
  const payload =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj;

  const rawVersion =
    typeof payload.schemaVersion === 'number' && Number.isFinite(payload.schemaVersion)
      ? payload.schemaVersion
      : 0;

  // Reject completely foreign objects that share zero expected keys with our schema
  const hasKnownKey =
    'schemaVersion' in payload ||
    'words' in payload ||
    'settings' in payload ||
    'streak' in payload ||
    'activeSession' in payload;
  if (!hasKnownKey) {
    return null;
  }

  const words: Record<string, WordProgress> = {};
  if (
    payload.words &&
    typeof payload.words === 'object' &&
    !Array.isArray(payload.words)
  ) {
    for (const [key, val] of Object.entries(
      payload.words as Record<string, unknown>
    )) {
      if (!key) continue;
      const clean = sanitizeWordRecord(key, val);
      if (clean) {
        words[key] = clean;
      }
    }
  }

  const state: AppDataState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    words,
    settings: sanitizeSettings(payload.settings),
    activeSession: sanitizeSession(payload.activeSession),
    streak: sanitizeStreak(payload.streak),
    updatedAt:
      typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt)
        ? payload.updatedAt
        : Date.now(),
  };

  return {
    state,
    migratedFrom:
      rawVersion !== CURRENT_SCHEMA_VERSION ? rawVersion : undefined,
  };
}

export function safeWriteBackup(
  rawText: string,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(BACKUP_STORAGE_KEY, rawText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads `ielts-trainer:v1` safely with full corruption protection & automatic backup
 * before any migration (Spec Section 5).
 */
export function loadPersistedState(
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): StorageLoadResult {
  const store =
    storage ??
    (() => {
      try {
        return typeof window !== 'undefined' ? window.localStorage : undefined;
      } catch {
        return undefined;
      }
    })();

  if (!store) {
    return {
      state: createDefaultState(),
      corrupted: false,
      backupSaved: false,
      storageAvailable: false,
    };
  }

  let raw: string | null = null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return {
      state: createDefaultState(),
      corrupted: false,
      backupSaved: false,
      storageAvailable: false,
    };
  }

  if (raw === null || raw.trim() === '') {
    return {
      state: createDefaultState(),
      corrupted: false,
      backupSaved: false,
      storageAvailable: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupSaved = safeWriteBackup(raw, store);
    return {
      state: createDefaultState(),
      corrupted: true,
      backupSaved,
      storageAvailable: true,
    };
  }

  const migrated = migrateAndValidateState(parsed);
  if (!migrated) {
    const backupSaved = safeWriteBackup(raw, store);
    return {
      state: createDefaultState(),
      corrupted: true,
      backupSaved,
      storageAvailable: true,
    };
  }

  let backupSaved = false;
  if (migrated.migratedFrom !== undefined) {
    backupSaved = safeWriteBackup(raw, store);
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(migrated.state));
    } catch {
      // Quota exceeded on migration save — continue cleanly in memory
    }
  }

  return {
    state: migrated.state,
    corrupted: false,
    backupSaved,
    migratedFrom: migrated.migratedFrom,
    storageAvailable: true,
  };
}

export function savePersistedState(
  state: AppDataState,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    const store =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: Date.now(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedState(
  storage?: Pick<Storage, 'removeItem'>
): boolean {
  try {
    const store =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates clean export JSON envelope and validates imported JSON files with preview stats.
 */
export function serializeExportPayload(state: AppDataState): string {
  return JSON.stringify(
    {
      app: 'ielts-listening-vocab-trainer',
      exportedAt: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: state,
    },
    null,
    2
  );
}

export function validateImportJson(
  jsonText: string,
  knownWordIds?: ReadonlySet<string>
): ImportValidationResult {
  if (!jsonText || !jsonText.trim()) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      valid: false,
      error: 'Invalid JSON file. Please choose a valid progress backup.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Unrecognized backup format (expected a JSON object).',
    };
  }

  const envelope = parsed as Record<string, unknown>;
  if (
    typeof envelope.app === 'string' &&
    envelope.app !== 'ielts-listening-vocab-trainer'
  ) {
    return {
      valid: false,
      error: `Foreign backup file from "${envelope.app}".`,
    };
  }

  const migrated = migrateAndValidateState(parsed);
  if (!migrated) {
    return {
      valid: false,
      error: 'This JSON file does not contain IELTS Vocabulary Trainer progress data.',
    };
  }

  const { state } = migrated;
  const warnings: string[] = [];

  if (migrated.migratedFrom !== undefined) {
    warnings.push(
      `Migrated automatically from schema version ${migrated.migratedFrom} to v${CURRENT_SCHEMA_VERSION}.`
    );
  }

  const records = Object.values(state.words);
  if (knownWordIds) {
    const unknownCount = records.filter((r) => !knownWordIds.has(r.id)).length;
    if (unknownCount > 0) {
      warnings.push(
        `${unknownCount} word record${unknownCount === 1 ? '' : 's'} not present in the current word list will be preserved safely.`
      );
    }
  }

  const trackedWordsCount = records.filter((r) => r.attempts > 0 || r.inBank).length;
  const masteredCount = records.filter((r) => getWordStatus(r) === 'mastered').length;
  const mistakesBankCount = records.filter((r) => r.inBank).length;
  const totalAttempts = records.reduce((sum, r) => sum + r.attempts, 0);

  return {
    valid: true,
    state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : undefined,
    trackedWordsCount,
    masteredCount,
    mistakesBankCount,
    totalAttempts,
    currentStreak: getEffectiveCurrentStreak(state.streak),
    warnings,
  };
}
