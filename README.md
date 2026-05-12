# DRISHTI — AI-Native Frontend Runtime

> Sees · Feels · Heals · Protects

DRISHTI is a new frontend technology built from scratch — a lightweight runtime (<4 KB gzipped) with emotion intelligence, self-healing components, zero-trust security, and signal-based reactivity. No VDOM. No framework dependency. No boilerplate.

---

## Quick Start (Mac / Linux)

### Prerequisites

Install Node.js (v18+) from https://nodejs.org, then install pnpm:

```bash
npm install -g pnpm
```

### Run the Demo

```bash
# 1. Clone the repo
git clone <repo-url>
cd front-claude-frontend-tech-2026-AEuxx

# 2. One command — installs + builds everything
pnpm setup

# 3. Start the dev server
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## What's in the Demo

| Section | What it shows |
|---|---|
| **1 · Emotion Intelligence** | Move mouse fast → frustrated, pause → confused, steady → engaged |
| **2 · Reactive Metrics** | Click buttons to update revenue/users — only changed nodes update |
| **3 · Self-Healing Cards** | Cards auto-retry failed loads, show live status badge |
| **4 · Reactive Table** | Search, sort, paginate — fine-grained signal updates |
| **5 · Sentient Form** | Self-validates, zero unsafe input reaches DOM |
| **6 · Live .dr Compiler** | Edit `.dr` code on the left, see TypeScript appear on the right |

---

## Project Structure

```
drishti/
├── packages/
│   ├── compiler/          # .dr language → TypeScript compiler
│   │   ├── src/lexer.ts   # Tokenizer
│   │   ├── src/parser.ts  # AST builder
│   │   ├── src/codegen.ts # TypeScript code generator
│   │   └── src/index.ts   # compile(source) → { code, ast, errors }
│   │
│   ├── runtime/           # Browser runtime (~3.5 KB gzipped, zero deps)
│   │   ├── src/signal.ts      # Fine-grained signals + computed + effect
│   │   ├── src/emotion.ts     # Behavioral emotion detection
│   │   ├── src/healing.ts     # Self-healing with exponential backoff
│   │   ├── src/security.ts    # Zero-trust sanitizer + role enforcement
│   │   ├── src/integration.ts # REST / WebSocket / SSE connector
│   │   ├── src/genome.ts      # Design DNA → CSS custom properties
│   │   └── src/renderer.ts    # Signal-bound DOM renderer (no VDOM)
│   │
│   └── components/        # 5 Intelligence Unit components
│       ├── src/MetricCard.ts      # Signal-reactive KPI card
│       ├── src/SentientForm.ts    # Self-validating form
│       ├── src/ReactiveTable.ts   # Sortable, searchable, paginated table
│       ├── src/EmotionBadge.ts    # Live emotion state display
│       └── src/HealingCard.ts     # Auto-retry loader with status badge
│
├── apps/
│   └── demo/              # Vite demo application
│       ├── src/main.ts    # All 6 demo sections
│       └── index.html
│
└── examples/
    ├── real-world-usage.ts    # Full real project using TypeScript API
    └── orders-dashboard.dr    # Same app in .dr declarative syntax
```

---

## The .dr Language

Write UI as intent — the compiler handles the code.

```dr
surface: OrdersDashboard
  intent: show and manage customer orders
  secure: role(manager)

  unit: OrderGrid
    data: connect(api.orders, realtime)
    feel: celebrate if new-order-arrived
    feel: calm-alert if payment-failed
    heal: retry(3) then empty-state
    layout: grid(3)
```

Compiles to TypeScript automatically. See Section 6 of the demo for the live compiler.

---

## Using the Runtime Directly (TypeScript API)

```ts
import { signal, computed, effect, connect, h, EmotionProcessor } from '@nexoraaidrishti/runtime';

// State
const count = signal(0);
const doubled = computed(() => count() * 2);

// Reactive UI — only the text node updates
const el = document.createElement('p');
effect(() => { el.textContent = `Count: ${count()} — Doubled: ${doubled()}`; });

// Data
const data = connect('/api/orders');
data.data.subscribe(orders => console.log(orders));

// Emotion
const processor = new EmotionProcessor(document.body);
processor.state.subscribe(emotion => console.log('User feels:', emotion));
```

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm setup` | Install deps + build all packages (run once after clone) |
| `pnpm dev` | Start Vite dev server at http://localhost:3000 |
| `pnpm build` | Production build to apps/demo/dist/ |
| `pnpm typecheck` | TypeScript check all packages |

---

## Architecture

```
.dr source
    ↓ compiler (lexer → parser → AST → codegen)
TypeScript
    ↓ tsc / vite
    ↓
Browser Runtime (3.5 KB gzipped)
  ├── Signals      fine-grained reactivity, no VDOM
  ├── Emotion      setInterval(500ms) behavioral classifier
  ├── Healing      exponential backoff retry + fallback UI
  ├── Security     sanitizer + CSP + role enforcement
  ├── Integration  REST / WebSocket / SSE unified
  └── Genome       brand DNA → CSS custom properties
```
