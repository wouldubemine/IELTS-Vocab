import { useCallback, useEffect, useState } from 'react';
import type { NavSection, PracticeMode, RouteState } from '../types/word';

const SECTION_ORDER: Record<NavSection, number> = {
  home: 0,
  practice: 1,
  mistakes: 2,
  stats: 3,
  settings: 4,
};

export function parseHashRoute(hash: string): RouteState {
  const rawHash = hash || '#/';
  const cleaned = rawHash.replace(/^#\/?/, '');
  const [pathPart = '', queryPart = ''] = cleaned.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart);

  const modeParam = params.get('mode');
  const mode: PracticeMode | undefined =
    modeParam === 'listen' ||
    modeParam === 'flashcards' ||
    modeParam === 'choice' ||
    modeParam === 'read'
      ? modeParam
      : undefined;

  const first = segments[0];

  if (!first || first === 'home') {
    return { section: 'home', rawHash };
  }

  if (first === 'category' && segments[1]) {
    return {
      section: 'practice',
      source: 'category',
      categoryId: decodeURIComponent(segments[1]),
      mode,
      rawHash,
    };
  }

  if (first === 'practice') {
    const sub = segments[1];
    if (sub === 'mistakes') {
      return {
        section: 'practice',
        source: 'mistakes',
        categoryId: params.get('category') || undefined,
        mode,
        rawHash,
      };
    }
    if (sub === 'mixed') {
      return {
        section: 'practice',
        source: 'mixed',
        mode,
        rawHash,
      };
    }
    if (sub) {
      return {
        section: 'practice',
        source: 'category',
        categoryId: decodeURIComponent(sub),
        mode,
        rawHash,
      };
    }
    return {
      section: 'practice',
      source: 'mixed',
      mode,
      rawHash,
    };
  }

  if (first === 'mistakes') {
    return { section: 'mistakes', rawHash };
  }

  if (first === 'stats') {
    return { section: 'stats', rawHash };
  }

  if (first === 'settings') {
    return { section: 'settings', rawHash };
  }

  return { section: 'home', rawHash };
}

type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export function navigateToHash(nextHash: string): void {
  const target = nextHash.startsWith('#') ? nextHash : `#${nextHash}`;
  if (window.location.hash === target) return;

  const currentRoute = parseHashRoute(window.location.hash);
  const nextRoute = parseHashRoute(target);
  const dir =
    SECTION_ORDER[nextRoute.section] >= SECTION_ORDER[currentRoute.section]
      ? 'forward'
      : 'back';

  const root = document.documentElement;
  root.dataset.navDir = dir;

  const reduced =
    root.dataset.motion === 'reduced' ||
    (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const doc = document as DocWithViewTransition;
  if (!reduced && typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => {
      window.location.hash = target;
    });
  } else {
    window.location.hash = target;
  }
}

export function useHashRoute(): {
  route: RouteState;
  navigate: (hash: string) => void;
  transitionKey: string;
} {
  const [route, setRoute] = useState<RouteState>(() =>
    parseHashRoute(typeof window !== 'undefined' ? window.location.hash : '#/')
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHashRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((hash: string) => {
    navigateToHash(hash);
  }, []);

  const transitionKey = `${route.section}:${route.source ?? ''}:${route.categoryId ?? ''}`;

  return { route, navigate, transitionKey };
}
