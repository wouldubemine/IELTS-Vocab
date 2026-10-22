import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  pickBestVoice,
  probeAudioPackClip,
  rankVoicesForAccent,
  SpeechController,
  type RankedVoice,
} from '../lib/audio';
import { useTrainer } from './TrainerContext';
import type { Word } from '../types/word';

export interface AudioContextValue {
  speechSupported: boolean;
  voicesLoaded: boolean;
  hasAvailableVoice: boolean;
  rankedVoices: RankedVoice[];
  activeVoice: SpeechSynthesisVoice | null;
  speakingMode: 'normal' | 'slow' | null;
  gestureBlocked: boolean;

  speakWord: (word: Pick<Word, 'id' | 'text'>, options?: { slow?: boolean }) => void;
  speakSample: (sampleText?: string, slow?: boolean) => void;
  stopSpeaking: () => void;
  preloadWordsAudio: (words: readonly Word[]) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { state } = useTrainer();
  const { accent, voiceURI, speechRate } = state.settings;

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [rawVoices, setRawVoices] = useState<SpeechSynthesisVoice[]>(() => {
    if (!speechSupported) return [];
    try {
      return window.speechSynthesis.getVoices();
    } catch {
      return [];
    }
  });
  const [voicesLoaded, setVoicesLoaded] = useState<boolean>(
    () => !speechSupported || rawVoices.length > 0
  );
  const [speakingMode, setSpeakingMode] = useState<'normal' | 'slow' | null>(null);
  const [gestureBlocked, setGestureBlocked] = useState<boolean>(false);

  const controllerRef = useRef<SpeechController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new SpeechController();
  }

  // Discover Web Speech voices asynchronously via `voiceschanged` + short fallback polls
  useEffect(() => {
    if (!speechSupported) {
      setVoicesLoaded(true);
      return;
    }

    let mounted = true;
    const refreshVoices = () => {
      if (!mounted) return;
      try {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) {
          setRawVoices(list);
          setVoicesLoaded(true);
        }
      } catch {
        // Ignore browser voice enumeration errors
      }
    };

    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);

    // Some WebViews populate getVoices() slightly after load without dispatching `voiceschanged`
    const t1 = window.setTimeout(refreshVoices, 150);
    const t2 = window.setTimeout(refreshVoices, 500);
    const settleTimer = window.setTimeout(() => {
      if (mounted) {
        refreshVoices();
        setVoicesLoaded(true);
      }
    }, 1100);

    return () => {
      mounted = false;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(settleTimer);
      window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      controllerRef.current?.cancel();
    };
  }, [speechSupported]);

  const rankedVoices = useMemo(
    () => rankVoicesForAccent(rawVoices, accent),
    [rawVoices, accent]
  );

  const activeVoice = useMemo(
    () => pickBestVoice(rawVoices, accent, voiceURI),
    [rawVoices, accent, voiceURI]
  );

  const hasAvailableVoice = Boolean(activeVoice);

  const stopSpeaking = useCallback(() => {
    controllerRef.current?.cancel();
    setSpeakingMode(null);
  }, []);

  // Cancel stale speech cleanly if accent, voice, or speech rate changes mid-playback
  const prevAudioConfigRef = useRef({ accent, voiceURI, speechRate });
  useEffect(() => {
    const prev = prevAudioConfigRef.current;
    if (
      prev.accent !== accent ||
      prev.voiceURI !== voiceURI ||
      prev.speechRate !== speechRate
    ) {
      prevAudioConfigRef.current = { accent, voiceURI, speechRate };
      if (speakingMode !== null) {
        stopSpeaking();
      }
    }
  }, [accent, voiceURI, speechRate, speakingMode, stopSpeaking]);

  const speakWord = useCallback(
    (word: Pick<Word, 'id' | 'text'>, options?: { slow?: boolean }) => {
      const isSlow = Boolean(options?.slow);
      setGestureBlocked(false);

      controllerRef.current?.speakWord(word, {
        voice: activeVoice,
        accent,
        rate: speechRate,
        slow: isSlow,
        callbacks: {
          onStart: () => setSpeakingMode(isSlow ? 'slow' : 'normal'),
          onEnd: () => setSpeakingMode(null),
          onGestureBlocked: () => {
            setGestureBlocked(true);
            setSpeakingMode(null);
          },
          onUnavailable: () => {
            setSpeakingMode(null);
          },
        },
      });
    },
    [activeVoice, accent, speechRate]
  );

  const speakSample = useCallback(
    (
      sampleText = 'Accommodation, stationery, and solar power.',
      slow = false
    ) => {
      speakWord({ id: '__voice_sample__', text: sampleText }, { slow });
    },
    [speakWord]
  );

  const preloadWordsAudio = useCallback((words: readonly Word[]) => {
    for (const w of words.slice(0, 12)) {
      void probeAudioPackClip(w.id);
    }
  }, []);

  const value: AudioContextValue = {
    speechSupported,
    voicesLoaded,
    hasAvailableVoice,
    rankedVoices,
    activeVoice,
    speakingMode,
    gestureBlocked,
    speakWord,
    speakSample,
    stopSpeaking,
    preloadWordsAudio,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio must be used inside <AudioProvider>');
  }
  return ctx;
}
