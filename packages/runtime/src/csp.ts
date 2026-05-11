export interface CSPDirectives {
  defaultSrc:  string[];
  scriptSrc:   string[];
  styleSrc:    string[];
  imgSrc:      string[];
  connectSrc:  string[];
  fontSrc:     string[];
  frameSrc:    string[];
  reportUri:   string;
}

export interface CSPOptions {
  nonce?:      string;
  reportUri?:  string;
  directives?: Partial<CSPDirectives>;
}

export interface CSPHandle {
  getNonce(): string;
  generateNonce(): string;
  buildHeader(): string;
  buildMetaTag(): string;
  injectNonce(el: HTMLElement): void;
}

const directiveKeyMap: Record<string, string> = {
  defaultSrc:  'default-src',
  scriptSrc:   'script-src',
  styleSrc:    'style-src',
  imgSrc:      'img-src',
  connectSrc:  'connect-src',
  fontSrc:     'font-src',
  frameSrc:    'frame-src',
};

export function createCSP(opts?: CSPOptions): CSPHandle {
  let _nonce: string | undefined = opts?.nonce;

  const defaults: CSPDirectives = {
    defaultSrc:  ["'self'"],
    scriptSrc:   ["'self'"],
    styleSrc:    ["'self'", "'unsafe-inline'"],
    imgSrc:      ["'self'", 'data:'],
    connectSrc:  ["'self'"],
    fontSrc:     ["'self'"],
    frameSrc:    ["'none'"],
    reportUri:   opts?.reportUri ?? '',
  };

  const merged: CSPDirectives = {
    defaultSrc:  opts?.directives?.defaultSrc  ?? defaults.defaultSrc,
    scriptSrc:   opts?.directives?.scriptSrc   ?? defaults.scriptSrc,
    styleSrc:    opts?.directives?.styleSrc    ?? defaults.styleSrc,
    imgSrc:      opts?.directives?.imgSrc      ?? defaults.imgSrc,
    connectSrc:  opts?.directives?.connectSrc  ?? defaults.connectSrc,
    fontSrc:     opts?.directives?.fontSrc     ?? defaults.fontSrc,
    frameSrc:    opts?.directives?.frameSrc    ?? defaults.frameSrc,
    reportUri:   opts?.directives?.reportUri   ?? defaults.reportUri,
  };

  function generateNonce(): string {
    if (
      typeof crypto !== 'undefined' &&
      typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID === 'function'
    ) {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID().replace(/-/g, '').slice(0, 16);
    }
    return Math.random().toString(36).slice(2, 18);
  }

  function getNonce(): string {
    if (_nonce === undefined) {
      _nonce = generateNonce();
    }
    return _nonce;
  }

  function buildHeader(): string {
    const parts: string[] = [];

    for (const key of Object.keys(directiveKeyMap) as Array<keyof typeof directiveKeyMap>) {
      const directiveName = directiveKeyMap[key];
      const values = merged[key as keyof CSPDirectives];
      if (Array.isArray(values) && values.length > 0) {
        parts.push(`${directiveName} ${values.join(' ')}`);
      }
    }

    if (merged.reportUri) {
      parts.push(`report-uri ${merged.reportUri}`);
    }

    return parts.join('; ');
  }

  function buildMetaTag(): string {
    const content = buildHeader();
    return `<meta http-equiv="Content-Security-Policy" content="${content}">`;
  }

  function injectNonce(el: HTMLElement): void {
    const nonce = getNonce();
    const elements = el.querySelectorAll<HTMLElement>('script, style');
    for (const element of elements) {
      element.setAttribute('nonce', nonce);
    }
  }

  return { getNonce, generateNonce, buildHeader, buildMetaTag, injectNonce };
}
