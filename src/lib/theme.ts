import type { ResolvedTheme, ThemePreference } from '../types/word';

const STORAGE_KEY = 'ielts-trainer:v1';

export function getSystemTheme(): ResolvedTheme {
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Ignore restricted environment errors
  }
  return 'light';
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref;
}

export function isReducedMotionActive(override: boolean): boolean {
  if (override) return true;
  try {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export function applyThemeToDocument(
  pref: ThemePreference,
  animate = false
): ResolvedTheme {
  const resolved = resolveTheme(pref);
  if (typeof document === 'undefined') return resolved;

  const root = document.documentElement;
  const previous = root.dataset.theme;
  const reduced =
    root.dataset.motion === 'reduced' || isReducedMotionActive(false);

  const commit = () => {
    root.dataset.theme = resolved;
    root.dataset.themePref = pref;
    root.style.colorScheme = resolved;
    const meta = document.getElementById('meta-theme-color');
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? '#12110F' : '#F4EFE6');
    }
  };

  const doc = document as DocWithViewTransition;
  if (
    animate &&
    previous &&
    previous !== resolved &&
    !reduced &&
    typeof doc.startViewTransition === 'function'
  ) {
    root.dataset.themeTransition = 'active';
    const vt = doc.startViewTransition(() => {
      commit();
    });
    vt.finished.finally(() => {
      delete root.dataset.themeTransition;
    });
  } else {
    commit();
  }

  return resolved;
}

export function applyMotionPreference(reduceMotion: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (reduceMotion) {
    root.dataset.motion = 'reduced';
  } else {
    delete root.dataset.motion;
  }
}

export function applyTextScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const clamped = Math.min(1.25, Math.max(0.9, scale));
  document.documentElement.style.setProperty('--font-scale', String(clamped));
}

export function readBootPreferences(): {
  theme: ThemePreference;
  reduceMotion: boolean;
  textScale: number;
} {
  const fallback = {
    theme: 'system' as ThemePreference,
    reduceMotion: false,
    textScale: 1,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const s = parsed.settings ?? {};
    const theme: ThemePreference =
      s.theme === 'light' || s.theme === 'dark' || s.theme === 'system'
        ? s.theme
        : 'system';
    const reduceMotion = typeof s.reduceMotion === 'boolean' ? s.reduceMotion : false;
    const textScale =
      typeof s.textScale === 'number' && Number.isFinite(s.textScale)
        ? Math.min(1.25, Math.max(0.9, s.textScale))
        : 1;
    return { theme, reduceMotion, textScale };
  } catch {
    return fallback;
  }
}

export function persistBootPreferences(patch: {
  theme?: ThemePreference;
  reduceMotion?: boolean;
  textScale?: number;
}): void {
  try {
    let existing: Record<string, unknown> = { schemaVersion: 1, settings: {} };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          existing = parsed as Record<string, unknown>;
        }
      } catch {
        try {
          window.localStorage.setItem(`${STORAGE_KEY}:backup`, raw);
        } catch {
          // Ignore quota error
        }
      }
    }
    const prevSettings =
      existing.settings && typeof existing.settings === 'object'
        ? (existing.settings as Record<string, unknown>)
        : {};
    const next = {
      ...existing,
      schemaVersion:
        typeof existing.schemaVersion === 'number' ? existing.schemaVersion : 1,
      settings: {
        ...prevSettings,
        ...patch,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or quota full — operate cleanly in memory without crashing
  }
}
