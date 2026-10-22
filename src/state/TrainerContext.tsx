import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CATALOG, WORDS } from '../data/catalog';
import {
  applyWordAnswer,
  buildSessionQueue,
  computeCategoryStats,
  reconcileBankWithThreshold,
  removeWordFromBank,
  togglePinWord,
  type CategoryProgressStats,
} from '../lib/scheduler';
import {
  clearPersistedState,
  createDefaultState,
  getEffectiveCurrentStreak,
  getWordStatus,
  loadPersistedState,
  migrateAndValidateState,
  recordDailyActivity,
  savePersistedState,
  serializeExportPayload,
  STORAGE_KEY,
  validateImportJson,
  type AppDataState,
  type ImportValidationResult,
  type PersistedSession,
  type SessionLengthOption,
  type SessionSource,
  type UserSettings,
  type WordProgress,
} from '../lib/storage';
import {
  applyMotionPreference,
  applyTextScale,
  applyThemeToDocument,
  resolveTheme,
} from '../lib/theme';
import type { PracticeMode, ResolvedTheme, Word } from '../types/word';

export interface StartSessionParams {
  source: SessionSource;
  categoryId?: string;
  mode?: PracticeMode;
  lengthOption?: SessionLengthOption;
  explicitWords?: Word[];
}

export interface SubmitSessionAnswerParams {
  word: Word;
  attempt: string;
  isCorrect: boolean;
  skipped?: boolean;
  usedHint?: boolean;
}

export interface TrainerContextValue {
  state: AppDataState;
  resolvedTheme: ResolvedTheme;
  corruptedOnBoot: boolean;
  backupSavedOnBoot: boolean;
  storageAvailable: boolean;

  // Memoized derived summaries
  masteredCount: number;
  learningCount: number;
  effectiveStreak: number;
  mistakesBankEntries: Array<{ word: Word; progress: WordProgress }>;
  hardestWords: Array<{ word: Word; progress: WordProgress }>;
  categoryStats: Map<string, CategoryProgressStats>;

  // Core mutations
  updateSettings: (patch: Partial<UserSettings>) => void;
  recordStandaloneAnswer: (wordId: string, isCorrect: boolean) => void;
  togglePin: (wordId: string) => void;
  removeFromBank: (wordId: string) => void;

  // Session lifecycle
  startSession: (params: StartSessionParams) => PersistedSession | null;
  submitSessionAnswer: (params: SubmitSessionAnswerParams) => void;
  advanceSessionCard: () => void;
  switchSessionMode: (mode: PracticeMode) => void;
  clearActiveSession: () => void;

  // Data portability & recovery
  exportProgressJson: () => string;
  previewImportJson: (jsonText: string) => ImportValidationResult;
  confirmImportState: (importedState: AppDataState) => void;
  resetAllProgress: () => void;
  dismissCorruptionAndReset: () => void;
}

const TrainerContext = createContext<TrainerContextValue | null>(null);

const UNIQUE_WORD_LOOKUP: Map<string, Word> = (() => {
  const m = new Map<string, Word>();
  for (const w of WORDS) {
    if (!m.has(w.id)) m.set(w.id, w);
  }
  return m;
})();

const KNOWN_WORD_IDS: ReadonlySet<string> = new Set(UNIQUE_WORD_LOOKUP.keys());

