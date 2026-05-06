import type { EmotionState, EmotionAdaptation } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface ColorPalette {
  primary:      string;
  primaryLight: string;
  primaryDark:  string;
  secondary:    string;
  accent:       string;
  surface:      string;
  surfaceHigh:  string;
  text:         string;
  textMuted:    string;
  border:       string;
}

export interface GenomeConfig {
  // Brand inputs
  primaryColor:    string;
  secondaryColor?: string;
  accentColor?:    string;
  fontFamily?:     string;
  fontMono?:       string;
  fontSizeBase?:   string;
  spacingUnit?:    string;
  borderRadius?:   string;
  shadowElevation?:string;
  transitionSpeed?:string;
  transitionEasing?:string;
  // Theme
  theme?:          'dark' | 'light' | 'auto';
  // Extend with any custom token
  [key: string]: string | undefined;
}

// ── Emotion adaptations ────────────────────────────────────────────────
// Each emotion subtly shifts the visual language without changing brand identity.
// These are CSS var multipliers — components multiply their base values by these.

const EMOTION_ADAPTATIONS: Record<EmotionState, EmotionAdaptation> = {
  calm:        { animationSpeed: 1.0,  borderRadius: 1.0,  shadowIntensity: 1.0,  saturation: 1.0,  blurStrength: 1.0,  spacingScale: 1.0  },
  engaged:     { animationSpeed: 0.80, borderRadius: 1.08, shadowIntensity: 1.25, saturation: 1.15, blurStrength: 1.15, spacingScale: 1.0  },
  focused:     { animationSpeed: 1.10, borderRadius: 0.92, shadowIntensity: 0.85, saturation: 0.90, blurStrength: 0.85, spacingScale: 0.97 },
  frustrated:  { animationSpeed: 0.55, borderRadius: 0.82, shadowIntensity: 1.55, saturation: 1.35, blurStrength: 1.50, spacingScale: 0.95 },
  confused:    { animationSpeed: 1.40, borderRadius: 1.15, shadowIntensity: 0.75, saturation: 0.80, blurStrength: 0.90, spacingScale: 1.05 },
  bored:       { animationSpeed: 1.60, borderRadius: 1.0,  shadowIntensity: 0.65, saturation: 0.70, blurStrength: 0.80, spacingScale: 1.0  },
  celebrating: { animationSpeed: 0.45, borderRadius: 1.30, shadowIntensity: 1.85, saturation: 1.55, blurStrength: 1.60, spacingScale: 1.03 },
};

// ── Color math ─────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const _s = s / 100, _l = l / 100;
  const a = _s * Math.min(_l, 1 - _l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const col = _l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * col).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generatePalette(primaryHex: string, theme: 'dark' | 'light' = 'dark'): ColorPalette {
  const [h, s, l] = hexToHsl(primaryHex);
  const isDark = theme === 'dark';

  return {
    primary:      primaryHex,
    primaryLight: hslToHex(h, s, Math.min(l + 18, 92)),
    primaryDark:  hslToHex(h, s, Math.max(l - 18, 8)),
    secondary:    hslToHex((h + 210) % 360, s * 0.80, l),
    accent:       hslToHex((h + 145) % 360, s * 0.90, l),
    surface:      isDark ? hslToHex(h, s * 0.08, 6)  : hslToHex(h, s * 0.04, 97),
    surfaceHigh:  isDark ? hslToHex(h, s * 0.10, 10) : hslToHex(h, s * 0.06, 93),
    text:         isDark ? hslToHex(h, 12, 90)        : hslToHex(h, 10, 10),
    textMuted:    isDark ? hslToHex(h, 8,  55)        : hslToHex(h, 6,  45),
    border:       isDark ? hslToHex(h, s * 0.12, 16)  : hslToHex(h, s * 0.08, 82),
  };
}

// ── Genome state ───────────────────────────────────────────────────────

let _active: GenomeConfig | null = null;
let _palette: ColorPalette | null = null;

const CSS_VAR_MAP: Record<string, string> = {
  primaryColor:     '--dr-color-primary',
  secondaryColor:   '--dr-color-secondary',
  accentColor:      '--dr-color-accent',
  fontFamily:       '--dr-font-family',
  fontMono:         '--dr-font-mono',
  fontSizeBase:     '--dr-font-size-base',
  spacingUnit:      '--dr-spacing-unit',
  borderRadius:     '--dr-border-radius',
  shadowElevation:  '--dr-shadow',
  transitionSpeed:  '--dr-transition-speed',
  transitionEasing: '--dr-transition-ease',
};

