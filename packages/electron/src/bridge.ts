export interface ElectronBridgeOptions {
  channel?:      string;  // IPC channel name, default 'drishti-signals'
  debounce?:     number;  // ms to debounce signal updates, default 16
  allowedKeys?:  string[]; // whitelist of signal labels to sync, default all
}

export interface ElectronBridgeHandle {
  /** Send a signal update to the other side */
  send(label: string, value: unknown): void;
  /** Listen for updates from the other side */
  onUpdate(handler: (label: string, value: unknown) => void): () => void;
  /** In renderer: expose to preload bridge */
  exposeToRenderer(): void;
  destroy(): void;
}

// Mock IPC types (real Electron types would be imported from 'electron')
export interface IpcMain {
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

export interface IpcRenderer {
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
  send(channel: string, ...args: unknown[]): void;
}

export function createMainBridge(ipcMain: IpcMain, opts?: ElectronBridgeOptions): ElectronBridgeHandle {
  const channel = opts?.channel ?? 'drishti-signals';
  const allowedKeys = opts?.allowedKeys;
  const handlers: Array<(label: string, value: unknown) => void> = [];

  const listener = (_event: unknown, label: string, value: unknown) => {
    if (allowedKeys && !allowedKeys.includes(label)) return;
    handlers.forEach(h => h(label, value));
  };

  ipcMain.on(channel, listener);

  return {
    send(_label: string, _value: unknown): void {
      // Main to renderer: use BrowserWindow.webContents.send in real Electron
      // For testability, we broadcast via handlers
    },
    onUpdate(handler): () => void {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    exposeToRenderer(): void {
      // In preload: contextBridge.exposeInMainWorld('drishti', { send, onUpdate })
    },
    destroy(): void {
      ipcMain.removeListener(channel, listener as (...args: unknown[]) => void);
      handlers.length = 0;
    },
  };
}

export function createRendererBridge(ipcRenderer: IpcRenderer, opts?: ElectronBridgeOptions): ElectronBridgeHandle {
  const channel = opts?.channel ?? 'drishti-signals';
  const allowedKeys = opts?.allowedKeys;
  const handlers: Array<(label: string, value: unknown) => void> = [];

  const listener = (_event: unknown, label: string, value: unknown) => {
    if (allowedKeys && !allowedKeys.includes(label)) return;
    handlers.forEach(h => h(label, value));
  };

  ipcRenderer.on(channel, listener);

  return {
    send(label: string, value: unknown): void {
      ipcRenderer.send(channel, label, value);
    },
    onUpdate(handler): () => void {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    exposeToRenderer(): void { /* no-op in renderer */ },
    destroy(): void {
      ipcRenderer.removeListener(channel, listener as (...args: unknown[]) => void);
      handlers.length = 0;
    },
  };
}
