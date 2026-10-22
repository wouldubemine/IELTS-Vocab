import { describe, expect, it } from 'vitest';
import {
  computeSlowRate,
  pickBestVoice,
  prepareSpokenText,
  probeAudioPackClip,
  rankVoicesForAccent,
  resetAudioPackCacheForTests,
} from '../lib/audio';

function mockVoice(
  partial: Partial<SpeechSynthesisVoice> & { name: string; lang: string }
): SpeechSynthesisVoice {
  return {
    default: false,
    localService: true,
    voiceURI: partial.voiceURI ?? `${partial.name}-${partial.lang}`,
    ...partial,
  } as SpeechSynthesisVoice;
}

describe('Phase 4 — Audio Voice Ranking, Slow Replay, & Audio Pack Fallback', () => {
  it('ranks Neural/Natural exact-accent voices above standard, other dialects, and novelty voices', () => {
    const voices = [
      mockVoice({ name: 'Zarvox', lang: 'en-GB', localService: true }),
      mockVoice({ name: 'Daniel', lang: 'en-GB', localService: true }),
      mockVoice({
        name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)',
        lang: 'en-GB',
        localService: false,
      }),
      mockVoice({
        name: 'Samantha (Enhanced)',
        lang: 'en-US',
        localService: true,
      }),
      mockVoice({
        name: 'Thomas',
        lang: 'fr-FR',
        localService: true,
      }),
    ];

    const ukRanked = rankVoicesForAccent(voices, 'en-GB');
    // French voice excluded completely
    expect(ukRanked.some((v) => v.voice.name === 'Thomas')).toBe(false);
    // Natural en-GB ranks #1, Daniel en-GB #2, Novelty Zarvox penalized below Daniel
    expect(ukRanked[0].voice.name).toContain('Sonia Online (Natural)');
    expect(ukRanked[0].qualityLabel).toBe('Natural');
    expect(ukRanked[1].voice.name).toBe('Daniel');

    // Switching accent to en-US puts Samantha (Enhanced) #1
    const usBest = pickBestVoice(voices, 'en-US', null);
    expect(usBest?.name).toBe('Samantha (Enhanced)');

    // Valid manual voiceURI override wins; missing voiceURI falls back cleanly to best ranked
    const manual = pickBestVoice(voices, 'en-US', 'Daniel-en-GB');
    expect(manual?.name).toBe('Daniel');

    const missingFallback = pickBestVoice(voices, 'en-US', 'NonExistentVoiceURI');
    expect(missingFallback?.name).toBe('Samantha (Enhanced)');
  });

  it('returns null gracefully when zero English voices exist on the device', () => {
    expect(pickBestVoice([], 'en-GB', null)).toBeNull();
    expect(
      pickBestVoice(
        [mockVoice({ name: 'Mei-Jia', lang: 'zh-TW' })],
        'en-GB',
        null
      )
    ).toBeNull();
  });

  it('formats slash alternatives cleanly for natural speech and computes bounded slow replay rates', () => {
    expect(prepareSpokenText('single/double bedded room')).toBe(
      'single or double bedded room'
    );
    expect(computeSlowRate(0.9)).toBe(0.61);
    expect(computeSlowRate(0.6)).toBe(0.5);
  });

  it('accepts genuine audio/* MP3 responses and rejects SPA text/html 200 fallbacks', async () => {
    resetAudioPackCacheForTests();

    const spaFallbackFetch = async () =>
      new Response('<!doctype html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

    const spaResult = await probeAudioPackClip(
      'credit-card',
      spaFallbackFetch as unknown as typeof fetch
    );
    expect(spaResult).toBeNull();

    const realMp3Fetch = async () =>
      new Response('', {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });

    const mp3Result = await probeAudioPackClip(
      'stationery',
      realMp3Fetch as unknown as typeof fetch
    );
    expect(mp3Result).toBe('/audio/stationery.mp3');
  });
});
