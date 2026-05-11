# @drishti/runtime

Fine-grained reactive signals runtime for the DRISHTI framework — the reactive core powering signals, computed values, effects, and state machines.

## Install

```bash
pnpm add @drishti/runtime
```

## Basic Usage

```typescript
import { signal, computed, effect, batch } from '@drishti/runtime';

// Create a reactive signal
const count = signal(0);

// Derived computed value
const doubled = computed(() => count() * 2);

// React to changes
effect(() => {
  console.log('count:', count(), 'doubled:', doubled());
});

// Update signal — effect runs automatically
count.set(1); // logs: count: 1 doubled: 2

// Batch multiple updates into a single flush
batch(() => {
  count.set(10);
});
```
