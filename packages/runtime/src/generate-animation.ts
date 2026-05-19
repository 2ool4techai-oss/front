export type AnimationPreset =
  | 'fadeIn' | 'fadeOut'
  | 'slideInLeft' | 'slideInRight' | 'slideInUp' | 'slideInDown'
  | 'bounceIn' | 'pulse' | 'shake' | 'spin'
  | 'zoomIn' | 'zoomOut'
  | 'flipX' | 'flipY';

export interface GenerateAnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  fill?: 'forwards' | 'backwards' | 'both' | 'none';
  iterations?: number;
  ai?: {
    provider: 'anthropic' | 'openai' | 'ollama';
    apiKey?: string;
    model?: string;
  } | false;
}

export interface AnimationResult {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  css: string;
  apply: (element: HTMLElement) => Animation;
}

const PRESETS: Record<AnimationPreset, Keyframe[]> = {
  fadeIn: [{ opacity: 0 }, { opacity: 1 }],
  fadeOut: [{ opacity: 1 }, { opacity: 0 }],
  slideInLeft: [{ transform: 'translateX(-100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
  slideInRight: [{ transform: 'translateX(100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
  slideInUp: [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
  slideInDown: [{ transform: 'translateY(-20px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
  bounceIn: [
    { transform: 'scale(0.3)', opacity: 0 },
    { transform: 'scale(1.05)' },
    { transform: 'scale(0.9)' },
    { transform: 'scale(1)', opacity: 1 },
  ],
  pulse: [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10px)' },
    { transform: 'translateX(10px)' },
    { transform: 'translateX(-10px)' },
    { transform: 'translateX(0)' },
  ],
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  zoomIn: [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
  zoomOut: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }],
  flipX: [
    { transform: 'perspective(400px) rotateY(-90deg)', opacity: 0 },
    { transform: 'perspective(400px) rotateY(0)', opacity: 1 },
  ],
  flipY: [
    { transform: 'perspective(400px) rotateX(-90deg)', opacity: 0 },
    { transform: 'perspective(400px) rotateX(0)', opacity: 1 },
  ],
};

const PRESET_NAMES = Object.keys(PRESETS) as AnimationPreset[];

function isPreset(value: string): value is AnimationPreset {
  return PRESET_NAMES.includes(value as AnimationPreset);
}

function keyframesToCss(name: string, keyframes: Keyframe[]): string {
  const steps = keyframes.map((kf, i) => {
    const pct = keyframes.length === 1 ? '100%' : `${Math.round((i / (keyframes.length - 1)) * 100)}%`;
    const props = Object.entries(kf)
      .filter(([k]) => k !== 'offset' && k !== 'easing' && k !== 'composite')
      .map(([k, v]) => {
        // Convert camelCase to kebab-case
        const prop = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
        return `  ${prop}: ${v};`;
      })
      .join('\n');
    return `  ${pct} {\n${props}\n  }`;
  });
  return `@keyframes ${name} {\n${steps.join('\n')}\n}`;
}

function buildResult(
  preset: AnimationPreset,
  keyframes: Keyframe[],
  opts?: Omit<GenerateAnimationOptions, 'ai'>,
): AnimationResult {
  const duration = opts?.duration ?? 300;
  const easing = opts?.easing ?? 'ease-out';
  const delay = opts?.delay ?? 0;
  const fill = opts?.fill ?? 'none';
  const iterations = opts?.iterations ?? 1;

  const options: KeyframeAnimationOptions = {
    duration,
    easing,
    delay,
    fill,
    iterations,
  };

  const css = keyframesToCss(`drishti-${preset}`, keyframes);

  const apply = (element: HTMLElement): Animation => {
    return element.animate(keyframes, options);
  };

  return { keyframes, options, css, apply };
}

function findClosestPreset(prompt: string): AnimationPreset {
  const lower = prompt.toLowerCase();
  // Score each preset by how many characters of its name appear in the prompt
  let bestPreset: AnimationPreset = 'fadeIn';
  let bestScore = -1;

  for (const name of PRESET_NAMES) {
    const nameLower = name.toLowerCase();
    let score = 0;
    // Check if any word from the preset name appears in the prompt
    const words = nameLower.replace(/([A-Z])/g, ' $1').toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && lower.includes(word)) {
        score += word.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPreset = name;
    }
  }

  return bestPreset;
}

export function generateAnimationSync(
  preset: AnimationPreset,
  opts?: Omit<GenerateAnimationOptions, 'ai'>,
): AnimationResult {
  const keyframes = PRESETS[preset];
  return buildResult(preset, keyframes, opts);
}

export async function generateAnimation(
  prompt: string | AnimationPreset,
  opts?: GenerateAnimationOptions,
): Promise<AnimationResult> {
  if (isPreset(prompt)) {
    return generateAnimationSync(prompt, opts);
  }

  // Natural language prompt
  if (opts?.ai) {
    // AI stub — in a real implementation this would call the provider
    // AI would enhance this with custom keyframes based on the prompt
    const fallbackPreset = findClosestPreset(prompt);
    return generateAnimationSync(fallbackPreset, opts);
  }

  // No AI configured — find closest preset via string matching
  const closest = findClosestPreset(prompt);
  return generateAnimationSync(closest, opts);
}
