import { useEffect, useRef, useState } from 'react';

interface ProgressRingProps {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showCenterText?: boolean;
}

/**
 * Spring-animated SVG Progress Ring (Spec Section 7).
 * Uses GPU-friendly stroke-dashoffset transition and tabular center numerals.
 */
export function ProgressRing({
  value,
  size = 42,
  strokeWidth = 3.75,
  color = 'var(--accent)',
  label,
  showCenterText = true,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition:
              'stroke-dashoffset var(--dur-slow) var(--ease-spring, var(--ease-ios))',
          }}
        />
      </svg>

      {showCenterText && (
        <span
          className="tabular"
          aria-hidden="true"
          style={{
            position: 'absolute',
            fontSize: size >= 64 ? 'var(--text-base)' : '0.68rem',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1,
          }}
        >
          {Math.round(clamped)}%
        </span>
      )}
    </span>
  );
}

/**
 * Smoothly counts numbers toward target value (< 350ms, honors reduced motion).
 */
export function CountUpNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const startVal = prevRef.current;
    prevRef.current = value;
    if (startVal === value) {
      setDisplay(value);
      return;
    }

    const reduced =
      document.documentElement.dataset.motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setDisplay(value);
      return;
    }

    const duration = 320;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [value]);

  return <span className="tabular">{display}</span>;
}
