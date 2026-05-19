// ── AICopilot component ────────────────────────────────────────────────

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: CopilotAction[];
}

export interface CopilotAction {
  label: string;
  signalName: string;
  value: unknown;
  description: string;
}

export interface CopilotOptions {
  endpoint?: string;
  apiKey?: string;
  signals?: Record<string, { get(): unknown }>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark' | 'auto';
  placeholder?: string;
  welcomeMessage?: string;
  onAction?: (action: CopilotAction) => void;
}

export interface CopilotHandle {
  open(): void;
  close(): void;
  toggle(): void;
  sendMessage(content: string): Promise<CopilotMessage>;
  getMessages(): CopilotMessage[];
  clearHistory(): void;
  getSignalContext(): Record<string, unknown>;
  dispose(): void;
}

// ── ID generator ───────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Rule-based response logic ──────────────────────────────────────────

function ruleBasedReply(
  content: string,
  context: Record<string, unknown>,
): { reply: string; actions?: CopilotAction[] } {
  const lower = content.toLowerCase();

  if (lower.includes('what') || lower.includes('show')) {
    const keys = Object.keys(context);
    if (keys.length === 0) {
      return { reply: 'No signals are currently registered.' };
    }
    const desc = keys
      .map(k => `${k}: ${JSON.stringify(context[k])}`)
      .join(', ');
    return { reply: `Here is the current app state — ${desc}.` };
  }

  if (lower.includes('how many')) {
    const keys = Object.keys(context);
    const arrayCounts = keys
      .filter(k => Array.isArray(context[k]))
      .map(k => `${k} has ${(context[k] as unknown[]).length} item(s)`)
      .join('; ');
    if (arrayCounts) {
      return { reply: `Count info — ${arrayCounts}.` };
    }
    return { reply: 'No array signals found in the current state.' };
  }

  if (lower.includes('navigate') || lower.includes('go to')) {
    const actions: CopilotAction[] = Object.keys(context)
      .filter(k => k.toLowerCase().includes('route') || k.toLowerCase().includes('page'))
      .map(k => ({
        label: `Go to ${k}`,
        signalName: k,
        value: context[k],
        description: `Navigate using signal "${k}"`,
      }));
    const reply =
      actions.length > 0
        ? 'Here are navigation options I found based on your signal state.'
        : 'I could not find any navigation-related signals. Try registering a route or page signal.';
    return { reply, actions };
  }

  return {
    reply: 'I can see your app state. Ask me what you\'d like to know or do.',
  };
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectCopilotStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-copilot-styles')) return;
  const s = document.createElement('style');
  s.id = 'dr-copilot-styles';
  s.textContent = `
.dr-copilot-btn{position:fixed;z-index:9100;width:52px;height:52px;border-radius:9999px;background:var(--dr-copilot-accent,#6366f1);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(99,102,241,.45);transition:transform 150ms,box-shadow 150ms;font-size:1.4rem;}
.dr-copilot-btn:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(99,102,241,.55);}
.dr-copilot-btn.bottom-right{bottom:24px;right:24px;}
.dr-copilot-btn.bottom-left{bottom:24px;left:24px;}
.dr-copilot-btn.top-right{top:24px;right:24px;}
.dr-copilot-btn.top-left{top:24px;left:24px;}
.dr-copilot-panel{position:fixed;z-index:9099;width:360px;max-height:520px;background:var(--dr-surface,#fff);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:16px;box-shadow:0 16px 64px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden;animation:dr-cop-in .18s cubic-bezier(.34,1.56,.64,1);}
@keyframes dr-cop-in{from{opacity:0;transform:scale(.93)translateY(10px)}to{opacity:1;transform:none}}
.dr-copilot-panel.bottom-right{bottom:88px;right:24px;}
.dr-copilot-panel.bottom-left{bottom:88px;left:24px;}
.dr-copilot-panel.top-right{top:88px;right:24px;}
.dr-copilot-panel.top-left{top:88px;left:24px;}
.dr-copilot-header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--dr-border-color,#e2e8f0);font-weight:600;font-size:.9rem;color:var(--dr-text,#0f172a);}
.dr-copilot-header-icon{width:28px;height:28px;border-radius:8px;background:var(--dr-copilot-accent,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.9rem;}
.dr-copilot-messages{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}
.dr-copilot-msg{display:flex;flex-direction:column;gap:4px;max-width:88%;}
.dr-copilot-msg.user{align-self:flex-end;align-items:flex-end;}
.dr-copilot-msg.assistant{align-self:flex-start;align-items:flex-start;}
.dr-copilot-bubble{padding:8px 12px;border-radius:12px;font-size:.85rem;line-height:1.5;word-break:break-word;}
.dr-copilot-msg.user .dr-copilot-bubble{background:var(--dr-copilot-accent,#6366f1);color:#fff;border-bottom-right-radius:4px;}
.dr-copilot-msg.assistant .dr-copilot-bubble{background:var(--dr-bg-muted,#f1f5f9);color:var(--dr-text,#0f172a);border-bottom-left-radius:4px;}
.dr-copilot-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
.dr-copilot-action-btn{padding:4px 10px;border-radius:6px;border:1px solid var(--dr-copilot-accent,#6366f1);background:transparent;color:var(--dr-copilot-accent,#6366f1);font-size:.78rem;cursor:pointer;transition:background 120ms,color 120ms;}
.dr-copilot-action-btn:hover{background:var(--dr-copilot-accent,#6366f1);color:#fff;}
.dr-copilot-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--dr-border-color,#e2e8f0);}
.dr-copilot-input{flex:1;border:1px solid var(--dr-border-color,#e2e8f0);border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none;background:var(--dr-bg,#fff);color:var(--dr-text,#0f172a);}
.dr-copilot-input:focus{border-color:var(--dr-copilot-accent,#6366f1);}
.dr-copilot-send{padding:7px 14px;border-radius:8px;background:var(--dr-copilot-accent,#6366f1);color:#fff;border:none;cursor:pointer;font-size:.82rem;font-weight:600;transition:opacity 120ms;}
.dr-copilot-send:disabled{opacity:.5;cursor:not-allowed;}
.dr-copilot-hidden{display:none!important;}
`;
  document.head.appendChild(s);
}