// ── loadGenome ─────────────────────────────────────────────────────────
// Call once at app boot with your brand config.
// Generates a full palette from primaryColor and writes all CSS vars.
export function loadGenome(config: GenomeConfig): ColorPalette {
  _active = config;
  const root  = document.documentElement;
  const theme = config.theme === 'light' ? 'light' : 'dark';

  // Generate and apply palette
  const palette = generatePalette(config.primaryColor, theme);
  _palette = palette;

  root.style.setProperty('--dr-color-primary',       palette.primary);
  root.style.setProperty('--dr-color-primary-light',  palette.primaryLight);
  root.style.setProperty('--dr-color-primary-dark',   palette.primaryDark);
  root.style.setProperty('--dr-color-secondary',      palette.secondary);
  root.style.setProperty('--dr-color-accent',         palette.accent);
  root.style.setProperty('--dr-color-surface',        palette.surface);
  root.style.setProperty('--dr-color-surface-high',   palette.surfaceHigh);
  root.style.setProperty('--dr-color-text',           palette.text);
  root.style.setProperty('--dr-color-text-muted',     palette.textMuted);
  root.style.setProperty('--dr-color-border',         palette.border);

  // Apply named overrides
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const val = config[key];
    if (val !== undefined) root.style.setProperty(cssVar, val);
  }

  // Defaults for tokens that weren't specified
  if (!config.fontFamily)     root.style.setProperty('--dr-font-family',      'system-ui, sans-serif');
  if (!config.fontMono)       root.style.setProperty('--dr-font-mono',        'ui-monospace, monospace');
  if (!config.fontSizeBase)   root.style.setProperty('--dr-font-size-base',   '1rem');
  if (!config.spacingUnit)    root.style.setProperty('--dr-spacing-unit',     '8px');
  if (!config.borderRadius)   root.style.setProperty('--dr-border-radius',    '8px');
  if (!config.shadowElevation)root.style.setProperty('--dr-shadow',           '0 4px 24px rgba(0,0,0,.35)');
  if (!config.transitionSpeed)root.style.setProperty('--dr-transition-speed', '300ms');
  if (!config.transitionEasing)root.style.setProperty('--dr-transition-ease', 'cubic-bezier(.4,0,.2,1)');

  // Emotion adaptation defaults (overridden by applyEmotionAdaptation)
  root.style.setProperty('--dr-adapt-speed',   '1');
  root.style.setProperty('--dr-adapt-radius',  '1');
  root.style.setProperty('--dr-adapt-shadow',  '1');
  root.style.setProperty('--dr-adapt-sat',     '1');
  root.style.setProperty('--dr-adapt-blur',    '1');
  root.style.setProperty('--dr-adapt-spacing', '1');

  // Custom extra tokens
  for (const [key, val] of Object.entries(config)) {
    if (!(key in CSS_VAR_MAP) && key !== 'theme' && val !== undefined) {
      root.style.setProperty(`--dr-${kebab(key)}`, val);
    }
  }

  return palette;
}

// ── applyEmotionAdaptation ─────────────────────────────────────────────
// Call this inside an effect() that watches the EmotionProcessor state signal.
// Components read --dr-adapt-* via CSS calc() so they respond automatically.
export function applyEmotionAdaptation(emotion: EmotionState): void {
  const a = EMOTION_ADAPTATIONS[emotion];
  const root = document.documentElement;
  root.style.setProperty('--dr-adapt-speed',   String(a.animationSpeed));
  root.style.setProperty('--dr-adapt-radius',  String(a.borderRadius));
  root.style.setProperty('--dr-adapt-shadow',  String(a.shadowIntensity));
  root.style.setProperty('--dr-adapt-sat',     String(a.saturation));
  root.style.setProperty('--dr-adapt-blur',    String(a.blurStrength));
  root.style.setProperty('--dr-adapt-spacing', String(a.spacingScale));
}

// ── useGenome ──────────────────────────────────────────────────────────
export function useGenome(): GenomeConfig {
  if (!_active) throw new Error('[DRISHTI] No genome loaded. Call loadGenome() first.');
  return _active;
}

export function usePalette(): ColorPalette {
  if (!_palette) throw new Error('[DRISHTI] No genome loaded. Call loadGenome() first.');
  return _palette;
}

// ── Preset themes ──────────────────────────────────────────────────────
export const GenomePresets: Record<string, GenomeConfig> = {
  midnight: {
    primaryColor: '#3b82f6',
    accentColor:  '#8b5cf6',
    theme: 'dark',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '10px',
    transitionSpeed: '300ms',
  },
  ocean: {
    primaryColor: '#06b6d4',
    accentColor:  '#0ea5e9',
    theme: 'dark',
    borderRadius: '12px',
    transitionSpeed: '280ms',
  },
  forest: {
    primaryColor: '#10b981',
    accentColor:  '#34d399',
    theme: 'dark',
    borderRadius: '8px',
  },
  sunset: {
    primaryColor: '#f59e0b',
    accentColor:  '#f97316',
    theme: 'dark',
    borderRadius: '14px',
  },
  daylight: {
    primaryColor: '#2563eb',
    accentColor:  '#7c3aed',
    theme: 'light',
    borderRadius: '8px',
    transitionSpeed: '250ms',
  },
};

export function loadGenomePreset(name: keyof typeof GenomePresets): ColorPalette {
  const preset = GenomePresets[name];
  if (!preset) throw new Error(`[DRISHTI] Unknown genome preset: ${name}`);
  return loadGenome(preset);
}

// ── Helpers ────────────────────────────────────────────────────────────

function kebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
