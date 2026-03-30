export const $ = id => document.getElementById(id);

export const fmt = n => n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M'
  : n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k'
  : '$' + Math.round(n).toLocaleString();

export const fmtN = n => n >= 1000000 ? (n / 1000000).toFixed(2) + 'M'
  : n >= 1000 ? (n / 1000).toFixed(0) + 'k'
  : Math.round(n).toLocaleString();

export const jit = (v, p) => v * (1 + (Math.random() - 0.5) * p * 0.01);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function setVal(id, val, flash = false) {
  const el = $(id);
  if (!el) return;
  if (el.textContent !== String(val)) {
    el.textContent = val;
    if (flash) {
      el.classList.remove('val-update');
      void el.offsetWidth;
      el.classList.add('val-update');
    }
  }
}
