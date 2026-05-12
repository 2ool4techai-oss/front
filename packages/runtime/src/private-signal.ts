/**
 * private-signal.ts
 * PII-aware signals. Auto-redacts sensitive fields when value would enter an LLM prompt,
 * audit trail, or serialization. GDPR + AI safety in one primitive.
 */

import { signal } from './signal.js';

export type PIICategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'dob'
  | 'address'
  | 'financial'
  | 'health'
  | 'custom';

export interface PrivateSignalOptions<T> {
  category: PIICategory;
  redact?: (value: T) => string;
  allowedContexts?: string[];
  audit?: boolean;
}

export interface PrivateSignal<T> {
  (): T;
  set: (v: T) => void;
  peek: () => T;
  redacted: () => string;
  inContext: (ctx: string) => T | string;
  category: PIICategory;
}

// ── Internal registry ─────────────────────────────────────────────────────

const _privateSignalSet = new Set<PrivateSignal<unknown>>();
const _PRIVATE_BRAND = Symbol('drishti.private');

interface BrandedPrivateSignal<T> extends PrivateSignal<T> {
  [_PRIVATE_BRAND]: true;
}

export function isPrivateSignal(s: unknown): s is PrivateSignal<unknown> {
  return (
    typeof s === 'function' &&
    (s as BrandedPrivateSignal<unknown>)[_PRIVATE_BRAND] === true
  );
}

export function markAsPrivate(sig: PrivateSignal<unknown>): void {
  _privateSignalSet.add(sig);
}

export function getPrivateSignals(): Set<PrivateSignal<unknown>> {
  return new Set(_privateSignalSet);
}

// ── Audit log ─────────────────────────────────────────────────────────────

interface PrivateAuditEntry {
  ts: number;
  category: PIICategory;
  action: 'read' | 'redacted-read' | 'context-read' | 'context-denied' | 'write';
  context?: string;
}

const _auditLog: PrivateAuditEntry[] = [];

export function getPrivateAuditLog(): readonly PrivateAuditEntry[] {
  return _auditLog;
}

export function clearPrivateAuditLog(): void {
  _auditLog.length = 0;
}

// ── Factory ────────────────────────────────────────────────────────────────

export function privateSignal<T>(
  initial: T,
  opts: PrivateSignalOptions<T>,
): PrivateSignal<T> {
  const inner = signal<T>(initial);
  const allowedContexts = new Set(opts.allowedContexts ?? []);

  const defaultRedact = (_v: T): string => '***REDACTED***';
  const doRedact = opts.redact ?? defaultRedact;

  const sig = Object.assign(
    function (): T {
      if (opts.audit) {
        _auditLog.push({ ts: Date.now(), category: opts.category, action: 'read' });
      }
      return inner();
    },
    {
      set(v: T): void {
        if (opts.audit) {
          _auditLog.push({ ts: Date.now(), category: opts.category, action: 'write' });
        }
        inner.set(v);
      },

      peek(): T {
        return inner.peek();
      },

      redacted(): string {
        if (opts.audit) {
          _auditLog.push({
            ts: Date.now(),
            category: opts.category,
            action: 'redacted-read',
          });
        }
        return doRedact(inner.peek());
      },

      inContext(ctx: string): T | string {
        if (allowedContexts.has(ctx)) {
          if (opts.audit) {
            _auditLog.push({
              ts: Date.now(),
              category: opts.category,
              action: 'context-read',
              context: ctx,
            });
          }
          return inner.peek();
        }
        if (opts.audit) {
          _auditLog.push({
            ts: Date.now(),
            category: opts.category,
            action: 'context-denied',
            context: ctx,
          });
        }
        return doRedact(inner.peek());
      },

      category: opts.category,

      [_PRIVATE_BRAND]: true as const,
    },
  ) as BrandedPrivateSignal<T>;

  // Auto-register in the private signal set
  _privateSignalSet.add(sig as unknown as PrivateSignal<unknown>);

  return sig;
}
