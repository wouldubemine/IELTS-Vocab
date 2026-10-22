import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { getRemainingBankClears } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import type { Word } from '../types/word';
import { Icon } from './Icon';

interface FlashcardStageProps {
  word: Word;
  cardKey: string;
  onGrade: (knewIt: boolean) => void;
  onAnnounce: (msg: string) => void;
}

const SWIPE_THRESHOLD_PX = 72;

/**
 * Flashcards Practice Stage (Spec Sections 4.2, 7 & 8):
 * - Word hidden initially -> tap card or press Space/Enter to reveal
 * - Self-grade "Missed it" (Left Arrow / Swipe Left) or "Knew it" (Right Arrow / Swipe Right)
 */
export function FlashcardStage({
  word,
  cardKey,
  onGrade,
  onAnnounce,
}: FlashcardStageProps) {
  const { state } = useTrainer();
  const { hasAvailableVoice, speakingMode, speakWord } = useAudio();

  const [revealed, setRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [gradedLock, setGradedLock] = useState(false);
  const pointerStartRef = useRef<number | null>(null);

  const wordProgress = state.words[word.id];

  useEffect(() => {
    setRevealed(false);
    setDragX(0);
    setGradedLock(false);

    if (state.settings.autoPlayAudio && hasAvailableVoice) {
      speakWord(word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, word.id]);

  const handleReveal = useCallback(() => {
    setRevealed((prev) => {
      if (!prev) {
        onAnnounce(`Revealed spelling: ${word.text}`);
      }
      return true;
    });
  }, [onAnnounce, word.text]);

  const commitGrade = useCallback(
    (knewIt: boolean) => {
      if (gradedLock) return;
      setGradedLock(true);
      onAnnounce(
        knewIt
          ? `Marked ${word.text} as Knew it`
          : `Marked ${word.text} as Missed — added to Mistakes Bank`
      );
      onGrade(knewIt);
    },
    [gradedLock, onAnnounce, onGrade, word.text]
  );

  // Keyboard shortcuts: Space / Enter to reveal; ArrowLeft / 1 = Missed; ArrowRight / 2 = Knew it
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        const tag = (e.target as HTMLElement | null)?.tagName ?? '';
        if (tag !== 'BUTTON') {
          e.preventDefault();
        }
        if (e.key === ' ') {
          e.preventDefault();
          handleReveal();
        }
        return;
      }

      if (revealed) {
        if (e.key === 'ArrowLeft' || e.key === '1') {
          e.preventDefault();
          commitGrade(false);
        } else if (e.key === 'ArrowRight' || e.key === '2') {
          e.preventDefault();
          commitGrade(true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commitGrade, handleReveal, revealed]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!revealed) return;
    if ((e.target as HTMLElement).closest('button')) return;
    pointerStartRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerStartRef.current === null) return;
    const dx = e.clientX - pointerStartRef.current;
    setDragX(Math.max(-180, Math.min(180, dx)));
  };

  const onPointerEnd = () => {
    if (pointerStartRef.current === null) return;
    pointerStartRef.current = null;
    if (dragX >= SWIPE_THRESHOLD_PX) {
      setDragX(0);
      commitGrade(true);
    } else if (dragX <= -SWIPE_THRESHOLD_PX) {
      setDragX(0);
      commitGrade(false);
    } else {
      setDragX(0);
    }
  };

  const swipeHint =
    dragX >= 34 ? 'knew' : dragX <= -34 ? 'missed' : null;

  return (
    <div
      key={cardKey}
      className="practice-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{
        touchAction: revealed ? 'pan-y' : 'auto',
        transform:
          dragX !== 0
            ? `translate3d(${dragX}px, 0, 0) rotate(${(dragX * 0.035).toFixed(2)}deg)`
            : undefined,
        borderColor:
          swipeHint === 'knew'
            ? 'var(--correct-border)'
            : swipeHint === 'missed'
              ? 'var(--wrong-border)'
              : undefined,
      }}
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
          {revealed
            ? 'Did you picture the exact spelling?'
            : 'Visualize the exact spelling, then reveal'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {swipeHint === 'knew' && (
            <span className="pill pill-correct">Release: Knew it →</span>
          )}
          {swipeHint === 'missed' && (
            <span className="pill pill-wrong">← Release: Missed it</span>
          )}
          {wordProgress?.inBank && (
            <span className="pill pill-wrong tabular">
              {wordProgress.pinned
                ? 'Pinned in bank'
                : `${getRemainingBankClears(
                    wordProgress,
                    state.settings.bankClearThreshold
                  )} more to clear`}
            </span>
          )}
        </div>
      </div>

      {/* Audio replay strip */}
      <div className="audio-hero-row">
        {hasAvailableVoice && (
          <>
            <button
              type="button"
              className={`audio-speak-orb ${
                speakingMode === 'normal' ? 'is-speaking' : ''
              }`}
              onClick={() => speakWord(word)}
            >
              <Icon name="volume" size={20} />
              <span>{speakingMode === 'normal' ? 'Speaking…' : 'Hear word'}</span>
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => speakWord(word, { slow: true })}
            >
              <Icon name="slow" size={18} />
              <span>Slow</span>
            </button>
          </>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          className="flashcard-reveal-surface"
          onClick={handleReveal}
        >
          <span
            className="font-display"
            style={{ fontSize: 'var(--text-xl)', color: 'var(--text)' }}
          >
            Tap or press <kbd>Space</kbd> to reveal spelling
          </span>
          {word.hint && (
            <span
              style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                marginTop: '6px',
              }}
            >
              Clue: {word.hint}
            </span>
          )}
        </button>
      ) : (
        <div
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="memory-hero-word">{word.text}</p>

          {word.alt && word.alt.length > 0 && (
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                marginTop: 'var(--space-2)',
              }}
            >
              Also accepted: {word.alt.join(', ')}
            </p>
          )}

          {word.hint && (
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--highlight-ink)',
                marginTop: '4px',
              }}
            >
              Note: {word.hint}
            </p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-5)',
            }}
          >
            <button
              type="button"
              className="btn"
              style={{
                minHeight: '50px',
                borderColor: 'var(--wrong-border)',
                color: 'var(--wrong)',
                background: 'var(--wrong-bg)',
              }}
              onClick={() => commitGrade(false)}
            >
              <Icon name="close" size={18} />
              <span>Missed it (←)</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: '50px' }}
              onClick={() => commitGrade(true)}
            >
              <Icon name="check" size={18} />
              <span>Knew it (→)</span>
            </button>
          </div>

          <p
            style={{
              textAlign: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-3)',
            }}
          >
            Tip: swipe card left/right or use <kbd>←</kbd> / <kbd>→</kbd> arrow keys
          </p>
        </div>
      )}
    </div>
  );
}
