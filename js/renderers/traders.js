import { S } from '../state.js';
import { $ } from '../utils.js';
import { runMonteCarlo } from '../services/montecarlo.js';
import { generateGarchPaths, forecastVolatility } from '../services/garch.js';

let garchChart = null;
let constChart = null;
let volChart = null;

export function renderTraderSummary() {
  const bBookTraders = S.traders.filter(t => t.book === 'B');
  const toxicCount   = S.traders.filter(t => t.toxicity > 70).length;
  const reRouteCount = S.traders.filter(t => t.toxicity > 70 && t.book === 'B').length;

  // Aggregate GARCH VaR
  let totalVaR = 0;
  for (const t of bBookTraders) {
    if (t.dailyReturn > 0) {
      const mc = generateGarchPaths({
        ...t.garch, mu: t.dailyReturn,
        lastReturn: t.returns[t.returns.length - 1],
        days: 30, paths: 100, startEquity: 10000,
      });
      const loss = mc.stats.p95 - 10000;
      if (loss > 0) totalVaR += loss;
    }
  }

  const el = $('trader-summary-cards');
  if (!el) return;
  el.innerHTML = `
    <div class="metric-card accent">
      <div class="metric-label">B-book Traders</div>
      <div class="metric-value accent">${bBookTraders.length}</div>
      <div class="metric-sub">of ${S.traders.length} total</div>
    </div>
    <div class="metric-card red-c">
      <div class="metric-label">Toxic Flagged</div>
      <div class="metric-value red">${toxicCount}</div>
      <div class="metric-sub">score &gt; 70</div>
    </div>
    <div class="metric-card amber-c">
      <div class="metric-label">GARCH VaR (95th)</div>
      <div class="metric-value amber">$${Math.round(totalVaR).toLocaleString()}</div>
      <div class="metric-sub">30-day projected risk</div>
    </div>
    <div class="metric-card red-c">
      <div class="metric-label">Reroute Recommended</div>
      <div class="metric-value red">${reRouteCount}</div>
      <div class="metric-sub">toxic on B-book</div>
    </div>
  `;

  const badge = $('traders-badge');
  if (badge) {
    badge.textContent = toxicCount;
    badge.style.display = toxicCount > 0 ? '' : 'none';
  }
}

export function renderTraderTable() {
  const el = $('trader-table-body');
  if (!el) return;

  const sorted = [...S.traders].sort((a, b) => b.toxicity - a.toxicity);

  el.innerHTML = sorted.map(t => {
    const toxCls  = t.toxicity > 70 ? 'red' : t.toxicity > 40 ? 'amber' : 'green';
    const pnlCls  = t.pnl >= 0 ? 'green' : 'red';
    const pnlSign = t.pnl >= 0 ? '+' : '';
    const bookTag = t.book === 'A' ? 'tag-blue' : 'tag-amber';
    const selected = S.selectedTraderId === t.id ? ' trader-row-selected' : '';

    // Current GARCH vol (annualised) vs long-run
    const currentVol = Math.sqrt(t.garch.lastVariance * 252);
    const longRunVol = Math.sqrt((t.garch.omega / (1 - t.garch.alpha - t.garch.beta)) * 252);
    const volPct = (currentVol * 100).toFixed(1);
    const volArrow = currentVol > longRunVol * 1.05 ? '↑' : currentVol < longRunVol * 0.95 ? '↓' : '→';
    const volCls = currentVol > longRunVol * 1.1 ? 'red' : currentVol < longRunVol * 0.9 ? 'green' : 'amber';

    // Recommendation engine: composite score determines A-book vs B-book
    // Factors: toxicity (40%), win rate vs house (25%), vol regime (20%), P&L direction (15%)
    const volElevated = currentVol > longRunVol * 1.1;
    const traderProfitable = t.pnl < 0; // negative pnl = trader winning vs house
    let recScore = 0;
    recScore += (t.toxicity / 100) * 40;                          // toxicity: 0-40
    recScore += (Math.max(t.winRate - 50, 0) / 50) * 25;         // win rate above 50%: 0-25
    recScore += (volElevated ? 15 : (currentVol > longRunVol ? 10 : 0)); // elevated vol: 0-15
    recScore += (traderProfitable ? 15 : 0);                      // trader beating house: 0-15

    const rec = recScore > 55 ? 'A' : recScore > 35 ? 'REVIEW' : 'B';
    const recTag = rec === 'A' ? 'tag-blue' : rec === 'REVIEW' ? 'tag-amber' : 'tag-green';
    const recLabel = rec === 'A' ? 'A-BOOK' : rec === 'REVIEW' ? 'REVIEW' : 'B-BOOK';
    const mismatch = (rec === 'A' && t.book === 'B') ? ' rec-mismatch' : '';

    return `<tr class="trader-row${selected}" onclick="window.__selectTrader('${t.id}')">
      <td style="padding-left:14px" class="mono">${t.id}</td>
      <td>${t.name}</td>
      <td class="mono" style="text-align:right">${t.trades}</td>
      <td class="mono ${t.winRate > 60 ? 'red' : t.winRate > 50 ? 'amber' : 'green'}" style="text-align:right">${t.winRate}%</td>
      <td class="mono ${pnlCls}" style="text-align:right">${pnlSign}$${Math.abs(t.pnl).toLocaleString()}</td>
      <td class="mono dim" style="text-align:center">${t.avgHold}</td>
      <td style="text-align:center">
        <div class="toxicity-bar-wrap">
          <div class="toxicity-bar">
            <div class="toxicity-fill toxicity-${toxCls}" style="width:${t.toxicity}%"></div>
          </div>
          <span class="mono ${toxCls}" style="font-size:11px;min-width:28px">${t.toxicity}</span>
        </div>
      </td>
      <td class="mono ${volCls}" style="text-align:center;font-size:11px">${volPct}% <span style="font-size:10px">${volArrow}</span></td>
      <td style="text-align:center"><span class="panel-tag ${recTag}${mismatch}">${recLabel}</span></td>
      <td style="text-align:center"><span class="panel-tag ${bookTag}">${t.book}-BOOK</span></td>
      <td style="text-align:right;padding-right:14px">
        <button class="hedge-btn" style="font-size:9px;padding:3px 8px" onclick="event.stopPropagation(); window.__rerouteTrader('${t.id}')">
          ${t.book === 'B' ? '→ A' : '→ B'}
        </button>
      </td>
    </tr>`;
  }).join('');
}

