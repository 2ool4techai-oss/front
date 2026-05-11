export interface DeployConfig {
  framework:   'drishti';
  version:     string;
  outputDir:   string;
  entryPoint?: string;
  envVars?:    string[];
}

export interface VercelConfig {
  framework:        string;
  outputDirectory:  string;
  buildCommand:     string;
  installCommand:   string;
  functions?:       Record<string, { memory?: number; maxDuration?: number }>;
}

export interface NetlifyConfig {
  build: { command: string; publish: string };
  functions?: { directory: string };
  redirects?: Array<{ from: string; to: string; status: number }>;
  headers?:   Array<{ for: string; values: Record<string, string> }>;
}

export interface CloudflareConfig {
  name:                string;
  compatibility_date:  string;
  pages?: { build_config: { build_command: string; destination_dir: string } };
  vars?:  Record<string, string>;
}

export function generateVercelConfig(config: DeployConfig): VercelConfig {
  return {
    framework:       'drishti',
    outputDirectory: config.outputDir,
    buildCommand:    'pnpm build',
    installCommand:  'pnpm install',
  };
}

export function generateNetlifyConfig(config: DeployConfig): NetlifyConfig {
  return {
    build: {
      command: 'pnpm build',
      publish: config.outputDir,
    },
    redirects: [
      { from: '/*', to: '/index.html', status: 200 },
    ],
  };
}

export function generateCloudflareConfig(config: DeployConfig): CloudflareConfig {
  const name = config.entryPoint
    ? config.entryPoint.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '')
    : 'drishti-app';
  return {
    name,
    compatibility_date: '2024-01-01',
    pages: {
      build_config: {
        build_command:   'pnpm build',
        destination_dir: config.outputDir,
      },
    },
  };
}

export function generateVercelJson(config: DeployConfig): string {
  return JSON.stringify(generateVercelConfig(config), null, 2);
}

export function generateNetlifyToml(config: DeployConfig): string {
  const cfg = generateNetlifyConfig(config);
  const lines: string[] = [];
  lines.push('[build]');
  lines.push(`  command = "${cfg.build.command}"`);
  lines.push(`  publish = "${cfg.build.publish}"`);
  if (cfg.redirects && cfg.redirects.length > 0) {
    for (const r of cfg.redirects) {
      lines.push('');
      lines.push('[[redirects]]');
      lines.push(`  from = "${r.from}"`);
      lines.push(`  to = "${r.to}"`);
      lines.push(`  status = ${r.status}`);
    }
  }
  return lines.join('\n');
}

export function generateWranglerToml(config: DeployConfig): string {
  const cfg = generateCloudflareConfig(config);
  const lines: string[] = [];
  lines.push(`name = "${cfg.name}"`);
  lines.push(`compatibility_date = "${cfg.compatibility_date}"`);
  if (cfg.pages) {
    lines.push('');
    lines.push('[pages]');
    lines.push('  [pages.build_config]');
    lines.push(`    build_command = "${cfg.pages.build_config.build_command}"`);
    lines.push(`    destination_dir = "${cfg.pages.build_config.destination_dir}"`);
  }
  return lines.join('\n');
}
