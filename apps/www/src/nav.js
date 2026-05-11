// ── Active nav link ───────────────────────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href && (location.pathname.endsWith(href) || location.href.includes(href))) {
    a.classList.add('active');
  }
});

// ── Smooth scroll for anchor links ───────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ── Mobile nav toggle ─────────────────────────────────────────
const toggle = document.querySelector('.nav-mobile-toggle');
const mobileMenu = document.querySelector('.nav-links');
if (toggle && mobileMenu) {
  toggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      mobileMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}
