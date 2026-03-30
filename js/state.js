export const S = {
  grossRevenue:  107745,
  netProfit:     53478,
  activeClients: 247,
  openPositions: 1834,
  lpMarginUsed:  87400,
  lpCollateral:  150000,
  unrealisedPnl: 12840,
  bBookTotal:    2180000,
  bBookLimit:    5000000,
  spreadRevenue: 13065,
  commRevenue:   3900,
  swapRevenue:   1755,
  bBookPnl:      3900,

  exposure: [
    { sym: 'EUR/USD', net: 1250000, limit: 2000000, dir: 'long' },
    { sym: 'XAU/USD', net: 480000,  limit: 500000,  dir: 'long' },
    { sym: 'GBP/USD', net: 180000,  limit: 1000000, dir: 'short' },
    { sym: 'US30',    net: 95000,   limit: 300000,  dir: 'long' },
    { sym: 'NAS100',  net: 42000,   limit: 300000,  dir: 'short' },
    { sym: 'WTI',     net: 133000,  limit: 200000,  dir: 'long' },
  ],

  sessions: [
    { lp: 'IS Prime',  type: 'Price Feed', status: 'connected', lat: 4.2,  rej: 0.3, up: 99.97 },
    { lp: 'IS Prime',  type: 'Order Feed', status: 'connected', lat: 3.8,  rej: 0.3, up: 99.97 },
    { lp: 'Finalto',   type: 'Price Feed', status: 'connected', lat: 7.1,  rej: 0.6, up: 99.91 },
    { lp: 'Finalto',   type: 'Order Feed', status: 'connected', lat: 6.9,  rej: 0.6, up: 99.91 },
    { lp: 'Backup LP', type: 'Price Feed', status: 'standby',   lat: null, rej: null, up: 99.95 },
    { lp: 'Backup LP', type: 'Order Feed', status: 'standby',   lat: null, rej: null, up: 99.95 },
  ],

  alerts: [
    { level: 'amber', title: 'XAU/USD exposure at 96% of limit', desc: '$480k vs $500k — review B-book routing', time: '2m ago' },
    { level: 'amber', title: 'Client #4471 margin level 118%',   desc: 'Approaching margin call — monitoring',    time: '14m ago' },
    { level: 'green', title: 'Daily reconciliation complete',    desc: 'All 3 sources matched — zero breaks',     time: '1h ago' },
    { level: 'green', title: 'LP margin utilisation healthy',    desc: '58.3% — within green threshold',          time: '2h ago' },
  ],

  stopouts: [
    { id: '#4471', sym: 'XAU/USD', margin: 118, equity: 2340, req: 1980, lots: 2.0 },
    { id: '#2209', sym: 'GBP/USD', margin: 134, equity: 1070, req: 800,  lots: 1.5 },
    { id: '#8834', sym: 'US30',    margin: 141, equity: 4230, req: 3000, lots: 3.0 },
  ],

  traders: [
    { id: '#4471', name: 'M. Chen',      trades: 342, winRate: 71, pnl: -18400, avgHold: '4m',  toxicity: 82, book: 'B', dailyReturn: 0.0038, volatility: 0.021,
      garch: { omega: 0.000010, alpha: 0.18, beta: 0.75, lastVariance: 0.00055 },
      returns: [0.008,0.003,-0.012,0.015,0.002,0.009,-0.004,0.011,0.006,-0.008,0.013,0.001,-0.003,0.018,-0.006,0.005,0.012,-0.002,0.007,0.004,-0.009,0.014,0.003,-0.001,0.022,-0.005,0.008,0.006,-0.011,0.010] },
    { id: '#2209', name: 'R. Petrov',     trades: 156, winRate: 64, pnl: -8200,  avgHold: '22m', toxicity: 61, book: 'B', dailyReturn: 0.0021, volatility: 0.018,
      garch: { omega: 0.000007, alpha: 0.10, beta: 0.82, lastVariance: 0.00035 },
      returns: [0.004,0.002,-0.006,0.008,0.001,0.005,-0.003,0.006,0.003,-0.005,0.007,0.000,-0.002,0.009,-0.004,0.003,0.006,-0.001,0.004,0.002,-0.005,0.007,0.001,-0.001,0.010,-0.003,0.004,0.003,-0.006,0.005] },
    { id: '#8834', name: 'J. Williams',   trades: 89,  winRate: 43, pnl: 12300,  avgHold: '2h',  toxicity: 22, book: 'B', dailyReturn: -0.0015, volatility: 0.025,
      garch: { omega: 0.000012, alpha: 0.06, beta: 0.85, lastVariance: 0.00065 },
      returns: [-0.003,0.005,-0.008,0.002,-0.006,0.004,-0.010,0.001,-0.004,0.007,-0.002,0.003,-0.009,0.006,-0.005,-0.001,0.008,-0.007,0.002,-0.003,0.005,-0.011,0.004,-0.006,0.001,-0.004,0.003,-0.008,0.006,-0.002] },
    { id: '#3391', name: 'S. Nakamura',   trades: 512, winRate: 68, pnl: -31200, avgHold: '1m',  toxicity: 91, book: 'B', dailyReturn: 0.0045, volatility: 0.019,
      garch: { omega: 0.000008, alpha: 0.15, beta: 0.80, lastVariance: 0.00048 },
      returns: [0.010,0.005,-0.008,0.018,0.003,0.012,-0.005,0.014,0.007,-0.010,0.016,0.002,-0.004,0.020,-0.007,0.006,0.015,-0.003,0.009,0.005,-0.012,0.017,0.004,-0.002,0.025,-0.006,0.011,0.008,-0.014,0.013] },
    { id: '#7823', name: 'A. Garcia',     trades: 203, winRate: 52, pnl: 3400,   avgHold: '45m', toxicity: 35, book: 'B', dailyReturn: -0.0005, volatility: 0.022,
      garch: { omega: 0.000005, alpha: 0.07, beta: 0.90, lastVariance: 0.00050 },
      returns: [0.001,-0.003,0.004,-0.002,0.003,-0.005,0.002,-0.001,0.004,-0.003,0.001,0.002,-0.004,0.003,-0.002,0.001,0.005,-0.003,-0.001,0.002,-0.004,0.003,0.000,-0.002,0.004,-0.001,0.002,-0.003,0.001,-0.002] },
    { id: '#1156', name: 'L. Thompson',   trades: 78,  winRate: 38, pnl: 8900,   avgHold: '4h',  toxicity: 15, book: 'B', dailyReturn: -0.0022, volatility: 0.030,
      garch: { omega: 0.000015, alpha: 0.05, beta: 0.88, lastVariance: 0.00090 },
      returns: [-0.005,0.008,-0.012,0.003,-0.009,0.006,-0.015,0.002,-0.007,0.010,-0.004,0.005,-0.013,0.008,-0.008,-0.002,0.011,-0.010,0.003,-0.005,0.007,-0.016,0.006,-0.009,0.002,-0.006,0.004,-0.012,0.009,-0.003] },
    { id: '#9045', name: 'K. Al-Rashid',  trades: 267, winRate: 73, pnl: -22100, avgHold: '8m',  toxicity: 88, book: 'A', dailyReturn: 0.0041, volatility: 0.017,
      garch: { omega: 0.000005, alpha: 0.12, beta: 0.85, lastVariance: 0.00038 },
      returns: [0.009,0.004,-0.006,0.013,0.002,0.008,-0.003,0.010,0.005,-0.007,0.012,0.001,-0.002,0.015,-0.005,0.004,0.011,-0.002,0.007,0.003,-0.008,0.013,0.003,-0.001,0.019,-0.004,0.008,0.005,-0.010,0.009] },
    { id: '#5502', name: 'D. Okafor',     trades: 145, winRate: 55, pnl: -1200,  avgHold: '1h',  toxicity: 44, book: 'B', dailyReturn: 0.0008, volatility: 0.024,
      garch: { omega: 0.000006, alpha: 0.08, beta: 0.88, lastVariance: 0.00058 },
      returns: [0.002,-0.001,0.005,-0.004,0.003,-0.002,0.006,-0.003,0.001,0.004,-0.005,0.003,-0.001,0.007,-0.003,0.002,0.004,-0.002,0.001,0.003,-0.006,0.005,0.000,-0.002,0.008,-0.004,0.003,0.001,-0.005,0.004] },
  ],

  selectedTraderId: null,

  kyc: {
    stats: { total: 312, approved: 278, pending: 18, rejected: 16, avgHours: 3.2 },
    queue: [
      { id: '#6621', name: 'T. Okonkwo',     country: 'NG', status: 'pending',  risk: 'high',   pep: false, sanctioned: false, submitted: 'Today 09:14', waitHours: 4 },
      { id: '#6618', name: 'A. Petersen',     country: 'DK', status: 'pending',  risk: 'low',    pep: false, sanctioned: false, submitted: 'Today 08:52', waitHours: 5 },
      { id: '#6605', name: 'M. Al-Farsi',     country: 'AE', status: 'review',   risk: 'high',   pep: true,  sanctioned: false, submitted: 'Yesterday',  waitHours: 19 },
      { id: '#6599', name: 'L. Varga',        country: 'HU', status: 'pending',  risk: 'medium', pep: false, sanctioned: false, submitted: 'Yesterday',  waitHours: 22 },
      { id: '#6588', name: 'C. Beaumont',     country: 'GB', status: 'approved', risk: 'low',    pep: false, sanctioned: false, submitted: '2d ago',     waitHours: 2 },
      { id: '#6571', name: 'D. Volkov',       country: 'RU', status: 'rejected', risk: 'high',   pep: false, sanctioned: true,  submitted: '3d ago',     waitHours: 6 },
    ],
  },

  compliance: {
    amlAlerts: [
      { accountId: '#3391', name: 'S. Nakamura', level: 'high',   type: 'RAPID WITHDRAWAL',   amount: 48000, flagged: 'Today 11:22',   filed: false,  dismissed: false },
      { accountId: '#6571', name: 'D. Volkov',   level: 'high',   type: 'SANCTIONS MATCH',    amount: 12500, flagged: 'Yesterday',      filed: true,   dismissed: false },
      { accountId: '#4471', name: 'M. Chen',     level: 'medium', type: 'UNUSUAL VOLUME',     amount: 31000, flagged: 'Today 08:05',   filed: false,  dismissed: false },
      { accountId: '#2209', name: 'R. Petrov',   level: 'low',    type: 'STRUCTURING',        amount: 9800,  flagged: '2d ago',         filed: false,  dismissed: true  },
    ],
    withdrawals: [
      { accountId: '#3391', name: 'S. Nakamura', amount: 48000, method: 'Wire',        requested: 'Today 11:18',  status: 'flagged',  firstWithdrawal: false },
      { accountId: '#6618', name: 'A. Petersen', amount: 5200,  method: 'Card',        requested: 'Today 09:40',  status: 'pending',  firstWithdrawal: true  },
      { accountId: '#8834', name: 'J. Williams', amount: 12300, method: 'Wire',        requested: 'Today 08:15',  status: 'pending',  firstWithdrawal: false },
      { accountId: '#1156', name: 'L. Thompson', amount: 8900,  method: 'Crypto',      requested: 'Yesterday',    status: 'approved', firstWithdrawal: false },
      { accountId: '#5502', name: 'D. Okafor',   amount: 2100,  method: 'Card',        requested: 'Yesterday',    status: 'approved', firstWithdrawal: false },
    ],
    regulatory: [
      { report: 'Transaction Report (EMIR)',    regulator: 'CySEC',  period: 'Mar 2026', due: '15 Apr',  status: 'scheduled', filedOn: null },
      { report: 'Best Execution (RTS 27)',      regulator: 'CySEC',  period: 'Q1 2026',  due: '30 Apr',  status: 'scheduled', filedOn: null },
      { report: 'Capital Adequacy (ICAAP)',     regulator: 'CySEC',  period: 'Mar 2026', due: '31 Mar',  status: 'due',       filedOn: null },
      { report: 'AML Activity Report',         regulator: 'CySEC',  period: 'Q4 2025',  due: 'Filed',   status: 'filed',     filedOn: '14 Jan 2026' },
      { report: 'Transaction Report (EMIR)',    regulator: 'CySEC',  period: 'Feb 2026', due: 'Filed',   status: 'filed',     filedOn: '12 Mar 2026' },
    ],
  },

  recon: [
    { item: 'LP open positions vs back office',  a: '1,834',       b: '1,834',       ok: true },
    { item: 'LP realised P&L today',             a: '$13,065',     b: '$13,065',     ok: true },
    { item: 'Swap charges',                      a: '$1,755',      b: '$1,755',      ok: true },
    { item: 'Commission charged',                a: '$3,900',      b: '$3,900',      ok: true },
    { item: 'Client balances vs EMI pool',       a: '$4,820,000',  b: '$4,820,000',  ok: true },
    { item: 'Mauritius EMI segregated',          a: '$1,640,000',  b: '$1,640,000',  ok: true },
    { item: 'Singapore EMI segregated',          a: '$2,180,000',  b: '$2,180,000',  ok: true },
    { item: 'Hong Kong EMI segregated',          a: '$1,000,000',  b: '$1,000,000',  ok: true },
    { item: 'LP collateral balance',             a: '$62,600',     b: '$62,600',     ok: true },
  ],
};

export function updateState(partial) {
  Object.assign(S, partial);
}
