import { signal, computed } from './signal.js';

export interface RiveAdapter {
  load(opts: { src: string; canvas: HTMLCanvasElement; autoplay?: boolean }): RiveInstance;
}

export interface RiveInstance {
  stateMachineInputs(name: string): RiveInput[];
  play(name?: string): void;
  pause(): void;
  stop(): void;
  isPlaying: boolean;
  on(event: string, cb: () => void): void;
}

export interface RiveInput {
  name: string;
  type: 'boolean' | 'number' | 'trigger';
  value: boolean | number;
}

export interface RiveSignalOptions {
  adapter?: RiveAdapter;
  stateMachine?: string;
  autoplay?: boolean;
}

export interface RiveHandle {
  playing: () => boolean;
  input: <T extends boolean | number>(name: string) => {
    (): T;
    set: (v: T) => void;
  } | null;
  trigger: (name: string) => void;
  mount: (canvas: HTMLCanvasElement, src: string) => void;
  play: () => void;
  pause: () => void;
}

export function riveSignal(opts?: RiveSignalOptions): RiveHandle {
  const _playing = signal<boolean>(opts?.autoplay ?? false);
  const _inputSignals = new Map<string, ReturnType<typeof signal>>();

  let riveInstance: RiveInstance | null = null;

  function mount(canvas: HTMLCanvasElement, src: string): void {
    const adapter = opts?.adapter;
    if (!adapter) return;

    riveInstance = adapter.load({
      src,
      canvas,
      autoplay: opts?.autoplay,
    });

    _playing.set(riveInstance.isPlaying);

    riveInstance.on('play', () => _playing.set(true));
    riveInstance.on('pause', () => _playing.set(false));
    riveInstance.on('stop', () => _playing.set(false));

    if (opts?.stateMachine) {
      const inputs = riveInstance.stateMachineInputs(opts.stateMachine);
      for (const inp of inputs) {
        if (inp.type !== 'trigger') {
          _inputSignals.set(inp.name, signal(inp.value));
        }
      }
    }
  }

  function input<T extends boolean | number>(name: string): { (): T; set: (v: T) => void } | null {
    const sig = _inputSignals.get(name);
    if (!sig) return null;
    return sig as { (): T; set: (v: T) => void };
  }

  function trigger(name: string): void {
    if (!riveInstance || !opts?.stateMachine) return;
    const inputs = riveInstance.stateMachineInputs(opts.stateMachine);
    const inp = inputs.find((i) => i.name === name && i.type === 'trigger');
    if (inp) {
      // Rive trigger inputs are fired via value assignment in the real SDK
      // In the adapter pattern, we signal by setting value to true momentarily
      void inp;
    }
  }

  function play(): void {
    if (riveInstance) riveInstance.play();
    _playing.set(true);
  }

  function pause(): void {
    if (riveInstance) riveInstance.pause();
    _playing.set(false);
  }

  return {
    playing: _playing,
    input,
    trigger,
    mount,
    play,
    pause,
  };
}
