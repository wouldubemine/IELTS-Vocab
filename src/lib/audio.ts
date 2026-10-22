import type { VoiceAccent } from './storage';
import type { Word } from '../types/word';

export interface RankedVoice {
  voice: SpeechSynthesisVoice;
  score: number;
  qualityLabel: 'Natural' | 'Enhanced' | 'Standard';
  isExactAccent: boolean;
}

const HIGHEST_QUALITY_KEYWORDS = [
  'natural',
  'neural',
  'wavenet',
  'studio',
  'siri',
];

const ENHANCED_QUALITY_KEYWORDS = ['premium', 'enhanced', 'hq'];

const KNOWN_GOOD_VOICE_NAMES = [
  'libby',
  'sonia',
  'ryan',
  'daniel',
  'serena',
  'martha',
  'kate',
  'oliver',
  'stephanie',
  'karen',
  'catherine',
  'lee',
  'natasha',
  'william',
  'samantha',
  'ava',
  'allison',
  'jenny',
  'aria',
  'guy',
  'google uk english',
  'google us english',
];

const NOVELTY_PENALTY_KEYWORDS = [
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'trinoids',
  'whisper',
  'zarvox',
  'espeak',
];

export function normalizeLangTag(lang: string | undefined): string {
  return (lang ?? '').trim().replace(/_/g, '-').toLowerCase();
}

export function isEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  const tag = normalizeLangTag(voice.lang);
  return tag === 'en' || tag.startsWith('en-');
}

/**
 * Ranks available SpeechSynthesis voices by:
 * 1. Exact accent match (`en-GB`, `en-AU`, `en-US`), then any English dialect
 * 2. Quality tier ("Natural"/"Neural" > "Premium"/"Enhanced" > known clean voices > novelty/robotic)
 * 3. Local service vs remote latency tie-breaker
 */
export function scoreVoiceForAccent(
  voice: SpeechSynthesisVoice,
  targetAccent: VoiceAccent
): RankedVoice {
  const lang = normalizeLangTag(voice.lang);
  const target = targetAccent.toLowerCase();
  const nameLower = (voice.name ?? '').toLowerCase();

  let score = 0;
  let isExactAccent = false;

  // 1. Language & Accent score
  if (lang === target || lang.startsWith(`${target}-`)) {
    score += 1000;
    isExactAccent = true;
  } else if (lang === 'en' || lang.startsWith('en-')) {
    // Prefer Commonwealth similarity when UK/AU chosen
    if (
      (target === 'en-gb' && lang.startsWith('en-au')) ||
      (target === 'en-au' && lang.startsWith('en-gb'))
    ) {
      score += 650;
    } else {
      score += 500;
    }
  } else {
    score -= 2000;
  }

  // Name hint bonus when OS marks accent inside voice name (e.g. "Google UK English Female")
  if (
    target === 'en-gb' &&
    (nameLower.includes('uk') ||
      nameLower.includes('british') ||
      nameLower.includes('united kingdom'))
  ) {
    score += 120;
    isExactAccent = true;
  } else if (target === 'en-au' && nameLower.includes('australia')) {
    score += 120;
    isExactAccent = true;
  } else if (
    target === 'en-us' &&
    (nameLower.includes('us') || nameLower.includes('united states'))
  ) {
    score += 120;
    isExactAccent = true;
  }

  // 2. Quality tier score
  let qualityLabel: RankedVoice['qualityLabel'] = 'Standard';
  if (HIGHEST_QUALITY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
    score += 320;
    qualityLabel = 'Natural';
  } else if (ENHANCED_QUALITY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
    score += 220;
    qualityLabel = 'Enhanced';
  } else if (KNOWN_GOOD_VOICE_NAMES.some((kw) => nameLower.includes(kw))) {
    score += 110;
  }

  if (NOVELTY_PENALTY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
    score -= 260;
  }

  // 3. Local vs remote tie-breaker
  if (voice.localService) {
    score += 35;
  }
  if (voice.default) {
    score += 10;
  }

  return { voice, score, qualityLabel, isExactAccent };
}

