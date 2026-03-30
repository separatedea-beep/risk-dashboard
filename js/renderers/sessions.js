import { S } from '../state.js';
import { $ } from '../utils.js';

export function renderSessionsFull() {
  const el = $('sessions-full-body');
  if (!el) return;
  el.innerHTML = S.sessions.map(s => {
    const dot = s.status === 'connected' ? 'sdot-green' : s.status === 'standby' ? 'sdot-amber' : 'sdot-red';
    return `<div class="session-row">
      <span class="mono" style="font-size:11px">${s.lp}<br><span style="color:var(--text3);font-size:10px">${s.type}</span></span>
      <span class="status-dot"><span class="sdot ${dot}"></span>${s.status}</span>
      <span class="mono" style="text-align:right">${s.lat ? s.lat.toFixed(1) + 'ms' : '—'}</span>
      <span class="mono ${s.rej && s.rej > 1 ? 'red' : s.rej ? 'green' : ''}" style="text-align:right">${s.rej ? s.rej + '%' : '—'}</span>
      <span class="mono green" style="text-align:right">${s.up ? s.up + '%' : '—'}</span>
    </div>`;
  }).join('');
}
