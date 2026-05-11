// ── Copy buttons for code blocks ─────────────────────────────
document.querySelectorAll('pre').forEach(pre => {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', 'Copy code to clipboard');
  btn.onclick = async () => {
    const code = pre.querySelector('code');
    // Get text content, stripping any HTML tags
    const text = (code ? code.innerText : pre.innerText) || '';
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied!';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
      btn.style.color = '#fff';
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = 'Copied!';
      btn.style.background = '#10b981';
      btn.style.color = '#fff';
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  };
  pre.style.position = 'relative';
  pre.appendChild(btn);
});

// ── Tab switching for code examples ──────────────────────────
document.querySelectorAll('.code-tabs').forEach(tabBar => {
  tabBar.querySelectorAll('.code-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      const parent = tabBar.closest('.code-demo') || tabBar.parentElement;
      parent.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = parent.querySelector(`#${panel}`);
      if (target) target.classList.add('active');
    });
  });
});

// ── Install command switcher ──────────────────────────────────
const cmds = {
  npm:   'npm create drishti-app@latest my-app',
  pnpm:  'pnpm create drishti-app my-app',
  bun:   'bun create drishti-app my-app',
  yarn:  'yarn create drishti-app my-app',
};

window.setInstallCmd = function(pkg, el) {
  const cmdEl = document.getElementById('install-cmd');
  if (cmdEl) cmdEl.textContent = cmds[pkg] || cmds.npm;
  document.querySelectorAll('.install-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
};
