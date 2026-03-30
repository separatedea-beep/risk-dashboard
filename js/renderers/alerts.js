import { S } from '../state.js';
import { $ } from '../utils.js';

export function renderAlerts(elId, max) {
  const el = $(elId);
  if (!el) return;
  const items = max ? S.alerts.slice(0, max) : S.alerts;
  el.innerHTML = items.map(a => {
    const icon = a.level === 'red' ? '✕' : a.level === 'amber' ? '⚠' : '✓';
    return `<div class="alert-item alert-${a.level}">
      <span class="alert-icon">${icon}</span>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
      </div>
      <div class="alert-time">${a.time}</div>
    </div>`;
  }).join('');

  const active = S.alerts.filter(a => a.level !== 'green').length;
  const tag = $('alerts-count-tag');
  if (tag) tag.textContent = active + ' active';
  const allTag = $('all-alerts-tag');
  if (allTag) allTag.textContent = active + ' active';
  const badge = $('alert-badge');
  if (badge) badge.textContent = active;
}
