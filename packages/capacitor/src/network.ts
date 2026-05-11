// Capacitor Network plugin shape
export interface CapacitorNetwork {
  getStatus(): Promise<{ connected: boolean; connectionType: string }>;
  addListener(event: 'networkStatusChange', handler: (status: { connected: boolean; connectionType: string }) => void): Promise<{ remove: () => void }>;
}

export interface NetworkState {
  connected:      boolean;
  connectionType: string;
  initialized:    boolean;
}

export interface NetworkHandle {
  readonly state: NetworkState;
  destroy(): void;
}

export function createNetworkSignal(network: CapacitorNetwork): NetworkHandle {
  const state: NetworkState = { connected: true, connectionType: 'unknown', initialized: false };
  let pluginListener: { remove: () => void } | null = null;

  // Initial status
  void network.getStatus().then(status => {
    state.connected      = status.connected;
    state.connectionType = status.connectionType;
    state.initialized    = true;
  });

  // Listen for changes
  void network.addListener('networkStatusChange', (status) => {
    state.connected      = status.connected;
    state.connectionType = status.connectionType;
  }).then(listener => { pluginListener = listener; });

  return {
    state,
    destroy() {
      pluginListener?.remove();
      pluginListener = null;
    },
  };
}
