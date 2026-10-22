import { evaluateSpellingAttempt } from '../lib/answerCheck';
import {
  getWordStatus,
  type PersistedSession,
  type SessionSource,
} from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import type { Word } from '../types/word';
import { Icon } from './Icon';
import { CountUpNumber, ProgressRing } from './ProgressRing';
import { SpellingDiffView } from './SpellingDiffView';

interface SessionSummaryViewProps {
  session: PersistedSession;
  desiredSource: SessionSource;
  desiredCategory?: string;
  onNavigate: (hash: string) => void;
  onAnnounce: (msg: string) => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function SessionSummaryView({
  session,
  desiredSource,
  desiredCategory,
  onNavigate,
  onAnnounce,
}: SessionSummaryViewProps) {
  const { state, startSession, togglePin } = useTrainer();
  const { hasAvailableVoice, speakWord } = useAudio();

  const totalAnswered = session.answers.length;
  const correctItems = session.answers.filter((a) => a.isCorrect);
  const missedItems = session.answers.filter((a) => !a.isCorrect);
  const accuracyPct =
    totalAnswered > 0 ? Math.round((correctItems.length / totalAnswered) * 100) : 0;

  const missedWordsUnique: Word[] = [];
  const seenMissed = new Set<string>();
  for (const m of missedItems) {
    if (!seenMissed.has(m.wordId)) {
      seenMissed.add(m.wordId);
      const found = session.queue.find((q) => q.id === m.wordId);
      if (found) missedWordsUnique.push(found);
    }
  }

  const elapsedMs =
    session.elapsedMsBeforePause > 0
      ? session.elapsedMsBeforePause
      : Date.now() - session.startedAt;

  return (
    <section aria-labelledby="summary-heading">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ProgressRing
            value={accuracyPct}
            size={68}
            strokeWidth={5.5}
            color={accuracyPct >= 80 ? 'var(--correct)' : 'var(--accent)'}
            label={`Session accuracy ${accuracyPct}%`}
          />
          <div>
            <span className="eyebrow">End-of-Session Report</span>
            <h1 id="summary-heading" className="page-title">
              <CountUpNumber value={accuracyPct} />% Spelling Accuracy
            </h1>
            <p className="page-lead tabular">
              {correctItems.length} of {totalAnswered} right · Time taken:{' '}
              <strong>{formatDuration(elapsedMs)}</strong>
            </p>
          </div>
        </div>

        {/* One-tap "Practice these mistakes now" + Next Actions (Spec Section 4.6) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {missedWordsUnique.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                startSession({
                  source: 'mistakes',
                  categoryId: desiredCategory,
                  mode: session.mode,
                  explicitWords: missedWordsUnique,
                })
              }
            >
              <Icon name="mistakes" size={18} />
              <span>
                Practice these {missedWordsUnique.length} mistake
                {missedWordsUnique.length === 1 ? '' : 's'} now
              </span>
            </button>
          )}

          <button
            type="button"
            className={`btn ${missedWordsUnique.length === 0 ? 'btn-primary' : ''}`}
            onClick={() =>
              startSession({
                source: desiredSource,
                categoryId: desiredCategory,
                mode: session.mode,
                lengthOption: session.lengthOption,
              })
            }
          >
            <Icon name="refresh" size={17} />
            <span>Another set</span>
          </button>

          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => onNavigate('#/mistakes')}
          >
            <span>Mistakes bank</span>
          </button>

          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => onNavigate('#/')}
          >
            <span>All categories</span>
          </button>
        </div>
      </div>

      {/* Side-by-side summary panels on Medium+ screens (Spec Section 8) */}
      <div className="two-col-spec" style={{ alignItems: 'start' }}>
        <div className="folio-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-lg)' }}>
              Words Missed ({missedItems.length})
            </h2>
            {missedItems.length === 0 && (
              <span className="pill pill-correct">
                <Icon name="check" size={14} /> Zero errors
              </span>
            )}
          </div>

          {missedItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Clean sweep — every word in this set was spelled accurately and
              promoted up a Leitner box.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {missedItems.map((item, idx) => {
                const targetWord = session.queue.find((w) => w.id === item.wordId) ?? {
                  id: item.wordId,
                  text: item.text,
                  category: item.category,
                };
                const diffObj = evaluateSpellingAttempt(
                  item.attempt || '',
                  targetWord
                );
                const isPinned = Boolean(state.words[item.wordId]?.pinned);

                return (
                  <div
                    key={`${item.wordId}-${idx}`}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <strong
                        className="font-display"
                        style={{ fontSize: 'var(--text-lg)' }}
                      >
                        {item.text}
                      </strong>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {hasAvailableVoice && (
                          <button
                            type="button"
                            className="btn btn-icon"
                            style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
                            aria-label={`Speak ${item.text}`}
                            onClick={() => speakWord(targetWord)}
                          >
                            <Icon name="volume" size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-icon ${isPinned ? 'btn-primary' : ''}`}
                          style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
                          aria-pressed={isPinned}
                          aria-label={isPinned ? `Unpin ${item.text}` : `Pin ${item.text}`}
                          onClick={() => {
                            togglePin(item.wordId);
                            onAnnounce(
                              isPinned
                                ? `Unpinned ${item.text}`
                                : `Pinned ${item.text} in Mistakes Bank`
                            );
                          }}
                        >
                          <Icon name="pin" size={15} />
                        </button>
                      </div>
                    </div>

                    <p
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--wrong)',
                        marginTop: '4px',
                      }}
                    >
                      Your attempt:{' '}
                      <strong>
                        {item.attempt ? `“${item.attempt}”` : '(skipped / revealed)'}
                      </strong>
                    </p>

                    {item.attempt && <SpellingDiffView result={diffObj} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="folio-card">
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>
            Answered Right ({correctItems.length})
          </h2>

          {correctItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Missed words have been placed in your Mistakes Bank — tap{' '}
              <strong>Practice these mistakes now</strong> above to master them immediately.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {correctItems.map((item, idx) => {
                const prog = state.words[item.wordId];
                const status = getWordStatus(prog);
                return (
                  <li
                    key={`${item.wordId}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      paddingBottom: '8px',
                      borderBottom: '1px dashed var(--border)',
                    }}
                  >
                    <span
                      className="font-display"
                      style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}
                    >
                      {item.text}
                    </span>
                    <span
                      className={`pill tabular ${
                        status === 'mastered' ? 'pill-correct' : ''
                      }`}
                    >
                      {status === 'mastered'
                        ? 'Mastered'
                        : `Box ${prog?.box ?? 2} / 5`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
