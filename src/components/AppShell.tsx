import type { MouseEvent, ReactNode } from 'react';
import type { NavSection, ResolvedTheme, ThemePreference } from '../types/word';
import { Icon, type IconName } from './Icon';

interface AppShellProps {
  activeSection: NavSection;
  transitionKey: string;
  onNavigate: (hash: string) => void;
  themePref: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onChangeTheme: (pref: ThemePreference) => void;
  mistakesCount: number;
  masteredCount: number;
  totalUniqueWords: number;
  liveAnnouncement: string;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  section: NavSection;
  label: string;
  hash: string;
  icon: IconName;
}> = [
  { section: 'home', label: 'Home', hash: '#/', icon: 'home' },
  { section: 'practice', label: 'Practice', hash: '#/practice', icon: 'headphones' },
  { section: 'mistakes', label: 'Mistakes', hash: '#/mistakes', icon: 'mistakes' },
  { section: 'stats', label: 'Stats', hash: '#/stats', icon: 'chart' },
  { section: 'settings', label: 'Settings', hash: '#/settings', icon: 'settings' },
];

export function AppShell({
  activeSection,
  transitionKey,
  onNavigate,
  themePref,
  resolvedTheme,
  onChangeTheme,
  mistakesCount,
  masteredCount,
  totalUniqueWords,
  liveAnnouncement,
  children,
}: AppShellProps) {
  const handleLinkClick = (hash: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(hash);
  };

  const toggleQuickTheme = () => {
    onChangeTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Accessible live region for feedback & progress updates */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      <div className="app-shell">
        {/* Compact (<600px Portrait) Top Header */}
        <header className="mobile-topbar">
          <a
            href="#/"
            className="brand-lockup"
            onClick={handleLinkClick('#/')}
          >
            <span className="brand-mark" aria-hidden="true">
              Lf
            </span>
            <span className="brand-title">Lexicon Folio</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="pill tabular" aria-label={`${masteredCount} of ${totalUniqueWords} words mastered`}>
              <span>{masteredCount}</span>
              <span style={{ color: 'var(--text-muted)' }}>/ {totalUniqueWords}</span>
            </span>

            <button
              type="button"
              className="btn btn-icon btn-subtle"
              onClick={toggleQuickTheme}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </header>

        {/* Medium Rail (600–1024px & Short Landscape) + Expanded/Large Persistent Sidebar (>1024px) */}
        <aside className="side-nav" aria-label="Primary navigation">
          <div className="side-nav-top">
            <a
              href="#/"
              className="side-brand"
              onClick={handleLinkClick('#/')}
            >
              <span className="brand-mark" aria-hidden="true">
                Lf
              </span>
              <span className="side-brand-text">
                <span className="brand-title">Lexicon Folio</span>
                <span className="brand-subtitle">
                  IELTS Listening · {totalUniqueWords} words
                </span>
              </span>
            </a>

            <nav aria-label="Sections">
              <ul className="side-nav-list">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.section;
                  return (
                    <li key={item.section}>
                      <a
                        href={item.hash}
                        className="side-nav-link"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={handleLinkClick(item.hash)}
                      >
                        <span style={{ position: 'relative', display: 'inline-flex' }}>
                          <Icon name={item.icon} size={20} />
                          {item.section === 'mistakes' && mistakesCount > 0 && (
                            <span className="nav-badge side-rail-badge">
                              {mistakesCount > 99 ? '99+' : mistakesCount}
                            </span>
                          )}
                        </span>
                        <span className="side-nav-link-label">{item.label}</span>
                        {item.section === 'home' && (
                          <span className="side-nav-count side-nav-meta">37</span>
                        )}
                        {item.section === 'mistakes' && (
                          <span
                            className={`side-nav-count side-nav-meta ${
                              mistakesCount > 0 ? 'is-alert' : ''
                            }`}
                          >
                            {mistakesCount}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="side-nav-footer">
            {/* Desktop keyboard hints */}
            <div className="side-shortcuts" aria-label="Keyboard shortcuts">
              <div
                style={{
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="keyboard" size={15} />
                <span>Quick keys</span>
              </div>
              <div className="shortcut-row">
                <span>Replay / Slow</span>
                <span>
                  <kbd>R</kbd> <kbd>S</kbd>
                </span>
              </div>
              <div className="shortcut-row">
                <span>Hint / Submit</span>
                <span>
                  <kbd>H</kbd> <kbd>↵</kbd>
                </span>
              </div>
            </div>

            {/* Compact rail icon button on Medium / Landscape */}
            <button
              type="button"
              className="btn btn-icon btn-subtle rail-theme-cycle"
              onClick={toggleQuickTheme}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>

            {/* Full 3-way segmented theme control on Expanded / Large */}
            <div
              className="segmented theme-segment-labels"
              role="radiogroup"
              aria-label="Color theme"
            >
              {(
                [
                  { id: 'system', label: 'Auto', icon: 'monitor' },
                  { id: 'light', label: 'Paper', icon: 'sun' },
                  { id: 'dark', label: 'Ink', icon: 'moon' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={themePref === opt.id}
                  className="segmented-btn"
                  onClick={() => onChangeTheme(opt.id)}
                >
                  <Icon name={opt.icon} size={14} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <main id="main-content" className="main-region" tabIndex={-1}>
          <div key={transitionKey} className="main-inner route-stage">
            {children}
          </div>
        </main>

        {/* Compact (<600px Portrait) Bottom Tab Bar */}
        <nav className="bottom-tabbar" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.section;
            return (
              <a
                key={item.section}
                href={item.hash}
                className="tab-item"
                aria-current={isActive ? 'page' : undefined}
                onClick={handleLinkClick(item.hash)}
              >
                <span className="tab-icon-wrap">
                  <Icon name={item.icon} size={20} />
                  {item.section === 'mistakes' && mistakesCount > 0 && (
                    <span className="nav-badge">
                      {mistakesCount > 99 ? '99+' : mistakesCount}
                    </span>
                  )}
                </span>
                <span className="tab-label">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
