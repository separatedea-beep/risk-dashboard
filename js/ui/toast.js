import { $ } from '../utils.js';

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast t-' + type;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
