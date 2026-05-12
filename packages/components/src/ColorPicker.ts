import { signal, effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export interface ColorPickerProps {
  value?:    Signal<string>;  // hex color, e.g. '#6366f1'
  format?:   ColorFormat;
  presets?:  string[];
  alpha?:    boolean;
  disabled?: Signal<boolean> | boolean;
  onChange?: (color: string) => void;
  class?:    string;
}

// ── Color math ─────────────────────────────────────────────────────────

interface HSV { h: number; s: number; v: number; a: number; }
interface RGB { r: number; g: number; b: number; a: number; }

function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0,2), 16),
    g: parseInt(full.slice(2,4), 16),
    b: parseInt(full.slice(4,6), 16),
    a: full.length === 8 ? parseInt(full.slice(6,8), 16) / 255 : 1,
  };
}

function rgbToHSV({ r, g, b, a }: RGB): HSV {
  const rn = r/255, gn = g/255, bn = b/255;
  const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn);
  const d   = max - min;
  const v   = max;
  const s   = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s, v, a };
}

function hsvToRGB({ h, s, v, a }: HSV): RGB {
  const hn = h / 360;
  const i  = Math.floor(hn * 6);
  const f  = hn * 6 - i;
  const p  = v * (1 - s);
  const q  = v * (1 - f * s);
  const t  = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255), a };
}

function rgbToHex({ r, g, b, a }: RGB, alpha: boolean): string {
  const hex = '#' + [r,g,b].map(n => n.toString(16).padStart(2,'0')).join('');
  if (alpha && a < 1) return hex + Math.round(a*255).toString(16).padStart(2,'0');
  return hex;
}

function rgbToCSS({ r, g, b, a }: RGB): string {
  return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : `rgb(${r},${g},${b})`;
}

function hsvToHex(hsv: HSV, alpha: boolean): string {
  return rgbToHex(hsvToRGB(hsv), alpha);
}

