export type { AnalysisResult } from './analyzer.js';
export { analyzeProject, analyzeFile } from './analyzer.js';

export type { CodemodResult } from './codemods/react.js';
export { transformReact } from './codemods/react.js';
export { transformVue } from './codemods/vue.js';

export { generateMigrationReport } from './report.js';
