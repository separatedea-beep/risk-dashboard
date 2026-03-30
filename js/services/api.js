import { CONFIG } from '../config.js';
import { S, updateState } from '../state.js';
import { MockDataProvider } from './mock.js';

const mock = new MockDataProvider();

async function apiFetch(endpoint, options = {}) {
  const url = CONFIG.API_BASE_URL + endpoint;
  const headers = {
    'Content-Type': 'application/json',
    ...(CONFIG.API_TOKEN ? { 'Authorization': 'Bearer ' + CONFIG.API_TOKEN } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

function useMock() {
  return CONFIG.USE_MOCK || !CONFIG.API_BASE_URL;
}

export const ApiService = {
  /**
   * Fetch a full risk snapshot (all state fields).
   * Map your API response fields to match the S object shape.
   */
  async fetchSnapshot() {
    if (useMock()) {
      const { update, spikeAlert } = mock.generateUpdate(S);
      updateState(update);
      return { spikeAlert };
    }

    // ── Replace with your real endpoint mapping ──────────────
    const data = await apiFetch('/risk/snapshot');

    updateState({
      grossRevenue:  data.gross_revenue    ?? S.grossRevenue,
      netProfit:     data.net_profit       ?? S.netProfit,
      activeClients: data.active_clients   ?? S.activeClients,
      openPositions: data.open_positions   ?? S.openPositions,
      lpMarginUsed:  data.lp_margin_used   ?? S.lpMarginUsed,
      lpCollateral:  data.lp_collateral    ?? S.lpCollateral,
      unrealisedPnl: data.unrealised_pnl   ?? S.unrealisedPnl,
      bBookTotal:    data.bbook_total      ?? S.bBookTotal,
      bBookLimit:    data.bbook_limit      ?? S.bBookLimit,
      spreadRevenue: data.spread_revenue   ?? S.spreadRevenue,
      commRevenue:   data.comm_revenue     ?? S.commRevenue,
      swapRevenue:   data.swap_revenue     ?? S.swapRevenue,
      bBookPnl:      data.bbook_pnl        ?? S.bBookPnl,
      exposure:      data.exposure         ?? S.exposure,
      sessions:      data.sessions         ?? S.sessions,
      alerts:        data.alerts           ?? S.alerts,
      stopouts:      data.stopouts         ?? S.stopouts,
      recon:         data.recon            ?? S.recon,
    });

    return {};
  },

  /**
   * Trigger a full B-book hedge.
   */
  async triggerHedge() {
    if (useMock()) {
      S.bBookTotal = Math.round(S.bBookTotal * 0.3);
      S.exposure = S.exposure.map(e => ({ ...e, net: Math.round(e.net * 0.3) }));
      return { success: true };
    }

    return apiFetch('/risk/hedge', { method: 'POST' });
  },

  /**
   * Reroute a trader between A-book and B-book.
   */
  async rerouteTrader(traderId, newBook) {
    if (useMock()) {
      const trader = S.traders.find(t => t.id === traderId);
      if (trader) trader.book = newBook;
      return { success: true, traderId, book: newBook };
    }

    return apiFetch('/risk/reroute', {
      method: 'POST',
      body: JSON.stringify({ trader_id: traderId, book: newBook }),
    });
  },

  /**
   * Send a margin call to an account.
   */
  async sendMarginCall(accountId) {
    if (useMock()) {
      return { success: true, accountId };
    }

    return apiFetch('/risk/margin-call', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    });
  },

  // ── KYC / Compliance ───────────────────────────────────────
  // These call CONFIG.KYC_BASE_URL if set, otherwise fall back to mock.
  // Field names are placeholders — adjust to match your partner's API schema.

  async fetchKycQueue() {
    if (!CONFIG.KYC_BASE_URL) return null; // mock data already in state
    const headers = CONFIG.KYC_TOKEN
      ? { 'Authorization': 'Bearer ' + CONFIG.KYC_TOKEN }
      : {};
    const res = await fetch(CONFIG.KYC_BASE_URL + '/kyc/queue', { headers });
    if (!res.ok) throw new Error(`KYC API ${res.status}`);
    const data = await res.json();
    // ── Map your partner's field names here ──────────────────
    return (data.applications || data).map(c => ({
      id:         c.account_id   || c.id,
      name:       c.full_name    || c.name,
      country:    c.country_code || c.country,
      status:     c.kyc_status   || c.status,   // 'pending'|'approved'|'rejected'|'review'
      risk:       c.risk_level   || c.risk,      // 'low'|'medium'|'high'
      pep:        c.is_pep       ?? c.pep        ?? false,
      sanctioned: c.is_sanctioned ?? c.sanctioned ?? false,
      submitted:  c.submitted_at || c.submitted,
      waitHours:  c.wait_hours   || c.waitHours  || 0,
    }));
  },

  async approveKyc(accountId) {
    if (!CONFIG.KYC_BASE_URL) return { success: true };
    return fetch(CONFIG.KYC_BASE_URL + '/kyc/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(CONFIG.KYC_TOKEN ? { Authorization: 'Bearer ' + CONFIG.KYC_TOKEN } : {}) },
      body: JSON.stringify({ account_id: accountId }),
    }).then(r => r.json());
  },

  async rejectKyc(accountId) {
    if (!CONFIG.KYC_BASE_URL) return { success: true };
    return fetch(CONFIG.KYC_BASE_URL + '/kyc/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(CONFIG.KYC_TOKEN ? { Authorization: 'Bearer ' + CONFIG.KYC_TOKEN } : {}) },
      body: JSON.stringify({ account_id: accountId }),
    }).then(r => r.json());
  },

  async fetchWithdrawals() {
    if (!CONFIG.KYC_BASE_URL) return null;
    const headers = CONFIG.KYC_TOKEN ? { Authorization: 'Bearer ' + CONFIG.KYC_TOKEN } : {};
    const res = await fetch(CONFIG.KYC_BASE_URL + '/withdrawals/pending', { headers });
    if (!res.ok) throw new Error(`Withdrawals API ${res.status}`);
    const data = await res.json();
    return (data.withdrawals || data).map(w => ({
      accountId:      w.account_id    || w.accountId,
      name:           w.client_name   || w.name,
      amount:         w.amount,
      method:         w.method        || w.payment_method,
      requested:      w.requested_at  || w.requested,
      status:         w.status,
      firstWithdrawal: w.first_withdrawal ?? w.firstWithdrawal ?? false,
    }));
  },

  async approveWithdrawal(accountId) {
    if (!CONFIG.KYC_BASE_URL) return { success: true };
    return apiFetch('/withdrawals/approve', { method: 'POST', body: JSON.stringify({ account_id: accountId }) });
  },

  async rejectWithdrawal(accountId) {
    if (!CONFIG.KYC_BASE_URL) return { success: true };
    return apiFetch('/withdrawals/reject', { method: 'POST', body: JSON.stringify({ account_id: accountId }) });
  },
};
