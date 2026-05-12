import { signal } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface KanbanColumn {
  id:     string;
  title:  string;
  color?: string;
  limit?: number;
}

export interface KanbanCard {
  id:        string;
  columnId:  string;
  title:     string;
  body?:     string;
  tags?:     string[];
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
}

export interface KanbanOptions {
  columns:      KanbanColumn[];
  cards?:       KanbanCard[];
  draggable?:   boolean;
  onCardMove?:  (card: KanbanCard, from: string, to: string) => void;
  onCardClick?: (card: KanbanCard) => void;
  onCardAdd?:   (colId: string, title: string) => void;
}

export interface KanbanHandle {
  readonly cards: Signal<KanbanCard[]>;
  addCard(card: Omit<KanbanCard, 'id'>): void;
  moveCard(cardId: string, toColId: string): void;
  removeCard(cardId: string): void;
  updateCard(id: string, patch: Partial<KanbanCard>): void;
  getColumn(id: string): KanbanCard[];
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── CSS injection ──────────────────────────────────────────────────────

let _kanbanStylesInjected = false;
function injectKanbanStyles(): void {
  if (_kanbanStylesInjected || typeof document === 'undefined') return;
  _kanbanStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.dr-kanban{display:flex;flex-direction:row;gap:16px;overflow-x:auto;height:100%;padding:8px}
.dr-kanban__column{display:flex;flex-direction:column;min-width:260px;max-width:300px;background:var(--dr-color-surface,#1a1a2e);border:1px solid var(--dr-color-border,rgba(255,255,255,.1));border-radius:8px;overflow:hidden}
.dr-kanban__col-header{padding:12px 16px;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dr-color-border,rgba(255,255,255,.1))}
.dr-kanban__col-header--over-limit{color:#ef4444}
.dr-kanban__col-title{display:flex;align-items:center;gap:8px}
.dr-kanban__col-dot{width:10px;height:10px;border-radius:50%;background:currentColor}
.dr-kanban__col-count{font-size:12px;opacity:.6;margin-left:4px}
.dr-kanban__cards{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:40px}
.dr-kanban__cards--drag-over{background:rgba(255,255,255,.05)}
.dr-kanban__card{background:var(--dr-color-surface,#0d0d1a);border:1px solid var(--dr-color-border,rgba(255,255,255,.1));border-radius:6px;padding:10px 12px;cursor:pointer;user-select:none}
.dr-kanban__card:hover{border-color:rgba(255,255,255,.2)}
.dr-kanban__card--dragging{opacity:.4}
.dr-kanban__card-title{font-size:13px;font-weight:500;margin-bottom:4px}
.dr-kanban__card-body{font-size:12px;opacity:.7;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-kanban__card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
.dr-kanban__tag{font-size:11px;padding:2px 6px;border-radius:10px;background:rgba(59,130,246,.2);color:#93c5fd}
.dr-kanban__priority{display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-top:2px}
.dr-kanban__priority-dot{font-size:12px}
.dr-kanban__priority--low .dr-kanban__priority-dot{color:#22c55e}
.dr-kanban__priority--medium .dr-kanban__priority-dot{color:#f59e0b}
.dr-kanban__priority--high .dr-kanban__priority-dot{color:#ef4444}
.dr-kanban__add-btn{margin:4px 8px 8px;padding:6px;border:1px dashed var(--dr-color-border,rgba(255,255,255,.1));border-radius:6px;background:transparent;color:inherit;font-size:13px;cursor:pointer;text-align:center;opacity:.7;width:calc(100% - 16px)}
.dr-kanban__add-btn:hover{opacity:1;background:rgba(255,255,255,.05)}
.dr-kanban__add-input{margin:4px 8px 8px;width:calc(100% - 16px);padding:6px 8px;border:1px solid rgba(59,130,246,.5);border-radius:6px;background:rgba(0,0,0,.3);color:inherit;font-size:13px;outline:none}
`;
  document.head.appendChild(style);
}

// ── createKanban ───────────────────────────────────────────────────────

export function createKanban(opts: KanbanOptions): KanbanHandle {
  injectKanbanStyles();

  const cards = signal<KanbanCard[]>(opts.cards ? [...opts.cards] : []);

  let boardEl:    HTMLElement | null = null;
  let parentEl:   HTMLElement | null = null;
  let dragCardId: string | null = null;

  function genId(): string {
    return Math.random().toString(36).slice(2);
  }

  function getCardById(id: string): KanbanCard | undefined {
    return cards().find((c) => c.id === id);
  }

  function renderCard(card: KanbanCard): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dr-kanban__card';
    el.setAttribute('data-card-id', card.id);

    if (opts.draggable !== false) {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (e) => {
        dragCardId = card.id;
        el.classList.add('dr-kanban__card--dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', card.id);
        }
      });
      el.addEventListener('dragend', () => {
        dragCardId = null;
        el.classList.remove('dr-kanban__card--dragging');
      });
    }

    el.addEventListener('click', () => {
      if (opts.onCardClick !== undefined) opts.onCardClick(card);
    });

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'dr-kanban__card-title';
    titleEl.textContent = card.title;
    el.appendChild(titleEl);

    // Body preview
    if (card.body !== undefined) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'dr-kanban__card-body';
      bodyEl.textContent = card.body.length > 50 ? card.body.slice(0, 50) + '…' : card.body;
      el.appendChild(bodyEl);
    }

    // Tags
    if (card.tags !== undefined && card.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'dr-kanban__card-tags';
      card.tags.forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'dr-kanban__tag';
        chip.textContent = tag;
        tagsEl.appendChild(chip);
      });
      el.appendChild(tagsEl);
    }

    // Priority
    if (card.priority !== undefined) {
      const priEl = document.createElement('div');
      priEl.className = `dr-kanban__priority dr-kanban__priority--${card.priority}`;
      const dotEl = document.createElement('span');
      dotEl.className = 'dr-kanban__priority-dot';
      dotEl.textContent = '●';
      priEl.appendChild(dotEl);
      const label = document.createElement('span');
      label.textContent = card.priority;
      priEl.appendChild(label);
      el.appendChild(priEl);
    }

    return el;
  }

  function renderColumn(col: KanbanColumn): HTMLElement {
    const colEl = document.createElement('div');
    colEl.className = 'dr-kanban__column';
    colEl.setAttribute('data-col-id', col.id);

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'dr-kanban__col-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'dr-kanban__col-title';

    if (col.color !== undefined) {
      const dotEl = document.createElement('span');
      dotEl.className = 'dr-kanban__col-dot';
      dotEl.style.backgroundColor = col.color;
      titleWrap.appendChild(dotEl);
    }

    const titleText = document.createElement('span');
    titleText.textContent = col.title;
    titleWrap.appendChild(titleText);

    headerEl.appendChild(titleWrap);

    const countEl = document.createElement('span');
    countEl.className = 'dr-kanban__col-count';
    headerEl.appendChild(countEl);

    colEl.appendChild(headerEl);

    // Cards list
    const cardsListEl = document.createElement('div');
    cardsListEl.className = 'dr-kanban__cards';
    cardsListEl.setAttribute('data-col-id', col.id);
    colEl.appendChild(cardsListEl);

    // Drag-and-drop on columns
    if (opts.draggable !== false) {
      cardsListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        cardsListEl.classList.add('dr-kanban__cards--drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      cardsListEl.addEventListener('dragleave', () => {
        cardsListEl.classList.remove('dr-kanban__cards--drag-over');
      });
      cardsListEl.addEventListener('drop', (e) => {
        e.preventDefault();
        cardsListEl.classList.remove('dr-kanban__cards--drag-over');
        const cid = dragCardId ?? (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
        if (cid) moveCard(cid, col.id);
      });
    }

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'dr-kanban__add-btn';
    addBtn.textContent = '+ Add card';
    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      const input = document.createElement('input');
      input.className = 'dr-kanban__add-input';
      input.placeholder = 'Card title…';
      colEl.appendChild(input);
      input.focus();

      function commit(): void {
        const title = input.value.trim();
        input.remove();
        addBtn.style.display = '';
        if (title) {
          addCard({ columnId: col.id, title });
          if (opts.onCardAdd !== undefined) opts.onCardAdd(col.id, title);
        }
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          input.remove();
          addBtn.style.display = '';
        }
      });
      input.addEventListener('blur', commit);
    });
    colEl.appendChild(addBtn);

    return colEl;
  }

  function syncColumn(col: KanbanColumn): void {
    if (!boardEl) return;
    const colEl = boardEl.querySelector(`[data-col-id="${col.id}"]`) as HTMLElement | null;
    if (!colEl) return;

    const cardsListEl = colEl.querySelector(`.dr-kanban__cards[data-col-id="${col.id}"]`) as HTMLElement | null;
    const headerEl    = colEl.querySelector('.dr-kanban__col-header') as HTMLElement | null;
    const countEl     = colEl.querySelector('.dr-kanban__col-count') as HTMLElement | null;
    if (!cardsListEl || !headerEl || !countEl) return;

    const colCards = cards().filter((c) => c.columnId === col.id);
    cardsListEl.innerHTML = '';
    colCards.forEach((c) => {
      cardsListEl.appendChild(renderCard(c));
    });

    countEl.textContent = String(colCards.length);

    if (col.limit !== undefined && colCards.length >= col.limit) {
      headerEl.classList.add('dr-kanban__col-header--over-limit');
    } else {
      headerEl.classList.remove('dr-kanban__col-header--over-limit');
    }
  }

  function syncAll(): void {
    opts.columns.forEach((col) => syncColumn(col));
  }

  function addCard(card: Omit<KanbanCard, 'id'>): void {
    const newCard: KanbanCard = { ...card, id: genId() };
    cards.set([...cards(), newCard]);
    syncAll();
  }

  function moveCard(cardId: string, toColId: string): void {
    const card = getCardById(cardId);
    if (!card) return;
    const fromColId = card.columnId;
    if (fromColId === toColId) return;
    cards.set(
      cards().map((c) => c.id === cardId ? { ...c, columnId: toColId } : c),
    );
    if (opts.onCardMove !== undefined) {
      const updatedCard = getCardById(cardId);
      if (updatedCard !== undefined) opts.onCardMove(updatedCard, fromColId, toColId);
    }
    syncAll();
  }

  function removeCard(cardId: string): void {
    cards.set(cards().filter((c) => c.id !== cardId));
    syncAll();
  }

  function updateCard(id: string, patch: Partial<KanbanCard>): void {
    cards.set(cards().map((c) => c.id === id ? { ...c, ...patch } : c));
    syncAll();
  }

  function getColumn(id: string): KanbanCard[] {
    return cards().filter((c) => c.columnId === id);
  }

  function mount(container: HTMLElement): void {
    parentEl = container;
    boardEl = document.createElement('div');
    boardEl.className = 'dr-kanban';

    opts.columns.forEach((col) => {
      boardEl!.appendChild(renderColumn(col));
    });

    container.appendChild(boardEl);
    syncAll();
  }

  function destroy(): void {
    if (boardEl && parentEl) {
      parentEl.removeChild(boardEl);
    }
    boardEl  = null;
    parentEl = null;
  }

  return { cards, addCard, moveCard, removeCard, updateCard, getColumn, destroy, mount };
}
