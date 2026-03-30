import { S } from '../state.js';
import { $, fmt, setVal, clamp } from '../utils.js';

export function renderOverviewMetrics() {
  const marginPct = Math.round(S.lpMarginUsed / S.lpCollateral * 100);
  const bPct      = Math.round(S.bBookTotal / S.bBookLimit * 100);
  const mCls      = marginPct > 85 ? 'red' : marginPct > 70 ? 'amber' : '';
  const bCls      = bPct > 90 ? 'red' : bPct > 70 ? 'amber' : 'accent';

  setVal('m-profit',      '$' + S.netProfit.toLocaleString(), true);
  setVal('m-revenue',     '$' + S.grossRevenue.toLocaleString(), true);
  setVal('m-bbook-pct',   bPct + '%');
  setVal('m-bbook-sub',   fmt(S.bBookTotal) + ' / ' + fmt(S.bBookLimit) + ' limit');
  setVal('m-margin-pct',  marginPct + '%');
  setVal('m-margin-sub',  fmt(S.lpMarginUsed) + ' / ' + fmt(S.lpCollateral));
  setVal('m-positions',   S.openPositions.toLocaleString());
  setVal('m-upnl',        (S.unrealisedPnl >= 0 ? '+' : '') + '$' + S.unrealisedPnl.toLocaleString());
  setVal('m-stopout-count', S.stopouts.length);

  const mpv = $('m-margin-pct');
  if (mpv) mpv.className = 'metric-value ' + mCls;
  const bpv = $('m-bbook-pct');
  if (bpv) bpv.className = 'metric-value ' + bCls;

  setVal('gauge-used',  fmt(S.lpMarginUsed));
  setVal('gauge-avail', fmt(S.lpCollateral - S.lpMarginUsed));
  updateGauge(marginPct);
}

export function renderExpBarsOverview() {
  const el = $('exp-bars-overview');
  if (!el) return;
  el.innerHTML = S.exposure.map(e => {
    const pct = clamp(Math.round(e.net / e.limit * 100), 0, 100);
    const cls = pct > 90 ? 'fill-red' : pct > 70 ? 'fill-amber' : 'fill-green';
    const tc  = pct > 90 ? 'red'      : pct > 70 ? 'amber'      : 'green';
    return `<div class="progress-wrap">
      <span class="progress-label">${e.sym}</span>
      <div class="progress-track"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="progress-pct ${tc}">${pct}%</span>
    </div>`;
  }).join('');
}

export function renderSessionsMini() {
  const el = $('session-mini-body');
  if (!el) return;
  el.innerHTML = S.sessions.map(s => {
    const dot = s.status === 'connected' ? 'sdot-green' : s.status === 'standby' ? 'sdot-amber' : 'sdot-red';
    const val = s.lat ? s.lat.toFixed(1) + 'ms' : s.status;
    return `<div class="data-row">
      <span class="data-row-label" style="display:flex;align-items:center;gap:5px">
        <span class="sdot ${dot}"></span>${s.lp} ${s.type.split(' ')[0]}
      </span>
      <span class="data-row-val ${s.status === 'connected' ? 'green' : 'amber'}">${val}</span>
    </div>`;
  }).join('');
}

function updateGauge(pct) {
  const arc = $('gauge-arc');
  const txt = $('gauge-text');
  if (!arc || !txt) return;
  const total = 157;
  const filled = clamp(pct / 100 * total, 0, total);
  const col = pct > 85 ? '#ff5252' : pct > 70 ? '#ffab00' : '#00d4ff';
  arc.setAttribute('stroke-dasharray', `${filled} ${total - filled}`);
  arc.setAttribute('stroke', col);
  txt.textContent = Math.round(pct) + '%';
  txt.setAttribute('fill', col);
}
