import { describe, it, expect } from 'vitest';
import { scaffold } from '../index.js';

describe('scaffold()', () => {
  it('returns a result with files and instructions', () => {
    const result = scaffold({ name: 'my-app' });
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('instructions');
  });

  it('files includes index.html', () => {
    const { files } = scaffold({ name: 'my-app' });
    expect(files).toHaveProperty('index.html');
  });

  it('files includes src/main.ts', () => {
    const { files } = scaffold({ name: 'my-app' });
    expect(files).toHaveProperty('src/main.ts');
  });

  it('files includes package.json', () => {
    const { files } = scaffold({ name: 'my-app' });
    expect(files).toHaveProperty('package.json');
  });

  it("files['package.json'] contains the project name", () => {
    const { files } = scaffold({ name: 'my-cool-project' });
    expect(files['package.json']).toContain('my-cool-project');
  });

  it("files['src/App.ts'] contains signal for todo template", () => {
    const { files } = scaffold({ name: 'my-app', template: 'todo' });
    expect(files['src/App.ts']).toContain('signal');
  });

  it('instructions array has 4 items', () => {
    const { instructions } = scaffold({ name: 'my-app' });
    expect(instructions).toHaveLength(4);
  });

  it("template 'minimal' returns simpler App.ts", () => {
    const { files } = scaffold({ name: 'my-app', template: 'minimal' });
    expect(files['src/App.ts']).toContain('Hello from DRISHTI');
    expect(files['src/App.ts']).not.toContain('TodoMVC');
  });

  it('tsconfig.json is valid JSON', () => {
    const { files } = scaffold({ name: 'my-app' });
    expect(() => JSON.parse(files['tsconfig.json']!)).not.toThrow();
  });

  it("instructions[0] is 'cd {name}'", () => {
    const { instructions } = scaffold({ name: 'test-project' });
    expect(instructions[0]).toBe('cd test-project');
  });
});
