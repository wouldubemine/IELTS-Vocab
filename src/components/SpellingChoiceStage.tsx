import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateSpellingAttempt } from '../lib/answerCheck';
import { generateSpellingChoices } from '../lib/misspellings';
import { getRemainingBankClears, getWordStatus } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import type { Word } from '../types/word';
import { Icon } from './Icon';
import { SpellingDiffView } from './SpellingDiffView';

interface SpellingChoiceStageProps {
  word: Word;
  cardKey: string;
  isLastCard: boolean;
  onSelectAnswer: (chosenText: string, isCorrect: boolean) => void;
  onNext: () => void;
  onAnnounce: (msg: string) => void;
}

/**
 * Spelling Choice Stage (Spec Section 4.2 #3):
 * Hear the word (or see contextual prompt if device lacks voices) and pick the
 * exact spelling among 4 plausible misspellings. Supports keys `1`–`4` & `Enter`.
 */
export function SpellingChoiceStage({
  word,
  cardKey,
  isLastCard,
  onSelectAnswer,
  onNext,
  onAnnounce,
}: SpellingChoiceStageProps) {
  const { state } = useTrainer();
  const { hasAvailableVoice, speakingMode, speakWord } = useAudio();

  const choices = useMemo(
    () => generateSpellingChoices(word, cardKey, 4),
    [word, cardKey]
  );

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const answered = selectedChoice !== null;
  const isCorrect =
    answered &&
    choices.find((c) => c.text === selectedChoice)?.isCorrect === true;

  useEffect(() => {
    setSelectedChoice(null);
    if (state.settings.autoPlayAudio && hasAvailableVoice) {
      speakWord(word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, word.id]);

  const chooseOption = useCallback(
    (choiceText: string, right: boolean) => {
      if (selectedChoice !== null) return;
      setSelectedChoice(choiceText);
      onSelectAnswer(choiceText, right);
      onAnnounce(
        right
          ? `Correct! ${word.text} is spelled right.`
          : `Incorrect. Correct spelling is ${word.text}.`
      );
      window.requestAnimationFrame(() => nextBtnRef.current?.focus());
    },
    [onAnnounce, onSelectAnswer, selectedChoice, word.text]
  );

  // Number keys 1..4 choose option; Enter advances after answering
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!answered) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < choices.length) {
          e.preventDefault();
          chooseOption(choices[idx].text, choices[idx].isCorrect);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answered, choices, chooseOption, onNext]);

  const wordProgress = state.words[word.id];
  const diffComparison = useMemo(() => {
    if (!selectedChoice || isCorrect) return null;
    return evaluateSpellingAttempt(selectedChoice, word);
  }, [isCorrect, selectedChoice, word]);

  return (
    <div
      key={cardKey}
      className={`practice-card ${
        answered ? (isCorrect ? 'is-correct' : 'is-wrong') : ''
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
          Pick the exact standard spelling (keys 1–4)
        </span>

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

      {/* Audio replay controls */}
      {hasAvailableVoice ? (
        <div className="audio-hero-row">
          <button
            type="button"
            className={`audio-speak-orb ${
              speakingMode === 'normal' ? 'is-speaking' : ''
            }`}
            onClick={() => speakWord(word)}
          >
            <Icon name="volume" size={20} />
            <span>{speakingMode === 'normal' ? 'Speaking…' : 'Replay word'}</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => speakWord(word, { slow: true })}
          >
            <Icon name="slow" size={18} />
            <span>Slow replay</span>
          </button>
        </div>
      ) : (
        <p
          style={{
            margin: 'var(--space-3) 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}
        >
          Spot which of the 4 spellings below is written without any IELTS spelling
          traps{word.hint ? ` (${word.hint})` : ''}:
        </p>
      )}

      {/* 4 Choice Buttons */}
      <div className="choice-grid" role="group" aria-label="Spelling options">
        {choices.map((opt, idx) => {
          const isPicked = selectedChoice === opt.text;
          let stateClass = '';
          if (answered) {
            if (opt.isCorrect) stateClass = 'is-right-option';
            else if (isPicked) stateClass = 'is-picked-wrong';
          }

          return (
            <button
              key={opt.text}
              type="button"
              className={`choice-option-btn ${stateClass}`}
              disabled={answered}
              onClick={() => chooseOption(opt.text, opt.isCorrect)}
            >
              <span className="choice-num-badge tabular">{idx + 1}</span>
              <span className="choice-text font-display">{opt.text}</span>
              {answered && opt.isCorrect && (
                <span style={{ color: 'var(--correct)', display: 'inline-flex' }}>
                  <Icon name="check" size={20} />
                </span>
              )}
              {answered && isPicked && !opt.isCorrect && (
                <span style={{ color: 'var(--wrong)', display: 'inline-flex' }}>
                  <Icon name="close" size={18} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {answered && (
        <div
          className={`feedback-panel ${isCorrect ? 'is-correct' : 'is-wrong'}`}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <strong
              style={{
                color: isCorrect ? 'var(--correct)' : 'var(--wrong)',
                fontSize: 'var(--text-lg)',
              }}
            >
              {isCorrect
                ? `Exact match — ${word.text}`
                : `Trap spotted — correct spelling is “${word.text}”`}
            </strong>

            {wordProgress && (
              <span className="pill tabular">
                {getWordStatus(wordProgress) === 'mastered'
                  ? 'Mastered (Box 5)'
                  : `Box ${wordProgress.box} / 5`}
              </span>
            )}
          </div>

          {diffComparison && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <SpellingDiffView result={diffComparison} />
            </div>
          )}

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
            <button
              ref={nextBtnRef}
              type="button"
              className="btn btn-primary"
              onClick={onNext}
            >
              <span>{isLastCard ? 'View session summary' : 'Next word'}</span>
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
