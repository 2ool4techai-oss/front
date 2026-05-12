import { signal, computed } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface PredictiveOptions {
  threshold?: number;     // confidence threshold 0-1, default 0.6
  maxPrefetch?: number;   // max routes to prefetch
  /** Called each time the router navigates to a new route */
  onNavigate?: (route: string) => void;
}

export interface PredictiveRouter {
  /** Reactive signal of the current route string */
  current: Signal<string>;
  /** Alias for current() — returns current route string */
  currentRoute: () => string;
  navigate: (route: string) => void;
  /** Manually trigger prefetch for a route */
  prefetch: (route: string) => void;
  predictions: ComputedSignal<Array<{ route: string; confidence: number }>>;
  prefetched: Signal<string[]>;
}

// ── Scoring ────────────────────────────────────────────────────────────

interface HistoryEntry {
  route: string;
  t: number;
}

interface RouteStats {
  count: number;
  lastVisit: number;
  transitions: Map<string, number>; // from this route → next route counts
}

function computePredictions(
  history: HistoryEntry[],
  stats: Map<string, RouteStats>,
  currentRoute: string,
  threshold: number,
): Array<{ route: string; confidence: number }> {
  const totalVisits = history.length;
  if (totalVisits === 0) return [];

  const now = Date.now();
  const allRoutes = Array.from(stats.keys()).filter(r => r !== currentRoute);
  if (allRoutes.length === 0) return [];

  const currentStats = stats.get(currentRoute);
  const totalTransitions = currentStats
    ? Array.from(currentStats.transitions.values()).reduce((s, c) => s + c, 0)
    : 0;

  const scores: Array<{ route: string; confidence: number }> = [];

  for (const route of allRoutes) {
    // Transition probability from current → candidate
    const transCount = currentStats?.transitions.get(route) ?? 0;
    const transProb = totalTransitions > 0 ? transCount / totalTransitions : 0;

    // Global frequency
    const routeStats = stats.get(route);
    const globalFreq = routeStats ? routeStats.count / Math.max(totalVisits, 1) : 0;

    // Recency factor (0–1, exponential decay over 5 minutes)
    const lastVisit = routeStats?.lastVisit ?? 0;
    const ageMs = now - lastVisit;
    const recencyFactor = lastVisit > 0 ? Math.exp(-ageMs / (5 * 60 * 1000)) : 0;

    // Blend: 60% transition, 30% global frequency, 10% recency
    const confidence = transProb * 0.6 + globalFreq * 0.3 + recencyFactor * 0.1;

    if (confidence >= threshold) {
      scores.push({ route, confidence });
    }
  }

  return scores.sort((a, b) => b.confidence - a.confidence);
}

// ── createPredictiveRouter ─────────────────────────────────────────────

export function createPredictiveRouter(opts: PredictiveOptions = {}): PredictiveRouter {
  const threshold   = opts.threshold   ?? 0.6;
  const maxPrefetch = opts.maxPrefetch ?? 3;

  // Navigation history and per-route stats
  const history: HistoryEntry[] = [];
  const stats    = new Map<string, RouteStats>();

  // Prefetch cache — routes pre-rendered or pre-loaded
  const _prefetched = new Set<string>();

  // Signals
  const current    = signal<string>('');
  const prefetched = signal<string[]>([]);

  function ensureStats(route: string): RouteStats {
    if (!stats.has(route)) {
      stats.set(route, { count: 0, lastVisit: 0, transitions: new Map() });
    }
    return stats.get(route)!;
  }

  function recordVisit(from: string | null, to: string): void {
    history.push({ route: to, t: Date.now() });

    // Bound history at 200 entries
    if (history.length > 200) history.shift();

    const toStats   = ensureStats(to);
    toStats.count++;
    toStats.lastVisit = Date.now();

    if (from !== null && from !== '') {
      const fromStats = ensureStats(from);
      fromStats.transitions.set(to, (fromStats.transitions.get(to) ?? 0) + 1);
    }
  }

  function doPrefetch(route: string): void {
    if (!_prefetched.has(route)) {
      _prefetched.add(route);
      prefetched.set(Array.from(_prefetched));
    }
  }

  function triggerPrefetch(cur: string): void {
    const preds = computePredictions(history, stats, cur, threshold);
    preds.slice(0, maxPrefetch).forEach(p => doPrefetch(p.route));
  }

  // Computed predictions — re-derived when current changes
  const predictions = computed<Array<{ route: string; confidence: number }>>(() => {
    const cur = current();
    return computePredictions(history, stats, cur, threshold);
  });

  function navigate(route: string): void {
    const from = current.peek();
    if (from === route) return; // already here

    recordVisit(from || null, route);
    current.set(route);

    if (opts.onNavigate) {
      opts.onNavigate(route);
    }

    // Trigger prefetch of predicted next routes
    triggerPrefetch(route);
  }

  function prefetch(route: string): void {
    doPrefetch(route);
  }

  return {
    current,
    currentRoute: () => current(),
    navigate,
    prefetch,
    predictions,
    prefetched,
  };
}