export function rankVoicesForAccent(
  voices: readonly SpeechSynthesisVoice[],
  targetAccent: VoiceAccent
): RankedVoice[] {
  return voices
    .filter(isEnglishVoice)
    .map((v) => scoreVoiceForAccent(v, targetAccent))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.voice.name.localeCompare(b.voice.name);
    });
}

export function pickBestVoice(
  voices: readonly SpeechSynthesisVoice[],
  targetAccent: VoiceAccent,
  overrideVoiceURI?: string | null
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (overrideVoiceURI) {
    const manual = voices.find((v) => v.voiceURI === overrideVoiceURI);
    if (manual) return manual;
  }

  const ranked = rankVoicesForAccent(voices, targetAccent);
  if (ranked.length > 0) return ranked[0].voice;

  // Last-resort fallback only if browser reports voices without standard BCP-47 tags
  return null;
}

/**
 * Formats text cleanly for natural spoken IELTS dictation
 * (e.g. "single/double bedded room" -> "single or double bedded room").
 */
export function prepareSpokenText(rawText: string): string {
  return rawText
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeSlowRate(normalRate: number): number {
  return Math.max(0.5, Number((normalRate * 0.68).toFixed(2)));
}

/* ==========================================================================
   Optional Pre-Recorded Audio Pack Layer (`/audio/<word-id>.mp3`)
   Rejects SPA fallback `text/html` responses so missing MP3s fall back cleanly
   to Web Speech Synthesis without breaking playback or user-gesture activation.
   ========================================================================== */

const audioPackCache = new Map<string, string | null>();
const inFlightProbes = new Map<string, Promise<string | null>>();

export function getAudioPackUrl(wordId: string): string {
  return `/audio/${encodeURIComponent(wordId)}.mp3`;
}

export async function probeAudioPackClip(
  wordId: string,
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined
): Promise<string | null> {
  if (audioPackCache.has(wordId)) {
    return audioPackCache.get(wordId)!;
  }
  const existing = inFlightProbes.get(wordId);
  if (existing) return existing;

  const probePromise = (async () => {
    if (!fetchImpl) {
      audioPackCache.set(wordId, null);
      return null;
    }
    const url = getAudioPackUrl(wordId);
    try {
      const res = await fetchImpl(url, { method: 'HEAD' });
      const contentType = res.headers.get('content-type') ?? '';
      // Crucial guard: static SPAs often return 200 OK with text/html for missing assets
      if (res.ok && /^audio\/|^application\/octet-stream/i.test(contentType)) {
        audioPackCache.set(wordId, url);
        return url;
      }
    } catch {
      // Offline or network blocked — clean fallback to speechSynthesis
    }
    audioPackCache.set(wordId, null);
    return null;
  })();

  inFlightProbes.set(wordId, probePromise);
  try {
    return await probePromise;
  } finally {
    inFlightProbes.delete(wordId);
  }
}

export function getCachedAudioPackUrl(wordId: string): string | null | undefined {
  return audioPackCache.get(wordId);
}

export function resetAudioPackCacheForTests(): void {
  audioPackCache.clear();
  inFlightProbes.clear();
}

/* ==========================================================================
   Unified Word Speaker Controller (Handles Safari quirks, replay spam, MP3s)
   ========================================================================== */

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onGestureBlocked?: () => void;
  onUnavailable?: () => void;
}

export class SpeechController {
  private tokenCounter = 0;
  private activeAudioEl: HTMLAudioElement | null = null;
  private watchdogTimer: number | undefined;