export function renderMonteCarloPanel() {
  const panel = $('mc-panel');
  if (!panel) return;

  if (!S.selectedTraderId) {
    panel.style.display = 'none';
    return;
  }

  const trader = S.traders.find(t => t.id === S.selectedTraderId);
  if (!trader) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';

  const titleEl = $('mc-trader-name');
  if (titleEl) titleEl.textContent = `${trader.name} (${trader.id})`;

  const lastReturn = trader.returns[trader.returns.length - 1];

  // Run GARCH MC
  const garchMc = generateGarchPaths({
    ...trader.garch,
    mu: trader.dailyReturn,
    lastReturn,
    days: 30,
    paths: 500,
    startEquity: 10000,
  });

  // Run constant-vol MC for comparison
  const constMc = runMonteCarlo({
    dailyReturn: trader.dailyReturn,
    volatility: trader.volatility,
    days: 30,
    paths: 500,
    startEquity: 10000,
  });

  // Vol term structure
  const volForecast = forecastVolatility({
    ...trader.garch,
    lastReturn,
    days: 30,
  });

  const longRunVol = Math.sqrt((trader.garch.omega / (1 - trader.garch.alpha - trader.garch.beta)) * 252);

  // Render stats
  renderGarchStats(garchMc, constMc, volForecast, longRunVol);

  // Render charts
  renderFanChart('mc-garch-chart', garchMc.percentiles, garchChart, c => { garchChart = c; });
  renderFanChart('mc-const-chart', constMc.percentiles, constChart, c => { constChart = c; });
  renderVolChart(volForecast, longRunVol);
}

