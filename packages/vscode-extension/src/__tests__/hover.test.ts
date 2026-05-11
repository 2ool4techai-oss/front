import { describe, it, expect } from 'vitest';
import { getHoverInfo, formatHoverMarkdown } from '../hover.js';

describe('hover info', () => {
  it('getHoverInfo returns info for signal', () => {
    const info = getHoverInfo('signal');
    expect(info).toBeDefined();
    expect(info!.title).toContain('signal');
  });

  it('getHoverInfo returns info for computed', () => {
    expect(getHoverInfo('computed')).toBeDefined();
  });

  it('getHoverInfo returns undefined for unknown word', () => {
    expect(getHoverInfo('nonexistent')).toBeUndefined();
  });

  it('formatHoverMarkdown includes title and description', () => {
    const info = getHoverInfo('signal')!;
    const md = formatHoverMarkdown(info);
    expect(md).toContain('signal');
    expect(md).toContain('reactive');
  });

  it('formatHoverMarkdown includes example if present', () => {
    const info = getHoverInfo('signal')!;
    const md = formatHoverMarkdown(info);
    expect(md).toContain('Example');
  });
});
