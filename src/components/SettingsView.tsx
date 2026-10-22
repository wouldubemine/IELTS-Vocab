import { useRef, useState, type ChangeEvent } from 'react';
import {
  toLocalDateKey,
  type ImportPreviewSummary,
  type SessionLengthOption,
} from '../lib/storage';
import { useTrainer } from '../state/TrainerContext';
import type { PracticeMode, ThemePreference } from '../types/word';
import { Icon } from './Icon';
import { SheetModal } from './SheetModal';
import { VoiceSettingsCard } from './VoiceSettingsCard';

interface SettingsViewProps {
  onAnnounce: (msg: string) => void;
}

export function SettingsView({ onAnnounce }: SettingsViewProps) {
  const {
    state,
    storageAvailable,
    updateSettings,
    exportProgressJson,
    previewImportJson,
    confirmImportState,
    resetAllProgress,
  } = useTrainer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] =
    useState<ImportPreviewSummary | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Two-step Reset All confirmation state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmedCheck, setResetConfirmedCheck] = useState(false);

  const settings = state.settings;

  const handleExportDownload = () => {
    const json = exportProgressJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ielts-vocab-progress-${toLocalDateKey(Date.now())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const msg = 'Exported progress backup JSON file.';
    setStatusBanner(msg);
    onAnnounce(msg);
  };

  const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setStatusBanner(null);

    try {
      const text = await file.text();
      const validation = previewImportJson(text);
      if (!validation.valid) {
        setImportError(validation.error);
        onAnnounce(`Import error: ${validation.error}`);
        return;
      }
      setPendingImport(validation);
    } catch {
      setImportError('Could not read the selected file.');
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    confirmImportState(pendingImport.state);
    const count = pendingImport.trackedWordsCount;
    setPendingImport(null);
    const msg = `Restored ${count} tracked words cleanly.`;
    setStatusBanner(msg);
    onAnnounce(msg);
  };

  const confirmFullReset = () => {
    if (!resetConfirmedCheck) return;
    resetAllProgress();
    setResetConfirmedCheck(false);
    setResetModalOpen(false);
    const msg = 'All progress has been reset to a fresh start.';
    setStatusBanner(msg);
    onAnnounce(msg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Page Header */}
      <section className="card">
        <span className="eyebrow">Preferences &amp; Data</span>
        <h1
          className="font-display"
          style={{
            fontSize: 'var(--text-2xl)',
            lineHeight: 'var(--leading-tight)',
            marginTop: '2px',
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            marginTop: '4px',
          }}
        >
          All progress saves automatically on this device (`schemaVersion: 1`)
          {!storageAvailable
            ? ' — running in session-memory fallback because browser storage is blocked.'
            : '.'}
        </p>

        {statusBanner && (
          <div
            role="status"
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--correct-bg)',
              border: '1px solid var(--correct-border)',
              color: 'var(--correct)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            {statusBanner}
          </div>
        )}
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Appearance + Study Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <section className="card">
            <span className="eyebrow">Display &amp; Comfort</span>
            <h2
              className="font-display"
              style={{
                fontSize: 'var(--text-xl)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Appearance &amp; Accessibility
            </h2>

            {/* Theme */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}
              >
                Color theme
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {(
                  [
                    { id: 'system', label: 'Auto (System)', icon: 'monitor' },
                    { id: 'light', label: 'Paper (Light)', icon: 'sun' },
                    { id: 'dark', label: 'Ink (Dark)', icon: 'moon' },
                  ] as Array<{
                    id: ThemePreference;
                    label: string;
                    icon: 'monitor' | 'sun' | 'moon';
                  }>
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`btn ${
                      settings.theme === mode.id ? 'btn-primary' : 'btn-subtle'
                    }`}
                    onClick={() => updateSettings({ theme: mode.id })}
                  >
                    <Icon name={mode.icon} size={16} />
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Scale */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}
              >
                Text size scale
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {[
                  { scale: 1, label: 'Standard (100%)' },
                  { scale: 1.12, label: 'Large (112%)' },
                  { scale: 1.25, label: 'Extra Large (125%)' },
                ].map((opt) => (
                  <button
                    key={opt.scale}
                    type="button"
                    className={`btn ${
                      Math.abs(settings.textScale - opt.scale) < 0.03
                        ? 'btn-primary'
                        : 'btn-subtle'
                    }`}
                    onClick={() => updateSettings({ textScale: opt.scale })}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reduced Motion */}
            <div>
              <button
                type="button"
                className="btn btn-subtle"
                aria-pressed={settings.reduceMotion}
                onClick={() =>
                  updateSettings({ reduceMotion: !settings.reduceMotion })
                }
              >
                <span>
                  Reduce motion &amp; transitions:{' '}
                  <strong>{settings.reduceMotion ? 'On' : 'Off'}</strong>
                </span>
              </button>
            </div>
          </section>

          {/* Study Rules Card */}
          <section className="card">
            <span className="eyebrow">Training Behavior</span>
            <h2
              className="font-display"
              style={{
                fontSize: 'var(--text-xl)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Study &amp; Mistakes Bank Rules
            </h2>

            {/* Default Mode */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}
              >
                Default practice mode
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(
                  [
                    { id: 'listen', label: 'Listen & Spell' },
                    { id: 'flashcards', label: 'Flashcards' },
                    { id: 'choice', label: 'Spelling choice' },
                    { id: 'read', label: 'Read & type' },
                  ] as Array<{ id: PracticeMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`btn ${
                      settings.defaultMode === m.id ? 'btn-primary' : 'btn-subtle'
                    }`}
                    onClick={() => updateSettings({ defaultMode: m.id })}
                  >
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Session Length */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}
              >
                Default session length
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(
                  [
                    { id: 10, label: '10 words' },
                    { id: 20, label: '20 words' },
                    { id: 50, label: '50 words' },
                    { id: 'all', label: 'All words' },
                  ] as Array<{ id: SessionLengthOption; label: string }>
                ).map((len) => (
                  <button
                    key={String(len.id)}
                    type="button"
                    className={`btn tabular ${
                      settings.defaultSessionLength === len.id
                        ? 'btn-primary'
                        : 'btn-subtle'
                    }`}
                    onClick={() =>
                      updateSettings({ defaultSessionLength: len.id })
                    }
                  >
                    <span>{len.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bank Clear Threshold (Spec Section 4.1 & 4.3: 2 to 5 consecutive right answers) */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                Consecutive correct answers needed to clear a mistake
              </label>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Pinned words stay in the Mistakes Bank regardless of streak until
                unpinned.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {[2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`btn tabular ${
                      settings.bankClearThreshold === num
                        ? 'btn-primary'
                        : 'btn-subtle'
                    }`}
                    onClick={() => updateSettings({ bankClearThreshold: num })}
                  >
                    <span>{num} in a row</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-play & Hint button toggles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-subtle"
                aria-pressed={settings.autoPlayAudio}
                onClick={() =>
                  updateSettings({ autoPlayAudio: !settings.autoPlayAudio })
                }
              >
                <Icon name="volume" size={16} />
                <span>
                  Auto-play audio:{' '}
                  <strong>{settings.autoPlayAudio ? 'On' : 'Off'}</strong>
                </span>
              </button>

              <button
                type="button"
                className="btn btn-subtle"
                aria-pressed={settings.showHintButton}
                onClick={() =>
                  updateSettings({ showHintButton: !settings.showHintButton })
                }
              >
                <Icon name="hint" size={16} />
                <span>
                  Hint button:{' '}
                  <strong>{settings.showHintButton ? 'Shown' : 'Hidden'}</strong>
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Voices + Backup/Restore/Reset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <VoiceSettingsCard />

          <section className="card">
            <span className="eyebrow">Backup &amp; Portability</span>
            <h2
              className="font-display"
              style={{
                fontSize: 'var(--text-xl)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Export, Import &amp; Reset
            </h2>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Move your entire progress history between browsers or devices with a
              single portable JSON snapshot.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExportDownload}
              >
                <Icon name="download" size={18} />
                <span>Export JSON backup</span>
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={18} />
                <span>Import JSON backup…</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChosen}
                style={{ display: 'none' }}
              />
            </div>

            {importError && (
              <div
                role="alert"
                style={{
                  marginTop: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--wrong-bg)',
                  border: '1px solid var(--wrong-border)',
                  color: 'var(--wrong)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <strong>Invalid backup file:</strong> {importError}
              </div>
            )}

            <hr
              style={{
                border: 0,
                borderTop: '1px solid var(--border)',
                margin: 'var(--space-5) 0',
              }}
            />

            <div>
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                Danger zone
              </h3>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Erase all box levels, streaks, session logs, and mistakes bank
                records on this device.
              </p>

              <button
                type="button"
                className="btn"
                style={{
                  borderColor: 'var(--wrong-border)',
                  color: 'var(--wrong)',
                }}
                onClick={() => {
                  setResetConfirmedCheck(false);
                  setResetModalOpen(true);
                }}
              >
                <Icon name="trash" size={16} />
                <span>Reset all progress…</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Validated Import Preview Confirmation SheetModal */}
      <SheetModal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Confirm Progress Import"
      >
        {pendingImport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Backup validated cleanly (`schemaVersion: {pendingImport.schemaVersion}
              `). Importing will replace your current device progress with the
              snapshot below:
            </p>

            {pendingImport.warnings.length > 0 && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--highlight-bg)',
                  color: 'var(--highlight-ink)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {pendingImport.warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div className="eyebrow">Words tracked</div>
                <strong
                  className="font-display tabular"
                  style={{ fontSize: 'var(--text-xl)' }}
                >
                  {pendingImport.trackedWordsCount}
                </strong>
              </div>
              <div>
                <div className="eyebrow">Mastered</div>
                <strong
                  className="font-display tabular"
                  style={{ fontSize: 'var(--text-xl)' }}
                >
                  {pendingImport.masteredCount}
                </strong>
              </div>
              <div>
                <div className="eyebrow">Mistakes Bank</div>
                <strong
                  className="font-display tabular"
                  style={{ fontSize: 'var(--text-xl)' }}
                >
                  {pendingImport.mistakesBankCount}
                </strong>
              </div>
              <div>
                <div className="eyebrow">Daily Streak</div>
                <strong
                  className="font-display tabular"
                  style={{ fontSize: 'var(--text-xl)' }}
                >
                  {pendingImport.currentStreak} days
                </strong>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setPendingImport(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmImport}
              >
                <Icon name="check" size={18} />
                <span>Restore backup now</span>
              </button>
            </div>
          </div>
        )}
      </SheetModal>

      {/* Two-Step Reset All Confirmation SheetModal */}
      <SheetModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset All Progress?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            This permanently clears all learned boxes, streaks, session logs, and
            Mistakes Bank entries from this browser. Consider exporting a JSON
            backup first.
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--wrong-bg)',
              border: '1px solid var(--wrong-border)',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            <input
              type="checkbox"
              checked={resetConfirmedCheck}
              onChange={(e) => setResetConfirmedCheck(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--wrong)' }}
            />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Yes, I want to permanently erase all progress on this device
            </span>
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => setResetModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={!resetConfirmedCheck}
              style={{
                background: resetConfirmedCheck ? 'var(--wrong)' : 'var(--surface-2)',
                borderColor: resetConfirmedCheck ? 'var(--wrong)' : 'var(--border)',
                color: resetConfirmedCheck ? '#FFFFFF' : 'var(--text-muted)',
              }}
              onClick={confirmFullReset}
            >
              <Icon name="trash" size={16} />
              <span>Erase all data</span>
            </button>
          </div>
        </div>
      </SheetModal>
    </div>
  );
}
