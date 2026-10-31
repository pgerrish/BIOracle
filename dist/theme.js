'use strict';

// Run before the stylesheets so every page starts in the saved theme.
(() => {
  const root = document.documentElement;
  let button;
  function savedTheme() {
    try { return localStorage.getItem('bioracle-theme'); } catch { return null; }
  }
  function apply(theme) {
    const dark = theme === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17221d' : '#d8e5dd');
    if (!button) return;
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.querySelector('.theme-toggle-icon').textContent = dark ? '☀' : '☾';
    button.querySelector('.theme-toggle-label').textContent = dark ? 'Light mode' : 'Dark mode';
  }
  function restore() {
    const saved = savedTheme();
    if (saved === 'dark' || saved === 'light') apply(saved);
  }
  apply(savedTheme());
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const menu = header?.querySelector('.menu-toggle');
    if (!menu) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-label"></span>';
    header.insertBefore(button, menu);
    apply(root.dataset.theme);
    button.addEventListener('click', () => {
      const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(theme);
      try { localStorage.setItem('bioracle-theme', theme); } catch { /* Theme still works on this page. */ }
    });
  });
  // Restore a cached page's theme after Back/Forward and synchronize other tabs.
  window.addEventListener('pageshow', restore);
  window.addEventListener('storage', event => {
    if (event.key === 'bioracle-theme' || event.key === null) apply(savedTheme());
  });
})();
