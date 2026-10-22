import { useMemo, useState } from 'react';
import { getCategoryById, WORDS } from '../data/catalog';
import { getRemainingBankClears } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import { Icon } from './Icon';

interface MistakesBankViewProps {
  onNavigate: (hash: string) => void;
  onAnnounce: (msg: string) => void;
}

type SortBy = 'recent' | 'misses' | 'remaining';

function formatRelativeMissDate(epochMs: number | null): string {
  if (!epochMs) return 'Pinned manually';
  const diffSec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function MistakesBankView({
  onNavigate,
  onAnnounce,
}: MistakesBankViewProps) {
  const {
    state,
    mistakesBankEntries,
    togglePin,
    removeFromBank,
    startSession,
  } = useTrainer();
  const { hasAvailableVoice, speakWord } = useAudio();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  const threshold = state.settings.bankClearThreshold;

  // Compute all categories that have >= 1 word currently in the Mistakes Bank
  // (Remember: cross-category shared words appear in multiple categories!)
  const categoriesWithMistakes = useMemo(() => {
    const bankIds = new Set(mistakesBankEntries.map((e) => e.word.id));
    const counts = new Map<string, number>();
    for (const w of WORDS) {
      if (bankIds.has(w.id)) {
        counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([catId, count]) => ({
        id: catId,
        name: getCategoryById(catId)?.name ?? catId,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [mistakesBankEntries]);

  const effectiveSelectedCategory =
    selectedCategory === 'all' ||
    categoriesWithMistakes.some((c) => c.id === selectedCategory)
      ? selectedCategory
      : 'all';

  const filteredEntries = useMemo(() => {
    let base = mistakesBankEntries;
    if (effectiveSelectedCategory !== 'all') {
      const catWordIds = new Set(
        WORDS.filter((w) => w.category === effectiveSelectedCategory).map(
          (w) => w.id
        )
      );
      base = base.filter((e) => catWordIds.has(e.word.id));
    }

    return [...base].sort((a, b) => {
      if (a.progress.pinned !== b.progress.pinned) {
        return a.progress.pinned ? -1 : 1;
      }
      if (sortBy === 'misses') {
        return b.progress.wrong - a.progress.wrong;
      }
      if (sortBy === 'remaining') {
        return (
          getRemainingBankClears(a.progress, threshold) -
          getRemainingBankClears(b.progress, threshold)
        );
      }
      return (b.progress.lastMissAt ?? 0) - (a.progress.lastMissAt ?? 0);
    });
  }, [effectiveSelectedCategory, mistakesBankEntries, sortBy, threshold]);

  const handleDrillBank = () => {
    if (effectiveSelectedCategory === 'all') {
      startSession({
        source: 'mistakes',
        mode: state.settings.defaultMode,
        lengthOption: 'all',
      });
      onNavigate('#/practice/mistakes');
    } else {
      startSession({
        source: 'mistakes',
        categoryId: effectiveSelectedCategory,
        mode: state.settings.defaultMode,
        lengthOption: 'all',
      });
      onNavigate(
        `#/practice/mistakes?category=${encodeURIComponent(effectiveSelectedCategory)}`
      );
    }
  };

  // Designed, Celebratory Empty Bank State (Spec Section 4.4 & 6.4)
  if (mistakesBankEntries.length === 0) {
    const lifetimeCleared = Object.values(state.words).filter(
      (r) => r.wrong > 0 && !r.inBank
    ).length;

    return (
      <section aria-labelledby="mistakes-empty-heading">
        <div className="page-header">
          <div>
            <span className="eyebrow">Targeted Re-drill</span>
            <h1 id="mistakes-empty-heading" className="page-title">
              Mistakes Bank
            </h1>
            <p className="page-lead">
              Every missed word stays here until you spell it accurately{' '}
              {threshold} times in a row.
            </p>
          </div>
        </div>

        <div
          className="folio-card"
          style={{
            maxWidth: '42rem',
            padding: 'var(--space-8) var(--space-6)',
            textAlign: 'center',
            margin: '0 auto',
          }}
        >
          {/* Custom Editorial Ink Stamp Emblem (Stroke SVG, Zero Emoji) */}
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto var(--space-4)',
              borderRadius: '50%',
              background: 'var(--correct-bg)',
              border: '1.5px solid var(--correct-border)',
              color: 'var(--correct)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-hidden="true"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="18" r="14" strokeDasharray="3 3" />
              <path d="m11.5 18.5 4.3 4.3 8.7-9.2" />
            </svg>
          </div>

          <h2 style={{ fontSize: 'var(--text-2xl)' }}>
            Not a single misspelling left standing
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              marginTop: 'var(--space-2)',
              maxWidth: '46ch',
              marginInline: 'auto',
            }}
          >
            {lifetimeCleared > 0
              ? `Bravo — you have already cleared ${lifetimeCleared} tricky word${lifetimeCleared === 1 ? '' : 's'} out of your mistakes bank.`
              : 'Your slate is completely spotless. Pick any IELTS category or launch a mixed spelling test — any word you miss will land right here for targeted re-drilling.'}
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-6)',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('#/')}
            >
              <span>Explore all 37 categories</span>
              <Icon name="arrow-right" size={18} />
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('#/practice/mixed')}
            >
              <Icon name="headphones" size={18} />
              <span>Start a Mixed Test</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="mistakes-heading">
      <div className="page-header">
        <div>
          <span className="eyebrow">Targeted Re-drill</span>
          <h1 id="mistakes-heading" className="page-title">
            Mistakes Bank ({mistakesBankEntries.length})
          </h1>
          <p className="page-lead">
            Words leave automatically after{' '}
            <strong>{threshold} consecutive right answers</strong> unless pinned.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDrillBank}
        >
          <Icon name="headphones" size={18} />
          <span>
            {effectiveSelectedCategory === 'all'
              ? `Practice all ${mistakesBankEntries.length} mistakes`
              : `Practice ${filteredEntries.length} in category`}
          </span>
        </button>
      </div>

      {/* Category Filter Chips + Sort Control */}
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
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
          role="group"
          aria-label="Filter mistakes by category"
        >
          <button
            type="button"
            className={`btn ${effectiveSelectedCategory === 'all' ? 'btn-primary' : 'btn-subtle'}`}
            style={{ minHeight: '38px', padding: '0.4rem 0.85rem' }}
            onClick={() => setSelectedCategory('all')}
          >
            All ({mistakesBankEntries.length})
          </button>

          {categoriesWithMistakes.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`btn ${effectiveSelectedCategory === cat.id ? 'btn-primary' : 'btn-subtle'}`}
              style={{ minHeight: '38px', padding: '0.4rem 0.85rem' }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label
            htmlFor="bank-sort-select"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}
          >
            Sort:
          </label>
          <select
            id="bank-sort-select"
            className="input-field"
            style={{ width: 'auto', minHeight: '40px', padding: '0.4rem 0.75rem', fontSize: 'var(--text-xs)' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="recent">Last missed</option>
            <option value="misses">Most misses</option>
            <option value="remaining">Closest to clearing</option>
          </select>
        </div>
      </div>

      {/* Bank Words List View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filteredEntries.map(({ word, progress }) => {
          const cat = getCategoryById(word.category);
          const remaining = getRemainingBankClears(progress, threshold);

          return (
            <div
              key={word.id}
              className="folio-card"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                padding: 'var(--space-4) var(--space-5)',
              }}
            >
              <div style={{ minWidth: '200px', flex: '1 1 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span
                    className="font-display"
                    style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}
                  >
                    {word.text}
                  </span>

                  {progress.pinned ? (
                    <span className="pill pill-highlight">
                      <Icon name="pin" size={12} /> Pinned in bank
                    </span>
                  ) : (
                    <span className="pill pill-wrong tabular">
                      {remaining} more to clear
                    </span>
                  )}
                </div>

                <div
                  className="tabular"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                  }}
                >
                  <span>Category: {cat?.name ?? word.category}</span>
                  <span>
                    Missed: <strong>{progress.wrong}×</strong>
                  </span>
                  <span>Last missed: {formatRelativeMissDate(progress.lastMissAt)}</span>
                </div>
              </div>

              {/* Action Controls: Speak, Pin/Unpin, Remove */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {hasAvailableVoice && (
                  <button
                    type="button"
                    className="btn btn-icon"
                    aria-label={`Speak ${word.text}`}
                    title="Hear pronunciation"
                    onClick={() => speakWord(word)}
                  >
                    <Icon name="volume" size={17} />
                  </button>
                )}

                <button
                  type="button"
                  className={`btn btn-icon ${progress.pinned ? 'btn-primary' : ''}`}
                  aria-pressed={progress.pinned}
                  aria-label={
                    progress.pinned
                      ? `Unpin ${word.text}`
                      : `Pin ${word.text} in bank`
                  }
                  title={
                    progress.pinned
                      ? 'Unpin word'
                      : 'Pin so it stays in bank even after clearing'
                  }
                  onClick={() => {
                    togglePin(word.id);
                    onAnnounce(
                      progress.pinned
                        ? `Unpinned ${word.text}`
                        : `Pinned ${word.text} in Mistakes Bank`
                    );
                  }}
                >
                  <Icon name="pin" size={17} />
                </button>

                <button
                  type="button"
                  className="btn btn-icon btn-subtle"
                  aria-label={`Remove ${word.text} from mistakes bank`}
                  title="Remove from Mistakes Bank"
                  onClick={() => {
                    removeFromBank(word.id);
                    onAnnounce(`Removed ${word.text} from Mistakes Bank`);
                  }}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
