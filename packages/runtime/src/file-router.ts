export interface FileRoute {
  path: string;
  filePath: string;
  params: string[];
  isDynamic: boolean;
  isCatchAll: boolean;
  isLayout: boolean;
  isIndex: boolean;
}

export interface FileRouterOptions {
  baseDir?: string;
  extensions?: string[];
}

export interface FileRouterHandle {
  routes: FileRoute[];
  match(pathname: string): { route: FileRoute; params: Record<string, string> } | null;
  generate(): string;
}

function stripExtension(file: string, extensions: string[]): string {
  for (const ext of extensions) {
    if (file.endsWith(ext)) return file.slice(0, -ext.length);
  }
  return file;
}

function parseFilePath(filePath: string, baseDir: string, extensions: string[]): FileRoute {
  // Normalize: strip baseDir prefix
  let rel = filePath;
  const prefix = baseDir.endsWith('/') ? baseDir : baseDir + '/';
  if (rel.startsWith(prefix)) {
    rel = rel.slice(prefix.length);
  } else if (rel === baseDir) {
    rel = '';
  }

  // Strip extension
  rel = stripExtension(rel, extensions);

  // Detect layout
  const isLayout = rel === '_layout' || rel.endsWith('/_layout');

  // Split into segments
  const segments = rel === '' ? [] : rel.split('/');

  // Detect index
  const lastSeg = segments[segments.length - 1];
  const isIndex = lastSeg === 'index' || segments.length === 0;

  // Build URL path and collect params
  const params: string[] = [];
  let isCatchAll = false;

  const pathSegments: string[] = [];

  for (const seg of segments) {
    if (seg === 'index') {
      // index means no extra segment
      continue;
    }
    if (seg === '_layout') {
      // layout files: path is the parent dir path
      continue;
    }
    const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(seg);
    if (catchAllMatch) {
      isCatchAll = true;
      const paramName = catchAllMatch[1]!;
      params.push(paramName);
      pathSegments.push(`:${paramName}*`);
      continue;
    }
    const dynamicMatch = /^\[(.+)\]$/.exec(seg);
    if (dynamicMatch) {
      const paramName = dynamicMatch[1]!;
      params.push(paramName);
      pathSegments.push(`:${paramName}`);
      continue;
    }
    pathSegments.push(seg);
  }

  const path = '/' + pathSegments.join('/');
  const isDynamic = params.length > 0;

  return {
    path,
    filePath,
    params,
    isDynamic,
    isCatchAll,
    isLayout,
    isIndex,
  };
}

function routeToRegex(route: FileRoute): RegExp {
  if (route.isCatchAll) {
    // e.g. /:slug* should match /anything/nested
    const base = route.path.replace(/:([^/]+)\*$/, '(.+)');
    const escaped = base.replace(/\//g, '\\/').replace(/([.+?^${}()|[\]\\])/g, (m, c) => c === '\\' ? c : `\\${c}`);
    // Actually, let's build the regex properly:
    const prefix = route.path.replace(/\/:([^/]+)\*$/, '');
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escapedPrefix}(?:\\/(.+))?$`);
  }

  const pattern = route.path
    .split('/')
    .map(seg => {
      if (seg.startsWith(':')) return '([^/]+)';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('\\/');

  return new RegExp(`^${pattern}$`);
}

export function createFileRouter(files: string[], opts?: FileRouterOptions): FileRouterHandle {
  const baseDir = opts?.baseDir ?? 'routes';
  const extensions = opts?.extensions ?? ['.ts', '.dr', '.js'];

  const routes: FileRoute[] = files.map(f => parseFilePath(f, baseDir, extensions));

  function match(pathname: string): { route: FileRoute; params: Record<string, string> } | null {
    for (const route of routes) {
      if (route.isLayout) continue;

      const regex = routeToRegex(route);
      const m = regex.exec(pathname);
      if (!m) continue;

      const paramValues = m.slice(1);
      const paramMap: Record<string, string> = {};
      route.params.forEach((p, i) => {
        const val = paramValues[i];
        if (val !== undefined) paramMap[p] = val;
      });

      return { route, params: paramMap };
    }
    return null;
  }

  function generate(): string {
    const serialized = routes.map(r => {
      return `  {
    path: ${JSON.stringify(r.path)},
    filePath: ${JSON.stringify(r.filePath)},
    params: ${JSON.stringify(r.params)},
    isDynamic: ${r.isDynamic},
    isCatchAll: ${r.isCatchAll},
    isLayout: ${r.isLayout},
    isIndex: ${r.isIndex},
  }`;
    });
    return `export const routes = [\n${serialized.join(',\n')}\n];\n`;
  }

  return { routes, match, generate };
}
