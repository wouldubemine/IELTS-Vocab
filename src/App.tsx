import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { HomeView } from './components/HomeView';
import { MistakesBankView } from './components/MistakesBankView';
import { PracticeWorkspace } from './components/PracticeWorkspace';
import { SettingsView } from './components/SettingsView';
import { StatsView } from './components/StatsView';
import { CATALOG } from './data/catalog';
import { useHashRoute } from './lib/router';
import { useViewportMetrics } from './lib/viewport';
import { AudioProvider } from './state/AudioContext';
import { TrainerProvider, useTrainer } from './state/TrainerContext';

function InnerApp() {
  useViewportMetrics();

  const {
    state,
    resolvedTheme,
    corruptedOnBoot,
    backupSavedOnBoot,
    masteredCount,
    mistakesBankEntries,
    updateSettings,
    dismissCorruptionAndReset,
  } = useTrainer();

  const { route, navigate, transitionKey } = useHashRoute();
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  return (
    <AppShell
      activeSection={route.section}
      transitionKey={transitionKey}
      onNavigate={navigate}
      themePref={state.settings.theme}
      resolvedTheme={resolvedTheme}
      onChangeTheme={(pref) => {
        updateSettings({ theme: pref });
        setLiveAnnouncement(`Theme switched to ${pref}`);
      }}
      mistakesCount={mistakesBankEntries.length}
      masteredCount={masteredCount}
      totalUniqueWords={CATALOG.uniqueWordCount}
      liveAnnouncement={liveAnnouncement}
    >
      {corruptedOnBoot && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--highlight-bg)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
            <strong>Saved data appeared damaged.</strong>{' '}
            {backupSavedOnBoot
              ? 'We preserved the raw data safely under local backup key "ielts-trainer:v1:backup" and started a clean session.'
              : 'Started a clean session safely.'}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={dismissCorruptionAndReset}
          >
            Dismiss &amp; continue
          </button>
        </div>
      )}

      {route.section === 'home' && (
        <HomeView onNavigate={navigate} onAnnounce={setLiveAnnouncement} />
      )}

      {route.section === 'practice' && (
        <PracticeWorkspace
          route={route}
          onNavigate={navigate}
          onAnnounce={setLiveAnnouncement}
        />
      )}

      {route.section === 'mistakes' && (
        <MistakesBankView
          onNavigate={navigate}
          onAnnounce={setLiveAnnouncement}
        />
      )}

      {route.section === 'stats' && (
        <StatsView onNavigate={navigate} onAnnounce={setLiveAnnouncement} />
      )}

      {route.section === 'settings' && (
        <SettingsView onAnnounce={setLiveAnnouncement} />
      )}
    </AppShell>
  );
}

export function App() {
  return (
    <TrainerProvider>
      <AudioProvider>
        <InnerApp />
      </AudioProvider>
    </TrainerProvider>
  );
}