// ── Styles ─────────────────────────────────────────────────────────────
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done || typeof document === 'undefined') return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
.dr-cp-wrap{position:relative;display:inline-block;font-family:inherit;font-size:13px;}
.dr-cp-swatch{width:32px;height:32px;border-radius:var(--dr-border-radius,8px);border:2px solid var(--dr-border-color,#e2e8f0);cursor:pointer;transition:border .2s;background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0;}
.dr-cp-swatch-inner{width:100%;height:100%;border-radius:calc(var(--dr-border-radius,8px) - 2px);}
.dr-cp-swatch:hover{border-color:var(--dr-primary,#6366f1);}
.dr-cp-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:1000;background:var(--dr-surface,#fff);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,12px);box-shadow:0 8px 32px rgba(0,0,0,.15);padding:14px;width:240px;animation:dr-cp-in .15s ease;}
@keyframes dr-cp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.dr-cp-canvas{width:100%;height:160px;border-radius:var(--dr-border-radius,6px);cursor:crosshair;touch-action:none;}
.dr-cp-pointer{position:absolute;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 2px 4px rgba(0,0,0,.2);transform:translate(-50%,-50%);pointer-events:none;}
.dr-cp-sv{position:relative;margin-bottom:10px;}
.dr-cp-sliders{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;}
.dr-cp-slider-row{display:flex;align-items:center;gap:8px;}
.dr-cp-slider-label{font-size:11px;color:var(--dr-text-muted,#94a3b8);width:14px;text-align:center;}
.dr-cp-slider{flex:1;appearance:none;height:10px;border-radius:99px;cursor:pointer;outline:none;}
.dr-cp-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid rgba(0,0,0,.2);box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer;}
.dr-cp-inputs{display:flex;gap:6px;margin-bottom:10px;}
.dr-cp-hex{flex:1;padding:5px 8px;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,6px);font-size:12px;font-family:monospace;background:var(--dr-surface,#fff);color:inherit;outline:none;}
.dr-cp-hex:focus{border-color:var(--dr-primary,#6366f1);}
.dr-cp-presets{display:flex;flex-wrap:wrap;gap:6px;}
.dr-cp-preset{width:20px;height:20px;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:border .15s,transform .15s;}
.dr-cp-preset:hover{transform:scale(1.2);}
.dr-cp-preset.active{border-color:var(--dr-primary,#6366f1);}
.dr-cp-alpha{background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%);background-size:10px 10px;background-position:0 0,0 5px,5px -5px,-5px 0;border-radius:99px;}
    `;
    document.head.appendChild(s);
  };
})();

// ── ColorPicker ────────────────────────────────────────────────────────
export function ColorPicker(props: ColorPickerProps): HTMLElement {
  injectStyles();

  const initHex  = props.value?.peek() ?? '#6366f1';
  const hsv$     = signal<HSV>(rgbToHSV(hexToRGB(initHex)));
  const open$    = signal(false);
  const disabled$ = typeof props.disabled === 'boolean'
    ? signal(props.disabled) : (props.disabled ?? signal(false));

  const valueSignal = props.value ?? signal(initHex);
  const alpha       = props.alpha ?? false;

  const currentHex = () => hsvToHex(hsv$.peek(), alpha);

  // ── Wrap & swatch ────────────────────────────────────────────────────
  const wrap   = document.createElement('div');
  wrap.className = `dr-cp-wrap${props.class ? ' ' + props.class : ''}`;

  const swatch      = document.createElement('div');
  swatch.className  = 'dr-cp-swatch';
  const swatchInner = document.createElement('div');
  swatchInner.className = 'dr-cp-swatch-inner';
  swatch.appendChild(swatchInner);
  wrap.appendChild(swatch);

  swatch.addEventListener('click', () => {
    if (!disabled$.peek()) open$.set(!open$.peek());
  });

  // ── Panel ─────────────────────────────────────────────────────────────
  let panel: HTMLElement | null = null;

  const buildPanel = (): HTMLElement => {
    const p = document.createElement('div');
    p.className = 'dr-cp-panel';

    // ── SV canvas ───────────────────────────────────────────────────────
    const svWrap = document.createElement('div');
    svWrap.className = 'dr-cp-sv';
    svWrap.style.position = 'relative';

    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvas.className = 'dr-cp-canvas';
    canvas.width  = 220;
    canvas.height = 160;

    const pointer = document.createElement('div');
    pointer.className = 'dr-cp-pointer';
    svWrap.append(canvas, pointer);

    const drawSV = (hue: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      // White to hue gradient (horizontal)
      const gradH = ctx.createLinearGradient(0, 0, w, 0);
      gradH.addColorStop(0, '#fff');
      gradH.addColorStop(1, `hsl(${hue},100%,50%)`);
      ctx.fillStyle = gradH;
      ctx.fillRect(0, 0, w, h);
      // Transparent to black gradient (vertical)
      const gradV = ctx.createLinearGradient(0, 0, 0, h);
      gradV.addColorStop(0, 'transparent');
      gradV.addColorStop(1, '#000');
      ctx.fillStyle = gradV;
      ctx.fillRect(0, 0, w, h);
    };

    const updatePointer = () => {
      const { s, v } = hsv$.peek();
      const cw = canvas.offsetWidth  || canvas.width;
      const ch = canvas.offsetHeight || canvas.height;
      pointer.style.left = `${s * cw}px`;
      pointer.style.top  = `${(1 - v) * ch}px`;
    };

    const onCanvasDrag = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx   = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
      const cy   = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
      const s = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, 1 - (cy - rect.top)  / rect.height));
      hsv$.set({ ...hsv$.peek(), s, v });
      emitChange();
    };

    let draggingSV = false;
    canvas.addEventListener('mousedown', (e) => { draggingSV = true; onCanvasDrag(e); });
    document.addEventListener('mousemove', (e) => { if (draggingSV) onCanvasDrag(e); });
    document.addEventListener('mouseup',   () => { draggingSV = false; });
    canvas.addEventListener('touchstart',  (e) => { e.preventDefault(); onCanvasDrag(e); }, { passive: false });
    canvas.addEventListener('touchmove',   (e) => { e.preventDefault(); onCanvasDrag(e); }, { passive: false });

    p.appendChild(svWrap);

    // ── Sliders ─────────────────────────────────────────────────────────
    const sliders = document.createElement('div');
    sliders.className = 'dr-cp-sliders';

    // Hue slider
    const hueRow = document.createElement('div');
    hueRow.className = 'dr-cp-slider-row';
    const hueLbl = document.createElement('span');
    hueLbl.className = 'dr-cp-slider-label';
    hueLbl.textContent = 'H';
    const hueSlider = document.createElement('input') as HTMLInputElement;
    hueSlider.type = 'range'; hueSlider.min = '0'; hueSlider.max = '360'; hueSlider.step = '1';
    hueSlider.className = 'dr-cp-slider';
    hueSlider.style.background = `linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))`;
    hueSlider.addEventListener('input', () => {
      hsv$.set({ ...hsv$.peek(), h: Number(hueSlider.value) });
      emitChange();
    });
    hueRow.append(hueLbl, hueSlider);
    sliders.appendChild(hueRow);

    // Alpha slider
    let alphaSlider: HTMLInputElement | undefined;
    if (alpha) {
      const aRow = document.createElement('div');
      aRow.className = 'dr-cp-slider-row';
      const aLbl = document.createElement('span');
      aLbl.className = 'dr-cp-slider-label';
      aLbl.textContent = 'A';
      alphaSlider = document.createElement('input') as HTMLInputElement;
      alphaSlider.type = 'range'; alphaSlider.min = '0'; alphaSlider.max = '1'; alphaSlider.step = '0.01';
      alphaSlider.className = 'dr-cp-slider dr-cp-alpha';
      alphaSlider.addEventListener('input', () => {
        hsv$.set({ ...hsv$.peek(), a: Number(alphaSlider!.value) });
        emitChange();
      });
      aRow.append(aLbl, alphaSlider);
      sliders.appendChild(aRow);
    }

    p.appendChild(sliders);

    // ── Hex input ────────────────────────────────────────────────────────
    const inputs = document.createElement('div');
    inputs.className = 'dr-cp-inputs';
    const hexInput = document.createElement('input') as HTMLInputElement;
    hexInput.className = 'dr-cp-hex';
    hexInput.maxLength = alpha ? 9 : 7;
    hexInput.addEventListener('change', () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-f]{3,8}$/i.test(v)) {
        const rgb = hexToRGB(v);
        hsv$.set(rgbToHSV(rgb));
        emitChange();
      }
    });
    inputs.appendChild(hexInput);
    p.appendChild(inputs);

    // ── Presets ──────────────────────────────────────────────────────────
    if (props.presets?.length) {
      const presetsEl = document.createElement('div');
      presetsEl.className = 'dr-cp-presets';
      for (const preset of props.presets) {
        const dot = document.createElement('div');
        dot.className = 'dr-cp-preset';
        dot.style.background = preset;
        dot.title = preset;
        dot.addEventListener('click', () => {
          const rgb = hexToRGB(preset);
          hsv$.set(rgbToHSV(rgb));
          emitChange();
        });
        presetsEl.appendChild(dot);
      }
      p.appendChild(presetsEl);
    }

    // ── Emit change ──────────────────────────────────────────────────────
    const emitChange = () => {
      const hex = currentHex();
      valueSignal.set(hex);
      props.onChange?.(hex);
      syncUI();
    };

    const syncUI = () => {
      const hsv = hsv$.peek();
      drawSV(hsv.h);
      requestAnimationFrame(updatePointer);
      hueSlider.value = String(hsv.h);
      if (alphaSlider) {
        alphaSlider.value = String(hsv.a);
        alphaSlider.style.background = `linear-gradient(to right,transparent,${rgbToCSS(hsvToRGB({...hsv,a:1}))})`;
      }
      hexInput.value = currentHex();
      swatchInner.style.background = currentHex();

      // Update preset active state
      const hex = currentHex();
      p.querySelectorAll('.dr-cp-preset').forEach(el => {
        el.classList.toggle('active', (el as HTMLElement).title === hex);
      });
    };

    // Initial sync
    requestAnimationFrame(syncUI);

    return p;
  };

  // ── Open/close ────────────────────────────────────────────────────────
  const onOutside = (e: MouseEvent) => {
    if (!wrap.contains(e.target as Node)) open$.set(false);
  };

  effect(() => {
    const isOpen = open$();
    if (isOpen) {
      document.addEventListener('mousedown', onOutside);
      panel = buildPanel();
      wrap.appendChild(panel);
    } else {
      document.removeEventListener('mousedown', onOutside);
      panel?.remove();
      panel = null;
    }
  });

  // Sync swatch to external value changes
  effect(() => {
    const hex = valueSignal();
    swatchInner.style.background = hex;
  });

  return wrap;
}
