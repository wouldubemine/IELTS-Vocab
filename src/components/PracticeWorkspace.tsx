import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCategoryById } from '../data/catalog';
import {
  buildProgressiveHint,
  evaluateSpellingAttempt,
  type AnswerCheckResult,
} from '../lib/answerCheck';
import {
  getRemainingBankClears,
  getWordStatus,
  type SessionLengthOption,
  type SessionSource,
} from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import type { PracticeMode, RouteState, Word } from '../types/word';
import { FlashcardStage } from './FlashcardStage';
import { Icon } from './Icon';
import { SessionSummaryView } from './SessionSummaryView';
import { SpellingChoiceStage } from './SpellingChoiceStage';
import { SpellingDiffView } from './SpellingDiffView';

interface PracticeWorkspaceProps {
  route: RouteState;
  onNavigate: (hash: string) => void;
  onAnnounce: (message: string) => void;
}

const SESSION_LENGTHS: Array<{ value: SessionLengthOption; label: string }> = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 'all', label: 'All' },
];

export function PracticeWorkspace({
  route,
  onNavigate,
  onAnnounce,
}: PracticeWorkspaceProps) {
  const {
    state,
    mistakesBankEntries,
    startSession,
    submitSessionAnswer,
    advanceSessionCard,
    switchSessionMode,
    updateSettings,
  } = useTrainer();

  const {
    voicesLoaded,
    hasAvailableVoice,
    speakingMode,
    gestureBlocked,
    speakWord,
    stopSpeaking,
    preloadWordsAudio,
  } = useAudio();

  const desiredSource: SessionSource = route.source ?? 'mixed';
  const desiredCategory = route.categoryId;
  const activeSession = state.activeSession;

  // Determine whether the persisted activeSession matches the current route target
  const matchesRoute = useMemo(() => {
    if (!activeSession) return false;
    if (activeSession.source !== desiredSource) return false;
    if ((activeSession.categoryId ?? '') !== (desiredCategory ?? '')) return false;
    return true;
  }, [activeSession, desiredSource, desiredCategory]);

  // Auto-initialize session when navigating to a category, mixed test, or mistakes drill
  useEffect(() => {
    if (!matchesRoute) {
      startSession({
        source: desiredSource,
        categoryId: desiredCategory,
        mode: route.mode ?? state.settings.defaultMode,
        lengthOption: state.settings.defaultSessionLength,
      });
    }
  }, [
    matchesRoute,
    desiredSource,
    desiredCategory,
    route.mode,
    state.settings.defaultMode,
    state.settings.defaultSessionLength,
    startSession,
  ]);

  const session = matchesRoute ? activeSession : null;
  const currentWord: Word | undefined = session
    ? session.queue[session.currentIndex]
    : undefined;

  // Automatic fallback to `read` (Read & Type) when no speech synthesis voice exists (Spec Section 9)
  const effectiveMode: PracticeMode = useMemo(() => {
    const requested = session?.mode ?? 'listen';
    if (requested === 'listen' && voicesLoaded && !hasAvailableVoice) {
      return 'read';
    }
    return requested;
  }, [session?.mode, voicesLoaded, hasAvailableVoice]);

  const cardKey = session
    ? `${session.id}:${session.currentIndex}:${effectiveMode}`
    : 'loading';

  const [typedInput, setTypedInput] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [emptyNudge, setEmptyNudge] = useState(false);
  const [submittedState, setSubmittedState] = useState<{
    cardKey: string;
    result: AnswerCheckResult;
    attempt: string;
    skipped: boolean;
  } | null>(null);
  const [memoryVisible, setMemoryVisible] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const peekTimerRef = useRef<number | undefined>(undefined);

  const isFeedbackPhase = submittedState?.cardKey === cardKey;

  // Reset card-local state whenever session card or mode changes
  useEffect(() => {
    setTypedInput('');
    setHintLevel(0);
    setEmptyNudge(false);
    window.clearTimeout(peekTimerRef.current);

    if (!currentWord || session?.completed) {
      setMemoryVisible(false);
      return;
    }

    if (effectiveMode === 'flashcards' || effectiveMode === 'choice') {
      setMemoryVisible(false);
      return;
    }

    if (effectiveMode === 'read') {
      setMemoryVisible(true);
      peekTimerRef.current = window.setTimeout(() => {
        setMemoryVisible(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }, 2100);
    } else {
      setMemoryVisible(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      if (state.settings.autoPlayAudio && hasAvailableVoice) {
        speakWord(currentWord);
      }
    }

    return () => {
      window.clearTimeout(peekTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, currentWord?.id, session?.completed]);

  // Pre-probe audio pack clips for upcoming queue items
  useEffect(() => {
    if (session?.queue) {
      preloadWordsAudio(session.queue.slice(session.currentIndex));
    }
  }, [session?.id, session?.currentIndex, session?.queue, preloadWordsAudio]);

  const triggerReplayOrPeek = useCallback(
    (slow = false) => {
      if (!currentWord) return;
      if (effectiveMode === 'read' && !hasAvailableVoice) {
        window.clearTimeout(peekTimerRef.current);
        setMemoryVisible(true);
        peekTimerRef.current = window.setTimeout(() => {
          setMemoryVisible(false);
          inputRef.current?.focus();
        }, 1500);
        return;
      }
      speakWord(currentWord, { slow });
      if (!isFeedbackPhase) {
        inputRef.current?.focus();
      }
    },
    [currentWord, effectiveMode, hasAvailableVoice, isFeedbackPhase, speakWord]
  );

  const triggerHint = useCallback(() => {
    if (!currentWord || isFeedbackPhase || !state.settings.showHintButton) return;
    setHintLevel((prev) => {
      const next = Math.min(3, prev + 1);
      onAnnounce(`Hint level ${next} of 3 revealed`);
      return next;
    });
    inputRef.current?.focus();
  }, [currentWord, isFeedbackPhase, state.settings.showHintButton, onAnnounce]);

  const handleCheckSpelling = useCallback(() => {
    if (!currentWord || isFeedbackPhase) return;

    const evaluated = evaluateSpellingAttempt(typedInput, currentWord);
    if (evaluated.isEmpty) {
      setEmptyNudge(true);
      onAnnounce('Type your spelling first, or click Skip if you are unsure.');
      inputRef.current?.focus();
      return;
    }

    setEmptyNudge(false);
    submitSessionAnswer({
      word: currentWord,
      attempt: typedInput.trim(),
      isCorrect: evaluated.isCorrect,
      usedHint: hintLevel > 0,
    });

    setSubmittedState({
      cardKey,
      result: evaluated,
      attempt: typedInput.trim(),
      skipped: false,
    });

    onAnnounce(
      evaluated.isCorrect
        ? `Correct! ${currentWord.text}`
        : `Incorrect. Correct spelling is ${currentWord.text}`
    );

    window.requestAnimationFrame(() => nextBtnRef.current?.focus());
  }, [
    cardKey,
    currentWord,
    hintLevel,
    isFeedbackPhase,
    onAnnounce,
    submitSessionAnswer,
    typedInput,
  ]);

  const handleSkip = useCallback(() => {
    if (!currentWord || isFeedbackPhase) return;
    const diffResult = evaluateSpellingAttempt('', currentWord);
    const fullMissingResult: AnswerCheckResult = {
      ...diffResult,
      isEmpty: false,
      diff: [{ kind: 'missing', expected: currentWord.text }],
      summaryCounts: {
        missing: currentWord.text.length,
        extra: 0,
        swapped: 0,
        wrong: 0,
      },
    };

    submitSessionAnswer({
      word: currentWord,
      attempt: '',
      isCorrect: false,
      skipped: true,
      usedHint: hintLevel > 0,
    });

    setSubmittedState({
      cardKey,
      result: fullMissingResult,
      attempt: '',
      skipped: true,
    });

    if (hasAvailableVoice) {
      speakWord(currentWord);
    }
    onAnnounce(`Skipped. Spelling is ${currentWord.text}. Added to mistakes bank.`);
    window.requestAnimationFrame(() => nextBtnRef.current?.focus());
  }, [
    cardKey,
    currentWord,
    hasAvailableVoice,
    hintLevel,
    isFeedbackPhase,
    onAnnounce,
    speakWord,
    submitSessionAnswer,
  ]);

  const handleNextCard = useCallback(() => {
    if (!isFeedbackPhase) return;
    stopSpeaking();
    setSubmittedState(null);
    advanceSessionCard();
  }, [advanceSessionCard, isFeedbackPhase, stopSpeaking]);

  // Global keyboard shortcuts (Spec Section 8)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopSpeaking();
        onNavigate(desiredSource === 'mistakes' ? '#/mistakes' : '#/');
        return;
      }

      if (!session || session.completed || !currentWord) return;

      // Intercept Ctrl+R / Cmd+R so replay shortcut never accidentally reloads browser mid-dictation
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        triggerReplayOrPeek(false);
        return;
      }

      const targetTag = (e.target as HTMLElement | null)?.tagName ?? '';
      const typingInsideInput =
        (targetTag === 'INPUT' || targetTag === 'TEXTAREA') && !isFeedbackPhase;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'r') {
          e.preventDefault();
          triggerReplayOrPeek(false);
          return;
        }
        if (lower === 's') {
          e.preventDefault();
          triggerReplayOrPeek(true);
          return;
        }
        if (lower === 'h') {
          e.preventDefault();
          triggerHint();
          return;
        }
      }

      if (!typingInsideInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'r') {
          e.preventDefault();
          triggerReplayOrPeek(false);
          return;
        }
        if (lower === 's') {
          e.preventDefault();
          triggerReplayOrPeek(true);
          return;
        }
        if (lower === 'h') {
          e.preventDefault();
          triggerHint();
          return;
        }
        if (e.key === 'Enter' && isFeedbackPhase) {
          e.preventDefault();
          handleNextCard();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentWord,
    desiredSource,
    handleNextCard,
    isFeedbackPhase,
    onNavigate,
    session,
    stopSpeaking,
    triggerHint,
    triggerReplayOrPeek,
  ]);

  const categoryMeta = getCategoryById(desiredCategory);
  const currentWordCategory = getCategoryById(currentWord?.category);
  const hintInfo =
    currentWord && hintLevel > 0
      ? buildProgressiveHint(currentWord, hintLevel)
      : null;

  // Handle empty Mistakes Bank when navigating directly to `#/practice/mistakes`
  if (desiredSource === 'mistakes' && mistakesBankEntries.length === 0 && !session) {
    return (
      <section aria-labelledby="empty-bank-practice">
        <div className="folio-card" style={{ maxWidth: '38rem' }}>
          <span className="pill pill-correct">
            <Icon name="check" size={14} /> Mistakes Bank Clear
          </span>
          <h1
            id="empty-bank-practice"
            style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-3)' }}
          >
            Every missed word is cleared
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Jump into any category or run a mixed test to keep sharpening your
            IELTS spelling accuracy.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('#/')}
            >
              <span>Choose a category</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('#/practice/mixed')}
            >
              <span>Start mixed test</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <div className="folio-card">
        <p>Preparing your session…</p>
      </div>
    );
  }

  // End-of-session Summary Screen (Spec Section 4.6)
  if (session.completed) {
    return (
      <SessionSummaryView
        session={session}
        desiredSource={desiredSource}
        desiredCategory={desiredCategory}
        onNavigate={onNavigate}
        onAnnounce={onAnnounce}
      />
    );
  }

  const progressPct = Math.round(
    (session.currentIndex / Math.max(1, session.queue.length)) * 100
  );
  const updatedWordProgress = currentWord
    ? state.words[currentWord.id]
    : undefined;
  const recentSessionMistakes = session.answers
    .filter((a) => !a.isCorrect)
    .slice(-5)
    .reverse();

  return (
    <section aria-labelledby="active-session-heading">
      {/* Compact Session Header */}
      <div className="practice-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => {
              stopSpeaking();
              onNavigate(desiredSource === 'mistakes' ? '#/mistakes' : '#/');
            }}
          >
            <Icon name="arrow-left" size={17} />
            <span>Back</span>
          </button>

          <div>
            <h1 id="active-session-heading" style={{ fontSize: 'var(--text-lg)' }}>
              {categoryMeta
                ? categoryMeta.name
                : desiredSource === 'mistakes'
                  ? 'Mistakes Bank Drill'
                  : 'Mixed IELTS Test'}
            </h1>
            <p className="tabular" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Word {session.currentIndex + 1} of {session.queue.length}
              {currentWordCategory && !categoryMeta
                ? ` · ${currentWordCategory.name}`
                : ''}
            </p>
          </div>
        </div>

        {/* All 4 Practice Modes Switcher (Spec Section 4.2) */}
        <div
          className="mode-pills-bar"
          role="group"
          aria-label="Practice mode"
        >
          {(
            [
              { id: 'listen', label: 'Listen & Spell', icon: 'headphones' },
              { id: 'flashcards', label: 'Flashcards', icon: 'layers' },
              { id: 'choice', label: 'Spelling choice', icon: 'list-check' },
              { id: 'read', label: 'Read & type', icon: 'keyboard' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn ${session.mode === m.id ? 'btn-primary' : 'btn-subtle'}`}
              style={{ minHeight: '40px', padding: '0.45rem 0.78rem' }}
              onClick={() => {
                updateSettings({ defaultMode: m.id });
                switchSessionMode(m.id);
              }}
            >
              <Icon name={m.icon} size={15} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Spring Progress Bar */}
      <div
        className="session-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={session.queue.length}
        aria-valuenow={session.currentIndex}
        aria-label="Session progress"
      >
        <div
          className="session-progress-fill"
          style={
            {
              '--progress-ratio': progressPct / 100,
            } as React.CSSProperties
          }
        />
      </div>

      {/* No-Voice Auto-Fallback Banner (Spec Section 9) */}
      {session.mode === 'listen' && voicesLoaded && !hasAvailableVoice && (
        <div
          role="status"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--highlight-bg)',
            border: '1px solid var(--highlight-border)',
            color: 'var(--highlight-ink)',
            fontSize: 'var(--text-xs)',
          }}
        >
          No speech synthesis voice is installed on this browser — automatically
          running in <strong>Read &amp; Type</strong> memory mode so you can still
          practice seamlessly.
        </div>
      )}

      <div className="practice-layout">
        {/* Primary Practice Card — Supports All 4 Practice Modes */}
        <div className="practice-card-stage">
          {currentWord && effectiveMode === 'flashcards' && (
            <FlashcardStage
              word={currentWord}
              cardKey={cardKey}
              onAnnounce={onAnnounce}
              onGrade={(knewIt) => {
                submitSessionAnswer({
                  word: currentWord,
                  attempt: knewIt ? currentWord.text : '(missed flashcard)',
                  isCorrect: knewIt,
                });
                stopSpeaking();
                advanceSessionCard();
              }}
            />
          )}

          {currentWord && effectiveMode === 'choice' && (
            <SpellingChoiceStage
              word={currentWord}
              cardKey={cardKey}
              isLastCard={session.currentIndex + 1 >= session.queue.length}
              onAnnounce={onAnnounce}
              onSelectAnswer={(chosenText, right) => {
                submitSessionAnswer({
                  word: currentWord,
                  attempt: chosenText,
                  isCorrect: right,
                });
              }}
              onNext={() => {
                stopSpeaking();
                advanceSessionCard();
              }}
            />
          )}

          {currentWord &&
            (effectiveMode === 'listen' || effectiveMode === 'read') && (
            <div
              key={cardKey}
              className={`practice-card ${
                isFeedbackPhase
                  ? submittedState.result.isCorrect
                    ? 'is-correct'
                    : 'is-wrong'
                  : ''
              }`}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                  flexWrap: 'wrap',
                }}
              >
                <span className="eyebrow">
                  {effectiveMode === 'read'
                    ? 'Read briefly, then spell from memory'
                    : 'Listen carefully & type exact spelling'}
                </span>

                {updatedWordProgress?.inBank && (
                  <span className="pill pill-wrong tabular">
                    {updatedWordProgress.pinned
                      ? 'Pinned in bank'
                      : `${getRemainingBankClears(
                          updatedWordProgress,
                          state.settings.bankClearThreshold
                        )} more to clear`}
                  </span>
                )}
              </div>

              {/* Audio Dictation Controls OR Read & Type Flash Box */}
              {effectiveMode === 'listen' ? (
                <div className="audio-hero-row">
                  <button
                    type="button"
                    className={`audio-speak-orb ${
                      speakingMode === 'normal' ? 'is-speaking' : ''
                    }`}
                    onClick={() => triggerReplayOrPeek(false)}
                  >
                    <Icon name="volume" size={22} />
                    <span>
                      {gestureBlocked
                        ? 'Tap to hear word'
                        : speakingMode === 'normal'
                          ? 'Speaking…'
                          : 'Replay word'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => triggerReplayOrPeek(true)}
                  >
                    <Icon name="slow" size={18} />
                    <span>Slow replay</span>
                  </button>

                  {state.settings.showHintButton && !isFeedbackPhase && (
                    <button
                      type="button"
                      className="btn btn-subtle"
                      disabled={hintLevel >= 3}
                      onClick={triggerHint}
                    >
                      <Icon name="hint" size={18} />
                      <span>
                        {hintLevel === 0 ? 'Hint' : `Hint (${hintLevel}/3)`}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="memory-flash-box">
                  {memoryVisible || isFeedbackPhase ? (
                    <p className="memory-hero-word">{currentWord.text}</p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Word hidden — type it accurately from memory
                      </span>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn-subtle"
                          onClick={() => {
                            window.clearTimeout(peekTimerRef.current);
                            setMemoryVisible(true);
                            peekTimerRef.current = window.setTimeout(() => {
                              setMemoryVisible(false);
                              inputRef.current?.focus();
                            }, 1500);
                          }}
                        >
                          <Icon name="play" size={15} />
                          <span>Peek again</span>
                        </button>
                        {state.settings.showHintButton && (
                          <button
                            type="button"
                            className="btn btn-subtle"
                            disabled={hintLevel >= 3}
                            onClick={triggerHint}
                          >
                            <Icon name="hint" size={16} />
                            <span>
                              {hintLevel === 0 ? 'Hint' : `Hint (${hintLevel}/3)`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progressive Hint Strip (Reveals nothing until requested) */}
              {hintInfo && !isFeedbackPhase && (
                <div className="hint-banner" role="region" aria-label="Spelling hint">
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--highlight-ink)',
                    }}
                  >
                    {hintInfo.metaCaption}
                    {hintInfo.meaningClue ? ` — ${hintInfo.meaningClue}` : ''}
                  </div>
                  <div className="hint-pattern">{hintInfo.maskedPattern}</div>
                </div>
              )}

              {/* Spelling Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isFeedbackPhase) {
                    handleNextCard();
                  } else {
                    handleCheckSpelling();
                  }
                }}
              >
                <label htmlFor="ielts-spelling-field" className="sr-only">
                  Type the exact spelling
                </label>
                <input
                  ref={inputRef}
                  id="ielts-spelling-field"
                  type="text"
                  className="spelling-input"
                  value={typedInput}
                  readOnly={isFeedbackPhase}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint={isFeedbackPhase ? 'next' : 'done'}
                  placeholder="Type the spelling here…"
                  onChange={(e) => {
                    setTypedInput(e.target.value);
                    if (emptyNudge) setEmptyNudge(false);
                  }}
                />

                {emptyNudge && !isFeedbackPhase && (
                  <p
                    role="status"
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      marginTop: '6px',
                    }}
                  >
                    Enter your spelling attempt first, or press <strong>Skip</strong>{' '}
                    if you aren’t sure yet.
                  </p>
                )}

                {!isFeedbackPhase ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-4)',
                    }}
                  >
                    <button type="submit" className="btn btn-primary">
                      <Icon name="check" size={18} />
                      <span>Check spelling</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={handleSkip}
                    >
                      <Icon name="skip" size={17} />
                      <span>Skip / Reveal</span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={`feedback-panel ${
                      submittedState.result.isCorrect ? 'is-correct' : 'is-wrong'
                    }`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {submittedState.result.isCorrect ? (
                          <>
                            <span
                              className="drawn-check-icon"
                              style={{
                                display: 'inline-flex',
                                color: 'var(--correct)',
                              }}
                            >
                              <Icon name="check" size={22} />
                            </span>
                            <strong style={{ color: 'var(--correct)', fontSize: 'var(--text-lg)' }}>
                              Spot on — {currentWord.text}
                            </strong>
                          </>
                        ) : (
                          <>
                            <span
                              style={{
                                display: 'inline-flex',
                                color: 'var(--wrong)',
                              }}
                            >
                              <Icon name="close" size={20} />
                            </span>
                            <strong style={{ color: 'var(--wrong)', fontSize: 'var(--text-lg)' }}>
                              {submittedState.skipped
                                ? 'Skipped — added to Mistakes Bank'
                                : 'Close — check the letter diff below'}
                            </strong>
                          </>
                        )}
                      </div>

                      {updatedWordProgress && (
                        <span className="pill tabular">
                          {getWordStatus(updatedWordProgress) === 'mastered'
                            ? 'Mastered (Box 5)'
                            : `Box ${updatedWordProgress.box} / 5`}
                        </span>
                      )}
                    </div>

                    {!submittedState.result.isCorrect && (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                          Canonical spelling:{' '}
                          <strong style={{ color: 'var(--text)' }}>
                            {currentWord.text}
                          </strong>
                          {currentWord.alt && currentWord.alt.length > 0 && (
                            <span> (also accepted: {currentWord.alt.join(', ')})</span>
                          )}
                        </div>

                        {!submittedState.skipped && (
                          <SpellingDiffView result={submittedState.result} />
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-2)',
                        marginTop: 'var(--space-4)',
                      }}
                    >
                      <button
                        ref={nextBtnRef}
                        type="submit"
                        className="btn btn-primary"
                      >
                        <span>
                          {session.currentIndex + 1 >= session.queue.length
                            ? 'View session summary'
                            : 'Next word'}
                        </span>
                        <Icon name="arrow-right" size={18} />
                      </button>

                      {hasAvailableVoice && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => speakWord(currentWord)}
                        >
                          <Icon name="volume" size={17} />
                          <span>Hear again</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Secondary Panel on Expanded / Large Viewports (Spec Section 8) */}
        <aside className="practice-side-panel" aria-label="Session overview">
          <div className="folio-card">
            <span className="eyebrow">Session Length</span>
            <div
              className="segmented"
              style={{
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                marginTop: 'var(--space-2)',
              }}
              role="radiogroup"
              aria-label="Words per session"
            >
              {SESSION_LENGTHS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="radio"
                  aria-checked={session.lengthOption === opt.value}
                  className="segmented-btn"
                  onClick={() => {
                    updateSettings({ defaultSessionLength: opt.value });
                    startSession({
                      source: desiredSource,
                      categoryId: desiredCategory,
                      mode: session.mode,
                      lengthOption: opt.value,
                    });
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div
              className="tabular"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Right so far</span>
              <strong style={{ color: 'var(--correct)' }}>
                {session.answers.filter((a) => a.isCorrect).length} /{' '}
                {session.answers.length}
              </strong>
            </div>
          </div>

          <div className="folio-card">
            <span className="eyebrow">Recent Session Misses</span>
            {recentSessionMistakes.length === 0 ? (
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  marginTop: 'var(--space-2)',
                }}
              >
                No misses in this session yet — keep going!
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 'var(--space-3) 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {recentSessionMistakes.map((item, idx) => (
                  <li
                    key={`${item.wordId}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      paddingBottom: '6px',
                      borderBottom: '1px dashed var(--border)',
                    }}
                  >
                    <strong>{item.text}</strong>
                    <span style={{ color: 'var(--wrong)', fontSize: 'var(--text-xs)' }}>
                      {item.attempt || 'skipped'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
