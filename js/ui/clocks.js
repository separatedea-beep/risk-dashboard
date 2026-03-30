import { $ } from '../utils.js';

export function updateClocks() {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const ln = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const hk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const fmt = d => d.toTimeString().slice(0, 8);
  $('ny-time').textContent = fmt(ny);
  $('ln-time').textContent = fmt(ln);
  $('hk-time').textContent = fmt(hk);
}

export function startClocks() {
  updateClocks();
  setInterval(updateClocks, 1000);
}
