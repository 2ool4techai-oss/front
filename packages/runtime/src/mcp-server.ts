import { _getDevSignals } from './signal.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPServerOptions {
  name?: string;
  version?: string;
  transport?: 'stdio' | 'http' | 'memory';
  port?: number;
  onRequest?: (method: string, params: unknown) => void;
}

export interface MCPHandle {
  expose: (name: string, sig: { (): unknown; set?: (v: unknown) => void }, opts?: {
    description?: string;
    readOnly?: boolean;
    schema?: Record<string, unknown>;
  }) => void;
  exposeAll: () => void;
  handle: (request: MCPRequest) => Promise<MCPResponse>;
  listTools: () => MCPTool[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  snapshot: () => Record<string, unknown>;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ExposedSignal {
  name: string;
  sig: { (): unknown; set?: (v: unknown) => void };
  description: string;
  readOnly: boolean;
  schema?: Record<string, unknown>;
}

export function createMCPServer(opts?: MCPServerOptions): MCPHandle {
  const serverName = opts?.name ?? 'drishti-ui';
  const serverVersion = opts?.version ?? '1.0.0';
  const onRequest = opts?.onRequest;

  const exposed = new Map<string, ExposedSignal>();

  const expose: MCPHandle['expose'] = (name, sig, exposedOpts) => {
    exposed.set(name, {
      name,
      sig,
      description: exposedOpts?.description ?? `Signal: ${name}`,
      readOnly: exposedOpts?.readOnly ?? false,
      schema: exposedOpts?.schema,
    });
  };

  const exposeAll: MCPHandle['exposeAll'] = () => {
    const devSignals = _getDevSignals();
    for (const entry of devSignals) {
      if (entry.label) {
        exposed.set(entry.label, {
          name: entry.label,
          sig: entry.peek as { (): unknown; set?: (v: unknown) => void },
          description: `Signal: ${entry.label}`,
          readOnly: entry.type === 'computed',
          schema: undefined,
        });
      }
    }
  };

  const listTools: MCPHandle['listTools'] = () => {
    const tools: MCPTool[] = [];
    for (const entry of exposed.values()) {
      tools.push({
        name: `signal_read__${entry.name}`,
        description: `Read signal: ${entry.name}${entry.description !== `Signal: ${entry.name}` ? ` — ${entry.description}` : ''}`,
        inputSchema: { type: 'object', properties: {} },
      });
      if (!entry.readOnly && entry.sig.set) {
        tools.push({
          name: `signal_write__${entry.name}`,
          description: `Write signal: ${entry.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              value: entry.schema ?? {},
            },
            required: ['value'],
          },
        });
      }
    }
    return tools;
  };

  const snapshot: MCPHandle['snapshot'] = () => {
    const result: Record<string, unknown> = {};
    for (const entry of exposed.values()) {
      result[entry.name] = entry.sig();
    }
    return result;
  };

  const handle: MCPHandle['handle'] = async (request) => {
    onRequest?.(request.method, request.params);

    const ok = (result: unknown): MCPResponse => ({
      jsonrpc: '2.0',
      id: request.id,
      result,
    });

    const err = (code: number, message: string, data?: unknown): MCPResponse => ({
      jsonrpc: '2.0',
      id: request.id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    });

    switch (request.method) {
      case 'initialize': {
        return ok({
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version: serverVersion },
        });
      }

      case 'tools/list': {
        return ok({ tools: listTools() });
      }

      case 'tools/call': {
        const params = request.params ?? {};
        const toolName = params['name'] as string;
        const args = (params['arguments'] ?? {}) as Record<string, unknown>;

        if (typeof toolName !== 'string') {
          return err(-32602, 'Invalid params: name required');
        }

        if (toolName.startsWith('signal_read__')) {
          const sigName = toolName.slice('signal_read__'.length);
          const entry = exposed.get(sigName);
          if (!entry) {
            return err(-32602, `Unknown signal: ${sigName}`);
          }
          const value = entry.sig();
          return ok({ content: [{ type: 'text', text: String(JSON.stringify(value) ?? value) }] });
        }

        if (toolName.startsWith('signal_write__')) {
          const sigName = toolName.slice('signal_write__'.length);
          const entry = exposed.get(sigName);
          if (!entry) {
            return err(-32602, `Unknown signal: ${sigName}`);
          }
          if (entry.readOnly || !entry.sig.set) {
            return err(-32602, `Signal ${sigName} is read-only`);
          }
          entry.sig.set!(args['value']);
          return ok({ content: [{ type: 'text', text: 'OK' }] });
        }

        return err(-32602, `Unknown tool: ${toolName}`);
      }

      case 'resources/list': {
        const resources = Array.from(exposed.values()).map(entry => ({
          uri: `signal://${entry.name}`,
          name: entry.name,
          mimeType: 'application/json',
        }));
        return ok({ resources });
      }

      case 'resources/read': {
        const params = request.params ?? {};
        const uri = params['uri'] as string;
        if (typeof uri !== 'string' || !uri.startsWith('signal://')) {
          return err(-32602, 'Invalid URI');
        }
        const sigName = uri.slice('signal://'.length);
        const entry = exposed.get(sigName);
        if (!entry) {
          return err(-32602, `Unknown signal: ${sigName}`);
        }
        const value = entry.sig();
        return ok({
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(value),
          }],
        });
      }

      default:
        return err(-32601, 'Method not found');
    }
  };

  const start: MCPHandle['start'] = async () => {
    // HTTP/stdio transport — stub for memory transport (default)
  };

  const stop: MCPHandle['stop'] = async () => {
    // HTTP/stdio transport — stub for memory transport (default)
  };

  return { expose, exposeAll, handle, listTools, start, stop, snapshot };
}
