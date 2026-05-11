import { describe, it, expect, vi } from 'vitest';
import { createKanban } from '../Kanban.js';

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

const CARDS = [
  { id: 'card1', columnId: 'todo', title: 'Card 1' },
  { id: 'card2', columnId: 'inprogress', title: 'Card 2' },
];

describe('createKanban', () => {
  it('mount() renders columns', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS });
    kanban.mount(container);
    const colEls = container.querySelectorAll('.dr-kanban__column');
    expect(colEls.length).toBe(3);
  });

  it('cards signal initialized from opts.cards', () => {
    const kanban = createKanban({ columns: COLUMNS, cards: CARDS });
    expect(kanban.cards().length).toBe(2);
    expect(kanban.cards()[0]!.title).toBe('Card 1');
  });

  it('addCard() appends a card', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS, cards: [...CARDS] });
    kanban.mount(container);
    kanban.addCard({ columnId: 'todo', title: 'New Card' });
    expect(kanban.cards().length).toBe(3);
    expect(kanban.cards().some((c) => c.title === 'New Card')).toBe(true);
  });

  it('removeCard() removes a card', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS, cards: [...CARDS] });
    kanban.mount(container);
    kanban.removeCard('card1');
    expect(kanban.cards().length).toBe(1);
    expect(kanban.cards().some((c) => c.id === 'card1')).toBe(false);
  });

  it('moveCard() changes columnId', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS, cards: [...CARDS] });
    kanban.mount(container);
    kanban.moveCard('card1', 'done');
    const moved = kanban.cards().find((c) => c.id === 'card1');
    expect(moved?.columnId).toBe('done');
  });

  it('updateCard() patches card fields', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS, cards: [...CARDS] });
    kanban.mount(container);
    kanban.updateCard('card1', { title: 'Updated Title' });
    const updated = kanban.cards().find((c) => c.id === 'card1');
    expect(updated?.title).toBe('Updated Title');
  });

  it('getColumn() filters by columnId', () => {
    const kanban = createKanban({ columns: COLUMNS, cards: CARDS });
    const todoCards = kanban.getColumn('todo');
    expect(todoCards.length).toBe(1);
    expect(todoCards[0]!.id).toBe('card1');
  });

  it('destroy() removes element', () => {
    const container = document.createElement('div');
    const kanban = createKanban({ columns: COLUMNS });
    kanban.mount(container);
    expect(container.querySelector('.dr-kanban')).toBeTruthy();
    kanban.destroy();
    expect(container.querySelector('.dr-kanban')).toBeNull();
  });
});
