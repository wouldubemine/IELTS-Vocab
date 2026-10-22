import { useEffect, useState } from 'react';

export type ScreenSizeClass = 'compact' | 'medium' | 'expanded' | 'large';

export type ViewportInfo = {
  sizeClass: ScreenSizeClass;
  width: number;
  height: number;
  isShortLandscape: boolean;
  keyboardOpen: boolean;
};

function computeSizeClass(width: number): ScreenSizeClass {
  if (width < 600) return 'compact';
  if (width <= 1024) return 'medium';
  if (width <= 1600) return 'expanded';
  return 'large';
}

function readViewport(): ViewportInfo {
  if (typeof window === 'undefined') {
    return {
      sizeClass: 'expanded',
      width: 1280,
      height: 800,
      isShortLandscape: false,
      keyboardOpen: false,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const vv = window.visualViewport;
  const visualHeight = vv ? vv.height : height;
  const keyboardInset = Math.max(0, height - visualHeight - (vv ? vv.offsetTop : 0));
  const keyboardOpen = keyboardInset > 110;

  return {
    sizeClass: computeSizeClass(width),
    width,
    height: Math.round(visualHeight),
    isShortLandscape: width > height && height <= 520,
    keyboardOpen,
  };
}

/**
 * Syncs `window.visualViewport` metrics directly into CSS custom properties
 * (`--vvh`, `--keyboard-inset`) so practice inputs and primary actions stay
 * completely visible above mobile on-screen keyboards (Spec Section 8).
 */
export function useViewportMetrics(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(readViewport);

  useEffect(() => {
    let raf = 0;
    const sync = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const layoutH = window.innerHeight;
        const visualH = vv ? vv.height : layoutH;
        const inset = Math.max(0, Math.round(layoutH - visualH - (vv ? vv.offsetTop : 0)));
        const root = document.documentElement;
        root.style.setProperty('--vvh', `${Math.round(visualH)}px`);
        root.style.setProperty('--keyboard-inset', `${inset}px`);
        if (inset > 110) {
          root.dataset.keyboard = 'open';
        } else {
          delete root.dataset.keyboard;
        }
        setInfo(readViewport());
      });
    };

    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('orientationchange', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('scroll', sync, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('scroll', sync);
    };
  }, []);

  return info;
}
