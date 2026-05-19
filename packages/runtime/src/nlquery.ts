import { signal, computed, effect } from './signal.js';
import type { Signal, ComputedSignal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

// Use distinct names to avoid conflict with query.ts exports
export interface NLQueryResult<T> {
  data: () => T[];
  loading: () => boolean;
  error: () => string | null;
  refresh: () => void;
}

export interface NLQueryOptions {
  signals?: Record<string, any>;
  apiKey?: string;
}

// ── Global registry ────────────────────────────────────────────────────

interface RegistryEntry {
  signal: any;
  schema?: object;
}

const _queryRegistry = new Map<string, RegistryEntry>();

export function registerQueryable(name: string, sig: any, schema?: object): void {
  _queryRegistry.set(name, { signal: sig, ...(schema !== undefined ? { schema } : {}) });
}

export function getQueryRegistry(): Map<string, RegistryEntry> {
  return _queryRegistry;
}

// ── Local query engine ─────────────────────────────────────────────────

type Primitive = string | number | boolean | Date | null | undefined;

function getFieldValue(item: unknown, key: string): Primitive {
  if (item === null || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;
  // Support nested paths like "user.name"
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur as Primitive;
}

function parseNLDate(text: string): { start: Date; end: Date } | null {
  const now = new Date();
  const lower = text.toLowerCase();

  if (/this\s+month/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }
  if (/last\s+month/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end };
  }
  if (/this\s+week/.test(lower)) {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (/last\s+week/.test(lower)) {
    const day = now.getDay();
    const end = new Date(now);
    end.setDate(now.getDate() - day - 1);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (/today/.test(lower)) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (/yesterday/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

interface ParsedFilter {
  type: 'comparison' | 'date-range' | 'string-match' | 'boolean' | 'null-check';
  field?: string;
  op?: '<' | '>' | '<=' | '>=' | '==' | '!=';
  value?: number | string | boolean;
  dateRange?: { start: Date; end: Date };
  negate?: boolean;
}

function parseNLQuery(description: string): ParsedFilter[] {
  const filters: ParsedFilter[] = [];
  const lower = description.toLowerCase();

  // Numeric comparisons: "stock below 10", "price above 100", "age greater than 18"
  const numericPatterns: Array<{ re: RegExp; op: '<' | '>' | '<=' | '>=' | '==' }> = [
    { re: /(\w+)\s+(?:below|less\s+than|under|<)\s+([\d.]+)/i, op: '<' },
    { re: /(\w+)\s+(?:above|greater\s+than|over|more\s+than|>)\s+([\d.]+)/i, op: '>' },
    { re: /(\w+)\s+(?:at\s+most|<=|no\s+more\s+than)\s+([\d.]+)/i, op: '<=' },
    { re: /(\w+)\s+(?:at\s+least|>=|no\s+less\s+than)\s+([\d.]+)/i, op: '>=' },
    { re: /(\w+)\s+(?:equal(?:s)?\s+to|==|is\s+exactly)\s+([\d.]+)/i, op: '==' },
  ];

  for (const { re, op } of numericPatterns) {
    const m = lower.match(re);
    if (m && m[1] && m[2]) {
      filters.push({ type: 'comparison', field: m[1], op, value: parseFloat(m[2]) });
    }
  }

  // Date range patterns: "signed up last week", "created this month"
  const dateRangeTriggers = /(?:signed?\s+up|created|added|registered|joined|updated)\s+(this\s+week|last\s+week|this\s+month|last\s+month|today|yesterday)/i;
  const dateMatch = lower.match(dateRangeTriggers);
  if (dateMatch && dateMatch[1]) {
    const dateRange = parseNLDate(dateMatch[1]);
    if (dateRange) {
      // Guess the date field name
      const fieldGuess = lower.includes('signed') ? 'signedUpAt'
        : lower.includes('created') ? 'createdAt'
        : lower.includes('registered') ? 'registeredAt'
        : lower.includes('joined') ? 'joinedAt'
        : lower.includes('updated') ? 'updatedAt'
        : 'createdAt';
      filters.push({ type: 'date-range', field: fieldGuess, dateRange });
    }
  }

  // Boolean / status patterns: "unpaid", "paid", "active", "inactive", "pending", "overdue"
  const boolPatterns: Array<{ re: RegExp; field: string; value: boolean | string; negate?: boolean }> = [
    { re: /\bunpaid\b/, field: 'paid', value: false },
    { re: /\bpaid\b/, field: 'paid', value: true },
    { re: /\bactive\b/, field: 'active', value: true },
    { re: /\binactive\b/, field: 'active', value: false },
    { re: /\bpending\b/, field: 'status', value: 'pending' },
    { re: /\boverdue\b/, field: 'status', value: 'overdue' },
    { re: /\bcancelled?\b/, field: 'status', value: 'cancelled' },
    { re: /\bcompleted?\b/, field: 'status', value: 'completed' },
    { re: /\bin\s+stock\b/, field: 'inStock', value: true },
    { re: /\bout\s+of\s+stock\b/, field: 'inStock', value: false },
  ];

  for (const { re, field, value, negate } of boolPatterns) {
    if (re.test(lower)) {
      if (typeof value === 'boolean') {
        filters.push({ type: 'boolean', field, value, negate: negate ?? false });
      } else {
        filters.push({ type: 'string-match', field, value: value as string });
      }
    }
  }

  // String search: "with tag X", "named X", "category X"
  const stringPatterns = [
    { re: /\bwith\s+(?:tag|label)\s+["']?(\w+)["']?/i, field: 'tag' },
    { re: /\bcategor(?:y|ized\s+as)\s+["']?(\w+)["']?/i, field: 'category' },
    { re: /\bnamed?\s+["']?(\w+)["']?/i, field: 'name' },
  ];

  for (const { re, field } of stringPatterns) {
    const m = lower.match(re);
    if (m && m[1]) {
      filters.push({ type: 'string-match', field, value: m[1] });
    }
  }

  return filters;
}

function applyFilter<T>(item: T, filter: ParsedFilter): boolean {
  if (!filter.field) return true;

  const val = getFieldValue(item, filter.field);

  switch (filter.type) {
    case 'comparison': {
      const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : NaN);
      if (isNaN(num)) return true; // Skip if field not numeric
      const threshold = filter.value as number;
      switch (filter.op) {
        case '<':  return num < threshold;
        case '>':  return num > threshold;
        case '<=': return num <= threshold;
        case '>=': return num >= threshold;
        case '==': return num === threshold;
        case '!=': return num !== threshold;
      }
      return true;
    }

    case 'date-range': {
      if (!filter.dateRange) return true;
      let date: Date | null = null;
      if (val instanceof Date) {
        date = val;
      } else if (typeof val === 'string' || typeof val === 'number') {
        date = new Date(val);
      }
      if (!date || isNaN(date.getTime())) return true;
      return date >= filter.dateRange.start && date <= filter.dateRange.end;
    }

    case 'boolean': {
      if (filter.negate) return val !== filter.value;
      return val === filter.value || (filter.value === true && !!val) || (filter.value === false && !val);
    }

    case 'string-match': {
      if (typeof val !== 'string') return false;
      return val.toLowerCase() === String(filter.value).toLowerCase();
    }

    case 'null-check': {
      return filter.negate ? val != null : val == null;
    }
  }
}

export function queryLocally<T>(data: T[], nlDescription: string): T[] {
  if (!nlDescription.trim()) return data;
  const filters = parseNLQuery(nlDescription);
  if (filters.length === 0) return data;
  return data.filter(item => filters.every(f => applyFilter(item, f)));
}

// ── drQuery ────────────────────────────────────────────────────────────

export function drQuery<T = unknown>(
  description: string,
  opts?: NLQueryOptions,
): NLQueryResult<T> {
  const _data    = signal<T[]>([]);
  const _loading = signal(false);
  const _error   = signal<string | null>(null);

  const run = async (): Promise<void> => {
    _loading.set(true);
    _error.set(null);

    try {
      // Collect all data from registered signals + passed signals
      const allSources: Record<string, any[]> = {};

      for (const [name, entry] of _queryRegistry) {
        const sig = entry.signal;
        const raw = typeof sig === 'function' ? sig() : sig;
        if (Array.isArray(raw)) {
          allSources[name] = raw;
        }
      }

      if (opts?.signals) {
        for (const [name, sig] of Object.entries(opts.signals)) {
          const raw = typeof sig === 'function' ? sig() : sig;
          if (Array.isArray(raw)) {
            allSources[name] = raw;
          }
        }
      }

      // Attempt API-powered query first
      if (opts?.apiKey && Object.keys(allSources).length > 0) {
        try {
          const result = await apiQuery<T>(description, allSources, opts.apiKey);
          _data.set(result);
          _loading.set(false);
          return;
        } catch {
          // Fall through to local query
        }
      }

      // Local query: combine all arrays, run nl query
      const combined: T[] = Object.values(allSources).flat() as T[];
      const result = queryLocally<T>(combined, description);
      _data.set(result);
    } catch (e) {
      _error.set(String(e));
    } finally {
      _loading.set(false);
    }
  };

  // Run immediately
  run();

  return {
    data: _data,
    loading: _loading,
    error: _error,
    refresh: run,
  };
}

// ── API-powered query helper ───────────────────────────────────────────

async function apiQuery<T>(
  description: string,
  sources: Record<string, unknown[]>,
  apiKey: string,
): Promise<T[]> {
  const prompt = `You are a data query assistant. Given this dataset and a natural-language query, return matching items as a JSON array.

Dataset:
${JSON.stringify(sources, null, 2)}

Query: "${description}"

Respond ONLY with a JSON array of matching items from the dataset. No explanation, no markdown.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content?.[0]?.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]) as T[];
}
