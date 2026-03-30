import { S } from '../state.js';
import { $, fmtN, clamp } from '../utils.js';

export function renderExpTable() {
  const el = $('exp-table-body');
  if (!el) return;
  el.innerHTML = S.exposure.map(e => {
    const pct = clamp(Math.round(e.net / e.limit * 100), 0, 100);
    const sc  = pct > 90 ? 'red' : pct > 70 ? 'amber' : 'green';
    const tag = pct > 90 ? 'tag-red' : pct > 70 ? 'tag-amber' : 'tag-green';
    const dtag = e.dir === 'long' ? 'tag-green' : 'tag-red';
    return `<tr>
      <td style="padding-left:14px" class="mono">${e.sym}</td>
      <td><span class="panel-tag ${dtag}">${e.dir.toUpperCase()}</span></td>
      <td class="mono" style="text-align:right">${fmtN(e.net)}</td>
      <td class="mono dim" style="text-align:right">${fmtN(e.limit)}</td>
      <td style="text-align:right">
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div class="progress-track" style="width:60px">
            <div class="progress-fill ${pct > 90 ? 'fill-red' : pct > 70 ? 'fill-amber' : 'fill-green'}" style="width:${pct}%"></div>
          </div>
          <span class="mono ${sc}" style="font-size:11px;min-width:32px">${pct}%</span>
        </div>
      </td>
      <td style="padding-right:14px;text-align:right"><span class="panel-tag ${tag}">${pct > 90 ? 'CRITICAL' : pct > 70 ? 'WARNING' : 'OK'}</span></td>
    </tr>`;
  }).join('');
}
