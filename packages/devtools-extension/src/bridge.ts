export interface SignalSnapshot {
  id:        string;
  label:     string;
  value:     unknown;
  type:      'signal' | 'computed' | 'store';
  timestamp: number;
}

export interface DevtoolsMessage {
  type:     'DRISHTI_SIGNAL_UPDATE' | 'DRISHTI_INIT' | 'DRISHTI_CLEAR';
  payload?: SignalSnapshot | SignalSnapshot[];
}

export function createDevtoolsBridge(): {
  postUpdate(snap: SignalSnapshot): void;
  onMessage(handler: (msg: DevtoolsMessage) => void): () => void;
} {
  function postUpdate(snap: SignalSnapshot): void {
    window.postMessage({ source: 'drishti-devtools', ...snap }, '*');
  }

  function onMessage(handler: (msg: DevtoolsMessage) => void): () => void {
    const listener = (event: MessageEvent): void => {
      if (!event.data || event.data.source !== 'drishti-devtools') return;
      handler(event.data as DevtoolsMessage);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  return { postUpdate, onMessage };
}
