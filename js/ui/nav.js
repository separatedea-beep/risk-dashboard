import { $ } from '../utils.js';

export function showView(name, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('view-' + name).classList.add('active');
  el.classList.add('active');
}

export function initNav() {
  // Make showView available globally for onclick handlers in HTML
  window.showView = showView;
}
