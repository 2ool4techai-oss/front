import { describe, it, expect } from 'vitest';
import { createFileUpload } from '../FileUpload.js';

describe('createFileUpload', () => {
  it('mounts to container', () => {
    const container = document.createElement('div');
    const fu = createFileUpload();
    fu.mount(container);
    expect(container.querySelector('.dr-fileupload')).toBeTruthy();
  });

  it('files signal starts empty', () => {
    const fu = createFileUpload();
    expect(fu.files()).toEqual([]);
  });

  it('clear() empties files', () => {
    const fu = createFileUpload({ multiple: true });
    const container = document.createElement('div');
    fu.mount(container);
    // Manually set files via signal internals by adding a fake file
    const file1 = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const file2 = new File(['world'], 'world.txt', { type: 'text/plain' });
    (fu.files as any).set([file1, file2]);
    expect(fu.files().length).toBe(2);
    fu.clear();
    expect(fu.files()).toEqual([]);
  });

  it('removeFile(0) removes first file', () => {
    const fu = createFileUpload({ multiple: true });
    const container = document.createElement('div');
    fu.mount(container);
    const file1 = new File(['a'], 'a.txt');
    const file2 = new File(['b'], 'b.txt');
    (fu.files as any).set([file1, file2]);
    fu.removeFile(0);
    expect(fu.files().length).toBe(1);
    expect(fu.files()[0]?.name).toBe('b.txt');
  });

  it('openPicker() doesn\'t throw', () => {
    const container = document.createElement('div');
    const fu = createFileUpload();
    fu.mount(container);
    expect(() => fu.openPicker()).not.toThrow();
  });

  it('dragging signal starts false', () => {
    const fu = createFileUpload();
    expect(fu.dragging()).toBe(false);
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const fu = createFileUpload();
    fu.mount(container);
    expect(container.querySelector('.dr-fileupload')).toBeTruthy();
    fu.destroy();
    expect(container.querySelector('.dr-fileupload')).toBeNull();
  });
});
