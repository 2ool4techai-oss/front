import { describe, it, expect, afterEach } from 'vitest';
import { signal } from '../signal.js';
import { enableTimeTravel } from '../timetravel.js';
import { _setSignalWriteHook } from '../signal.js';

// Clean up the hook after each test
afterEach(() => {
  _setSignalWriteHook(null);
});

describe('enableTimeTravel', () => {
  it('records signal changes', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(1);
    s.set(2);
    expect(tt.history.length).toBe(2);
    expect(tt.history[0]?.prev).toBe(0);
    expect(tt.history[0]?.next).toBe(1);
    expect(tt.history[1]?.prev).toBe(1);
    expect(tt.history[1]?.next).toBe(2);
    tt.destroy();
  });

  it('undo() restores previous value', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(10);
    expect(s.peek()).toBe(10);
    tt.undo();
    expect(s.peek()).toBe(0);
    tt.destroy();
  });

  it('redo() after undo() re-applies the change', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(10);
    tt.undo();
    expect(s.peek()).toBe(0);
    tt.redo();
    expect(s.peek()).toBe(10);
    tt.destroy();
  });

  it('new write after undo truncates redo stack', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(1);
    s.set(2);
    tt.undo(); // back to 1
    s.set(99); // branches off — truncates history[2]
    expect(tt.history.length).toBe(2);
    expect(tt.history[1]?.next).toBe(99);
    expect(tt.canRedo).toBe(false);
    tt.destroy();
  });

  it('pause() stops recording', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    tt.pause();
    s.set(42);
    expect(tt.history.length).toBe(0);
    tt.destroy();
  });

  it('resume() re-enables recording', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    tt.pause();
    s.set(42);
    tt.resume();
    s.set(99);
    expect(tt.history.length).toBe(1);
    expect(tt.history[0]?.next).toBe(99);
    tt.destroy();
  });

  it('goto() jumps to correct state', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(1);
    s.set(2);
    s.set(3);
    // cursor is at 2 (0-indexed), value is 3
    tt.goto(0);
    expect(s.peek()).toBe(1);
    tt.goto(2);
    expect(s.peek()).toBe(3);
    tt.destroy();
  });

  it('clear() empties history', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    s.set(1);
    s.set(2);
    tt.clear();
    expect(tt.history.length).toBe(0);
    expect(tt.cursor).toBe(-1);
    tt.destroy();
  });

  it('respects maxHistory cap', () => {
    const tt = enableTimeTravel({ maxHistory: 5 });
    const s = signal(0);
    for (let i = 1; i <= 10; i++) s.set(i);
    expect(tt.history.length).toBe(5);
    // Should have the most recent 5 entries
    expect(tt.history[4]?.next).toBe(10);
    tt.destroy();
  });

  it('canUndo / canRedo are correct', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    expect(tt.canUndo).toBe(false);
    expect(tt.canRedo).toBe(false);
    s.set(1);
    expect(tt.canUndo).toBe(true); // cursor=0, prev=0 is stored — can restore initial value
    s.set(2);
    expect(tt.canUndo).toBe(true);
    tt.undo();
    expect(tt.canRedo).toBe(true);
    tt.destroy();
  });

  it('destroy() removes the hook', () => {
    const tt = enableTimeTravel();
    const s = signal(0);
    tt.destroy();
    s.set(123);
    expect(tt.history.length).toBe(0);
  });
});
