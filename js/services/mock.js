import { jit } from '../utils.js';

export class MockDataProvider {
  generateUpdate(currentState) {
    const update = {
      grossRevenue:  Math.round(jit(107745, 1.5)),
      netProfit:     Math.round(jit(53478, 2)),
      openPositions: Math.round(jit(1834, 0.8)),
      lpMarginUsed:  Math.round(jit(87400, 2)),
      unrealisedPnl: Math.round(jit(12840, 6)),
      bBookTotal:    Math.round(jit(currentState.bBookTotal, 1.5)),
      spreadRevenue: Math.round(jit(13065, 1)),
      commRevenue:   Math.round(jit(3900, 1)),
      swapRevenue:   Math.round(jit(1755, 0.5)),
      bBookPnl:      Math.round(jit(3900, 3)),
      exposure:      currentState.exposure.map(e => ({ ...e, net: Math.round(jit(e.net, 2)) })),
      sessions:      currentState.sessions.map(s => ({
        ...s,
        lat: s.status === 'connected' ? +jit(s.lat, 8).toFixed(1) : null,
      })),
    };

    // Random latency spike
    let spikeAlert = null;
    if (Math.random() < 0.03) {
      update.sessions[2].lat = +(Math.random() * 30 + 15).toFixed(1);
      spikeAlert = {
        message: 'Finalto latency elevated: ' + update.sessions[2].lat + 'ms',
        type: 'amber',
      };
    }

    // Jitter trader P&L, trade counts, and push new return
    update.traders = currentState.traders.map(t => {
      const newReturn = t.dailyReturn + (Math.random() - 0.5) * t.volatility * 0.8;
      const returns = [...t.returns.slice(1), +newReturn.toFixed(6)];
      // Update lastVariance via GARCH step
      const lastEps = newReturn - t.dailyReturn;
      const lastVariance = t.garch.omega + t.garch.alpha * lastEps * lastEps + t.garch.beta * t.garch.lastVariance;
      return {
        ...t,
        pnl: Math.round(jit(t.pnl, 1.5)),
        trades: t.trades + (Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0),
        returns,
        garch: { ...t.garch, lastVariance },
      };
    });

    return { update, spikeAlert };
  }
}
