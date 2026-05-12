import { mountApp } from '@nexoraaidrishti/runtime';
import { ShowcaseApp } from './ShowcaseApp.js';

mountApp((container) => {
  const el = ShowcaseApp();
  container.appendChild(el);
  return () => { container.removeChild(el); };
}, document.getElementById('app')!);
