export interface GenomeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  fontSizeBase: string;
  spacingUnit: string;
  borderRadius: string;
  shadowElevation: string;
  transitionSpeed: string;
  transitionEasing: string;
  [key: string]: string;
}

const CSS_VAR_MAP: Record<string, string> = {
  primaryColor:    '--dr-color-primary',
  secondaryColor:  '--dr-color-secondary',
  accentColor:     '--dr-color-accent',
  fontFamily:      '--dr-font-family',
  fontSizeBase:    '--dr-font-size-base',
  spacingUnit:     '--dr-spacing-unit',
  borderRadius:    '--dr-border-radius',
  shadowElevation: '--dr-shadow',
  transitionSpeed: '--dr-transition-speed',
  transitionEasing:'--dr-transition-ease',
};

let _active: GenomeConfig | null = null;

export function loadGenome(config: GenomeConfig): void {
  _active = config;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const val = config[key];
    if (val !== undefined) root.style.setProperty(cssVar, val);
  }
  for (const [key, val] of Object.entries(config)) {
    if (!(key in CSS_VAR_MAP)) {
      root.style.setProperty(`--dr-${kebab(key)}`, val);
    }
  }
}

export function useGenome(): GenomeConfig {
  if (!_active) throw new Error('[DRISHTI] No genome loaded. Call loadGenome() first.');
  return _active;
}

function kebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