// ── Factory ────────────────────────────────────────────────────────────

export function createCopilot(options?: CopilotOptions): CopilotHandle {
  const opts: Required<Omit<CopilotOptions, 'endpoint' | 'apiKey' | 'onAction'>> &
    Pick<CopilotOptions, 'endpoint' | 'apiKey' | 'onAction'> = {
    signals: options?.signals ?? {},
    position: options?.position ?? 'bottom-right',
    theme: options?.theme ?? 'auto',
    placeholder: options?.placeholder ?? 'Ask me anything…',
    welcomeMessage:
      options?.welcomeMessage ??
      'Hi! I\'m your AI copilot. I can see your app\'s signal state and help you navigate or operate it.',
    ...(options?.endpoint !== undefined ? { endpoint: options.endpoint } : {}),
    ...(options?.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    ...(options?.onAction !== undefined ? { onAction: options.onAction } : {}),
  };

  let isOpen = false;
  const messages: CopilotMessage[] = [];

  // DOM references (only created when document is available)
  let btnEl: HTMLButtonElement | null = null;
  let panelEl: HTMLDivElement | null = null;
  let messagesEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let sendBtn: HTMLButtonElement | null = null;

  function getSignalContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {};
    for (const [name, sig] of Object.entries(opts.signals)) {
      try {
        ctx[name] = sig.get();
      } catch {
        ctx[name] = undefined;
      }
    }
    return ctx;
  }

  function renderMessage(msg: CopilotMessage): void {
    if (!messagesEl) return;
    const wrap = document.createElement('div');
    wrap.className = `dr-copilot-msg ${msg.role}`;
    wrap.dataset.msgId = msg.id;

    const bubble = document.createElement('div');
    bubble.className = 'dr-copilot-bubble';
    bubble.textContent = msg.content;
    wrap.appendChild(bubble);

    if (msg.actions?.length) {
      const actRow = document.createElement('div');
      actRow.className = 'dr-copilot-actions';
      for (const action of msg.actions) {
        const btn = document.createElement('button');
        btn.className = 'dr-copilot-action-btn';
        btn.textContent = action.label;
        btn.addEventListener('click', () => opts.onAction?.(action));
        actRow.appendChild(btn);
      }
      wrap.appendChild(actRow);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function mountDOM(): void {
    if (typeof document === 'undefined') return;
    injectCopilotStyles();

    // Toggle button
    btnEl = document.createElement('button');
    btnEl.className = `dr-copilot-btn ${opts.position}`;
    btnEl.setAttribute('aria-label', 'Open AI Copilot');
    btnEl.textContent = '✦';
    btnEl.addEventListener('click', () => handle.toggle());
    document.body.appendChild(btnEl);

    // Panel
    panelEl = document.createElement('div');
    panelEl.className = `dr-copilot-panel ${opts.position} dr-copilot-hidden`;
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'AI Copilot');

    const header = document.createElement('div');
    header.className = 'dr-copilot-header';
    header.innerHTML = '<div class="dr-copilot-header-icon">✦</div><span>AI Copilot</span>';
    panelEl.appendChild(header);

    messagesEl = document.createElement('div');
    messagesEl.className = 'dr-copilot-messages';
    panelEl.appendChild(messagesEl);

    const inputRow = document.createElement('div');
    inputRow.className = 'dr-copilot-input-row';

    inputEl = document.createElement('input');
    inputEl.className = 'dr-copilot-input';
    inputEl.type = 'text';
    inputEl.placeholder = opts.placeholder;
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitInput();
      }
    });

    sendBtn = document.createElement('button');
    sendBtn.className = 'dr-copilot-send';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', submitInput);

    inputRow.appendChild(inputEl);
    inputRow.appendChild(sendBtn);
    panelEl.appendChild(inputRow);

    document.body.appendChild(panelEl);

    // Show welcome message
    if (opts.welcomeMessage) {
      const welcome: CopilotMessage = {
        id: genId(),
        role: 'assistant',
        content: opts.welcomeMessage,
        timestamp: Date.now(),
      };
      messages.push(welcome);
      renderMessage(welcome);
    }
  }

  async function submitInput(): Promise<void> {
    if (!inputEl || !sendBtn) return;
    const content = inputEl.value.trim();
    if (!content) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    try {
      await handle.sendMessage(content);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // Mount immediately if DOM is available
  if (typeof document !== 'undefined') {
    mountDOM();
  }

  const handle: CopilotHandle = {
    open(): void {
      isOpen = true;
      panelEl?.classList.remove('dr-copilot-hidden');
      inputEl?.focus();
    },

    close(): void {
      isOpen = false;
      panelEl?.classList.add('dr-copilot-hidden');
    },

    toggle(): void {
      if (isOpen) {
        handle.close();
      } else {
        handle.open();
      }
    },

    async sendMessage(content: string): Promise<CopilotMessage> {
      const userMsg: CopilotMessage = {
        id: genId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      messages.push(userMsg);
      renderMessage(userMsg);

      let assistantMsg: CopilotMessage;

      if (opts.endpoint) {
        try {
          const resp = await fetch(opts.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
            },
            body: JSON.stringify({ message: content, context: getSignalContext() }),
          });
          const data = (await resp.json()) as { reply: string; actions?: CopilotAction[] };
          assistantMsg = {
            id: genId(),
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now(),
            ...(data.actions !== undefined ? { actions: data.actions } : {}),
          };
        } catch (err) {
          assistantMsg = {
            id: genId(),
            role: 'assistant',
            content: `Sorry, I couldn't reach the AI endpoint: ${(err as Error).message}`,
            timestamp: Date.now(),
          };
        }
      } else {
        const ctx = getSignalContext();
        const { reply, actions } = ruleBasedReply(content, ctx);
        assistantMsg = {
          id: genId(),
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          ...(actions !== undefined ? { actions } : {}),
        };
      }

      messages.push(assistantMsg);
      renderMessage(assistantMsg);
      return assistantMsg;
    },

    getMessages(): CopilotMessage[] {
      return [...messages];
    },

    clearHistory(): void {
      messages.length = 0;
      if (messagesEl) messagesEl.innerHTML = '';
    },

    getSignalContext,

    dispose(): void {
      btnEl?.remove();
      panelEl?.remove();
      btnEl = null;
      panelEl = null;
      messagesEl = null;
      inputEl = null;
      sendBtn = null;
    },
  };

  return handle;
}
