import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runDoctor } from '../doctor.js';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('runDoctor', () => {
  it('returns checks array', () => {
    const result = runDoctor('/nonexistent-dir-xyz');
    expect(Array.isArray(result.checks)).toBe(true);
  });

  it('score is 0-100', () => {
    const result = runDoctor('/nonexistent-dir-xyz');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('each check has name, status, message', () => {
    const result = runDoctor('/nonexistent-dir-xyz');
    for (const check of result.checks) {
      expect(typeof check.name).toBe('string');
      expect(['pass', 'warn', 'fail']).toContain(check.status);
      expect(typeof check.message).toBe('string');
    }
  });

  it('summary string is non-empty', () => {
    const result = runDoctor('/nonexistent-dir-xyz');
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('returns failing checks for empty dir', () => {
    const result = runDoctor('/nonexistent-dir-xyz');
    const hasFail = result.checks.some(c => c.status === 'fail' || c.status === 'warn');
    expect(hasFail).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  describe('with a fully populated project dir', () => {
    let tmpDir: string;

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'drishti-doctor-test-'));

      // Create tsconfig.json
      writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

      // Create package.json with type: module, @nexoraaidrishti/runtime dep, test script
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        type: 'module',
        dependencies: { '@nexoraaidrishti/runtime': '^0.1.0' },
        scripts: { test: 'vitest run' },
      }));

      // Create dist/
      mkdirSync(join(tmpDir, 'dist'), { recursive: true });

      // Create README.md
      writeFileSync(join(tmpDir, 'README.md'), '# Test Project\n');
    });

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('score is 100 when all checks pass', () => {
      const result = runDoctor(tmpDir);
      expect(result.score).toBe(100);
    });

    it('all checks have status pass', () => {
      const result = runDoctor(tmpDir);
      for (const check of result.checks) {
        expect(check.status).toBe('pass');
      }
    });
  });
});
