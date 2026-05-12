import type { Signal } from '@nexoraaidrishti/runtime';
import { signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface FileUploadOptions {
  accept?:   string;
  multiple?: boolean;
  maxSize?:  number;
  maxFiles?: number;
  dragDrop?: boolean;
  onFiles?:  (files: File[]) => void;
  onError?:  (err: string) => void;
  label?:    string;
  hint?:     string;
}

export interface FileUploadHandle {
  readonly files:    Signal<File[]>;
  readonly dragging: Signal<boolean>;
  openPicker(): void;
  clear(): void;
  removeFile(index: number): void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectFileUploadStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-fileupload-styles')) return;
  const style = document.createElement('style');
  style.id = 'dr-fileupload-styles';
  style.textContent = `
.dr-fileupload{display:flex;flex-direction:column;gap:8px;width:100%}
.dr-fileupload__zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed #d1d5db;border-radius:8px;padding:24px;cursor:pointer;background:#fafafa;transition:border-color .15s,background .15s;min-height:80px;text-align:center;outline:none}
.dr-fileupload__zone:hover,.dr-fileupload__zone:focus{border-color:#2563eb;background:#eff6ff}
.dr-fileupload__zone--dragging{border-color:#2563eb;background:#eff6ff}
.dr-fileupload__label{font-size:14px;font-weight:500;color:#111827}
.dr-fileupload__hint{font-size:12px;color:#6b7280}
.dr-fileupload__list{display:flex;flex-direction:column;gap:4px}
.dr-fileupload__file{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;font-size:13px}
.dr-fileupload__file-info{display:flex;flex-direction:column;gap:1px}
.dr-fileupload__file-name{color:#111827;font-weight:500}
.dr-fileupload__file-size{color:#6b7280;font-size:11px}
.dr-fileupload__remove{background:none;border:none;cursor:pointer;color:#6b7280;font-size:16px;padding:0 4px;line-height:1}
.dr-fileupload__remove:hover{color:#dc2626}
`;
  document.head.appendChild(style);
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── createFileUpload ───────────────────────────────────────────────────

export function createFileUpload(opts?: FileUploadOptions): FileUploadHandle {
  injectFileUploadStyles();

  const maxFiles = opts?.maxFiles ?? 10;
  const dragDrop = opts?.dragDrop ?? true;

  const files    = signal<File[]>([]);
  const dragging = signal<boolean>(false);

  let container:  HTMLElement | null = null;
  let wrapEl:     HTMLElement | null = null;
  let zoneEl:     HTMLElement | null = null;
  let listEl:     HTMLElement | null = null;
  let inputEl:    HTMLInputElement | null = null;
  let dragCounter = 0;
  const cleanups: Array<() => void> = [];

  function renderFileList(): void {
    if (!listEl) return;
    listEl.innerHTML = '';
    const cur = files();
    for (let i = 0; i < cur.length; i++) {
      const file = cur[i]!;
      const itemEl = document.createElement('div');
      itemEl.className = 'dr-fileupload__file';

      const infoEl = document.createElement('div');
      infoEl.className = 'dr-fileupload__file-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'dr-fileupload__file-name';
      nameEl.textContent = file.name;

      const sizeEl = document.createElement('span');
      sizeEl.className = 'dr-fileupload__file-size';
      sizeEl.textContent = formatBytes(file.size);

      infoEl.appendChild(nameEl);
      infoEl.appendChild(sizeEl);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'dr-fileupload__remove';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.textContent = '×';
      const idx = i;
      removeBtn.addEventListener('click', () => removeFile(idx));

      itemEl.appendChild(infoEl);
      itemEl.appendChild(removeBtn);
      listEl.appendChild(itemEl);
    }
  }

  function addFiles(newFiles: FileList | File[]): void {
    const arr = Array.from(newFiles);
    const cur = files();

    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of arr) {
      if (opts?.maxSize !== undefined && file.size > opts.maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${formatBytes(opts.maxSize)}`);
        continue;
      }
      valid.push(file);
    }

    if (errors.length > 0) {
      opts?.onError?.(errors.join('\n'));
    }

    if (valid.length === 0) return;

    const merged = opts?.multiple === false
      ? valid.slice(0, 1)
      : [...cur, ...valid].slice(0, maxFiles);

    if (merged.length < cur.length + valid.length && valid.length > 0) {
      const dropped = cur.length + valid.length - maxFiles;
      if (dropped > 0) {
        opts?.onError?.(`Maximum ${maxFiles} files allowed`);
      }
    }

    files.set(merged);
    opts?.onFiles?.(merged);
    renderFileList();
  }

  function clear(): void {
    files.set([]);
    if (inputEl) inputEl.value = '';
    renderFileList();
  }

  function removeFile(index: number): void {
    const cur = files().slice();
    cur.splice(index, 1);
    files.set(cur);
    opts?.onFiles?.(cur);
    renderFileList();
  }

  function openPicker(): void {
    inputEl?.click();
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectFileUploadStyles();

    wrapEl = document.createElement('div');
    wrapEl.className = 'dr-fileupload';

    // Hidden file input
    inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.style.display = 'none';
    if (opts?.accept) inputEl.accept = opts.accept;
    if (opts?.multiple !== false) inputEl.multiple = true;

    const onInputChange = (): void => {
      if (inputEl?.files && inputEl.files.length > 0) {
        addFiles(inputEl.files);
        inputEl.value = '';
      }
    };
    inputEl.addEventListener('change', onInputChange);
    cleanups.push(() => inputEl?.removeEventListener('change', onInputChange));
    wrapEl.appendChild(inputEl);

    // Drop zone
    zoneEl = document.createElement('div');
    zoneEl.className = 'dr-fileupload__zone';
    zoneEl.setAttribute('role', 'button');
    zoneEl.setAttribute('tabindex', '0');
    zoneEl.setAttribute('aria-label', opts?.label ?? 'Upload files');

    const labelEl = document.createElement('div');
    labelEl.className = 'dr-fileupload__label';
    labelEl.textContent = opts?.label ?? 'Click or drag files here';
    zoneEl.appendChild(labelEl);

    if (opts?.hint) {
      const hintEl = document.createElement('div');
      hintEl.className = 'dr-fileupload__hint';
      hintEl.textContent = opts.hint;
      zoneEl.appendChild(hintEl);
    }

    // Click to open picker
    const onZoneClick = (): void => openPicker();
    zoneEl.addEventListener('click', onZoneClick);
    cleanups.push(() => zoneEl?.removeEventListener('click', onZoneClick));

    // Keyboard access
    const onZoneKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    };
    zoneEl.addEventListener('keydown', onZoneKeyDown);
    cleanups.push(() => zoneEl?.removeEventListener('keydown', onZoneKeyDown));

    // Drag and drop
    if (dragDrop) {
      const onDragEnter = (e: DragEvent): void => {
        e.preventDefault();
        dragCounter++;
        dragging.set(true);
        zoneEl?.classList.add('dr-fileupload__zone--dragging');
      };
      const onDragOver = (e: DragEvent): void => {
        e.preventDefault();
      };
      const onDragLeave = (_e: DragEvent): void => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dragging.set(false);
          zoneEl?.classList.remove('dr-fileupload__zone--dragging');
        }
      };
      const onDrop = (e: DragEvent): void => {
        e.preventDefault();
        dragCounter = 0;
        dragging.set(false);
        zoneEl?.classList.remove('dr-fileupload__zone--dragging');
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          addFiles(e.dataTransfer.files);
        }
      };

      zoneEl.addEventListener('dragenter', onDragEnter);
      zoneEl.addEventListener('dragover', onDragOver);
      zoneEl.addEventListener('dragleave', onDragLeave);
      zoneEl.addEventListener('drop', onDrop);

      cleanups.push(() => {
        zoneEl?.removeEventListener('dragenter', onDragEnter);
        zoneEl?.removeEventListener('dragover', onDragOver);
        zoneEl?.removeEventListener('dragleave', onDragLeave);
        zoneEl?.removeEventListener('drop', onDrop);
      });
    }

    wrapEl.appendChild(zoneEl);

    // File list
    listEl = document.createElement('div');
    listEl.className = 'dr-fileupload__list';
    wrapEl.appendChild(listEl);

    el.appendChild(wrapEl);
  }

  function destroy(): void {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
    if (wrapEl && container) {
      container.removeChild(wrapEl);
    }
    wrapEl    = null;
    container = null;
    inputEl   = null;
    zoneEl    = null;
    listEl    = null;
  }

  return { files, dragging, openPicker, clear, removeFile, destroy, mount };
}
