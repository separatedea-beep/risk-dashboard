import { CONFIG } from './config.js';
import { S } from './state.js';
import { ApiService } from './services/api.js';
import { WebSocketService } from './services/websocket.js';
import { initNav } from './ui/nav.js';
import { startClocks } from './ui/clocks.js';
import { toast } from './ui/toast.js';
import { buildCharts } from './ui/charts.js';
import { renderOverviewMetrics, renderExpBarsOverview, renderSessionsMini } from './renderers/overview.js';
import { renderExpTable } from './renderers/exposure.js';
import { renderSessionsFull } from './renderers/sessions.js';
import { renderPnl } from './renderers/pnl.js';
import { renderEmi } from './renderers/emi.js';
import { renderRecon } from './renderers/recon.js';
import { renderAlerts } from './renderers/alerts.js';
import { renderStopouts } from './renderers/stopouts.js';
import { renderTraders } from './renderers/traders.js';
import { renderCompliance } from './renderers/compliance.js';

// ── WebSocket instance (available globally for debugging) ────
const ws = new WebSocketService();

// ── Render everything ────────────────────────────────────────
function renderAll() {
  renderOverviewMetrics();
  renderExpBarsOverview();
  renderExpTable();
  renderSessionsMini();
  renderSessionsFull();
  renderAlerts('alerts-preview', 3);
  renderAlerts('all-alerts-body', null);
  renderPnl();
  renderEmi();
  renderRecon();
  renderStopouts();
  renderTraders();
  renderCompliance();
}

// ── Actions (exposed to HTML onclick handlers) ───────────────
window.triggerHedge = async function () {
  toast('⊠ Full hedge initiated — sending to IS Prime', 'red');
  await ApiService.triggerHedge();
  renderAll();
};

window.__callAccount = async function (id) {
  toast('📞 Margin call sent to account ' + id, 'amber');
  await ApiService.sendMarginCall(id);
};

window.__selectTrader = function (id) {
  S.selectedTraderId = S.selectedTraderId === id ? null : id;
  renderAll();
};

window.__rerouteTrader = async function (id) {
  const trader = S.traders.find(t => t.id === id);
  if (!trader) return;
  const newBook = trader.book === 'B' ? 'A' : 'B';
  await ApiService.rerouteTrader(id, newBook);
  toast(`${trader.name} rerouted to ${newBook}-book`, newBook === 'A' ? 'green' : 'amber');
  renderAll();
};

// ── Compliance actions ───────────────────────────────────────
window.__approveKyc = async function (id) {
  const client = S.kyc.queue.find(c => c.id === id);
  if (client) { client.status = 'approved'; S.kyc.stats.pending = Math.max(0, S.kyc.stats.pending - 1); S.kyc.stats.approved++; }
  await ApiService.approveKyc(id);
  toast(`KYC approved — ${client?.name || id}`, 'green');
  renderAll();
};

window.__rejectKyc = async function (id) {
  const client = S.kyc.queue.find(c => c.id === id);
  if (client) { client.status = 'rejected'; S.kyc.stats.pending = Math.max(0, S.kyc.stats.pending - 1); S.kyc.stats.rejected++; }
  await ApiService.rejectKyc(id);
  toast(`KYC rejected — ${client?.name || id}`, 'amber');
  renderAll();
};

window.__fileSar = function (accountId) {
  const alert = S.compliance.amlAlerts.find(a => a.accountId === accountId);
  if (alert) alert.filed = true;
  toast(`SAR filed for account ${accountId}`, 'red');
  renderAll();
};

window.__dismissAml = function (accountId) {
  const alert = S.compliance.amlAlerts.find(a => a.accountId === accountId);
  if (alert) alert.dismissed = true;
  toast(`AML alert dismissed — ${accountId}`, 'amber');
  renderAll();
};

window.__approveWithdrawal = async function (accountId) {
  const w = S.compliance.withdrawals.find(w => w.accountId === accountId);
  if (w) w.status = 'approved';
  await ApiService.approveWithdrawal(accountId);
  toast(`Withdrawal approved — ${accountId}`, 'green');
  renderAll();
};

window.__rejectWithdrawal = async function (accountId) {
  const w = S.compliance.withdrawals.find(w => w.accountId === accountId);
  if (w) w.status = 'rejected';
  await ApiService.rejectWithdrawal(accountId);
  toast(`Withdrawal rejected — ${accountId}`, 'amber');
  renderAll();
};

// ── Data update loop ─────────────────────────────────────────
async function fetchAndRender() {
  try {
    const result = await ApiService.fetchSnapshot();
    if (result.spikeAlert) {
      toast('⚠ ' + result.spikeAlert.message, result.spikeAlert.type);
    }
    renderAll();
  } catch (err) {
    console.error('[App] Data fetch error:', err);
  }
}

function startDataLoop() {
  if (CONFIG.WS_URL && !CONFIG.USE_MOCK) {
    // ── WebSocket mode ─────────────────────────────────────
    ws.onStatusChange((status) => {
      console.info('[App] WS status:', status);
      // Could update the LIVE badge here
    });

    ws.onMessage(() => {
      // State is auto-updated by WebSocketService when msg.state exists
      renderAll();
    });

    ws.connect();
  } else {
    // ── Polling / Mock mode ────────────────────────────────
    const interval = CONFIG.USE_MOCK ? CONFIG.MOCK_INTERVAL : CONFIG.POLL_INTERVAL;
    setInterval(fetchAndRender, interval);
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  startClocks();
  renderAll();
  buildCharts();
  startDataLoop();
  toast('Dashboard connected — all systems nominal', 'green');
});
