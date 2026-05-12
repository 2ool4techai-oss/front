import { signal } from './signal.js';
import type { Signal } from './types.js';

const DEFAULT_DWELL_THRESHOLD = 800;
const DEFAULT_SAMPLE_RATE = 200;
const DEFAULT_MAX_ELEMENTS = 100;

export interface AttentionOptions {
  dwellThreshold?: number;
  sampleRate?: number;
  maxElements?: number;
}

export interface AttentionEntry {
  totalDwell: number;
  visits: number;
  scrollVisibility: number;
  lastSeen: number;
}

export interface AttentionTracker {
  track: (el: HTMLElement, id: string) => () => void;
  attention: (id: string) => AttentionEntry | null;
  topElements: (n?: number) => Array<{ id: string; score: number }>;
  clear: () => void;
}

function score(entry: AttentionEntry): number {
  return (entry.totalDwell / 1000) * 0.6 + entry.visits * 0.3 + entry.scrollVisibility * 0.1;
}

export function createAttentionTracker(opts?: AttentionOptions): AttentionTracker {
  const dwellThreshold = opts?.dwellThreshold ?? DEFAULT_DWELL_THRESHOLD;
  const sampleRate = opts?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const maxElements = opts?.maxElements ?? DEFAULT_MAX_ELEMENTS;

  // Map of id → reactive signal holding the entry
  const entries = new Map<string, Signal<AttentionEntry | null>>();
  // Map of id → raw mutable entry (to avoid creating new objects on every update)
  const rawEntries = new Map<string, AttentionEntry>();

  function getOrCreateSignal(id: string): Signal<AttentionEntry | null> {
    if (!entries.has(id)) {
      entries.set(id, signal<AttentionEntry | null>(null));
    }
    return entries.get(id)!;
  }

  function getOrCreateEntry(id: string): AttentionEntry {
    if (!rawEntries.has(id)) {
      rawEntries.set(id, {
        totalDwell: 0,
        visits: 0,
        scrollVisibility: 0,
        lastSeen: Date.now(),
      });
    }
    return rawEntries.get(id)!;
  }

  function pushUpdate(id: string): void {
    const entry = rawEntries.get(id);
    if (!entry) return;
    const sig = getOrCreateSignal(id);
    sig.set({ ...entry });
  }

  // Scroll visibility tracking state per element
  interface VisibilityState {
    visibleSamples: number;
    totalSamples: number;
    intervalId: ReturnType<typeof setInterval> | null;
    observer: IntersectionObserver | null;
    isVisible: boolean;
  }

  const visibilityState = new Map<string, VisibilityState>();

  function track(el: HTMLElement, id: string): () => void {
    // Enforce maxElements limit
    if (rawEntries.size >= maxElements && !rawEntries.has(id)) {
      // Evict lowest-scoring element
      let lowestId: string | null = null;
      let lowestScore = Infinity;
      for (const [eid, entry] of rawEntries) {
        const s = score(entry);
        if (s < lowestScore) {
          lowestScore = s;
          lowestId = eid;
        }
      }
      if (lowestId) {
        rawEntries.delete(lowestId);
        entries.delete(lowestId);
        visibilityState.delete(lowestId);
      }
    }

    const entry = getOrCreateEntry(id);
    const sig = getOrCreateSignal(id);
    sig.set({ ...entry });

    // Dwell tracking
    let dwellStart: number | null = null;
    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const onEnter = () => {
      dwellStart = Date.now();
      entry.visits += 1;
      entry.lastSeen = Date.now();
      pushUpdate(id);

      // Start accumulating dwell time after threshold
      dwellTimer = setTimeout(() => {
        // Will accumulate on leave or periodically
      }, dwellThreshold);
    };

    const onLeave = () => {
      if (dwellTimer !== null) {
        clearTimeout(dwellTimer);
        dwellTimer = null;
      }
      if (dwellStart !== null) {
        const elapsed = Date.now() - dwellStart;
        if (elapsed >= dwellThreshold) {
          entry.totalDwell += elapsed;
        }
        dwellStart = null;
        entry.lastSeen = Date.now();
        pushUpdate(id);
      }
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    // Scroll visibility via IntersectionObserver + sampling interval
    const vState: VisibilityState = {
      visibleSamples: 0,
      totalSamples: 0,
      intervalId: null,
      observer: null,
      isVisible: false,
    };
    visibilityState.set(id, vState);

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (records) => {
          for (const r of records) {
            vState.isVisible = r.isIntersecting;
          }
        },
        { threshold: 0 },
      );
      observer.observe(el);
      vState.observer = observer;
    }

    vState.intervalId = setInterval(() => {
      vState.totalSamples += 1;
      if (vState.isVisible) vState.visibleSamples += 1;
      if (vState.totalSamples > 0) {
        entry.scrollVisibility = vState.visibleSamples / vState.totalSamples;
        pushUpdate(id);
      }
    }, sampleRate);

    return function cleanup() {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      if (dwellTimer !== null) clearTimeout(dwellTimer);
      if (dwellStart !== null) {
        const elapsed = Date.now() - dwellStart;
        if (elapsed >= dwellThreshold) {
          entry.totalDwell += elapsed;
          pushUpdate(id);
        }
        dwellStart = null;
      }
      const vs = visibilityState.get(id);
      if (vs) {
        if (vs.intervalId !== null) clearInterval(vs.intervalId);
        vs.observer?.disconnect();
        visibilityState.delete(id);
      }
    };
  }

  function attention(id: string): AttentionEntry | null {
    const sig = entries.get(id);
    if (!sig) return null;
    return sig();
  }

  function topElements(n: number = 10): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];
    for (const [id, entry] of rawEntries) {
      results.push({ id, score: score(entry) });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, n);
  }

  function clear(): void {
    // Clean up all visibility state
    for (const [, vs] of visibilityState) {
      if (vs.intervalId !== null) clearInterval(vs.intervalId);
      vs.observer?.disconnect();
    }
    visibilityState.clear();
    rawEntries.clear();
    entries.clear();
  }

  return { track, attention, topElements, clear };
}
