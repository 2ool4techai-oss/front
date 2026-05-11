// ── Docs sidebar navigation ───────────────────────────────────
function initDocs() {
  const links = document.querySelectorAll('.sidebar-link[data-section]');
  const sections = document.querySelectorAll('.docs-section');

  function showSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));

    const section = document.getElementById(id);
    const link = document.querySelector(`.sidebar-link[data-section="${id}"]`);

    if (section) section.classList.add('active');
    if (link) {
      link.classList.add('active');
      // Scroll link into view in sidebar
      link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    history.pushState(null, '', '#' + id);
    // Scroll docs content back to top
    const content = document.querySelector('.docs-content');
    if (content) content.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });

  // Show section from URL hash or default to 'installation'
  const hash = location.hash.slice(1);
  const target = hash && document.getElementById(hash) ? hash : 'installation';
  showSection(target);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDocs);
} else {
  initDocs();
}
