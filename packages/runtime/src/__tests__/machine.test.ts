import { describe, it, expect, vi } from 'vitest';
import { createMachine } from '../machine.js';

type TrafficState = 'green' | 'yellow' | 'red';
type TrafficEvent = 'NEXT' | 'RESET';

function makeTrafficMachine() {
  return createMachine<TrafficState, TrafficEvent>({
    initial: 'green',
    states: {
      green:  { on: { NEXT: 'yellow', RESET: 'green' } },
      yellow: { on: { NEXT: 'red',    RESET: 'green' } },
      red:    { on: { NEXT: 'green',  RESET: 'green' } },
    },
  });
}

describe('createMachine', () => {
  it('starts in the initial state', () => {
    const m = makeTrafficMachine();
    expect(m.state()).toBe('green');
  });

  it('transitions on send()', () => {
    const m = makeTrafficMachine();
    m.send('NEXT');
    expect(m.state()).toBe('yellow');
    m.send('NEXT');
    expect(m.state()).toBe('red');
  });

  it('can() returns true for valid events', () => {
    const m = makeTrafficMachine();
    expect(m.can('NEXT')).toBe(true);
    expect(m.can('RESET')).toBe(true);
  });

  it('can() returns false when event not defined in current state', () => {
    const m = createMachine<'a' | 'b', 'GO'>({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: { on: {} },
      },
    });
    m.send('GO');
    expect(m.can('GO')).toBe(false);
  });

  it('ignores unknown events silently', () => {
    const m = makeTrafficMachine();
    // @ts-expect-error — intentional unknown event
    m.send('UNKNOWN');
    expect(m.state()).toBe('green');
  });

  it('records history entries', () => {
    const m = makeTrafficMachine();
    m.send('NEXT');
    m.send('NEXT');
    expect(m.history.length).toBe(2);
    expect(m.history[0]).toMatchObject({ from: 'green', event: 'NEXT', to: 'yellow' });
    expect(m.history[1]).toMatchObject({ from: 'yellow', event: 'NEXT', to: 'red' });
  });

  it('reset() returns to initial state and clears history', () => {
    const m = makeTrafficMachine();
    m.send('NEXT');
    m.send('NEXT');
    m.reset();
    expect(m.state()).toBe('green');
    expect(m.history.length).toBe(0);
  });

  it('done is false for non-final states', () => {
    const m = makeTrafficMachine();
    expect(m.done()).toBe(false);
  });

  it('done is true for final state', () => {
    type S = 'idle' | 'done';
    type E = 'FINISH';
    const m = createMachine<S, E>({
      initial: 'idle',
      states: {
        idle: { on: { FINISH: 'done' } },
        done: { type: 'final' },
      },
    });
    expect(m.done()).toBe(false);
    m.send('FINISH');
    expect(m.done()).toBe(true);
  });

  it('calls entry action on initial state', () => {
    const entry = vi.fn();
    createMachine<'a', never>({
      initial: 'a',
      states: { a: { entry } },
    });
    expect(entry).toHaveBeenCalledOnce();
  });

  it('calls exit and entry hooks on transition', () => {
    const exitGreen  = vi.fn();
    const entryYellow = vi.fn();
    const m = createMachine<'green' | 'yellow', 'NEXT'>({
      initial: 'green',
      states: {
        green:  { on: { NEXT: 'yellow' }, exit: exitGreen },
        yellow: { entry: entryYellow },
      },
    });
    m.send('NEXT');
    expect(exitGreen).toHaveBeenCalledOnce();
    expect(entryYellow).toHaveBeenCalledOnce();
  });

  it('applies context action on transition', () => {
    type Ctx = { count: number };
    const m = createMachine<'a' | 'b', 'INC', Ctx>({
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            INC: {
              target: 'b',
              action: (ctx) => ({ count: ctx.count + 1 }),
            },
          },
        },
        b: {},
      },
    });
    m.send('INC');
    expect(m.context().count).toBe(1);
  });

  it('history timestamp is a number close to Date.now()', () => {
    const before = Date.now();
    const m = makeTrafficMachine();
    m.send('NEXT');
    const after = Date.now();
    const entry = m.history[0]!;
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });
});
