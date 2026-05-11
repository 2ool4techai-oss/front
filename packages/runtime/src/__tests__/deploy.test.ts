import { describe, it, expect } from 'vitest';
import {
  generateVercelConfig,
  generateNetlifyConfig,
  generateCloudflareConfig,
  generateVercelJson,
  generateNetlifyToml,
  generateWranglerToml,
} from '../deploy.js';
import type { DeployConfig } from '../deploy.js';

const baseConfig: DeployConfig = {
  framework: 'drishti',
  version: '1.0.0',
  outputDir: 'dist',
};

describe('deploy adapters', () => {
  it('generateVercelConfig returns correct framework', () => {
    const cfg = generateVercelConfig(baseConfig);
    expect(cfg.framework).toBe('drishti');
  });

  it('generateVercelConfig uses outputDir from config', () => {
    const cfg = generateVercelConfig({ ...baseConfig, outputDir: 'build' });
    expect(cfg.outputDirectory).toBe('build');
  });

  it('generateVercelJson returns valid JSON string', () => {
    const json = generateVercelJson(baseConfig);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('parsed vercelJson has buildCommand', () => {
    const json = generateVercelJson(baseConfig);
    const parsed = JSON.parse(json) as { buildCommand: string };
    expect(parsed.buildCommand).toBe('pnpm build');
  });

  it('generateNetlifyConfig has build.publish matching outputDir', () => {
    const cfg = generateNetlifyConfig({ ...baseConfig, outputDir: 'public' });
    expect(cfg.build.publish).toBe('public');
  });

  it('generateNetlifyConfig has SPA redirect', () => {
    const cfg = generateNetlifyConfig(baseConfig);
    expect(cfg.redirects).toBeDefined();
    const spa = cfg.redirects?.find(r => r.from === '/*' && r.to === '/index.html' && r.status === 200);
    expect(spa).toBeDefined();
  });

  it('generateNetlifyToml contains [build] section', () => {
    const toml = generateNetlifyToml(baseConfig);
    expect(toml).toContain('[build]');
    expect(toml).toContain('pnpm build');
  });

  it('generateCloudflareConfig has compatibility_date', () => {
    const cfg = generateCloudflareConfig(baseConfig);
    expect(cfg.compatibility_date).toBe('2024-01-01');
  });

  it('generateWranglerToml contains name field', () => {
    const toml = generateWranglerToml(baseConfig);
    expect(toml).toContain('name =');
  });

  it('generateCloudflareConfig name uses entryPoint', () => {
    const cfg = generateCloudflareConfig({ ...baseConfig, entryPoint: 'my-worker' });
    expect(cfg.name).toBe('my-worker');
  });
});
