import { useMemo, useState } from 'react';
import { CATALOG, WORDS } from '../data/catalog';
import { toLocalDateKey } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import type { CategoryMeta, Word } from '../types/word';
import { Icon } from './Icon';
import { CountUpNumber, ProgressRing } from './ProgressRing';

interface StatsViewProps {
  onNavigate: (hash: string) => void;
  onAnnounce: (msg: string) => void;
}

interface DayPoint {
  dateKey: string;
  shortLabel: string;
  practiced: number;
  correct: number;
}

export function StatsView({ onNavigate, onAnnounce }: StatsViewProps) {
  const {
    state,
    masteredCount,
    learningCount,
    effectiveStreak,
    mistakesBankEntries,
    hardestWords,
    categoryStats,
    togglePin,
  } = useTrainer();
  const { hasAvailableVoice, speakWord } = useAudio();

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(13);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const uniqueWordIds = useMemo(() => {
    const s = new Set<string>();
    for (const w of WORDS) s.add(w.id);
    return s;
  }, []);

  // Lifetime right / wrong & 5-box Leitner spacing distribution
  const breakdown = useMemo(() => {
    let totalCorrect = 0;
    let totalWrong = 0;
    const boxes = [0, 0, 0, 0, 0, 0]; // index 0 = unseen, 1..5 = Leitner boxes

    for (const id of uniqueWordIds) {
      const wp = state.words[id];
      if (!wp || wp.attempts === 0) {
        boxes[0]++;
        continue;
      }
      totalCorrect += wp.correct;
      totalWrong += wp.wrong;
      boxes[wp.box]++;
    }

    const totalAttempts = totalCorrect + totalWrong;
    const lifetimeAccuracyPct =
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return {
      totalCorrect,
      totalWrong,
      totalAttempts,
      lifetimeAccuracyPct,
      boxes,
    };
  }, [state.words, uniqueWordIds]);

  // Last 14 calendar days activity series (responsive viewBox SVG data)
  const last14Days = useMemo<DayPoint[]>(() => {
    const points: DayPoint[] = [];
    const now = new Date();
    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset
      );
      const dateKey = toLocalDateKey(d.getTime());
      const shortLabel = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const rec = state.streak.history[dateKey] ?? {
        practiced: 0,
        correct: 0,
        wrong: 0,
      };
      points.push({
        dateKey,
        shortLabel,
        practiced: rec.practiced,
        correct: rec.correct,
      });
    }
    return points;
  }, [state.streak.history]);

  // Category accuracy rows
  const categoryRows = useMemo(() => {
    const rows: Array<{
      category: CategoryMeta;
      seenCount: number;
      masteredCount: number;
      accuracyPct: number | null;
    }> = CATALOG.categories.map((cat) => {
      const st = categoryStats.get(cat.id);
      const seenCount = st ? st.learning + st.mastered : 0;

      return {
        category: cat,
        seenCount,
        masteredCount: st?.mastered ?? 0,
        accuracyPct: st?.accuracy ?? null,
      };
    });

    const filtered = showAllCategories
      ? rows
      : rows.filter((r) => r.seenCount > 0);

    return [...filtered].sort((a, b) => {
      if (a.accuracyPct === null && b.accuracyPct === null) return 0;
      if (a.accuracyPct === null) return 1;
      if (b.accuracyPct === null) return -1;
      return a.accuracyPct - b.accuracyPct;
    });
  }, [categoryStats, showAllCategories]);

  const totalUnique = CATALOG.uniqueWordCount;
  const seenTotal = masteredCount + learningCount;
  const unseenTotal = Math.max(0, totalUnique - seenTotal);
  const masteryPct = Math.round((masteredCount / Math.max(1, totalUnique)) * 100);
  const maxDayPracticed = Math.max(10, ...last14Days.map((d) => d.practiced));
  const activeDay = last14Days[selectedDayIdx] ?? last14Days[13];

  const handleTogglePinWord = (word: Word, currentlyPinned: boolean) => {
    togglePin(word.id);
    onAnnounce(
      currentlyPinned
        ? `Unpinned ${word.text}`
        : `Pinned ${word.text} to Mistakes Bank`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Hero Card */}
      <section
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ProgressRing
            value={masteryPct}
            size={84}
            strokeWidth={7}
            label={`${masteryPct}% vocabulary mastered`}
          />
          <div>
            <span className="eyebrow">Mastery &amp; Analytics</span>
            <h1
              className="font-display"
              style={{
                fontSize: 'var(--text-2xl)',
                lineHeight: 'var(--leading-tight)',
                marginTop: '2px',
              }}
            >
              Progress Dashboard
            </h1>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                marginTop: '4px',
              }}
            >
              <strong className="tabular" style={{ color: 'var(--text)' }}>
                <CountUpNumber value={masteredCount} />
              </strong>{' '}
              mastered ·{' '}
              <strong className="tabular" style={{ color: 'var(--text)' }}>
                {learningCount}
              </strong>{' '}
              in active review ·{' '}
              <strong className="tabular" style={{ color: 'var(--text)' }}>
                {unseenTotal}
              </strong>{' '}
              unseen
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate('#/practice?source=mixed')}
        >
          <Icon name="sparkles" size={18} />
          <span>Start mixed test</span>
        </button>
      </section>

      {/* 4 Summary Metric Cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 'var(--space-4)',
        }}
        aria-label="Key statistics"
      >
        <div className="card">
          <span className="eyebrow">Daily Streak</span>
          <div
            className="font-display tabular"
            style={{
              fontSize: 'var(--text-2xl)',
              marginTop: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: 'var(--highlight-ink)', display: 'inline-flex' }}>
              <Icon name="sparkles" size={22} />
            </span>
            <span>
              <CountUpNumber value={effectiveStreak} />{' '}
              {effectiveStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Longest streak:{' '}
            <strong className="tabular">{state.streak.longestStreak}</strong>{' '}
            {state.streak.longestStreak === 1 ? 'day' : 'days'}
          </p>
        </div>

        <div className="card">
          <span className="eyebrow">Lifetime Accuracy</span>
          <div
            className="font-display tabular"
            style={{
              fontSize: 'var(--text-2xl)',
              marginTop: 'var(--space-2)',
              color:
                breakdown.totalAttempts === 0
                  ? 'var(--text)'
                  : breakdown.lifetimeAccuracyPct >= 80
                    ? 'var(--correct)'
                    : 'var(--text)',
            }}
          >
            {breakdown.totalAttempts === 0 ? (
              '—'
            ) : (
              <>
                <CountUpNumber value={breakdown.lifetimeAccuracyPct} />%
              </>
            )}
          </div>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            <span className="tabular">{breakdown.totalCorrect}</span> right of{' '}
            <span className="tabular">{breakdown.totalAttempts}</span> lifetime answers
          </p>
        </div>

        <div className="card">
          <span className="eyebrow">Words Seen</span>
          <div
            className="font-display tabular"
            style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-2)' }}
          >
            <CountUpNumber value={seenTotal} /> / {totalUnique}
          </div>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {Math.round((seenTotal / Math.max(1, totalUnique)) * 100)}% of corpus explored
          </p>
        </div>

        <div className="card">
          <span className="eyebrow">Mistakes Bank</span>
          <div
            className="font-display tabular"
            style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--space-2)' }}
          >
            <CountUpNumber value={mistakesBankEntries.length} /> active
          </div>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Threshold:{' '}
            <strong className="tabular">
              {state.settings.bankClearThreshold}
            </strong>{' '}
            in a row to clear
          </p>
        </div>
      </section>

      {/* Two-Column Responsive Charts Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
      >
        {/* Chart 1: 14-Day Responsive ViewBox SVG Activity Bar Chart */}
        <section className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div>
              <span className="eyebrow">Last 14 Days</span>
              <h2 className="font-display" style={{ fontSize: 'var(--text-lg)' }}>
                Daily Practice Volume
              </h2>
            </div>

            <span className="pill tabular">
              {activeDay.shortLabel}:{' '}
              <strong>
                {activeDay.practiced === 0
                  ? '0 words'
                  : `${activeDay.practiced} words (${Math.round(
                      (activeDay.correct / activeDay.practiced) * 100
                    )}% right)`}
              </strong>
            </span>
          </div>

          <svg
            viewBox="0 0 560 175"
            width="100%"
            role="group"
            aria-label="Bar chart of words practiced across the past 14 days"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <title>14-day practice volume chart</title>
            <line
              x1="0"
              y1="140"
              x2="560"
              y2="140"
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="74"
              x2="560"
              y2="74"
              stroke="var(--border)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            {last14Days.map((day, idx) => {
              const slotW = 560 / 14;
              const barW = 24;
              const x = idx * slotW + (slotW - barW) / 2;
              const totalH =
                day.practiced === 0
                  ? 4
                  : Math.max(
                      10,
                      Math.round((day.practiced / maxDayPracticed) * 124)
                    );
              const rightH =
                day.practiced === 0
                  ? 0
                  : Math.round((day.correct / maxDayPracticed) * 124);
              const isSelected = idx === selectedDayIdx;

              return (
                <g
                  key={day.dateKey}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${day.shortLabel}: ${day.practiced} words practiced, ${day.correct} correct`}
                  onClick={() => setSelectedDayIdx(idx)}
                  onMouseEnter={() => setSelectedDayIdx(idx)}
                  onFocus={() => setSelectedDayIdx(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDayIdx(idx);
                    }
                  }}
                >
                  <rect
                    x={x}
                    y={140 - totalH}
                    width={barW}
                    height={totalH}
                    rx={5}
                    fill={
                      day.practiced === 0
                        ? 'var(--surface-2)'
                        : 'var(--highlight-bg)'
                    }
                    stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {rightH > 0 && (
                    <rect
                      x={x}
                      y={140 - rightH}
                      width={barW}
                      height={rightH}
                      rx={5}
                      fill="var(--accent)"
                    />
                  )}
                  {(idx % 3 === 0 || idx === 13) && (
                    <text
                      x={x + barW / 2}
                      y={162}
                      textAnchor="middle"
                      fontSize="11"
                      fill={isSelected ? 'var(--text)' : 'var(--text-muted)'}
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {idx === 13 ? 'Today' : day.shortLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </section>

        {/* Chart 2: 5-Box Leitner Spacing Distribution */}
        <section className="card">
          <span className="eyebrow">Spaced Repetition</span>
          <h2
            className="font-display"
            style={{
              fontSize: 'var(--text-lg)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Leitner 5-Box Distribution
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              {
                label: 'Box 5 · Mastered',
                count: breakdown.boxes[5],
                color: 'var(--correct)',
              },
              {
                label: 'Box 4 · Strong',
                count: breakdown.boxes[4],
                color: 'var(--accent)',
              },
              {
                label: 'Box 3 · Consolidating',
                count: breakdown.boxes[3],
                color: 'var(--accent)',
              },
              {
                label: 'Box 2 · Familiar',
                count: breakdown.boxes[2],
                color: 'var(--highlight-ink)',
              },
              {
                label: 'Box 1 · Needs review',
                count: breakdown.boxes[1],
                color: 'var(--wrong)',
              },
              {
                label: 'Unseen catalog words',
                count: breakdown.boxes[0],
                color: 'var(--border-strong)',
              },
            ].map((row) => {
              const pct = Math.round(
                (row.count / Math.max(1, totalUnique)) * 100
              );
              return (
                <div key={row.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--text-xs)',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{row.label}</span>
                    <span className="tabular" style={{ color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text)' }}>{row.count}</strong> (
                      {pct}%)
                    </span>
                  </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={
                          {
                            '--progress-ratio':
                              Math.max(row.count > 0 ? 0.02 : 0, pct / 100),
                            background: row.color,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Hardest Words Leaderboard */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div>
            <span className="eyebrow">Targeted Weak Spots</span>
            <h2 className="font-display" style={{ fontSize: 'var(--text-lg)' }}>
              Hardest Words Leaderboard
            </h2>
          </div>

          {mistakesBankEntries.length > 0 && (
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => onNavigate('#/practice?source=mistakes')}
            >
              <Icon name="mistakes" size={16} />
              <span>Drill mistakes bank ({mistakesBankEntries.length})</span>
            </button>
          )}
        </div>

        {hardestWords.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            No misspelled words recorded yet. Once you miss any words in practice,
            your trickiest IELTS spellings appear right here for quick review.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {hardestWords.map(({ word, progress }) => {
              const acc = Math.round(
                (progress.correct / Math.max(1, progress.attempts)) * 100
              );
              return (
                <div
                  key={word.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong
                        className="font-display"
                        style={{ fontSize: 'var(--text-lg)' }}
                      >
                        {word.text}
                      </strong>
                      <span className="pill pill-wrong tabular">
                        {progress.wrong}× missed
                      </span>
                    </div>
                    <div
                      className="tabular"
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {acc}% right across {progress.attempts} attempts
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {hasAvailableVoice && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Speak ${word.text}`}
                        onClick={() => speakWord(word)}
                      >
                        <Icon name="volume" size={18} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn ${
                        progress.pinned ? 'btn-primary' : 'btn-ghost'
                      }`}
                      aria-pressed={progress.pinned}
                      aria-label={
                        progress.pinned
                          ? `Unpin ${word.text}`
                          : `Pin ${word.text} to mistakes bank`
                      }
                      onClick={() => handleTogglePinWord(word, progress.pinned)}
                    >
                      <Icon name="pin" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Per-Category Accuracy Section */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div>
            <span className="eyebrow">Topic Performance</span>
            <h2 className="font-display" style={{ fontSize: 'var(--text-lg)' }}>
              Accuracy by Category
            </h2>
          </div>

          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => setShowAllCategories((v) => !v)}
          >
            <span>
              {showAllCategories
                ? 'Show practiced categories only'
                : `Show all ${CATALOG.categories.length} categories`}
            </span>
          </button>
        </div>

        {categoryRows.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Complete a practice card in any category to see per-topic accuracy bars
            sorted from lowest accuracy to strongest.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {categoryRows.map((row) => (
              <div
                key={row.category.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    flex: '1 1 240px',
                    minWidth: 0,
                  }}
                >
                  <div
                    className="category-monogram"
                    data-tint={row.category.tintIndex}
                    aria-hidden="true"
                  >
                    {row.category.mark}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 'var(--text-sm)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.category.name}
                      </strong>
                      <span
                        className="tabular"
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                          color:
                            row.accuracyPct === null
                              ? 'var(--text-muted)'
                              : row.accuracyPct >= 80
                                ? 'var(--correct)'
                                : 'var(--wrong)',
                        }}
                      >
                        {row.accuracyPct === null
                          ? 'Unseen'
                          : `${row.accuracyPct}% accuracy`}
                      </span>
                    </div>

                    <div className="progress-track" style={{ marginTop: '6px' }}>
                      <div
                        className="progress-fill"
                        style={
                          {
                            '--progress-ratio': (row.accuracyPct ?? 0) / 100,
                            background:
                              row.accuracyPct !== null && row.accuracyPct < 75
                                ? 'var(--wrong)'
                                : 'var(--accent)',
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={() =>
                    onNavigate(`#/practice?category=${row.category.id}`)
                  }
                >
                  <span>Drill</span>
                  <Icon name="arrow-right" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
