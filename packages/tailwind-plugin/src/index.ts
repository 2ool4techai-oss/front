// ── Types ──────────────────────────────────────────────────────────────

export interface DrishtiTailwindOptions {
  prefix?: string;   // default '--dr'
  tokens?: boolean;  // default true
}

export interface DrishtiTheme {
  colors:       Record<string, string>;
  fontFamily:   Record<string, string[]>;
  spacing:      Record<string, string>;
  borderRadius: Record<string, string>;
}

// ── getDrishtiTheme ────────────────────────────────────────────────────

export function getDrishtiTheme(_prefix?: string): DrishtiTheme {
  return {
    colors: {
      primary: 'var(--dr-color-primary, #3b82f6)',
      surface: 'var(--dr-color-surface, #0d0d1a)',
      border:  'var(--dr-color-border, rgba(255,255,255,.1))',
      text:    'var(--dr-color-text, #e2e8f0)',
      muted:   'var(--dr-color-text-muted, #64748b)',
    },
    fontFamily: {
      dr: ['var(--dr-font-family)', 'system-ui', 'sans-serif'],
    },
    spacing: {
      'dr-xs': '4px',
      'dr-sm': '8px',
      'dr-md': '16px',
      'dr-lg': '24px',
      'dr-xl': '40px',
    },
    borderRadius: {
      'dr-sm': '4px',
      'dr-md': '8px',
      'dr-lg': '12px',
      'dr-xl': '16px',
    },
  };
}

// ── getDrishtiContentGlobs ─────────────────────────────────────────────

export function getDrishtiContentGlobs(): string[] {
  return ['./src/**/*.dr', './src/**/*.ts', './src/**/*.js'];
}

// ── drishtiTailwindPlugin ──────────────────────────────────────────────

export function drishtiTailwindPlugin(opts?: DrishtiTailwindOptions): {
  handler: () => void;
  config?: Record<string, unknown>;
} {
  return {
    handler: () => {},
    config: {
      theme: {
        extend: getDrishtiTheme(opts?.prefix),
      },
    },
  };
}
