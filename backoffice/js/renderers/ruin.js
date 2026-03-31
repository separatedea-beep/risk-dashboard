/**
 * Ruin Analysis Renderer
 *
 * Full probability-of-ruin analysis for a selected trader:
 * - KPI cards: edge, Kelly, PoR, median survival days, recommendation
 * - Monte Carlo equity curve chart (500 paths, percentile bands)
 * - PoR vs Starting Capital chart
 * - Position sizing comparison table (with survival days column)
 * - Lifecycle & regime stats panel
 * - Trader profile detail grid
 */
const RuinRenderer = {
  _charts: {},

  render() {
    Header.setTitle('Probability of Ruin Analysis');
    const view = U.$('#view-ruin-analysis');
    const accounts = S.accounts.list.filter(a => a.status === 'active' && a.totalTrades > 0);
    const sel = S.ruin.selectedAccount;
    const p   = S.ruin.params;

    // ── Lazy-initialise new params with sensible defaults ──────────
    if (p.tailDf               === undefined) p.tailDf               = 4;
    if (p.regimeStress         === undefined) p.regimeStress         = true;
    if (p.reDepositRate        === undefined) p.reDepositRate        = 0.35;
    if (p.adaptiveSizing       === undefined) p.adaptiveSizing       = true;
    if (p.onboardingCurve      === undefined) p.onboardingCurve      = true;
    if (p.profitWithdrawal     === undefined) p.profitWithdrawal     = true;
    if (p.voluntaryChurnProb   === undefined) p.voluntaryChurnProb   = 0.10;

    const filterHtml = `
      <select id="ruin-account-select" class="form-control" style="min-width:250px"
        onchange="RuinRenderer.selectAccount(this.value)">
        <option value="">— Select a trader —</option>
        ${accounts.map(a => `<option value="${a.id}" ${sel && sel.id === a.id ? 'selected' : ''}>${a.login} — ${a.name} (${U.money(a.balance)})</option>`).join('')}
      </select>
      <select class="form-control form-sm"
        onchange="S.ruin.params.sizing=this.value; RuinRenderer.runAnalysis()">
        <option value="fixed_lot"         ${p.sizing==='fixed_lot'         ?'selected':''}>Fixed Lot</option>
        <option value="fixed_fractional"  ${p.sizing==='fixed_fractional'  ?'selected':''}>Fixed Fractional (${p.riskPercent}%)</option>
        <option value="half_kelly"        ${p.sizing==='half_kelly'        ?'selected':''}>Half Kelly</option>
        <option value="kelly"             ${p.sizing==='kelly'             ?'selected':''}>Full Kelly</option>
      </select>
      <select class="form-control form-sm"
        onchange="S.ruin.params.ruinThreshold=parseFloat(this.value); RuinRenderer.runAnalysis()">
        <option value="0.05" ${p.ruinThreshold===0.05?'selected':''}>Ruin = 5%</option>
        <option value="0.10" ${p.ruinThreshold===0.10?'selected':''}>Ruin = 10%</option>
        <option value="0.20" ${p.ruinThreshold===0.20?'selected':''}>Ruin = 20%</option>
        <option value="0.50" ${p.ruinThreshold===0.50?'selected':''}>Ruin = 50%</option>
      </select>
      <select class="form-control form-sm"
        title="Return distribution tail heaviness"
        onchange="S.ruin.params.tailDf=parseInt(this.value)||null; RuinRenderer.runAnalysis()">
        <option value="4"  ${p.tailDf===4  ?'selected':''}>Fat Tails — t(4)</option>
        <option value="10" ${p.tailDf===10 ?'selected':''}>Mild Tails — t(10)</option>
        <option value="0"  ${!p.tailDf     ?'selected':''}>Normal Dist.</option>
      </select>
      <select class="form-control form-sm"
        title="Probability of client re-depositing when near ruin"
        onchange="S.ruin.params.reDepositRate=parseFloat(this.value); RuinRenderer.runAnalysis()">
        <option value="0"    ${p.reDepositRate===0    ?'selected':''}>No Re-deposits</option>
        <option value="0.25" ${p.reDepositRate===0.25 ?'selected':''}>Re-deposit 25%</option>
        <option value="0.35" ${p.reDepositRate===0.35 ?'selected':''}>Re-deposit 35%</option>
        <option value="0.50" ${p.reDepositRate===0.50 ?'selected':''}>Re-deposit 50%</option>
      </select>
      <label class="form-check form-sm" title="Stress regime: 15% of days use reduced win rate + inflated losses">
        <input type="checkbox" ${p.regimeStress?'checked':''}
          onchange="S.ruin.params.regimeStress=this.checked; RuinRenderer.runAnalysis()"> Regimes
      </label>
      <label class="form-check form-sm" title="Scale fixed-lot size down as equity erodes (realistic margin constraint)">
        <input type="checkbox" ${p.adaptiveSizing?'checked':''}
          onchange="S.ruin.params.adaptiveSizing=this.checked; RuinRenderer.runAnalysis()"> Adaptive Lot
      </label>
      <label class="form-check form-sm" title="New accounts trade at 80% win rate for first 90 days (learning curve)">
        <input type="checkbox" ${p.onboardingCurve?'checked':''}
          onchange="S.ruin.params.onboardingCurve=this.checked; RuinRenderer.runAnalysis()"> Onboarding
      </label>
      <label class="form-check form-sm" title="Profitable clients withdraw 40% of profits above 1.3× starting capital">
        <input type="checkbox" ${p.profitWithdrawal?'checked':''}
          onchange="S.ruin.params.profitWithdrawal=this.checked; RuinRenderer.runAnalysis()"> Withdrawals
      </label>
      <select class="form-control form-sm"
        title="Probability of voluntary account closure after 5 consecutive losses"
        onchange="S.ruin.params.voluntaryChurnProb=parseFloat(this.value); RuinRenderer.runAnalysis()">
        <option value="0"    ${p.voluntaryChurnProb===0    ?'selected':''}>No Churn</option>
        <option value="0.05" ${p.voluntaryChurnProb===0.05 ?'selected':''}>Churn 5%</option>
        <option value="0.10" ${p.voluntaryChurnProb===0.10 ?'selected':''}>Churn 10%</option>
        <option value="0.20" ${p.voluntaryChurnProb===0.20 ?'selected':''}>Churn 20%</option>
      </select>`;

    const selectorCard = C.card('Select Trader', '', { filters: filterHtml });
    const placeholder  = sel ? '' : C.card(null, C.emptyState('Select a trader above to run the analysis'));

    view.innerHTML = `${selectorCard}<div id="ruin-content">${placeholder}</div>`;
    if (sel) this.renderAnalysis();
  },

  selectAccount(id) {
    const acc = S.accounts.list.find(a => a.id === id);
    S.ruin.selectedAccount = acc || null;
    if (acc) this.runAnalysis();
    else this.render();
  },

  runAnalysis() {
    const acc = S.ruin.selectedAccount;
    if (!acc) return;
    const p = S.ruin.params;

    // Compute account age from openedAt or createdAt if available
    const accountAgeDays = acc.openedAt
      ? Math.floor((Date.now() - new Date(acc.openedAt)) / 86400000)
      : acc.accountAgeDays || 365;

    const mcParams = {
      startingCapital  : acc.balance,
      winRate          : acc.winRate,
      avgWin           : acc.avgWin,
      avgLoss          : acc.avgLoss,
      tradesPerDay     : acc.tradeFrequency,
      days             : p.days,
      paths            : p.paths,
      ruinThreshold    : p.ruinThreshold,
      sizing           : p.sizing,
      riskPercent      : p.riskPercent,
      // Distribution / regime params
      tailDf                  : p.tailDf != null ? p.tailDf : 4,
      regimeStress            : p.regimeStress !== false,
      adaptiveSizing          : p.adaptiveSizing !== false,
      // Re-deposit params
      reDepositRate           : p.reDepositRate != null ? p.reDepositRate : 0.35,
      reDepositTrigger        : 0.20,
      reDepositFraction       : 0.50,
      // Lifecycle params
      accountAgeDays          : accountAgeDays,
      onboardingDays          : 90,
      onboardWinRateMult      : p.onboardingCurve !== false ? 0.80 : 1.0,
      profitWithdrawal        : p.profitWithdrawal !== false,
      profitWithdrawalTrigger : 1.30,
      profitWithdrawalFraction: 0.40,
      profitWithdrawalDailyProb: 0.05,
      voluntaryChurnLosses    : 5,
      voluntaryChurnProb      : p.voluntaryChurnProb != null ? p.voluntaryChurnProb : 0.10,
    };

    S.ruin.simulation = RuinEngine.monteCarloRuin(mcParams);

    // PoR vs Capital — pass kurtosis correction when fat tails enabled
    const excessKurtosis = (p.tailDf && p.tailDf > 2) ? (6 / (p.tailDf - 4 + 1e-9)) : 0;
    S.ruin.porCurve = RuinEngine.porVsCapital({
      winRate          : acc.winRate,
      avgWin           : acc.avgWin,
      avgLoss          : acc.avgLoss,
      capitalMin       : CONFIG.RUIN.CAPITAL_SWEEP_MIN,
      capitalMax       : Math.max(acc.balance * 3, CONFIG.RUIN.CAPITAL_SWEEP_MAX),
      steps            : CONFIG.RUIN.CAPITAL_SWEEP_STEPS,
      ruinThreshold    : p.ruinThreshold,
      excessKurtosis   : Math.min(6, Math.max(0, excessKurtosis)),
    });

    S.ruin.sizingComparison = RuinEngine.compareSizing({
      ...mcParams,
      paths: 200,
    });

    // Attach age for routing recommendation
    acc._accountAgeDays = accountAgeDays;
    this.renderAnalysis();
  },

  renderAnalysis() {
    const acc    = S.ruin.selectedAccount;
    const sim    = S.ruin.simulation;
    const porCurve = S.ruin.porCurve;
    const sizing   = S.ruin.sizingComparison;
    if (!acc || !sim) return;

    const edge    = acc.edgePerTrade;
    const kelly   = acc.kellyFraction;
    const routing = RuinEngine.routingRecommendation({
      ...acc,
      accountAgeDays: acc._accountAgeDays || 365,
    });

    const recLabel    = routing.recommendation === 'a_book' ? 'A-BOOK'
                      : routing.recommendation === 'b_book' ? 'B-BOOK' : 'REVIEW';
    const recBadgeCls = routing.recommendation === 'a_book' ? 'badge-info'
                      : routing.recommendation === 'b_book' ? 'badge-purple' : 'badge-warning';
    const porVariant  = sim.probabilityOfRuin > 0.5 ? 'danger'
                      : sim.probabilityOfRuin > 0.2 ? 'warning' : 'success';

    // ── KPI row ───────────────────────────────────────────────────
    const survivalKpiValue = sim.survivalDays
      ? `${sim.survivalDays.median}d`
      : '> ' + sim.days + 'd';
    const survivalKpiSub = sim.survivalDays
      ? `25th: ${sim.survivalDays.p25}d / 75th: ${sim.survivalDays.p75}d`
      : `${sim.survivedPaths}/${sim.paths} paths survived full horizon`;
    const survivalVariant = sim.survivalDays
      ? (sim.survivalDays.median < 60 ? 'danger' : sim.survivalDays.median < 180 ? 'warning' : undefined)
      : 'success';

    const kpis = C.kpiGrid([
      C.kpi('Edge / Trade',
        `${edge >= 0 ? '+' : ''}${U.money(edge)}`,
        `${U.money(acc.edgePerDay)}/day · ${U.num(acc.tradeFrequency, 1)} trades/day`,
        { valueClass: edge >= 0 ? 'positive' : 'negative' }),
      C.kpi('Win Rate',
        U.pct(acc.winRate * 100),
        `Avg W: ${U.money(acc.avgWin)} / Avg L: ${U.money(acc.avgLoss)}`),
      C.kpi('Kelly Criterion',
        U.pct(kelly * 100),
        `Profit Factor: ${U.num(acc.profitFactor)}`),
      C.kpi('Probability of Ruin',
        U.pct(sim.probabilityOfRuin * 100),
        `${sim.ruinCount}/${sim.paths} paths hit ruin (${U.pct(S.ruin.params.ruinThreshold * 100)} threshold)`,
        { variant: porVariant }),
      C.kpi('Median Survival',
        survivalKpiValue,
        survivalKpiSub,
        { variant: survivalVariant }),
      C.kpi('Recommended Book',
        `<span class="badge ${recBadgeCls}" style="font-size:16px;padding:4px 12px">${recLabel}</span>`,
        `<span class="text-sm">${routing.reason}</span>`),
      C.kpi('Median Final Equity',
        U.money(sim.finalEquity.median),
        `5th: ${U.money(sim.finalEquity.p5)} / 95th: ${U.money(sim.finalEquity.p95)}`,
        { valueClass: sim.finalEquity.median > acc.balance ? 'positive' : 'negative' }),
      C.kpi('Expected Max Drawdown',
        U.pct(sim.maxDrawdown.mean * 100),
        `95th pct: ${U.pct(sim.maxDrawdown.p95 * 100)}`,
        { valueClass: 'negative' }),
      C.kpi('Sharpe Ratio (ann.)',
        U.num(acc.sharpeRatio),
        `${acc.totalTrades} total trades`,
        { valueClass: acc.sharpeRatio >= 0 ? 'positive' : 'negative' }),
    ]);

    // ── Charts row ────────────────────────────────────────────────
    const tailLabel = S.ruin.params.tailDf ? `t(${S.ruin.params.tailDf})` : 'Normal';
    const mcChart = C.card(
      `Monte Carlo Equity Projection (${sim.paths} paths · ${sim.days}d · ${tailLabel} dist)`,
      '<div class="chart-container" style="height:350px"><canvas id="ruin-mc-chart"></canvas></div>');
    const capitalChart = C.card('Probability of Ruin vs Starting Capital',
      '<div class="chart-container" style="height:350px"><canvas id="ruin-capital-chart"></canvas></div>');
    const chartsRow = C.grid2(mcChart, capitalChart);

    // ── Position sizing comparison table ──────────────────────────
    const sizingRows = sizing.map(s => {
      const assessment  = s.por < 0.15 ? 'Conservative' : s.por < 0.40 ? 'Moderate' : s.por < 0.70 ? 'Aggressive' : 'Dangerous';
      const assessClass = s.por < 0.15 ? 'success' : s.por < 0.40 ? 'info' : s.por < 0.70 ? 'warning' : 'danger';
      const survCol     = s.survivalDays ? `${s.survivalDays.median}d median` : `> ${sim.days}d`;
      return `<tr class="${s.name === this._currentSizingLabel() ? 'row-highlight' : ''}">
        <td><strong>${s.name}</strong></td>
        <td>${s.fraction}</td>
        <td class="text-right ${s.por > 0.5 ? 'text-danger' : s.por > 0.2 ? 'text-warning' : ''}">${U.pct(s.por * 100)}</td>
        <td class="text-right">${survCol}</td>
        <td class="text-right ${s.expectedReturn >= 0 ? 'positive' : 'negative'}">${s.expectedReturn >= 0 ? '+' : ''}${U.pct(s.expectedReturn)}</td>
        <td class="text-right">${U.money(s.medianFinal)}</td>
        <td class="text-right negative">${U.pct(s.meanMaxDD)}</td>
        <td class="text-right negative">${U.pct(s.p95MaxDD)}</td>
        <td>${C.badge(assessment, assessClass)}</td>
      </tr>`;
    });

    const sizingTable = C.simpleTable(
      ['Strategy', 'Risk Fraction', 'PoR', 'Median Survival', 'Expected Return', 'Median Final Equity', 'Avg Max DD', '95th Max DD', 'Assessment'],
      sizingRows);
    const sizingCard = C.card('Position Sizing Strategy Comparison', sizingTable);

    // ── Lifecycle & regime stats ──────────────────────────────────
    const p = S.ruin.params;
    const regimesActive   = p.regimeStress !== false;
    const tailLabel2      = p.tailDf ? `Student t(${p.tailDf}) — excess kurtosis ≈ ${p.tailDf <= 4 ? '6.0' : p.tailDf <= 6 ? '3.0' : '1.2'}` : 'Normal (no tail correction)';
    const reDepositLabel  = sim.reDepositCount > 0
      ? `${sim.reDepositCount} events (${U.pct(sim.reDepositRate * 100)} of paths)`
      : 'None triggered';
    const withdrawalLabel = sim.withdrawalPaths > 0
      ? `${sim.withdrawalPaths} paths (avg ${U.money(sim.avgWithdrawnPerPath)} extracted)`
      : 'None triggered';
    const churnLabel = sim.churnCount > 0
      ? `${sim.churnCount} paths (${U.pct((sim.churnCount / sim.paths) * 100)} of total)`
      : 'None';
    const ageDays         = acc._accountAgeDays || 365;
    const onboardRemaining = Math.max(0, 90 - ageDays);

    const lifecycleStats = C.detailGrid([
      { label: 'Account Age',             value: `${ageDays} days` },
      { label: 'Onboarding Remaining',    html: onboardRemaining > 0
          ? `<span class="text-warning">${onboardRemaining}d left (80% win rate handicap)</span>`
          : '<span class="positive">Complete</span>' },
      { label: 'Tenure Signal Score',     html: `<span class="${routing.breakdown.tenureScore < 0.5 ? 'text-warning' : ''}">${U.pct(routing.breakdown.tenureScore * 100)}</span>${routing.breakdown.tenureScore < 0.5 ? ' ⚠ low confidence' : ''}` },
      { label: 'Composite Score',         value: U.pct(routing.composite * 100) },
      { label: 'Return Distribution',     value: tailLabel2 },
      { label: 'Stress Regimes',          value: regimesActive ? '15% of days (−30% win rate, +50% loss)' : 'Disabled' },
      { label: 'Adaptive Sizing',         value: p.adaptiveSizing !== false ? 'On — lot scales with equity' : 'Off — fixed lot throughout' },
      { label: 'Re-deposit Rate',         value: `${U.pct((p.reDepositRate || 0) * 100)} when equity < 20% of start` },
      { label: 'Re-deposit Events',       value: reDepositLabel },
      { label: 'Profit Withdrawals',      value: withdrawalLabel },
      { label: 'Voluntary Churn (≥5 losses)', value: churnLabel },
      { label: 'Path End Breakdown',      html: `<span class="positive">${sim.endReasonBreakdown.survived} survived</span> · <span class="negative">${sim.endReasonBreakdown.ruin} ruined</span> · <span class="text-warning">${sim.endReasonBreakdown.churn} churned</span>` },
      { label: 'Survival (median)',       value: sim.survivalDays ? `${sim.survivalDays.median} days` : `> ${sim.days} days (not ruined)` },
      { label: 'Survival (25th–75th)',    value: sim.survivalDays ? `${sim.survivalDays.p25}d – ${sim.survivalDays.p75}d` : 'N/A' },
    ]);

    // ── Routing factor breakdown ──────────────────────────────────
    const bd = routing.breakdown;
    const factorRows = [
      ['Edge',          bd.edgeScore],
      ['Profit Factor', bd.pfScore],
      ['Risk-Reward',   bd.rrScore],
      ['Sharpe',        bd.sharpeScore],
      ['Drawdown',      bd.ddScore],
      ['Volatility',    bd.volScore],
      ['PoR (inv.)',    bd.porScore],
      ['Tenure (0.7×)', bd.tenureScore],
    ].map(([label, score]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="width:110px;font-size:12px;color:var(--text-muted)">${label}</span>
        ${C.progressBar(score * 100, 100, score > 0.65 ? 'success' : score < 0.35 ? 'danger' : 'warning')}
        <span style="width:36px;font-size:12px;text-align:right">${U.pct(score * 100)}</span>
      </div>`).join('');

    const lifecycleCard = C.card('Lifecycle & Model Parameters', C.grid2(
      `${C.sectionLabel('Simulation Settings')}${lifecycleStats}`,
      `${C.sectionLabel('Routing Factor Breakdown')}${factorRows}`
    ));

    // ── Trader profile ────────────────────────────────────────────
    const tradeDistribution = C.detailGrid([
      { label: 'Total Trades',   value: acc.totalTrades },
      { label: 'Win Rate',       value: U.pct(acc.winRate * 100) },
      { label: 'Avg Win',        html: `<span class="positive">${U.money(acc.avgWin)}</span>` },
      { label: 'Avg Loss',       html: `<span class="negative">${U.money(acc.avgLoss)}</span>` },
      { label: 'Win/Loss Ratio', value: U.num(acc.avgWin / acc.avgLoss) },
      { label: 'Profit Factor',  value: U.num(acc.profitFactor) },
      { label: 'Trades/Day',     value: U.num(acc.tradeFrequency, 1) },
    ]);

    const riskMetrics = C.detailGrid([
      { label: 'Edge / Trade',           html: C.pnl(edge) },
      { label: 'Edge / Day',             html: C.pnl(acc.edgePerDay) },
      { label: 'Kelly Fraction',         value: U.pct(kelly * 100) },
      { label: 'Half-Kelly',             value: U.pct(kelly * 50) },
      { label: 'Sharpe (annualised)',    value: U.num(acc.sharpeRatio) },
      { label: 'Max Drawdown (hist.)',   html: `<span class="negative">${U.pct(acc.maxDrawdown * 100)}</span>` },
      { label: 'Current Balance',        value: U.money(acc.balance) },
    ]);

    const profileCard = C.card('Trader Profile', C.grid2(
      `${C.sectionLabel('Trade Distribution')}${tradeDistribution}`,
      `${C.sectionLabel('Risk Metrics')}${riskMetrics}`
    ));

    const content = U.$('#ruin-content');
    content.innerHTML = `${kpis}${chartsRow}${sizingCard}${lifecycleCard}${profileCard}`;

    this._renderMCChart();
    this._renderCapitalChart();
  },

  _currentSizingLabel() {
    const p = S.ruin.params;
    if (p.sizing === 'kelly')             return 'Full Kelly';
    if (p.sizing === 'half_kelly')        return 'Half Kelly';
    if (p.sizing === 'fixed_fractional')  return 'Fixed ' + p.riskPercent + '%';
    return 'Fixed Lot';
  },

  _renderMCChart() {
    const sim = S.ruin.simulation;
    if (!sim) return;
    const ctx = U.$('#ruin-mc-chart');
    if (!ctx) return;

    if (this._charts.mc) this._charts.mc.destroy();

    const labels = Array.from({ length: sim.days + 1 }, (_, i) => i);
    const pctl   = sim.percentiles;

    const pathDatasets = sim.sampleCurves.slice(0, 30).map((curve, i) => ({
      label: i === 0 ? 'Sample Paths' : '',
      data: curve,
      borderColor: 'rgba(148,163,184,0.12)',
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    }));

    // Median survival day reference line
    const survivalDatasets = sim.survivalDays ? [{
      label: `Median Ruin Day (${sim.survivalDays.median}d)`,
      data: labels.map(d => (d === sim.survivalDays.median ? sim.ruinLevel * 3 : null)),
      borderColor: 'rgba(251,146,60,0.7)',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: 'rgba(251,146,60,0.9)',
      fill: false,
      spanGaps: false,
    }] : [];

    this._charts.mc = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '95th Percentile',  data: pctl.p95, borderColor: 'rgba(34,197,94,0.6)',  borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [4,2] },
          { label: '75th Percentile',  data: pctl.p75, borderColor: 'rgba(34,197,94,0.3)',  borderWidth: 1,   pointRadius: 0, fill: '+1', backgroundColor: 'rgba(34,197,94,0.05)' },
          { label: 'Median',           data: pctl.p50, borderColor: '#3b82f6',               borderWidth: 2.5, pointRadius: 0, fill: false },
          { label: '25th Percentile',  data: pctl.p25, borderColor: 'rgba(239,68,68,0.3)',  borderWidth: 1,   pointRadius: 0, fill: '+1', backgroundColor: 'rgba(239,68,68,0.05)' },
          { label: '5th Percentile',   data: pctl.p5,  borderColor: 'rgba(239,68,68,0.6)',  borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [4,2] },
          { label: 'Ruin Level',       data: Array(sim.days + 1).fill(sim.ruinLevel),       borderColor: 'rgba(239,68,68,0.8)', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [8,4] },
          { label: 'Starting Capital', data: Array(sim.days + 1).fill(S.ruin.selectedAccount.balance), borderColor: 'rgba(148,163,184,0.3)', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [2,2] },
          ...survivalDatasets,
          ...pathDatasets,
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 12, filter: item => item.text !== '' } },
          tooltip: { callbacks: { label: ctx => ctx.dataset.label ? `${ctx.dataset.label}: ${U.money(ctx.parsed.y)}` : '' } },
        },
        scales: {
          x: { title: { display: true, text: 'Trading Days', color: '#64748b' }, ticks: { color: '#64748b', maxTicksLimit: 12 }, grid: { color: 'rgba(148,163,184,0.06)' } },
          y: { title: { display: true, text: 'Equity ($)', color: '#64748b' },   ticks: { color: '#64748b', callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: 'rgba(148,163,184,0.06)' } },
        }
      }
    });
  },

  _renderCapitalChart() {
    const porCurve = S.ruin.porCurve;
    if (!porCurve) return;
    const ctx = U.$('#ruin-capital-chart');
    if (!ctx) return;

    if (this._charts.capital) this._charts.capital.destroy();

    const acc = S.ruin.selectedAccount;

    this._charts.capital = new Chart(ctx, {
      type: 'line',
      data: {
        labels: porCurve.capitals.map(c => '$' + (c / 1000).toFixed(0) + 'k'),
        datasets: [
          {
            label: 'Probability of Ruin',
            data: porCurve.porValues.map(v => v * 100),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Current Balance',
            data: porCurve.capitals.map(c => {
              const closest = porCurve.capitals.reduce((prev, curr) =>
                Math.abs(curr - acc.balance) < Math.abs(prev - acc.balance) ? curr : prev);
              return Math.abs(c - closest) < (porCurve.capitals[1] - porCurve.capitals[0]) * 0.6 ? 100 : null;
            }),
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            borderDash: [6,3],
            spanGaps: false,
          },
          {
            label: 'A-Book Threshold (15%)',
            data: Array(porCurve.capitals.length).fill(CONFIG.RUIN.POR_A_BOOK * 100),
            borderColor: 'rgba(34,197,94,0.5)',
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            borderDash: [4,4],
          },
          {
            label: 'B-Book Threshold (60%)',
            data: Array(porCurve.capitals.length).fill(CONFIG.RUIN.POR_B_BOOK * 100),
            borderColor: 'rgba(168,85,247,0.5)',
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            borderDash: [4,4],
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
        },
        scales: {
          x: { title: { display: true, text: 'Starting Capital', color: '#64748b' }, ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(148,163,184,0.06)' } },
          y: { title: { display: true, text: 'Probability of Ruin (%)', color: '#64748b' }, ticks: { color: '#64748b', callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,0.06)' }, min: 0, max: 100 },
        }
      }
    });
  },
};
