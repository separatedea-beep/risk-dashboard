import { S } from '../state.js';
import { $ } from '../utils.js';

export function renderRecon() {
  const el = $('recon-rows');
  if (!el) return;
  el.innerHTML = S.recon.map(r => `
    <div class="recon-grid">
      <div class="recon-cell">${r.item}</div>
      <div class="recon-cell mono">${r.a}</div>
      <div class="recon-cell mono">${r.b}</div>
      <div class="recon-cell status-cell">
        <span class="match-badge ${r.ok ? 'match-ok' : 'match-break'}">${r.ok ? '✓ MATCH' : '✗ BREAK'}</span>
      </div>
    </div>`).join('');
}
