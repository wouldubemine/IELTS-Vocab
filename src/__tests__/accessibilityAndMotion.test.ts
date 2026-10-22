import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function hexToRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = hexToRelativeLuminance(fgHex);
  const l2 = hexToRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Phase 9 — WCAG 2.1 AA Contrast, GPU Motion Purity & Zero-Emoji Invariants', () => {
  it('verifies every Light & Dark Paper & Ink token pair meets WCAG 2.1 AA (>= 4.5:1 text, >= 3.0:1 UI control border)', () => {
    const light = {
      bg: '#F4EFE6',
      surface: '#FFFBF3',
      surface2: '#EDE6D8',
      text: '#1D1B16',
      textMuted: '#665F55',
      borderStrong: '#857C6E',
      accent: '#1F6F5C',
      accentContrast: '#FFFBF3',
      accentSoft: '#E3F0EC',
      highlightInk: '#8C5608',
      highlightBg: '#FBF0DC',
      correct: '#236B40',
      correctBg: '#E6F2EA',
      wrong: '#AC3A20',
      wrongBg: '#FAEDE9',
    };

    const dark = {
      bg: '#12110F',
      surface: '#1C1A17',
      surface2: '#26231F',
      text: '#F2ECE0',
      textMuted: '#A39B8D',
      borderStrong: '#787166',
      accent: '#5FB89A',
      accentContrast: '#0F1A16',
      accentSoft: '#182823',
      highlightInk: '#F0B65A',
      highlightBg: '#2B2316',
      correct: '#6CC38A',
      correctBg: '#192920',
      wrong: '#EE7B63',
      wrongBg: '#2C1C19',
    };

    for (const [themeName, p] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      expect(contrastRatio(p.text, p.bg), `${themeName} text/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.text, p.surface), `${themeName} text/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.text, p.surface2), `${themeName} text/surface2`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.bg), `${themeName} muted/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.surface), `${themeName} muted/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.surface2), `${themeName} muted/surface2`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.accentContrast, p.accent), `${themeName} btn primary`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.accent, p.surface), `${themeName} accent/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.accent, p.accentSoft), `${themeName} accent/soft`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.highlightInk, p.surface), `${themeName} highlight/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.highlightInk, p.highlightBg), `${themeName} highlight/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.correct, p.surface), `${themeName} correct/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.correct, p.correctBg), `${themeName} correct/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.wrong, p.surface), `${themeName} wrong/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.wrong, p.wrongBg), `${themeName} wrong/bg`).toBeGreaterThanOrEqual(4.5);

      // WCAG 1.4.11 Non-text UI control boundary >= 3.0:1
      expect(contrastRatio(p.borderStrong, p.bg), `${themeName} borderStrong/bg`).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(p.borderStrong, p.surface), `${themeName} borderStrong/surface`).toBeGreaterThanOrEqual(3.0);
    }

    // Verify all 16 category monogram tint pairs (8 light + 8 dark) in tokens.css
    const tokensCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/styles/tokens.css'),
      'utf-8'
    );
    const tintBlocks = [
      ...tokensCss.matchAll(
        /--tint-fg:\s*(#[0-9A-Fa-f]{6});\s*--tint-bg:\s*(#[0-9A-Fa-f]{6});/g
      ),
    ];
    expect(tintBlocks.length).toBe(16);
    for (const [, fg, bg] of tintBlocks) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('enforces pure GPU compositor animations (never animates width/height/top/left) & reduced-motion support', () => {
    const cssDir = path.resolve(process.cwd(), 'src/styles');
    for (const file of fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'))) {
      const content = fs.readFileSync(path.join(cssDir, file), 'utf-8');
      expect(content).not.toMatch(/transition\s*:[^;]*\b(width|height|top|left|margin)\b/);
      expect(content).not.toMatch(/\bease-in-out\b/);
    }

    const tokensCss = fs.readFileSync(path.join(cssDir, 'tokens.css'), 'utf-8');
    expect(tokensCss).toContain('prefers-reduced-motion: reduce');
    expect(tokensCss).toContain("html[data-motion='reduced']");
  });

  it('guarantees zero emoji characters anywhere in UI source components', () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(full);
      }
      return out;
    };

    for (const filePath of walk(path.resolve(process.cwd(), 'src'))) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(emojiRegex.test(content), `Unexpected emoji in ${filePath}`).toBe(false);
    }
  });
});
