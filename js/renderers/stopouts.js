import { S } from '../state.js';
import { $ } from '../utils.js';

export function renderStopouts() {
  const el = $('stopout-table');
  if (!el) return;
  el.innerHTML = S.stopouts.map(s => {
    const cls = s.margin < 120 ? 'red' : s.margin < 140 ? 'amber' : 'green';
    return `<tr>
      <td style="padding-left:0" class="mono">${s.id}</td>
      <td>${s.sym}</td>
      <td class="mono ${cls}" style="text-align:right;font-weight:700">${s.margin}%</td>
      <td class="mono" style="text-align:right">$${s.equity.toLocaleString()}</td>
      <td class="mono dim" style="text-align:right">$${s.req.toLocaleString()}</td>
      <td class="mono dim" style="text-align:right">${s.lots}</td>
      <td style="text-align:right;padding-right:0">
        <button class="hedge-btn" style="font-size:9px;padding:3px 8px" onclick="window.__callAccount('${s.id}')">CALL</button>
      </td>
    </tr>`;
  }).join('');
}
