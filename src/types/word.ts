export type Word = {
  id: string; // slug of normalized text, e.g. "credit-card"
  text: string; // canonical spelling to be typed, e.g. "credit card"
  category: string; // category id
  alt?: string[]; // accepted alternative spellings (e.g. "neighbourhood")
  hint?: string; // optional short clue
};

export type CategoryMeta = {
  id: string;
  name: string;
  order: number;
  tintIndex: number; // 0..7 shared desaturated editorial hues
  mark: string; // two-letter Fraunces typographic monogram (no emoji)
  wordCount: number;
};

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type NavSection = 'home' | 'practice' | 'mistakes' | 'stats' | 'settings';

export type PracticeMode = 'listen' | 'flashcards' | 'choice' | 'read';

export type RouteState = {
  section: NavSection;
  categoryId?: string;
  mode?: PracticeMode;
  source?: 'category' | 'mixed' | 'mistakes';
  rawHash: string;
};
