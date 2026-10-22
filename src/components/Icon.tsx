import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'headphones'
  | 'mistakes'
  | 'chart'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'search'
  | 'play'
  | 'slow'
  | 'hint'
  | 'skip'
  | 'check'
  | 'close'
  | 'arrow-left'
  | 'arrow-right'
  | 'layers'
  | 'list-check'
  | 'keyboard'
  | 'volume'
  | 'pin'
  | 'trash'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'sparkles';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

/**
 * Single cohesive 1.75px rounded-stroke SVG icon set (Spec Section 6.4).
 * Zero emoji anywhere in UI chrome.
 */
export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {name === 'home' && (
        <>
          <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
          <path d="M9.5 20.5v-6h5v6" />
        </>
      )}
      {name === 'headphones' && (
        <>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <rect x="3" y="13" width="4" height="7" rx="1.5" />
          <rect x="17" y="13" width="4" height="7" rx="1.5" />
        </>
      )}
      {name === 'mistakes' && (
        <>
          <path d="M6 4h11a1.5 1.5 0 0 1 1.5 1.5V20l-7-3.6L4.5 20V5.5A1.5 1.5 0 0 1 6 4Z" />
          <path d="M11.5 8.5v4" />
          <circle cx="11.5" cy="15" r="0.6" fill="currentColor" />
        </>
      )}
      {name === 'chart' && (
        <>
          <path d="M4 19.5h16" />
          <path d="M7.5 16v-5" />
          <path d="M12 16V7" />
          <path d="M16.5 16v-8" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M4 7h9" />
          <path d="M17 7h3" />
          <circle cx="15" cy="7" r="2" />
          <path d="M4 12h3" />
          <path d="M11 12h9" />
          <circle cx="9" cy="12" r="2" />
          <path d="M4 17h11" />
          <path d="M19 17h1" />
          <circle cx="17" cy="17" r="2" />
        </>
      )}
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </>
      )}
      {name === 'moon' && (
        <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
      )}
      {name === 'monitor' && (
        <>
          <rect x="3" y="4" width="18" height="12.5" rx="2" />
          <path d="M8.5 20h7M12 16.5V20" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.2 4.2" />
        </>
      )}
      {name === 'play' && <polygon points="7 5.5 18.5 12 7 18.5 7 5.5" />}
      {name === 'slow' && (
        <>
          <path d="M5 15.5a7 7 0 1 1 14 0" />
          <path d="m12 13 3.5-3.5" />
          <circle cx="12" cy="13" r="1.2" />
          <path d="M6 19h12" />
        </>
      )}
      {name === 'hint' && (
        <>
          <path d="M9 17.5h6M10 20.5h4" />
          <path d="M8.5 14c-1.4-1.2-2.2-2.8-2.2-4.6a5.7 5.7 0 0 1 11.4 0c0 1.8-.8 3.4-2.2 4.6-.7.6-1 1.4-1 2.3h-5c0-.9-.3-1.7-1-2.3Z" />
        </>
      )}
      {name === 'skip' && (
        <>
          <polygon points="5 6 14 12 5 18 5 6" />
          <path d="M18.5 6v12" />
        </>
      )}
      {name === 'check' && (
        <path className="icon-check-draw" d="m5 12.5 4.5 4.5L19.5 7" />
      )}
      {name === 'close' && <path d="M6.5 6.5 17.5 17.5M17.5 6.5l-11 11" />}
      {name === 'arrow-left' && (
        <>
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </>
      )}
      {name === 'arrow-right' && (
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      )}
      {name === 'layers' && (
        <>
          <polygon points="12 3.5 21 8.5 12 13.5 3 8.5 12 3.5" />
          <path d="m3 13 9 5 9-5" />
          <path d="m3 17.5 9 5 9-5" />
        </>
      )}
      {name === 'list-check' && (
        <>
          <path d="M11 7h9M11 12h9M11 17h9" />
          <path d="m4 7 1.8 1.8L8.8 5.8M4 12l1.8 1.8 3-3M4 17l1.8 1.8 3-3" />
        </>
      )}
      {name === 'keyboard' && (
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
          <path d="M6.5 9.5h.01M10 9.5h.01M14 9.5h.01M17.5 9.5h.01M6.5 13h.01M17.5 13h.01M8.5 16h7" />
        </>
      )}
      {name === 'volume' && (
        <>
          <polygon points="5 9.5 9.5 9.5 14 5.5 14 18.5 9.5 14.5 5 14.5 5 9.5" />
          <path d="M17 9a4.5 4.5 0 0 1 0 6M19.5 6.8a8 8 0 0 1 0 10.4" />
        </>
      )}
      {name === 'pin' && (
        <>
          <path d="m15 4.5 4.5 4.5-3.8 3.8.5 4.2-8.2-8.2 4.2.5 2.8-4.8Z" />
          <path d="m9 15-4.5 4.5" />
        </>
      )}
      {name === 'trash' && (
        <>
          <path d="M4.5 7h15M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
          <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M12 4v11.5M7.5 11.5 12 16l4.5-4.5" />
          <path d="M4.5 19.5h15" />
        </>
      )}
      {name === 'upload' && (
        <>
          <path d="M12 16V4.5M7.5 8.5 12 4l4.5 4.5" />
          <path d="M4.5 19.5h15" />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M20 11a8 8 0 0 0-14.4-4.8L4 8" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.4 4.8L20 16" />
          <path d="M20 20v-4h-4" />
        </>
      )}
      {name === 'sparkles' && (
        <>
          <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9L12 3.5Z" />
          <path d="M18.5 16.5v3M17 18h3" />
        </>
      )}
    </svg>
  );
}
