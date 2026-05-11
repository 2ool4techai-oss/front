import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface AnalysisResult {
  framework: 'react' | 'vue' | 'svelte' | 'angular' | 'unknown';
  version: string | null;
  componentCount: number;
  signalPatterns: number;      // useState/ref/signal usage count
  complexityScore: number;     // 0-100 (higher = harder to migrate)
  estimatedHours: number;
  breakdown: {
    components: number;
    stateUsages: number;
    effectUsages: number;
    routerUsages: number;
    contextUsages: number;
  };
  recommendations: string[];
}

type FileAnalysis = {
  framework: AnalysisResult['framework'];
  componentCount: number;
  stateUsages: number;
  effectUsages: number;
  routerUsages: number;
  contextUsages: number;
  signalPatterns: number;
};

function countMatches(code: string, pattern: RegExp): number {
  const matches = code.match(pattern);
  return matches ? matches.length : 0;
}

function detectFramework(code: string): AnalysisResult['framework'] {
  if (
    /from\s+['"]react['"]/i.test(code) ||
    /require\(['"]react['"]\)/i.test(code)
  ) {
    return 'react';
  }
  if (
    /from\s+['"]vue['"]/i.test(code) ||
    /require\(['"]vue['"]\)/i.test(code)
  ) {
    return 'vue';
  }
  if (
    /from\s+['"]@angular\/core['"]/i.test(code) ||
    /require\(['"]@angular\/core['"]\)/i.test(code)
  ) {
    return 'angular';
  }
  if (
    /from\s+['"]svelte['"]/i.test(code) ||
    /require\(['"]svelte['"]\)/i.test(code) ||
    /\.svelte['"]/.test(code)
  ) {
    return 'svelte';
  }
  return 'unknown';
}

function analyzeCodePatterns(code: string, framework: AnalysisResult['framework']): Omit<FileAnalysis, 'framework' | 'componentCount'> {
  let stateUsages = 0;
  let effectUsages = 0;
  let routerUsages = 0;
  let contextUsages = 0;
  let signalPatterns = 0;

  if (framework === 'react') {
    stateUsages = countMatches(code, /\buseState\s*\(/g);
    effectUsages = countMatches(code, /\buseEffect\s*\(/g);
    contextUsages = countMatches(code, /\buseContext\s*\(/g);
    routerUsages = countMatches(code, /\buseRouter\b|\buseNavigate\b|\buseHistory\b|\bfrom\s+['"]react-router/g);
    signalPatterns = stateUsages + countMatches(code, /\buseRef\s*\(/g);
  } else if (framework === 'vue') {
    stateUsages = countMatches(code, /\bref\s*\(/g);
    effectUsages = countMatches(code, /\bwatch\s*\(|\bonMounted\s*\(/g);
    contextUsages = countMatches(code, /\bprovide\s*\(|\binject\s*\(/g);
    routerUsages = countMatches(code, /\buseRouter\b|\buseRoute\b|\bfrom\s+['"]vue-router/g);
    signalPatterns = stateUsages + countMatches(code, /\bcomputed\s*\(/g);
  } else if (framework === 'svelte') {
    stateUsages = countMatches(code, /\$:/g);
    effectUsages = countMatches(code, /\bonMount\s*\(/g);
    contextUsages = countMatches(code, /\bgetContext\s*\(|\bsetContext\s*\(/g);
    routerUsages = countMatches(code, /from\s+['"]svelte-routing|from\s+['"]@sveltejs\/kit/g);
    signalPatterns = stateUsages + countMatches(code, /\bwritable\s*\(|\breadable\s*\(/g);
  } else if (framework === 'angular') {
    stateUsages = countMatches(code, /\bSignal\b|\bsignal\s*\(|\bBehaviorSubject\b/g);
    effectUsages = countMatches(code, /\bngOnInit\b|\bngAfterViewInit\b/g);
    contextUsages = countMatches(code, /\b@Injectable\b|\bprovideIn\b/g);
    routerUsages = countMatches(code, /\bRouter\b|\bActivatedRoute\b|\bRouterModule\b/g);
    signalPatterns = stateUsages;
  }

  return { stateUsages, effectUsages, routerUsages, contextUsages, signalPatterns };
}

function countComponents(code: string, framework: AnalysisResult['framework'], filename: string): number {
  if (framework === 'react') {
    // Count function components (capitalized function/const declarations)
    const fnComponents = countMatches(code, /(?:function|const)\s+[A-Z][a-zA-Z0-9]*\s*[=(]/g);
    return Math.max(fnComponents, 1);
  }
  if (framework === 'vue') {
    // Vue SFC has one component per file, or count defineComponent calls
    const defineComponents = countMatches(code, /\bdefineComponent\s*\(/g);
    return defineComponents || (filename.endsWith('.vue') ? 1 : 0);
  }
  if (framework === 'svelte') {
    return filename.endsWith('.svelte') ? 1 : 0;
  }
  if (framework === 'angular') {
    return countMatches(code, /\b@Component\s*\(/g);
  }
  return 0;
}

function buildRecommendations(
  framework: AnalysisResult['framework'],
  breakdown: AnalysisResult['breakdown']
): string[] {
  const recs: string[] = [];

  if (framework === 'react') {
    if (breakdown.stateUsages > 0) {
      recs.push(`Convert ${breakdown.stateUsages} useState() call(s) to signal()`);
    }
    if (breakdown.effectUsages > 0) {
      recs.push(`Convert ${breakdown.effectUsages} useEffect() call(s) to effect()`);
    }
    if (breakdown.contextUsages > 0) {
      recs.push(`Replace ${breakdown.contextUsages} useContext() call(s) with Drishti store/provide`);
    }
    if (breakdown.routerUsages > 0) {
      recs.push(`Migrate ${breakdown.routerUsages} router usage(s) to @drishti/router`);
    }
    recs.push('Remove React import — Drishti does not require a runtime import');
    recs.push('Convert JSX components to Drishti Islands manually');
  } else if (framework === 'vue') {
    if (breakdown.stateUsages > 0) {
      recs.push(`Convert ${breakdown.stateUsages} ref() call(s) to signal()`);
    }
    if (breakdown.effectUsages > 0) {
      recs.push(`Convert ${breakdown.effectUsages} watch()/onMounted() call(s) to effect()`);
    }
    if (breakdown.contextUsages > 0) {
      recs.push(`Replace ${breakdown.contextUsages} provide/inject usage(s) with Drishti store`);
    }
    if (breakdown.routerUsages > 0) {
      recs.push(`Migrate ${breakdown.routerUsages} vue-router usage(s) to @drishti/router`);
    }
    recs.push('Replace .value accesses with signal() calls');
    recs.push('Convert Vue SFCs to Drishti component format');
  } else if (framework === 'svelte') {
    recs.push('Convert Svelte reactive declarations ($:) to signal()/computed()');
    recs.push('Migrate Svelte stores to Drishti signals');
    recs.push('Convert Svelte template syntax to Drishti Islands');
  } else if (framework === 'angular') {
    recs.push('Convert Angular services to Drishti stores');
    recs.push('Migrate Angular components to Drishti Islands');
    if (breakdown.routerUsages > 0) {
      recs.push(`Migrate ${breakdown.routerUsages} Angular router usage(s) to @drishti/router`);
    }
  } else {
    recs.push('Framework not detected — manual analysis required');
  }

  return recs;
}

export function analyzeFile(code: string, filename: string): Partial<AnalysisResult> {
  const framework = detectFramework(code);
  const patterns = analyzeCodePatterns(code, framework);
  const componentCount = countComponents(code, framework, filename);

  const breakdown = {
    components: componentCount,
    stateUsages: patterns.stateUsages,
    effectUsages: patterns.effectUsages,
    routerUsages: patterns.routerUsages,
    contextUsages: patterns.contextUsages,
  };

  const rawScore =
    breakdown.stateUsages * 2 +
    breakdown.effectUsages * 3 +
    breakdown.contextUsages * 5 +
    breakdown.routerUsages * 2;
  const complexityScore = Math.min(rawScore, 100);

  const estimatedHours =
    componentCount * 0.5 + patterns.stateUsages * 0.25;

  const recommendations = buildRecommendations(framework, breakdown);

  return {
    framework,
    version: null,
    componentCount,
    signalPatterns: patterns.signalPatterns,
    complexityScore,
    estimatedHours,
    breakdown,
    recommendations,
  };
}

function collectSourceFiles(srcDir: string): string[] {
  const files: string[] = [];
  const supportedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte']);

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
          walk(fullPath);
        }
      } else if (supportedExts.has(extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  walk(srcDir);
  return files;
}

export function analyzeProject(srcDir: string): AnalysisResult {
  const files = collectSourceFiles(srcDir);

  const frameworkCounts: Record<AnalysisResult['framework'], number> = {
    react: 0,
    vue: 0,
    svelte: 0,
    angular: 0,
    unknown: 0,
  };

  let totalComponents = 0;
  let totalStateUsages = 0;
  let totalEffectUsages = 0;
  let totalRouterUsages = 0;
  let totalContextUsages = 0;
  let totalSignalPatterns = 0;

  for (const filePath of files) {
    let code: string;
    try {
      code = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const result = analyzeFile(code, filePath);
    const fw = result.framework ?? 'unknown';
    frameworkCounts[fw]++;

    totalComponents += result.componentCount ?? 0;
    totalSignalPatterns += result.signalPatterns ?? 0;
    if (result.breakdown) {
      totalStateUsages += result.breakdown.stateUsages;
      totalEffectUsages += result.breakdown.effectUsages;
      totalRouterUsages += result.breakdown.routerUsages;
      totalContextUsages += result.breakdown.contextUsages;
    }
  }

  // Determine dominant framework
  let dominantFramework: AnalysisResult['framework'] = 'unknown';
  let maxCount = 0;
  for (const [fw, count] of Object.entries(frameworkCounts) as Array<[AnalysisResult['framework'], number]>) {
    if (fw !== 'unknown' && count > maxCount) {
      maxCount = count;
      dominantFramework = fw;
    }
  }

  const breakdown = {
    components: totalComponents,
    stateUsages: totalStateUsages,
    effectUsages: totalEffectUsages,
    routerUsages: totalRouterUsages,
    contextUsages: totalContextUsages,
  };

  const rawScore =
    totalStateUsages * 2 +
    totalEffectUsages * 3 +
    totalContextUsages * 5 +
    totalRouterUsages * 2;
  const complexityScore = Math.min(rawScore, 100);

  const estimatedHours = totalComponents * 0.5 + totalStateUsages * 0.25;

  const recommendations = buildRecommendations(dominantFramework, breakdown);

  return {
    framework: dominantFramework,
    version: null,
    componentCount: totalComponents,
    signalPatterns: totalSignalPatterns,
    complexityScore,
    estimatedHours,
    breakdown,
    recommendations,
  };
}