function renderGarchStats(garchMc, constMc, volForecast, longRunVol) {
  const statsEl = $('mc-stats');
  if (!statsEl) return;

  const gHousePnl = 10000 - garchMc.stats.median;
  const cHousePnl = 10000 - constMc.stats.median;
  const gHouseCls = gHousePnl >= 0 ? 'green' : 'red';
  const gHouseSign = gHousePnl >= 0 ? '+' : '';

  const varDelta = garchMc.stats.p95 - constMc.stats.p95;
  const varDeltaPct = constMc.stats.p95 > 10000
    ? Math.round(((garchMc.stats.p95 - constMc.stats.p95) / (constMc.stats.p95 - 10000)) * 100)
    : 0;

  const currentVol = (volForecast[0] * 100).toFixed(1);
  const vol5d  = (volForecast.slice(0, 5).reduce((s, v) => s + v, 0) / 5 * 100).toFixed(1);
  const vol10d = (volForecast.slice(0, 10).reduce((s, v) => s + v, 0) / 10 * 100).toFixed(1);
  const vol30d = (volForecast.reduce((s, v) => s + v, 0) / volForecast.length * 100).toFixed(1);
  const lrVol  = (longRunVol * 100).toFixed(1);

  statsEl.innerHTML = `
    <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">GARCH vs Constant Vol</div>
    <div class="data-row">
      <span class="data-row-label">House P&L (GARCH median)</span>
      <span class="data-row-val ${gHouseCls}">${gHouseSign}\$${Math.abs(gHousePnl).toLocaleString()}</span>
    </div>
    <div class="data-row">
      <span class="data-row-label">GARCH VaR (95th)</span>
      <span class="data-row-val red">\$${garchMc.stats.p95.toLocaleString()}</span>
    </div>
    <div class="data-row">
      <span class="data-row-label">Const VaR (95th)</span>
      <span class="data-row-val" style="color:var(--text2)">\$${constMc.stats.p95.toLocaleString()}</span>
    </div>
    <div class="data-row">
      <span class="data-row-label">VaR delta (GARCH − Const)</span>
      <span class="data-row-val ${varDelta > 0 ? 'red' : 'green'}">${varDelta > 0 ? '+' : ''}\$${Math.abs(varDelta).toLocaleString()} <span style="font-size:9px">(${varDeltaPct > 0 ? '+' : ''}${varDeltaPct}%)</span></span>
    </div>
    <div class="data-row">
      <span class="data-row-label">Prob. trader profits (GARCH)</span>
      <span class="data-row-val ${garchMc.stats.probLoss > 50 ? 'red' : 'green'}">${garchMc.stats.probLoss}%</span>
    </div>
    <div class="data-row">
      <span class="data-row-label">Max drawdown (GARCH)</span>
      <span class="data-row-val amber">${garchMc.stats.maxDrawdown}%</span>
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Volatility Forecast (ann.)</div>
      <div class="data-row">
        <span class="data-row-label">Current σ</span>
        <span class="data-row-val ${parseFloat(currentVol) > parseFloat(lrVol) ? 'red' : 'green'}">${currentVol}%</span>
      </div>
      <div class="data-row">
        <span class="data-row-label">Long-run σ</span>
        <span class="data-row-val" style="color:var(--text2)">${lrVol}%</span>
      </div>
      <div class="data-row">
        <span class="data-row-label">5d / 10d / 30d avg σ</span>
        <span class="data-row-val" style="font-size:10px">${vol5d}% / ${vol10d}% / ${vol30d}%</span>
      </div>
    </div>
  `;
}

function renderFanChart(canvasId, percentiles, existingChart, setter) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const labels = Array.from({ length: percentiles.p50.length }, (_, i) => 'D' + i);
  if (existingChart) existingChart.destroy();

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '95th', data: percentiles.p95, borderColor: 'rgba(255,82,82,0.4)', backgroundColor: 'rgba(255,82,82,0.06)', borderWidth: 1, fill: '+1', tension: 0.3, pointRadius: 0 },
        { label: '75th', data: percentiles.p75, borderColor: 'rgba(255,171,0,0.4)', backgroundColor: 'rgba(255,171,0,0.06)', borderWidth: 1, fill: '+1', tension: 0.3, pointRadius: 0 },
        { label: 'Median', data: percentiles.p50, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)', borderWidth: 2, fill: '+1', tension: 0.3, pointRadius: 0 },
        { label: '25th', data: percentiles.p25, borderColor: 'rgba(0,230,118,0.4)', backgroundColor: 'rgba(0,230,118,0.06)', borderWidth: 1, fill: '+1', tension: 0.3, pointRadius: 0 },
        { label: '5th', data: percentiles.p5, borderColor: 'rgba(0,230,118,0.4)', borderWidth: 1, fill: false, tension: 0.3, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#4a5568', font: { size: 8 }, maxTicksLimit: 5 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#4a5568', font: { size: 8 }, callback: v => '$' + (v / 1000).toFixed(1) + 'k' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  setter(chart);
}

function renderVolChart(volForecast, longRunVol) {
  const canvas = $('vol-chart');
  if (!canvas) return;

  const labels = Array.from({ length: volForecast.length }, (_, i) => 'D' + (i + 1));
  const longRunLine = new Array(volForecast.length).fill(longRunVol * 100);
  const volPcts = volForecast.map(v => v * 100);

  if (volChart) volChart.destroy();

  volChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'GARCH σ forecast',
          data: volPcts,
          borderColor: '#b388ff',
          backgroundColor: 'rgba(179,136,255,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Long-run σ',
          data: longRunLine,
          borderColor: 'rgba(138,151,168,0.5)',
          borderWidth: 1,
          borderDash: [4, 4],
          fill: false,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#4a5568', font: { size: 8 }, maxTicksLimit: 7 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#4a5568', font: { size: 8 }, callback: v => v.toFixed(0) + '%' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

export function renderTraders() {
  renderTraderSummary();
  renderTraderTable();
  renderMonteCarloPanel();
}
