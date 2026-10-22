import { useMemo, useState } from 'react';
import { CATALOG, getCategoryById, WORDS } from '../data/catalog';
import { getWordStatus } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import { Icon } from './Icon';
import { CountUpNumber, ProgressRing } from './ProgressRing';

interface HomeViewProps {
  onNavigate: (hash: string) => void;
  onAnnounce: (msg: string) => void;
}

export function HomeView({ onNavigate, onAnnounce }: HomeViewProps) {
  const {
    state,
    masteredCount,
    learningCount,
    effectiveStreak,
    mistakesBankEntries,
    categoryStats,
    togglePin,
    clearActiveSession,
  } = useTrainer();
  const { hasAvailableVoice, speakWord } = useAudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  const mistakesCount = mistakesBankEntries.length;
  const resumableSession =
    state.activeSession && !state.activeSession.completed
      ? state.activeSession
      : null;

  const overallPct = Math.round(
    (masteredCount / Math.max(1, CATALOG.uniqueWordCount)) * 100
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return CATALOG.categories;
    return CATALOG.categories.filter((cat) => {
      if (cat.name.toLowerCase().includes(normalizedQuery)) return true;
      const list = CATALOG.wordsByCategory.get(cat.id) ?? [];
      return list.some(
        (w) =>
          w.text.toLowerCase().includes(normalizedQuery) ||
          w.alt?.some((a) => a.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [normalizedQuery]);

  // Direct word search hits across all unique words (Spec Section 4.1: "find a category or a word")
  const matchedWords = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    const seen = new Set<string>();
    const results = [];
    for (const w of WORDS) {
      if (seen.has(w.id)) continue;
      if (
        w.text.toLowerCase().includes(normalizedQuery) ||
        w.alt?.some((a) => a.toLowerCase().includes(normalizedQuery))
      ) {
        seen.add(w.id);
        results.push(w);
        if (results.length >= 12) break;
      }
    }
    return results;
  }, [normalizedQuery]);

  const resumeLabel = useMemo(() => {
    if (!resumableSession) return '';
    if (resumableSession.source === 'category' && resumableSession.categoryId) {
      const cat = getCategoryById(resumableSession.categoryId);
      return `${cat?.name ?? 'Category'} (${resumableSession.currentIndex + 1}/${resumableSession.queue.length})`;
    }
    if (resumableSession.source === 'mistakes') {
      return `Mistakes Bank (${resumableSession.currentIndex + 1}/${resumableSession.queue.length})`;
    }
    return `Mixed Test (${resumableSession.currentIndex + 1}/${resumableSession.queue.length})`;
  }, [resumableSession]);

  return (
    <section aria-labelledby="home-heading">
      {/* Editorial Notebook Banner + Primary Actions */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ProgressRing
            value={overallPct}
            size={64}
            strokeWidth={5}
            label={`Overall mastery ${overallPct}%`}
          />
          <div>
            <span className="eyebrow">IELTS Listening Spelling Folio</span>
            <h1 id="home-heading" className="page-title">
              <CountUpNumber value={masteredCount} /> of {CATALOG.uniqueWordCount}{' '}
              Mastered
            </h1>
            <p className="page-lead">
              37 exam categories · {learningCount} in progress ·{' '}
              {effectiveStreak > 0
                ? `${effectiveStreak}-day active streak`
                : 'Start today’s spelling session'}
            </p>
          </div>
        </div>

        {/* Spec Section 4.1 Primary Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {resumableSession && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onNavigate(
                  resumableSession.source === 'category' &&
                    resumableSession.categoryId
                    ? `#/category/${resumableSession.categoryId}`
                    : `#/practice/${resumableSession.source}`
                )
              }
            >
              <Icon name="play" size={17} />
              <span>Continue: {resumeLabel}</span>
            </button>
          )}

          <button
            type="button"
            className={`btn ${resumableSession ? '' : 'btn-primary'}`}
            onClick={() => onNavigate('#/practice/mixed')}
          >
            <Icon name="headphones" size={18} />
            <span>Mixed test</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={() =>
              onNavigate(mistakesCount > 0 ? '#/mistakes' : '#/mistakes')
            }
          >
            <Icon name="mistakes" size={18} />
            <span className="tabular">Mistakes bank ({mistakesCount})</span>
          </button>

          {resumableSession && (
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => {
                clearActiveSession();
                onAnnounce('Saved unfinished session cleared');
              }}
              aria-label="Discard unfinished session"
              title="Discard unfinished session"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search Box + Grid/List Layout Toggle */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '30rem' }}>
          <label htmlFor="category-search" className="sr-only">
            Find a category or a word
          </label>
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            <Icon name="search" size={18} />
          </span>
          <input
            id="category-search"
            type="search"
            className="input-field"
            style={{ paddingLeft: '2.45rem' }}
            placeholder="Find a category or a word (e.g. stationery, solar power)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div
          className="segmented"
          style={{ gridTemplateColumns: 'repeat(2, auto)', width: 'auto' }}
          role="radiogroup"
          aria-label="Category layout view"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewLayout === 'grid'}
            className="segmented-btn"
            onClick={() => setViewLayout('grid')}
          >
            <span>Cards</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewLayout === 'list'}
            className="segmented-btn"
            onClick={() => setViewLayout('list')}
          >
            <span>Compact list</span>
          </button>
        </div>
      </div>

      {/* Matching Individual Words Quick-Lookup Panel when Searching */}
      {matchedWords.length > 0 && (
        <div className="folio-card" style={{ marginBottom: 'var(--space-5)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <span className="eyebrow">
              Matching vocabulary words ({matchedWords.length}
              {matchedWords.length === 12 ? '+' : ''})
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))',
              gap: 'var(--space-2)',
            }}
          >
            {matchedWords.map((word) => {
              const cat = getCategoryById(word.category);
              const prog = state.words[word.id];
              const status = getWordStatus(prog);
              const isPinned = Boolean(prog?.pinned);

              return (
                <div
                  key={word.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <a
                      href={`#/category/${word.category}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`#/category/${word.category}`);
                      }}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        color: 'var(--text)',
                        textDecoration: 'none',
                        display: 'block',
                      }}
                    >
                      {word.text}
                    </a>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {cat?.name} ·{' '}
                      {status === 'mastered'
                        ? 'Mastered'
                        : status === 'learning'
                          ? `Box ${prog?.box ?? 1}`
                          : 'Unseen'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {hasAvailableVoice && (
                      <button
                        type="button"
                        className="btn btn-icon"
                        style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
                        aria-label={`Speak ${word.text}`}
                        onClick={() => speakWord(word)}
                      >
                        <Icon name="volume" size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn btn-icon ${isPinned ? 'btn-primary' : ''}`}
                      style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
                      aria-pressed={isPinned}
                      aria-label={
                        isPinned
                          ? `Unpin ${word.text} from mistakes bank`
                          : `Pin ${word.text} to mistakes bank`
                      }
                      title={isPinned ? 'Pinned in Mistakes Bank' : 'Pin to Mistakes Bank'}
                      onClick={() => {
                        togglePin(word.id);
                        onAnnounce(
                          isPinned
                            ? `Unpinned ${word.text}`
                            : `Pinned ${word.text} to Mistakes Bank`
                        );
                      }}
                    >
                      <Icon name="pin" size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All 37 Categories Grid or Compact List */}
      {filteredCategories.length === 0 ? (
        <div
          className="folio-card"
          style={{ textAlign: 'center', padding: 'var(--space-10)' }}
        >
          <h2 style={{ fontSize: 'var(--text-xl)' }}>
            No matching categories or words
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Nothing in the {CATALOG.uniqueWordCount}-word lexicon matched “
            {searchQuery}”.
          </p>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => setSearchQuery('')}
          >
            Clear search
          </button>
        </div>
      ) : viewLayout === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filteredCategories.map((cat) => {
            const stats = categoryStats.get(cat.id);
            const mastered = stats?.mastered ?? 0;
            const inBank = stats?.inBank ?? 0;
            const pct = Math.round((mastered / Math.max(1, cat.wordCount)) * 100);

            return (
              <a
                key={cat.id}
                href={`#/category/${cat.id}`}
                data-tint={cat.tintIndex}
                className="folio-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigate(`#/category/${cat.id}`);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                  <span className="category-monogram" aria-hidden="true">
                    {cat.mark}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                      {cat.name}
                    </h2>
                    <span className="tabular" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {mastered} of {cat.wordCount} mastered
                      {inBank > 0 ? ` · ${inBank} in bank` : ''}
                    </span>
                  </div>
                </div>

                <ProgressRing
                  value={pct}
                  size={40}
                  strokeWidth={3.5}
                  label={`${cat.name}: ${pct}% mastered`}
                />
              </a>
            );
          })}
        </div>
      ) : (
        <div className="category-grid">
          {filteredCategories.map((cat) => {
            const words = CATALOG.wordsByCategory.get(cat.id) ?? [];
            const stats = categoryStats.get(cat.id);
            const mastered = stats?.mastered ?? 0;
            const inBank = stats?.inBank ?? 0;
            const pct = Math.round((mastered / Math.max(1, cat.wordCount)) * 100);
            const preview = words
              .slice(0, 4)
              .map((w) => w.text)
              .join(' · ');
            const featured = cat.wordCount >= 40 && !normalizedQuery;

            return (
              <a
                key={cat.id}
                href={`#/category/${cat.id}`}
                data-tint={cat.tintIndex}
                className={`category-card ${featured ? 'is-featured' : ''}`}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigate(`#/category/${cat.id}`);
                  }
                }}
              >
                <div>
                  <div className="category-card-top">
                    <span className="category-monogram" aria-hidden="true">
                      {cat.mark}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {inBank > 0 && (
                        <span className="pill pill-wrong tabular">
                          {inBank} missed
                        </span>
                      )}
                      <ProgressRing
                        value={pct}
                        size={40}
                        strokeWidth={3.5}
                        label={`${cat.name}: ${pct}% mastered`}
                      />
                    </div>
                  </div>

                  <h2
                    className="category-name"
                    style={{ marginTop: 'var(--space-3)' }}
                  >
                    {cat.name}
                  </h2>
                  <p className="category-samples">{preview}</p>
                </div>

                <div>
                  {/* Subtle thin bottom progress bar paired with ring */}
                  <div
                    style={{
                      width: '100%',
                      height: '4px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-2)',
                      overflow: 'hidden',
                      marginBottom: 'var(--space-3)',
                    }}
                    aria-hidden="true"
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: pct === 100 ? 'var(--correct)' : 'var(--accent)',
                        transition:
                          'width var(--dur-slow) var(--ease-spring, var(--ease-ios))',
                      }}
                    />
                  </div>

                  <div className="category-card-foot tabular" style={{ borderTop: 0, paddingTop: 0 }}>
                    <span>
                      §{String(cat.order + 1).padStart(2, '0')} · {cat.wordCount} words
                    </span>
                    <span
                      style={{
                        color: pct === 100 ? 'var(--correct)' : 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {mastered} / {cat.wordCount} mastered
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
