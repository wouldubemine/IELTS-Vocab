import { computeSlowRate } from '../lib/audio';
import type { VoiceAccent } from '../lib/storage';
import { useAudio } from '../state/AudioContext';
import { useTrainer } from '../state/TrainerContext';
import { Icon } from './Icon';

const ACCENT_OPTIONS: Array<{ id: VoiceAccent; label: string; region: string }> = [
  { id: 'en-GB', label: 'British', region: 'UK · Default' },
  { id: 'en-AU', label: 'Australian', region: 'AU' },
  { id: 'en-US', label: 'American', region: 'US' },
];

export function VoiceSettingsCard() {
  const { state, updateSettings } = useTrainer();
  const {
    voicesLoaded,
    hasAvailableVoice,
    rankedVoices,
    activeVoice,
    speakingMode,
    speakSample,
    stopSpeaking,
  } = useAudio();

  const { accent, voiceURI, speechRate, autoPlayAudio } = state.settings;
  const slowRate = computeSlowRate(speechRate);

  return (
    <div className="folio-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Voice & Pronunciation</h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              marginTop: '4px',
            }}
          >
            Quality-ranked speech synthesis with automatic fallback to pre-recorded{' '}
            <code>/audio/&lt;word-id&gt;.mp3</code> clips when present.
          </p>
        </div>

        <span
          className={`pill ${
            hasAvailableVoice
              ? 'pill-correct'
              : voicesLoaded
                ? 'pill-wrong'
                : ''
          }`}
        >
          <Icon name="volume" size={14} />
          <span>
            {speakingMode === 'slow'
              ? 'Speaking (slow)…'
              : speakingMode === 'normal'
                ? 'Speaking…'
                : hasAvailableVoice
                  ? 'Voice ready'
                  : voicesLoaded
                    ? 'No voice found'
                    : 'Loading voices…'}
          </span>
        </span>
      </div>

      {/* No-Voice Fallback Alert (Spec Section 9) */}
      {voicesLoaded && !hasAvailableVoice && (
        <div
          role="status"
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--wrong-bg)',
            border: '1px solid var(--wrong-border)',
            color: 'var(--wrong)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong>No English speech voice detected on this browser/device.</strong>{' '}
          Listen &amp; Spell automatically switches to <strong>Read &amp; Type</strong>{' '}
          memory mode so you can still practice seamlessly without audio.
        </div>
      )}

      {/* Accent Selector */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
          }}
        >
          Preferred IELTS accent
        </span>
        <div
          className="segmented"
          role="radiogroup"
          aria-label="Preferred English accent"
        >
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={accent === opt.id}
              className="segmented-btn"
              onClick={() => updateSettings({ accent: opt.id, voiceURI: null })}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quality-Ranked Voice Picker */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <label
          htmlFor="voice-picker-select"
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
          }}
        >
          Voice model ({rankedVoices.length} English{' '}
          {rankedVoices.length === 1 ? 'voice' : 'voices'})
        </label>
        <select
          id="voice-picker-select"
          className="input-field"
          value={voiceURI ?? ''}
          disabled={!hasAvailableVoice}
          onChange={(e) =>
            updateSettings({
              voiceURI: e.target.value ? e.target.value : null,
            })
          }
        >
          <option value="">
            Auto — Best ranked
            {activeVoice ? ` (${activeVoice.name})` : ''}
          </option>
          {rankedVoices.map(({ voice, qualityLabel }) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang}) · {qualityLabel}
              {voice.localService ? ' · Local' : ' · Cloud'}
            </option>
          ))}
        </select>
      </div>

      {/* Playback Speed Slider (0.6x - 1.2x, default 0.9x) */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <label
          htmlFor="speech-rate-range"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
          }}
        >
          <span>Normal speech speed</span>
          <span className="tabular">
            {speechRate.toFixed(2).replace(/0$/, '')}× (slow: {slowRate}×)
          </span>
        </label>
        <input
          id="speech-rate-range"
          type="range"
          min={0.6}
          max={1.2}
          step={0.05}
          value={speechRate}
          onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
          style={{
            width: '100%',
            accentColor: 'var(--accent)',
            minHeight: '32px',
          }}
        />
      </div>

      {/* Preview Controls + Autoplay Toggle */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-4)',
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          disabled={!hasAvailableVoice}
          onClick={() => speakSample()}
        >
          <Icon name="volume" size={17} />
          <span>Test voice</span>
        </button>

        <button
          type="button"
          className="btn"
          disabled={!hasAvailableVoice}
          onClick={() => speakSample(undefined, true)}
        >
          <Icon name="slow" size={17} />
          <span>Slow replay</span>
        </button>

        {speakingMode !== null && (
          <button
            type="button"
            className="btn btn-subtle"
            onClick={stopSpeaking}
          >
            <Icon name="close" size={16} />
            <span>Stop</span>
          </button>
        )}

        <button
          type="button"
          className={`btn ${autoPlayAudio ? '' : 'btn-subtle'}`}
          aria-pressed={autoPlayAudio}
          onClick={() => updateSettings({ autoPlayAudio: !autoPlayAudio })}
        >
          <span>Auto-play: {autoPlayAudio ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Required iPhone / iOS Enhanced Voice Tip (Spec Section 9) */}
      <p
        style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--text)' }}>Tip for iPhone &amp; iPad:</strong>{' '}
        install an <em>Enhanced</em> or <em>Premium</em> voice in{' '}
        <strong>Settings → Accessibility → Spoken Content → Voices → English</strong>{' '}
        for crisp, studio-grade IELTS dictation audio.
      </p>
    </div>
  );
}
