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
};
