import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, formatHelp, formatVersion, runCLI, COMMANDS } from '../cli.js';

describe('parseArgs', () => {
  it('extracts command', () => {
    const result = parseArgs(['build']);
    expect(result.command).toBe('build');
  });

  it('extracts flags (--from react → { from: "react" })', () => {
    const result = parseArgs(['migrate', '--from', 'react']);
    expect(result.flags['from']).toBe('react');
  });

  it('extracts positional args', () => {
    const result = parseArgs(['new', 'my-project']);
    expect(result.positional).toEqual(['my-project']);
  });

  it('handles --flag=value syntax', () => {
    const result = parseArgs(['migrate', '--from=react']);
    expect(result.flags['from']).toBe('react');
  });

  it('handles boolean flags (--verbose)', () => {
    const result = parseArgs(['build', '--verbose']);
    expect(result.flags['verbose']).toBe(true);
  });

  it('handles empty args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('');
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });
});

describe('formatHelp', () => {
  it('contains all command names', () => {
    const help = formatHelp();
    for (const cmd of COMMANDS) {
      expect(help).toContain(cmd.name);
    }
  });

  it('contains descriptions', () => {
    const help = formatHelp();
    for (const cmd of COMMANDS) {
      expect(help).toContain(cmd.description);
    }
  });

  it('returns a non-empty string', () => {
    const help = formatHelp();
    expect(typeof help).toBe('string');
    expect(help.length).toBeGreaterThan(0);
  });
});

describe('formatVersion', () => {
  it('returns semver string', () => {
    const version = formatVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns 0.1.0', () => {
    expect(formatVersion()).toBe('0.1.0');
  });
});

describe('COMMANDS', () => {
  it('has all 11 commands', () => {
    expect(COMMANDS).toHaveLength(11);
  });

  it('includes all expected command names', () => {
    const names = COMMANDS.map(c => c.name);
    const expected = ['new', 'add', 'build', 'dev', 'preview', 'analyze', 'migrate', 'doctor', 'test', 'version', 'help'];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});

describe('runCLI', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("with 'help' doesn't throw", () => {
    expect(() => runCLI(['help'])).not.toThrow();
  });

  it("with 'version' doesn't throw", () => {
    expect(() => runCLI(['version'])).not.toThrow();
  });

  it('with unknown command doesn\'t throw', () => {
    expect(() => runCLI(['unknown-command-xyz'])).not.toThrow();
  });

  it('with no args prints help', () => {
    runCLI([]);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