  public cancel(): void {
    this.tokenCounter += 1;
    if (typeof window !== 'undefined') {
      window.clearTimeout(this.watchdogTimer);
    }
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
      } catch {
        // Ignore cleanup errors
      }
      this.activeAudioEl = null;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore synthesis cancel errors
    }
  }

  public speakWord(
    word: Pick<Word, 'id' | 'text'>,
    options: {
      voice: SpeechSynthesisVoice | null;
      accent: VoiceAccent;
      rate: number;
      slow?: boolean;
      callbacks?: SpeakCallbacks;
    }
  ): void {
    this.cancel();
    const myToken = ++this.tokenCounter;
    const effectiveRate = options.slow
      ? computeSlowRate(options.rate)
      : options.rate;

    const cachedMp3 = audioPackCache.get(word.id);

    // Trigger background probe if never checked before so next replay uses MP3 if installed
    if (cachedMp3 === undefined) {
      void probeAudioPackClip(word.id);
    }

    if (cachedMp3 && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(cachedMp3);
        this.activeAudioEl = audio;
        audio.playbackRate = Math.min(2, Math.max(0.5, effectiveRate));
        audio.onplay = () => {
          if (this.tokenCounter === myToken) options.callbacks?.onStart?.();
        };
        audio.onended = () => {
          if (this.tokenCounter === myToken) {
            this.activeAudioEl = null;
            options.callbacks?.onEnd?.();
          }
        };
        audio.onerror = () => {
          if (this.tokenCounter === myToken) {
            audioPackCache.set(word.id, null);
            this.activeAudioEl = null;
            this.speakWithSynthesis(myToken, word.text, effectiveRate, options);
          }
        };
        const playResult = audio.play();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch((err: unknown) => {
            if (this.tokenCounter !== myToken) return;
            const errName = (err as { name?: string })?.name ?? '';
            if (errName === 'NotAllowedError') {
              options.callbacks?.onGestureBlocked?.();
              options.callbacks?.onEnd?.();
            } else {
              this.speakWithSynthesis(myToken, word.text, effectiveRate, options);
            }
          });
        }
        return;
      } catch {
        // Fall through to speechSynthesis
      }
    }

    this.speakWithSynthesis(myToken, word.text, effectiveRate, options);
  }

  private speakWithSynthesis(
    myToken: number,
    rawText: string,
    effectiveRate: number,
    options: {
      voice: SpeechSynthesisVoice | null;
      accent: VoiceAccent;
      callbacks?: SpeakCallbacks;
    }
  ): void {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      options.callbacks?.onUnavailable?.();
      return;
    }

    if (!options.voice) {
      options.callbacks?.onUnavailable?.();
      return;
    }

    const synth = window.speechSynthesis;
    try {
      // Safari anti-stall sequence: cancel prior queue and resume if paused by background tabbing
      synth.cancel();
      if (synth.paused) {
        synth.resume();
      }
    } catch {
      // Ignore
    }

    const utterance = new SpeechSynthesisUtterance(prepareSpokenText(rawText));
    utterance.voice = options.voice;
    utterance.lang = options.voice.lang || options.accent;
    utterance.rate = Math.min(1.5, Math.max(0.5, effectiveRate));
    utterance.pitch = 1.0;

    const finish = () => {
      if (this.tokenCounter !== myToken) return;
      window.clearTimeout(this.watchdogTimer);
      options.callbacks?.onEnd?.();
    };

    utterance.onstart = () => {
      if (this.tokenCounter !== myToken) return;
      options.callbacks?.onStart?.();
    };
    utterance.onend = finish;
    utterance.onerror = (ev) => {
      if (this.tokenCounter !== myToken) return;
      window.clearTimeout(this.watchdogTimer);
      if (ev.error === 'not-allowed') {
        options.callbacks?.onGestureBlocked?.();
      }
      options.callbacks?.onEnd?.();
    };

    // Watchdog ensures `isSpeaking` never locks up if browser drops `onend`
    const maxDurationMs = Math.max(4000, rawText.length * 240);
    this.watchdogTimer = window.setTimeout(finish, maxDurationMs);

    try {
      options.callbacks?.onStart?.();
      synth.speak(utterance);
    } catch {
      window.clearTimeout(this.watchdogTimer);
      options.callbacks?.onUnavailable?.();
    }
  }
}
