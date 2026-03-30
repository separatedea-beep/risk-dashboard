# Risk Management Dashboard

Broker risk management dashboard with trader toxicity scoring, A/B-book routing recommendations, Monte Carlo simulations, and GARCH volatility modelling.

## Quick Start

### Option A — Open directly in browser
1. Open `risk-dashboard` in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Dashboard opens at `http://localhost:5500`

### Option B — Node.js
```bash
npm install
npm start
```
Opens at `http://localhost:3000`

### Option C — Python
```bash
python3 -m http.server 3000
```
Then open `http://localhost:3000`

---

## Views

### Monitor
| View | What it shows |
|------|--------------|
| **Overview** | Key metrics, B-book exposure bars, LP margin gauge, session health |
| **Exposure** | B-book exposure per instrument, history chart, correlation risk |
| **LP Sessions** | FIX session statuses, latency, rejection rates, uptime |
| **Traders** | Per-trader toxicity, win rate, GARCH vol, A/B-book recommendation, Monte Carlo P&L simulation |

### Finance
| View | What it shows |
|------|--------------|
| **P&L Summary** | Revenue and cost breakdown, monthly trend |
| **EMI Balances** | Segregated pool balances and segregation check |

### Operations
| View | What it shows |
|------|--------------|
| **Reconciliation** | Daily three-way match status and break log |
| **Alerts** | Active and resolved alerts |
| **Stop-outs** | Accounts approaching stop-out |

### Compliance
| View | What it shows |
|------|--------------|
| **KYC / AML** | KYC application queue with risk scoring, PEP/sanctions flags, approve/reject actions, AML transaction alerts with SAR filing |
| **Withdrawals** | Pending withdrawal approval queue, first-withdrawal flagging, approve/reject actions |
| **Regulatory** | Report filing status for EMIR, best execution, ICAAP, AML activity reports |

## Trader Intelligence

- **Toxicity score** — composite of win rate, hold time, slippage patterns, and news-event clustering
- **GARCH volatility** — per-trader volatility regime (current vs long-run), flagging elevated risk
- **Monte Carlo simulation** — 1,000-path P&L distribution with VaR (95%) and CVaR
- **Routing recommendation** — A-BOOK / REVIEW / B-BOOK based on toxicity (40%), win rate (25%), vol regime (20%), P&L direction (15%)
- Mismatches between current book and recommendation are highlighted

## Connecting Real Data

Edit `js/config.js`:

```js
API_BASE_URL: 'https://your-backoffice.com/api/v1',   // Bridge / back office REST API
WS_URL:       'wss://your-backoffice.com/ws/risk',    // Bridge WebSocket feed
API_TOKEN:    'your-token',
USE_MOCK:     false,

KYC_BASE_URL: 'https://your-kyc-system.com/api/v1',  // Partner KYC system (optional)
KYC_TOKEN:    'kyc-api-key',
```

When `USE_MOCK: false` and `API_BASE_URL` is set, the dashboard switches from simulated data to live REST polling + WebSocket streaming. The WebSocket service auto-reconnects with exponential backoff.

### REST endpoints expected

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/risk/snapshot` | Full state snapshot |
| POST | `/risk/hedge` | Trigger B-book hedge |
| POST | `/risk/reroute` | Reroute trader between books |
| POST | `/risk/margin-call` | Send margin call to account |

### WebSocket message format

```json
{ "channel": "risk", "data": { ...state fields... } }
```
or
```json
{ "state": { ...partial state... } }
```

## Project Structure

```
risk-dashboard/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js              ← entry point, action handlers
│   ├── config.js           ← API/WS/KYC endpoints, thresholds
│   ├── state.js            ← centralised state
│   ├── utils.js
│   ├── services/
│   │   ├── api.js          ← REST client + field mapping (bridge + KYC)
│   │   ├── websocket.js    ← WS client, auto-reconnect, exponential backoff
│   │   ├── mock.js         ← simulated data provider
│   │   ├── garch.js        ← GARCH(1,1) volatility model
│   │   └── montecarlo.js   ← Monte Carlo P&L simulation (1,000 paths)
│   ├── renderers/
│   │   ├── overview.js
│   │   ├── exposure.js
│   │   ├── sessions.js
│   │   ├── traders.js      ← toxicity, GARCH, A/B-book recommendation
│   │   ├── pnl.js
│   │   ├── emi.js
│   │   ├── recon.js
│   │   ├── alerts.js
│   │   ├── stopouts.js
│   │   └── compliance.js   ← KYC queue, AML alerts, withdrawals, regulatory
│   └── ui/
│       ├── nav.js
│       ├── clocks.js
│       ├── toast.js
│       └── charts.js
└── package.json
```
