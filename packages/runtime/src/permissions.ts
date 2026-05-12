import { signal, effect } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export type AIAccessLevel = 'read-write' | 'read-only' | 'none' | 'write-only';

export interface SignalPermissions {
  aiAccess?: AIAccessLevel;
  humanAccess?: AIAccessLevel;
  roles?: string[];
  audit?: boolean;
}

export interface WrappedSignal<T> {
  (): T;
  set(v: T): void;
  peek(): T;
  permissions: SignalPermissions;
  canRead(actorId?: string): boolean;
  canWrite(actorId?: string): boolean;
}

// ── Audit log ──────────────────────────────────────────────────────────

export interface AuditEntry {
  ts: number;
  actor: string | null;
  type: 'read' | 'write' | 'denied-read' | 'denied-write';
  value?: unknown;
}

const _auditLog: AuditEntry[] = [];

export function getAuditLog(): readonly AuditEntry[] {
  return _auditLog;
}

export function clearAuditLog(): void {
  _auditLog.length = 0;
}

// ── Global agent context ───────────────────────────────────────────────

let _currentAgent: string | null = null;

export function setAIAgent(agentId: string | null): void {
  _currentAgent = agentId;
}

export function getAIAgent(): string | null {
  return _currentAgent;
}

// ── Access checker helpers ─────────────────────────────────────────────

function resolveLevel(actor: 'ai' | 'human', perms: SignalPermissions): AIAccessLevel {
  return actor === 'ai'
    ? (perms.aiAccess ?? 'read-write')
    : (perms.humanAccess ?? 'read-write');
}

function actorType(): 'ai' | 'human' {
  return _currentAgent !== null ? 'ai' : 'human';
}

function checkRead(perms: SignalPermissions, actorId?: string): boolean {
  const actor = actorId !== undefined
    ? (actorId === _currentAgent ? 'ai' : 'human')
    : actorType();
  const level = resolveLevel(actor, perms);
  return level === 'read-write' || level === 'read-only';
}

function checkWrite(perms: SignalPermissions, actorId?: string): boolean {
  const actor = actorId !== undefined
    ? (actorId === _currentAgent ? 'ai' : 'human')
    : actorType();
  const level = resolveLevel(actor, perms);
  return level === 'read-write' || level === 'write-only';
}

// ── withPermissions ────────────────────────────────────────────────────

export function withPermissions<T>(sig: Signal<T>, perms: SignalPermissions): WrappedSignal<T> {
  const wrapped = Object.assign(
    function (): T {
      if (!checkRead(perms)) {
        if (perms.audit) {
          _auditLog.push({ ts: Date.now(), actor: _currentAgent, type: 'denied-read' });
        }
        throw new PermissionError(`Read access denied for actor "${_currentAgent ?? 'human'}"`);
      }
      if (perms.audit) {
        _auditLog.push({ ts: Date.now(), actor: _currentAgent, type: 'read', value: sig.peek() });
      }
      return sig();
    },
    {
      set(v: T): void {
        if (!checkWrite(perms)) {
          if (perms.audit) {
            _auditLog.push({ ts: Date.now(), actor: _currentAgent, type: 'denied-write', value: v });
          }
          throw new PermissionError(`Write access denied for actor "${_currentAgent ?? 'human'}"`);
        }
        if (perms.audit) {
          _auditLog.push({ ts: Date.now(), actor: _currentAgent, type: 'write', value: v });
        }
        sig.set(v);
      },
      peek(): T {
        return sig.peek();
      },
      permissions: perms,
      canRead(actorId?: string): boolean {
        return checkRead(perms, actorId);
      },
      canWrite(actorId?: string): boolean {
        return checkWrite(perms, actorId);
      },
    },
  ) as WrappedSignal<T>;

  return wrapped;
}

// ── canRead / canWrite (for any wrapped signal) ────────────────────────

export function canRead(sig: any): boolean {
  if (typeof sig?.canRead === 'function') {
    return (sig as WrappedSignal<unknown>).canRead();
  }
  // Plain signal — no restrictions
  return true;
}

export function canWrite(sig: any): boolean {
  if (typeof sig?.canWrite === 'function') {
    return (sig as WrappedSignal<unknown>).canWrite();
  }
  return true;
}

// ── permissionedSignal ─────────────────────────────────────────────────

export function permissionedSignal<T>(initial: T, perms: SignalPermissions): WrappedSignal<T> {
  const sig = signal<T>(initial);
  return withPermissions<T>(sig, perms);
}

// ── PermissionError ────────────────────────────────────────────────────

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}
