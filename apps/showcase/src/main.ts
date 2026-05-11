import { mountApp } from '@drishti/runtime';
import { ShowcaseApp } from './ShowcaseApp.js';

mountApp((container) => {
  const el = ShowcaseApp();
  container.appendChild(el);
  return () => { container.removeChild(el); };
}, document.getElementById('app')!);