export function TrainerProvider({ children }: { children: ReactNode }) {
  const initialLoad = useMemo(() => loadPersistedState(), []);

  const [state, setState] = useState<AppDataState>(initialLoad.state);
  const [corruptedOnBoot, setCorruptedOnBoot] = useState<boolean>(
    initialLoad.corrupted
  );
  const [backupSavedOnBoot] = useState<boolean>(initialLoad.backupSaved);
  const [storageAvailable] = useState<boolean>(initialLoad.storageAvailable);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(initialLoad.state.settings.theme)
  );

  // Track latest state & dirty flag for debounced non-blocking persistence
  const latestStateRef = useRef<AppDataState>(state);
  latestStateRef.current = state;
  const dirtyRef = useRef(false);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const suppressSaveOnCorruptBootRef = useRef<boolean>(initialLoad.corrupted);

  const schedulePersist = useCallback((nextState: AppDataState) => {
    latestStateRef.current = nextState;
    suppressSaveOnCorruptBootRef.current = false;
    dirtyRef.current = true;
    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      if (dirtyRef.current) {
        savePersistedState(latestStateRef.current);
        dirtyRef.current = false;
      }
    }, 160);
  }, []);

  const mutateState = useCallback(
    (updater: (prev: AppDataState) => AppDataState) => {
      setState((prev) => {
        const next = updater(prev);
        if (next !== prev) {
          schedulePersist(next);
        }
        return next;
      });
    },
    [schedulePersist]
  );

  // Flush pending debounced writes before tab hide / reload so mid-session state is never lost
  useEffect(() => {
    const flushNow = () => {
      if (dirtyRef.current && !suppressSaveOnCorruptBootRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        savePersistedState(latestStateRef.current);
        dirtyRef.current = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      flushNow();
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Sync visual DOM attributes & listen for OS theme change + cross-tab `storage` updates
  useEffect(() => {
    const applied = applyThemeToDocument(state.settings.theme, false);
    setResolvedTheme(applied);
    applyMotionPreference(state.settings.reduceMotion);
    applyTextScale(state.settings.textScale);

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (state.settings.theme === 'system') {
        setResolvedTheme(applyThemeToDocument('system', true));
      }
    };
    mql?.addEventListener?.('change', onSystemChange);

    const onStorageEvent = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY) return;
      if (!ev.newValue) {
        const fresh = createDefaultState();
        latestStateRef.current = fresh;
        dirtyRef.current = false;
        setState(fresh);
        setCorruptedOnBoot(false);
        return;
      }
      try {
        const parsed = JSON.parse(ev.newValue);
        const migrated = migrateAndValidateState(parsed);
        if (migrated) {
          latestStateRef.current = migrated.state;
          dirtyRef.current = false;
          setState(migrated.state);
          setCorruptedOnBoot(false);
          setResolvedTheme(applyThemeToDocument(migrated.state.settings.theme, true));
          applyMotionPreference(migrated.state.settings.reduceMotion);
          applyTextScale(migrated.state.settings.textScale);
        }
      } catch {
        // Ignore malformed external tab write without crashing
      }
    };
    window.addEventListener('storage', onStorageEvent);

    return () => {
      mql?.removeEventListener?.('change', onSystemChange);
      window.removeEventListener('storage', onStorageEvent);
    };
  }, [state.settings.theme, state.settings.reduceMotion, state.settings.textScale]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      if (patch.theme) {
        setResolvedTheme(applyThemeToDocument(patch.theme, true));
      }
      if (patch.reduceMotion !== undefined) {
        applyMotionPreference(patch.reduceMotion);
      }
      if (patch.textScale !== undefined) {
        applyTextScale(patch.textScale);
      }

      mutateState((prev) => {
        const nextSettings: UserSettings = {
          ...prev.settings,
          ...patch,
        };
        const reconciledWords =
          patch.bankClearThreshold !== undefined &&
          patch.bankClearThreshold !== prev.settings.bankClearThreshold
            ? reconcileBankWithThreshold(prev.words, nextSettings.bankClearThreshold)
            : prev.words;

        return {
          ...prev,
          words: reconciledWords,
          settings: nextSettings,
          updatedAt: Date.now(),
        };
      });
    },
    [mutateState]
  );

  const recordStandaloneAnswer = useCallback(
    (wordId: string, isCorrect: boolean) => {
      const now = Date.now();
      mutateState((prev) => ({
        ...prev,
        words: {
          ...prev.words,
          [wordId]: applyWordAnswer(prev.words[wordId], wordId, {
            isCorrect,
            bankClearThreshold: prev.settings.bankClearThreshold,
            now,
          }),
        },
        streak: recordDailyActivity(prev.streak, isCorrect, now),
        updatedAt: now,
      }));
    },
    [mutateState]
  );

  const togglePin = useCallback(
    (wordId: string) => {
      mutateState((prev) => ({
        ...prev,
        words: {
          ...prev.words,
          [wordId]: togglePinWord(
            prev.words[wordId],
            wordId,
            prev.settings.bankClearThreshold
          ),
        },
        updatedAt: Date.now(),
      }));
    },
    [mutateState]
  );

  const removeFromBank = useCallback(
    (wordId: string) => {
      mutateState((prev) => ({
        ...prev,
        words: {
          ...prev.words,
          [wordId]: removeWordFromBank(prev.words[wordId], wordId),
        },
        updatedAt: Date.now(),
      }));
    },
    [mutateState]
  );

  const startSession = useCallback(
    ({
      source,
      categoryId,
      mode,
      lengthOption,
      explicitWords,
    }: StartSessionParams): PersistedSession | null => {
      const current = latestStateRef.current;
      let pool: Word[] = [];

      if (explicitWords && explicitWords.length > 0) {
        pool = explicitWords;
      } else if (source === 'category' && categoryId) {
        pool = CATALOG.wordsByCategory.get(categoryId) ?? [];
      } else if (source === 'mistakes') {
        const sourceWords = categoryId
          ? CATALOG.wordsByCategory.get(categoryId) ?? []
          : WORDS;
        pool = sourceWords.filter((w) => current.words[w.id]?.inBank);
      } else {
        pool = WORDS;
      }

      const chosenLength = lengthOption ?? current.settings.defaultSessionLength;
      const queue = explicitWords
        ? pool
        : buildSessionQueue({
            candidates: pool,
            progressMap: current.words,
            lengthOption: chosenLength,
          });

      if (queue.length === 0) return null;

      const now = Date.now();
      const session: PersistedSession = {
        id: `sess-${now}-${Math.random().toString(36).slice(2, 7)}`,
        source,
        categoryId,
        mode: mode ?? current.settings.defaultMode,
        lengthOption: chosenLength,
        queue,
        currentIndex: 0,
        answers: [],
        startedAt: now,
        elapsedMsBeforePause: 0,
        lastActiveAt: now,
        completed: false,
      };

      mutateState((prev) => ({
        ...prev,
        activeSession: session,
        updatedAt: now,
      }));

      return session;
    },
    [mutateState]
  );

  const submitSessionAnswer = useCallback(
    ({ word, attempt, isCorrect, skipped, usedHint }: SubmitSessionAnswerParams) => {
      const now = Date.now();
      mutateState((prev) => {
        const updatedWord = applyWordAnswer(prev.words[word.id], word.id, {
          isCorrect,
          bankClearThreshold: prev.settings.bankClearThreshold,
          now,
        });

        const nextSession = prev.activeSession
          ? {
              ...prev.activeSession,
              answers: [
                ...prev.activeSession.answers,
                {
                  wordId: word.id,
                  text: word.text,
                  category: word.category,
                  attempt,
                  isCorrect,
                  skipped,
                  usedHint,
                  answeredAt: now,
                },
              ],
              elapsedMsBeforePause:
                prev.activeSession.elapsedMsBeforePause +
                Math.min(60_000, Math.max(0, now - prev.activeSession.lastActiveAt)),
              lastActiveAt: now,
            }
          : null;

        return {
          ...prev,
          words: {
            ...prev.words,
            [word.id]: updatedWord,
          },
          activeSession: nextSession,
          streak: recordDailyActivity(prev.streak, isCorrect, now),
          updatedAt: now,
        };
      });
    },
    [mutateState]
  );

  const advanceSessionCard = useCallback(() => {
    const now = Date.now();
    mutateState((prev) => {
      if (!prev.activeSession) return prev;
      const nextIndex = prev.activeSession.currentIndex + 1;
      const completed = nextIndex >= prev.activeSession.queue.length;
      return {
        ...prev,
        activeSession: {
          ...prev.activeSession,
          currentIndex: Math.min(prev.activeSession.queue.length, nextIndex),
          lastActiveAt: now,
          completed,
        },
        updatedAt: now,
      };
    });
  }, [mutateState]);

  const switchSessionMode = useCallback(
    (mode: PracticeMode) => {
      mutateState((prev) => {
        if (!prev.activeSession || prev.activeSession.mode === mode) return prev;
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            mode,
            lastActiveAt: Date.now(),
          },
          updatedAt: Date.now(),
        };
      });
    },
    [mutateState]
  );

  const clearActiveSession = useCallback(() => {
    mutateState((prev) => ({
      ...prev,
      activeSession: null,
      updatedAt: Date.now(),
    }));
  }, [mutateState]);

  const exportProgressJson = useCallback(() => {
    return serializeExportPayload(latestStateRef.current);
  }, []);

  const previewImportJson = useCallback((jsonText: string): ImportValidationResult => {
    return validateImportJson(jsonText, KNOWN_WORD_IDS);
  }, []);

  const confirmImportState = useCallback((importedState: AppDataState) => {
    window.clearTimeout(debounceTimerRef.current);
    dirtyRef.current = false;
    suppressSaveOnCorruptBootRef.current = false;
    savePersistedState(importedState);
    setState(importedState);
    setCorruptedOnBoot(false);
    setResolvedTheme(applyThemeToDocument(importedState.settings.theme, true));
    applyMotionPreference(importedState.settings.reduceMotion);
    applyTextScale(importedState.settings.textScale);
  }, []);

  const resetAllProgress = useCallback(() => {
    window.clearTimeout(debounceTimerRef.current);
    dirtyRef.current = false;
    suppressSaveOnCorruptBootRef.current = false;
    clearPersistedState();
    const fresh = createDefaultState();
    savePersistedState(fresh);
    setState(fresh);
    setCorruptedOnBoot(false);
    setResolvedTheme(applyThemeToDocument(fresh.settings.theme, true));
    applyMotionPreference(fresh.settings.reduceMotion);
    applyTextScale(fresh.settings.textScale);
  }, []);

  const dismissCorruptionAndReset = useCallback(() => {
    resetAllProgress();
  }, [resetAllProgress]);

  // Fast derived aggregates across unique vocabulary & 37 categories
  const { masteredCount, learningCount, mistakesBankEntries, hardestWords } =
    useMemo(() => {
      let mastered = 0;
      let learning = 0;
      const bank: Array<{ word: Word; progress: WordProgress }> = [];
      const missed: Array<{ word: Word; progress: WordProgress }> = [];

      for (const [id, word] of UNIQUE_WORD_LOOKUP.entries()) {
        const rec = state.words[id];
        if (!rec) continue;
        const st = getWordStatus(rec);
        if (st === 'mastered') mastered += 1;
        else if (st === 'learning') learning += 1;

        if (rec.inBank) {
          bank.push({ word, progress: rec });
        }
        if (rec.wrong > 0) {
          missed.push({ word, progress: rec });
        }
      }

      bank.sort((a, b) => {
        if (a.progress.pinned !== b.progress.pinned) {
          return a.progress.pinned ? -1 : 1;
        }
        return (b.progress.lastMissAt ?? 0) - (a.progress.lastMissAt ?? 0);
      });

      missed.sort((a, b) => {
        if (b.progress.wrong !== a.progress.wrong) {
          return b.progress.wrong - a.progress.wrong;
        }
        return b.progress.attempts - a.progress.attempts;
      });

      return {
        masteredCount: mastered,
        learningCount: learning,
        mistakesBankEntries: bank,
        hardestWords: missed.slice(0, 15),
      };
    }, [state.words]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, CategoryProgressStats>();
    for (const cat of CATALOG.categories) {
      const catWords = CATALOG.wordsByCategory.get(cat.id) ?? [];
      map.set(cat.id, computeCategoryStats(cat.id, catWords, state.words));
    }
    return map;
  }, [state.words]);

  const effectiveStreak = useMemo(
    () => getEffectiveCurrentStreak(state.streak),
    [state.streak]
  );

  const value: TrainerContextValue = {
    state,
    resolvedTheme,
    corruptedOnBoot,
    backupSavedOnBoot,
    storageAvailable,
    masteredCount,
    learningCount,
    effectiveStreak,
    mistakesBankEntries,
    hardestWords,
    categoryStats,
    updateSettings,
    recordStandaloneAnswer,
    togglePin,
    removeFromBank,
    startSession,
    submitSessionAnswer,
    advanceSessionCard,
    switchSessionMode,
    clearActiveSession,
    exportProgressJson,
    previewImportJson,
    confirmImportState,
    resetAllProgress,
    dismissCorruptionAndReset,
  };

  return (
    <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>
  );
}

export function useTrainer(): TrainerContextValue {
  const ctx = useContext(TrainerContext);
  if (!ctx) {
    throw new Error('useTrainer must be used inside <TrainerProvider>');
  }
  return ctx;
}
