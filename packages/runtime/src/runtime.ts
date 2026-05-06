import { EmotionProcessor } from './emotion.js';
import { HealingMonitor } from './healing.js';
import { ZeroTrustMesh, mesh } from './security.js';
import { connect } from './integration.js';
import { loadGenome, useGenome } from './genome.js';
import { signal, computed, effect, batch } from './signal.js';
import type { SurfaceDef, UnitDef, DrishtiSurface, DrishtiUnit, Signal, EmotionState } from './types.js';

export interface RuntimeConfig {
  debug?: boolean;
  emotionTracking?: boolean;
  healing?: boolean;
  security?: boolean;
}

class DrishtiRuntime {
  private _surfaces = new Set<DrishtiSurface>();
  private _cfg: RuntimeConfig = {};

  configure(cfg: RuntimeConfig): void {
    this._cfg = { ...this._cfg, ...cfg };
  }

  get security(): ZeroTrustMesh { return mesh; }
  get connect() { return connect; }

  createSurface(def: SurfaceDef): SurfaceDef {
    return def;
  }

  createUnit(def: UnitDef): UnitDef {
    return def;
  }

  mount(def: SurfaceDef, container: HTMLElement): DrishtiSurface {
    if (def.secure && !mesh.check(def.secure)) {
      container.innerHTML = '';
      container.setAttribute('data-dr-unauthorized', '');
      const msg = document.createElement('p');
      msg.style.cssText = 'color:#c62828;padding:1rem;font-size:.875rem;';
      msg.textContent = 'Access denied.';
      container.appendChild(msg);
    }

    const surfaceEl = document.createElement('div');
    surfaceEl.setAttribute('data-dr-surface', def.intent ?? 'unnamed');
    if (def.layout) applyLayout(surfaceEl, def.layout);

    const emotion = this._cfg.emotionTracking !== false
      ? new EmotionProcessor(surfaceEl)
      : null;

    const units: DrishtiUnit[] = def.units.map(u => this._mountUnit(u, surfaceEl, emotion?.state ?? null));
    container.appendChild(surfaceEl);

    const surface: DrishtiSurface = {
      def,
      el: surfaceEl,
      units,
      destroy: () => {
        emotion?.destroy();
        units.forEach(u => u.destroy());
        surfaceEl.remove();
        this._surfaces.delete(surface);
      },
    };

    this._surfaces.add(surface);
    return surface;
  }

  private _mountUnit(
    def: UnitDef,
    parent: HTMLElement,
    globalEmotion: Signal<EmotionState> | null,
  ): DrishtiUnit {
    const unitEl = document.createElement('div');
    unitEl.setAttribute('data-dr-unit', def.name);
    if (def.layout) applyLayout(unitEl, def.layout);

    if (def.secure) {
      mesh.enforce(def.secure, unitEl);
    }

    const state = signal<unknown>(null);
    const emotionState = globalEmotion ?? signal<EmotionState>('calm');

    let connector: ReturnType<typeof connect> | null = null;
    if (def.data) {
      connector = connect(def.data.source);
      const unsub = connector.data.subscribe(v => state.set(v));
      const statusUnsub = connector.status.subscribe(s => {
        unitEl.setAttribute('data-dr-status', s);
      });
      if (def.data.realtime) {
        unitEl.setAttribute('data-dr-realtime', '');
      }
      void unsub;
      void statusUnsub;
    }

    const healer = def.heal && this._cfg.healing !== false
      ? new HealingMonitor(def.heal, unitEl)
      : null;

    if (def.feel?.length) {
      effect(() => {
        const emotion = emotionState();
        const matchingFeel = def.feel?.find(f => {
          if (!f.condition) return true;
          return evaluateCondition(f.condition, { state: state() });
        });
        if (matchingFeel) {
          unitEl.setAttribute('data-dr-feel', matchingFeel.emotion);
          applyEmotionClass(unitEl, matchingFeel.emotion);
        }
        applyEmotionClass(unitEl, emotion);
      });
    }

    parent.appendChild(unitEl);

    return {
      def,
      el: unitEl,
      state,
      emotion: emotionState,
      destroy: () => {
        healer?.destroy();
        connector?.destroy();
        unitEl.remove();
      },
    };
  }
}

function applyLayout(el: HTMLElement, layout: { type: string; value?: string }): void {
  const type = layout.type;
  if (type === 'grid') {
    el.style.display = 'grid';
    el.style.gridTemplateColumns = `repeat(${layout.value ?? 'auto-fill'}, minmax(0, 1fr))`;
    el.style.gap = 'var(--dr-spacing-unit, 8px)';
  } else if (type === 'flex') {
    el.style.display = 'flex';
    el.style.gap = 'var(--dr-spacing-unit, 8px)';
  } else if (type === 'stack') {
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = 'var(--dr-spacing-unit, 8px)';
  }
}

function applyEmotionClass(el: HTMLElement, emotion: string): void {
  for (const cls of Array.from(el.classList)) {
    if (cls.startsWith('dr-emotion-')) el.classList.remove(cls);
  }
  el.classList.add(`dr-emotion-${emotion}`);
}

function evaluateCondition(
  condition: { left: string; op: string; right?: string },
  ctx: Record<string, unknown>,
): boolean {
  const left = resolvePath(condition.left, ctx);
  const right = condition.right !== undefined ? resolveValue(condition.right) : undefined;

  switch (condition.op) {
    case 'gt':     return Number(left) > Number(right);
    case 'lt':     return Number(left) < Number(right);
    case 'gte':    return Number(left) >= Number(right);
    case 'lte':    return Number(left) <= Number(right);
    case 'eq':     return left === right;
    case 'neq':    return left !== right;
    case 'truthy': return Boolean(left);
    default:       return false;
  }
}

function resolvePath(path: string, ctx: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function resolveValue(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  if (!isNaN(n)) return n;
  return v;
}

export const drishti = new DrishtiRuntime();

export function createSurface(def: SurfaceDef): SurfaceDef {
  return drishti.createSurface(def);
}

export function createUnit(def: UnitDef): UnitDef {
  return drishti.createUnit(def);
}
