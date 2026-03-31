/**
 * Probability of Ruin Engine
 *
 * Computes the probability a trader's equity hits a ruin threshold
 * given their edge, loss distribution, and position sizing.
 *
 * Model improvements over baseline:
 *   1. Fat-tailed returns  — Student's t(ν) replaces normal distribution
 *   2. Regime simulation   — alternating normal/stress regimes per day
 *   3. Adaptive sizing     — fixed-lot scales down with equity drawdown
 *   4. Re-deposit events   — Bernoulli re-fund when near ruin
 *   5. Survival tracking   — median days to ruin across all ruined paths
 *   6. Tenure factor       — routing composite penalises new accounts
 *
 * Used to enhance A/B book routing:
 *   - Low PoR + positive edge → A-Book (hedge — trader is dangerous)
 *   - High PoR + negative edge → B-Book (warehouse — trader will lose)
 */
const RuinEngine = {

  // ─── Edge Calculation ───────────────────────────────────────────

  /**
   * Expected edge per trade in $ terms
   * @param {number} winRate - probability of winning (0-1)
   * @param {number} avgWin - average win amount ($)
   * @param {number} avgLoss - average loss amount ($ positive number)
   * @returns {number} expected value per trade
   */
  edgePerTrade(winRate, avgWin, avgLoss) {
    return winRate * avgWin - (1 - winRate) * avgLoss;
  },

  /**
   * Expected edge per day
   */
  edgePerDay(winRate, avgWin, avgLoss, tradesPerDay) {
    return this.edgePerTrade(winRate, avgWin, avgLoss) * tradesPerDay;
  },

  /**
   * Profit factor: gross wins / gross losses
   */
  profitFactor(winRate, avgWin, avgLoss) {
    const grossWin = winRate * avgWin;
    const grossLoss = (1 - winRate) * avgLoss;
    return grossLoss > 0 ? grossWin / grossLoss : Infinity;
  },

  // ─── Position Sizing Models ─────────────────────────────────────

  /**
   * Kelly Criterion — optimal fraction of capital to risk per trade.
   * f* = (p * b - q) / b
   * where p = win prob, q = loss prob, b = win/loss ratio
   */
  kellyCriterion(winRate, avgWin, avgLoss) {
    if (avgLoss <= 0) return 0;
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - winRate;
    const kelly = (p * b - q) / b;
    return Math.max(0, kelly);
  },

  /**
   * Half-Kelly — more conservative, reduces variance
   */
  halfKelly(winRate, avgWin, avgLoss) {
    return this.kellyCriterion(winRate, avgWin, avgLoss) / 2;
  },

  /**
   * Fixed fractional — risk a fixed % of capital per trade
   */
  fixedFractional(riskPercent) {
    return riskPercent / 100;
  },

  /**
   * Optimal-f (Ralph Vince) — fraction that maximises geometric growth
   * @param {number[]} returns - array of trade P&L values
   */
  optimalF(returns) {
    if (!returns || returns.length === 0) return 0;
    const maxLoss = Math.max(...returns.map(r => Math.abs(Math.min(r, 0))));
    if (maxLoss === 0) return 1;

    let bestF = 0;
    let bestTWR = 0;

    for (let f = 0.01; f <= 1.0; f += 0.01) {
      let twr = 1;
      for (const r of returns) {
        const hpr = 1 + (f * r) / maxLoss;
        if (hpr <= 0) { twr = 0; break; }
        twr *= hpr;
      }
      const geoMean = Math.pow(twr, 1 / returns.length);
      if (geoMean > bestTWR) {
        bestTWR = geoMean;
        bestF = f;
      }
    }
    return bestF;
  },

  // ─── Loss Distribution ──────────────────────────────────────────

  /**
   * Fit a normal distribution to trade returns
   * @param {number[]} returns
   * @returns {{ mean: number, std: number }}
   */
  fitNormal(returns) {
    const n = returns.length;
    if (n === 0) return { mean: 0, std: 1 };
    const mean = returns.reduce((s, r) => s + r, 0) / n;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1 || 1);
    return { mean, std: Math.sqrt(variance) };
  },

  /**
   * Compute distribution statistics including skew and excess kurtosis
   */
  distributionStats(returns) {
    if (!returns.length) return { mean: 0, std: 0, skew: 0, kurtosis: 0, maxLoss: 0, maxWin: 0, median: 0 };
    const sorted = [...returns].sort((a, b) => a - b);
    const n = returns.length;
    const mean = returns.reduce((s, r) => s + r, 0) / n;
    const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1 || 1));
    const skew = std > 0 ? (returns.reduce((s, r) => s + ((r - mean) / std) ** 3, 0) / n) : 0;
    const kurtosis = std > 0 ? (returns.reduce((s, r) => s + ((r - mean) / std) ** 4, 0) / n - 3) : 0;

    return {
      mean, std, skew, kurtosis,
      maxLoss: Math.min(...returns),
      maxWin: Math.max(...returns),
      median: sorted[Math.floor(n / 2)],
    };
  },

  // ─── Analytical Probability of Ruin ─────────────────────────────

  /**
   * Classic gambler's ruin continuous approximation:
   *   PoR = exp(-2 * edge * capital / variance)
   *
   * For fat-tailed distributions (excess kurtosis κ > 0), the effective
   * variance is inflated by a kurtosis correction factor (1 + κ/4).
   * This causes PoR to increase — more realistic under real-market returns.
   *
   * @param {number} capital - starting capital ($)
   * @param {number} edge - expected edge per trade ($)
   * @param {number} variance - variance of trade returns ($^2)
   * @param {number} ruinLevel - equity level considered "ruin" ($)
   * @param {number} [excessKurtosis=3] - excess kurtosis of return dist (3 ≈ t₄)
   */
  analyticalPoR(capital, edge, variance, ruinLevel = 0, excessKurtosis = 0) {
    const effectiveCapital = capital - ruinLevel;
    if (effectiveCapital <= 0) return 1;
    if (edge <= 0) return 1;
    if (variance <= 0) return 0;

    // Kurtosis correction: heavy tails inflate effective variance
    // t(4) has excess kurtosis = 6; we scale by (1 + κ/6) as a first-order adjustment
    const kurtosisInflation = 1 + Math.max(0, excessKurtosis) / 6;
    const adjustedVariance = variance * kurtosisInflation;

    const por = Math.exp(-2 * edge * effectiveCapital / adjustedVariance);
    return Math.min(1, Math.max(0, por));
  },

  /**
   * Discrete gambler's ruin for win/loss streaks
   */
  discretePoR(winRate, capital, ruinUnits) {
    if (winRate === 0.5) return ruinUnits / (capital + ruinUnits);
    const r = (1 - winRate) / winRate;
    if (r === 1) return 1 - capital / (capital + ruinUnits);
    return (Math.pow(r, capital) - Math.pow(r, capital + ruinUnits)) / (1 - Math.pow(r, capital + ruinUnits));
  },

  // ─── Monte Carlo Ruin Simulation ────────────────────────────────

  /**
   * Run Monte Carlo simulation to estimate probability of ruin.
   *
   * Improvements over baseline model:
   *   - Fat tails: Student's t(tailDf) distribution (default ν=4, κ=6)
   *   - Regime simulation: alternating normal/stress regime per day
   *   - Adaptive sizing: fixed-lot scales with equity/starting ratio
   *   - Re-deposit events: Bernoulli re-fund near ruin threshold
   *   - Survival tracking: records day of ruin for each ruined path
   *
   * @param {Object} params
   * @param {number} params.startingCapital
   * @param {number} params.winRate
   * @param {number} params.avgWin
   * @param {number} params.avgLoss
   * @param {number} params.tradesPerDay
   * @param {number} params.days
   * @param {number} params.paths
   * @param {number} params.ruinThreshold
   * @param {string} params.sizing - 'fixed_fractional' | 'kelly' | 'half_kelly' | 'fixed_lot'
   * @param {number} params.riskPercent
   * @param {number} params.stdWin
   * @param {number} params.stdLoss
   *
   * New parameters:
   * @param {number|null} params.tailDf       - t-distribution df (null = normal). Default: 4
   * @param {boolean}     params.regimeStress - enable stress regime simulation. Default: true
   * @param {number}      params.stressProb   - daily probability of stress regime. Default: 0.15
   * @param {number}      params.stressWinRateMult - win rate multiplier in stress. Default: 0.70
   * @param {number}      params.stressLossMult    - avg loss multiplier in stress. Default: 1.50
   * @param {boolean}     params.adaptiveSizing    - scale fixed-lot with equity. Default: true
   * @param {number}      params.reDepositRate     - P(client re-deposits near ruin). Default: 0.35
   * @param {number}      params.reDepositTrigger  - equity fraction that triggers check. Default: 0.20
   * @param {number}      params.reDepositFraction - re-deposit as fraction of starting capital. Default: 0.50
   *
   * Lifecycle parameters:
   * @param {number}  params.accountAgeDays        - current account age (days). Default: 365
   * @param {number}  params.onboardingDays        - total learning-curve window (days). Default: 90
   * @param {number}  params.onboardWinRateMult    - win rate handicap during onboarding. Default: 0.80
   * @param {boolean} params.profitWithdrawal      - model profitable clients withdrawing. Default: true
   * @param {number}  params.profitWithdrawalTrigger - equity multiple to trigger (e.g. 1.30). Default: 1.30
   * @param {number}  params.profitWithdrawalFraction - fraction of profit extracted. Default: 0.40
   * @param {number}  params.profitWithdrawalDailyProb - daily check probability when above trigger. Default: 0.05
   * @param {number}  params.voluntaryChurnLosses  - consecutive losses before churn check. Default: 5
   * @param {number}  params.voluntaryChurnProb    - P(close account after N losses). Default: 0.10
   */
  monteCarloRuin(params) {
    const {
      startingCapital = 10000,
      winRate = 0.5,
      avgWin = 100,
      avgLoss = 100,
      tradesPerDay = 3,
      days = 252,
      paths = 500,
      ruinThreshold = 0.1,
      sizing = 'fixed_lot',
      riskPercent = 2,
      stdWin = null,
      stdLoss = null,
      // ── Distribution / regime params ──
      tailDf = 4,
      regimeStress = true,
      stressProb = 0.15,
      stressWinRateMult = 0.70,
      stressLossMult = 1.50,
      adaptiveSizing = true,
      // ── Re-deposit params ──
      reDepositRate = 0.35,
      reDepositTrigger = 0.20,
      reDepositFraction = 0.50,
      // ── Lifecycle params ──
      accountAgeDays = 365,
      onboardingDays = 90,
      onboardWinRateMult = 0.80,
      profitWithdrawal = true,
      profitWithdrawalTrigger = 1.30,
      profitWithdrawalFraction = 0.40,
      profitWithdrawalDailyProb = 0.05,
      voluntaryChurnLosses = 5,
      voluntaryChurnProb = 0.10,
    } = params;

    // How many simulated days remain in the onboarding window?
    const remainingOnboardDays = Math.max(0, onboardingDays - accountAgeDays);

    const ruinLevel = startingCapital * ruinThreshold;
    const totalTrades = Math.round(tradesPerDay * days);

    // Position sizing fraction
    let sizingFraction;
    switch (sizing) {
      case 'kelly':        sizingFraction = this.kellyCriterion(winRate, avgWin, avgLoss); break;
      case 'half_kelly':   sizingFraction = this.halfKelly(winRate, avgWin, avgLoss); break;
      case 'fixed_fractional': sizingFraction = riskPercent / 100; break;
      default:             sizingFraction = 0; // fixed_lot uses raw amounts
    }

    // Return distribution std devs
    const sigmaWin  = stdWin  || avgWin  * 0.3;
    const sigmaLoss = stdLoss || avgLoss * 0.3;

    // Noise sampler — fat-tailed (t-dist) or normal
    const noise = tailDf && tailDf > 2
      ? () => this._studentT(tailDf)
      : () => this._boxMuller();

    const equityCurves   = [];
    let ruinCount          = 0;
    let reDepositCount     = 0;
    let churnCount         = 0;
    let withdrawalPaths    = 0;
    let totalWithdrawn     = 0;
    const finalEquities    = [];
    const maxDrawdowns     = [];
    const ruinDays         = [];   // day index when ruin occurred (null if survived)
    const endReasons       = [];   // 'ruin' | 'churn' | 'survived'

    const sampleInterval = Math.max(1, Math.floor(totalTrades / days));
    const dailyEquities  = Array.from({ length: days + 1 }, () => []);

    for (let p = 0; p < paths; p++) {
      let equity         = startingCapital;
      let peak           = equity;
      let maxDD          = 0;
      let ruined         = false;
      let churned        = false;
      let reDeposited    = false;
      let pathWithdrawn  = false;
      let pathWithdrawAmt = 0;
      let inStress       = false;
      let ruinDay        = null;
      let consecutiveLosses = 0;
      const curve        = [equity];

      for (let t = 0; t < totalTrades; t++) {
        if (ruined || churned) { curve.push(equity); continue; }

        const currentDay = Math.floor(t / Math.max(1, tradesPerDay));

        // ── Regime: roll once at the start of each day ────────────
        if (regimeStress && t % tradesPerDay === 0) {
          inStress = Math.random() < stressProb;
        }

        // ── Onboarding curve: new accounts trade worse ────────────
        // Applies only for simulated days still within the learning window.
        const inOnboarding = currentDay < remainingOnboardDays;
        // Linear ramp from onboardWinRateMult → 1.0 across the window
        const onboardMult  = inOnboarding
          ? onboardWinRateMult + (1 - onboardWinRateMult) * (currentDay / Math.max(1, remainingOnboardDays))
          : 1.0;

        // ── Effective parameters for this trade ───────────────────
        let effWinRate = winRate * onboardMult;
        let effAvgWin  = avgWin;
        let effAvgLoss = avgLoss;
        if (inStress) {
          effWinRate = effWinRate * stressWinRateMult;
          effAvgWin  = avgWin  * 0.90;
          effAvgLoss = avgLoss * stressLossMult;
        }

        // ── Generate fat-tailed trade result ──────────────────────
        const isWin = Math.random() < effWinRate;
        let tradeResult;
        if (isWin) {
          tradeResult = Math.max(0, effAvgWin  + noise() * sigmaWin);
          consecutiveLosses = 0;
        } else {
          tradeResult = Math.min(0, -(effAvgLoss + noise() * sigmaLoss));
          consecutiveLosses++;
        }

        // ── Apply position sizing ─────────────────────────────────
        if (sizing !== 'fixed_lot' && sizingFraction > 0) {
          const riskedAmount = equity * sizingFraction;
          tradeResult = tradeResult * (riskedAmount / avgLoss);
        } else if (sizing === 'fixed_lot' && adaptiveSizing) {
          // As equity erodes below starting capital, scale lot size down.
          // Mirrors real broker margin constraints and rational risk reduction.
          const scaleFactor = Math.min(1, equity / startingCapital);
          tradeResult *= scaleFactor;
        }

        equity += tradeResult;

        // ── Peak / drawdown tracking ──────────────────────────────
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDD) maxDD = dd;

        // ── Profit withdrawal ─────────────────────────────────────
        // Profitable clients periodically extract gains, reducing their
        // effective capital and resetting the compounding base.
        // Checked once per day at the end of the last trade in that day.
        if (profitWithdrawal && equity > startingCapital * profitWithdrawalTrigger
            && t % tradesPerDay === tradesPerDay - 1) {
          if (Math.random() < profitWithdrawalDailyProb) {
            const profit    = equity - startingCapital;
            const withdrawn = profit * profitWithdrawalFraction;
            equity         -= withdrawn;
            pathWithdrawAmt += withdrawn;
            if (!pathWithdrawn) { pathWithdrawn = true; withdrawalPaths++; }
            totalWithdrawn += withdrawn;
            // Reset peak after withdrawal so drawdown tracking stays meaningful
            peak = equity;
          }
        }

        // ── Re-deposit event ─────────────────────────────────────
        // When equity falls below the trigger, client may re-fund.
        // One re-deposit per simulation path (conservative assumption).
        if (!reDeposited && equity <= startingCapital * reDepositTrigger) {
          if (Math.random() < reDepositRate) {
            equity        += startingCapital * reDepositFraction;
            reDeposited    = true;
            reDepositCount++;
          }
        }

        // ── Voluntary churn ───────────────────────────────────────
        // After N consecutive losses, client may quit regardless of ruin.
        // Models psychological closure: client stops after a loss streak,
        // even with capital remaining above the ruin threshold.
        if (voluntaryChurnProb > 0 && consecutiveLosses >= voluntaryChurnLosses) {
          if (Math.random() < voluntaryChurnProb) {
            churned = true;
            churnCount++;
          }
        }

        // ── Ruin check ────────────────────────────────────────────
        if (equity <= ruinLevel) {
          ruined   = true;
          equity   = ruinLevel;
          ruinDay  = currentDay;
          ruinCount++;
        }

        curve.push(equity);

        // ── Daily sample ─────────────────────────────────────────
        if ((t + 1) % sampleInterval === 0) {
          const dayIdx = Math.floor((t + 1) / sampleInterval);
          if (dayIdx <= days) dailyEquities[dayIdx].push(equity);
        }
      }

      dailyEquities[0].push(startingCapital);
      if (dailyEquities[days].length < p + 1) dailyEquities[days].push(equity);

      finalEquities.push(equity);
      maxDrawdowns.push(maxDD);
      ruinDays.push(ruinDay);
      endReasons.push(ruined ? 'ruin' : churned ? 'churn' : 'survived');
      equityCurves.push(curve);
    }

    // ── Percentile bands ─────────────────────────────────────────
    const percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    for (let d = 0; d <= days; d++) {
      const vals = dailyEquities[d].sort((a, b) => a - b);
      const n = vals.length || 1;
      percentiles.p5.push(vals[Math.floor(n * 0.05)]  || startingCapital);
      percentiles.p25.push(vals[Math.floor(n * 0.25)] || startingCapital);
      percentiles.p50.push(vals[Math.floor(n * 0.50)] || startingCapital);
      percentiles.p75.push(vals[Math.floor(n * 0.75)] || startingCapital);
      percentiles.p95.push(vals[Math.floor(n * 0.95)] || startingCapital);
    }

    // ── Final equity stats ────────────────────────────────────────
    const sortedFinal = [...finalEquities].sort((a, b) => a - b);

    // ── Survival / time-to-ruin stats ─────────────────────────────
    const ruinedDays    = ruinDays.filter(d => d !== null).sort((a, b) => a - b);
    const survivedPaths = endReasons.filter(r => r === 'survived').length;
    const survivalDays  = ruinedDays.length > 0 ? {
      median : ruinedDays[Math.floor(ruinedDays.length * 0.50)],
      mean   : Math.round(ruinedDays.reduce((s, d) => s + d, 0) / ruinedDays.length),
      p25    : ruinedDays[Math.floor(ruinedDays.length * 0.25)],
      p75    : ruinedDays[Math.floor(ruinedDays.length * 0.75)],
    } : null;

    return {
      probabilityOfRuin: ruinCount / paths,
      ruinCount,
      churnCount,
      survivedPaths,
      paths,
      days,
      totalTrades,
      ruinLevel,
      sizingFraction,

      // Survival analysis
      survivalDays,
      endReasonBreakdown: {
        survived : survivedPaths,
        ruin     : ruinCount,
        churn    : churnCount,
      },

      // Re-deposit stats
      reDepositCount,
      reDepositRate: reDepositCount / paths,

      // Lifecycle: profit withdrawal stats
      withdrawalPaths,
      totalWithdrawn,
      avgWithdrawnPerPath: withdrawalPaths > 0 ? totalWithdrawn / paths : 0,

      percentiles,

      finalEquity: {
        mean  : finalEquities.reduce((s, e) => s + e, 0) / paths,
        median: sortedFinal[Math.floor(paths / 2)],
        p5    : sortedFinal[Math.floor(paths * 0.05)],
        p95   : sortedFinal[Math.floor(paths * 0.95)],
        min   : sortedFinal[0],
        max   : sortedFinal[paths - 1],
      },

      maxDrawdown: {
        mean  : maxDrawdowns.reduce((s, d) => s + d, 0) / paths,
        median: [...maxDrawdowns].sort((a, b) => a - b)[Math.floor(paths / 2)],
        p95   : [...maxDrawdowns].sort((a, b) => a - b)[Math.floor(paths * 0.95)],
      },

      sampleCurves: equityCurves.slice(0, 50).map(c => {
        const daily = [c[0]];
        for (let d = 1; d <= days; d++) {
          const idx = Math.min(d * sampleInterval, c.length - 1);
          daily.push(c[idx]);
        }
        return daily;
      }),
    };
  },

  // ─── PoR as Function of Starting Capital ────────────────────────

  /**
   * Sweep starting capital from min to max, computing PoR at each level.
   * Uses the kurtosis-corrected analytical formula.
   *
   * @param {Object} params
   */
  porVsCapital(params) {
    const {
      winRate, avgWin, avgLoss,
      capitalMin = 1000,
      capitalMax = 100000,
      steps = 50,
      ruinThreshold = 0.1,
      excessKurtosis = 0,   // pass 6 for t(4) correction
    } = params;

    const edge = this.edgePerTrade(winRate, avgWin, avgLoss);
    const variance = winRate * avgWin ** 2 + (1 - winRate) * avgLoss ** 2 - edge ** 2;

    const capitals  = [];
    const porValues = [];
    const stepSize  = (capitalMax - capitalMin) / steps;

    for (let i = 0; i <= steps; i++) {
      const capital   = capitalMin + i * stepSize;
      const ruinLevel = capital * ruinThreshold;
      const por = this.analyticalPoR(capital, edge, variance, ruinLevel, excessKurtosis);
      capitals.push(capital);
      porValues.push(por);
    }

    return { capitals, porValues };
  },

  // ─── Position Sizing Comparison ─────────────────────────────────

  /**
   * Compare different position sizing strategies via MC simulation.
   */
  compareSizing(params) {
    const strategies = [
      { name: 'Fixed Lot',    sizing: 'fixed_lot',         riskPercent: 0 },
      { name: 'Fixed 1%',     sizing: 'fixed_fractional',  riskPercent: 1 },
      { name: 'Fixed 2%',     sizing: 'fixed_fractional',  riskPercent: 2 },
      { name: 'Half Kelly',   sizing: 'half_kelly',         riskPercent: 0 },
      { name: 'Full Kelly',   sizing: 'kelly',              riskPercent: 0 },
    ];

    return strategies.map(strat => {
      const result = this.monteCarloRuin({
        ...params,
        sizing: strat.sizing,
        riskPercent: strat.riskPercent,
        paths: 200,
      });
      return {
        name: strat.name,
        sizing: strat.sizing,
        fraction: strat.sizing === 'fixed_fractional' ? strat.riskPercent + '%' :
                  strat.sizing === 'kelly'      ? U.pct(result.sizingFraction * 100) :
                  strat.sizing === 'half_kelly' ? U.pct(result.sizingFraction * 100) : 'N/A',
        por: result.probabilityOfRuin,
        expectedReturn: ((result.finalEquity.median - params.startingCapital) / params.startingCapital) * 100,
        meanMaxDD: result.maxDrawdown.mean * 100,
        p95MaxDD:  result.maxDrawdown.p95 * 100,
        medianFinal: result.finalEquity.median,
        survivalDays: result.survivalDays,
      };
    });
  },

  // ─── A/B Book Recommendation ────────────────────────────────────

  /**
   * Composite routing score using multiple risk factors.
   *
   * Factors (each normalised 0-1, where 1 = more dangerous to broker):
   *   1.  Edge direction & magnitude
   *   2.  Profit factor
   *   3.  Risk-reward ratio
   *   4.  Sharpe ratio
   *   5.  Drawdown (inverted)
   *   6.  Return volatility (inverted)
   *   7.  Probability of ruin (inverted)
   *   8.  Account tenure — new accounts are unreliable signals (weight 0.7×)
   *
   * Total weight: 7 × 1.0 + 1 × 0.7 = 7.7
   *
   * Tenure penalises the composite for accounts under 90 days old,
   * preventing premature A-booking of lucky new accounts.
   *
   * @param {Object} trader - account stats
   * @param {number} [trader.accountAgeDays] - days since account opened
   * @param {Date}   [trader.openedAt] - fallback for age calculation
   */
  routingRecommendation(trader) {
    const edge    = this.edgePerTrade(trader.winRate, trader.avgWin, trader.avgLoss);
    const kelly   = this.kellyCriterion(trader.winRate, trader.avgWin, trader.avgLoss);
    const variance = trader.winRate * trader.avgWin ** 2 + (1 - trader.winRate) * trader.avgLoss ** 2 - edge ** 2;
    const stdDev  = Math.sqrt(variance);
    // Use kurtosis correction (t₄ ≈ excess kurtosis 6) for analytical PoR
    const por     = this.analyticalPoR(trader.balance || 10000, edge, variance, (trader.balance || 10000) * 0.1, 6);
    const pf      = trader.profitFactor || this.profitFactor(trader.winRate, trader.avgWin, trader.avgLoss);
    const rr      = trader.avgLoss > 0 ? trader.avgWin / trader.avgLoss : 1;
    const sharpe  = trader.sharpeRatio || 0;
    const maxDD   = trader.maxDrawdown  || 0.5;

    // ── Normalise each factor to 0-1 (1 = trader is skilled/dangerous) ──

    const edgeScore  = Math.min(1, Math.max(0, (edge + 200) / 400));
    const pfScore    = Math.min(1, Math.max(0, (pf - 0.5)   / 2.5));
    const rrScore    = Math.min(1, Math.max(0, (rr - 0.5)   / 3.5));
    const sharpeScore = Math.min(1, Math.max(0, (sharpe + 1) / 4));
    const ddScore    = Math.min(1, Math.max(0, 1 - maxDD / 0.6));

    const avgTrade   = (trader.avgWin + trader.avgLoss) / 2;
    const normVol    = avgTrade > 0 ? stdDev / avgTrade : 1;
    const volScore   = Math.min(1, Math.max(0, 1 - normVol / 2));

    const porScore   = Math.min(1, Math.max(0, 1 - por));

    // ── Tenure reliability score ──────────────────────────────────
    // Accounts under ~90 days have an insufficient track record.
    // The score ramps from 0 (day 0) → 0.25 (30d) → 0.50 (90d) → 0.80 (1yr) → 1.0 (2yr+)
    const accountAgeDays = trader.accountAgeDays != null
      ? trader.accountAgeDays
      : (trader.openedAt ? Math.floor((Date.now() - new Date(trader.openedAt)) / 86400000) : 365);

    const tenureScore =
      accountAgeDays <= 0    ? 0 :
      accountAgeDays < 30    ? (accountAgeDays / 30) * 0.25 :
      accountAgeDays < 90    ? 0.25 + ((accountAgeDays - 30)  / 60)  * 0.25 :
      accountAgeDays < 365   ? 0.50 + ((accountAgeDays - 90)  / 275) * 0.30 :
      accountAgeDays < 730   ? 0.80 + ((accountAgeDays - 365) / 365) * 0.20 :
      1.0;

    // ── Composite: tenure has 0.7× weight to avoid single-factor dominance ──
    const composite = (edgeScore + pfScore + rrScore + sharpeScore + ddScore + volScore + porScore + tenureScore * 0.7) / 7.7;

    // ── Classify into 3 buckets ──
    let recommendation, reason;
    const tenureWarning = accountAgeDays < 90 ? ` ⚠ account ${accountAgeDays}d old — signal unreliable` : '';

    if (composite > 0.55 && edge > 0) {
      recommendation = 'a_book';
      reason = `Skilled trader (score ${U.pct(composite * 100)}): PF ${U.num(pf)}, Sharpe ${U.num(sharpe)}, PoR ${U.pct(por * 100)} — hedge exposure${tenureWarning}`;
    } else if (composite < 0.40 || edge < 0) {
      recommendation = 'b_book';
      reason = `Weak trader (score ${U.pct(composite * 100)}): PF ${U.num(pf)}, edge ${U.money(edge)}, PoR ${U.pct(por * 100)} — warehouse risk${tenureWarning}`;
    } else {
      recommendation = 'review';
      reason = `Borderline (score ${U.pct(composite * 100)}): PF ${U.num(pf)}, Sharpe ${U.num(sharpe)}, PoR ${U.pct(por * 100)} — manual review${tenureWarning}`;
    }

    return {
      recommendation, por, edge, kelly, variance, reason, composite,
      accountAgeDays,
      breakdown: { edgeScore, pfScore, rrScore, sharpeScore, ddScore, volScore, porScore, tenureScore },
    };
  },

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * Student's t-distribution sampler with ν degrees of freedom.
   * Normalized to unit variance (var = ν/(ν-2)) so it's a drop-in
   * replacement for _boxMuller() with heavier tails.
   *
   * For even ν, uses the Poisson trick: chi²(2k) = -2·Σln(U_i),
   * which requires only k uniform samples instead of ν normal samples.
   *
   * t(4): excess kurtosis = 6 (vs 0 for normal) — realistic CFD tail risk
   * t(10): excess kurtosis = 1.2 — mild tails (shorter-dated strategies)
   * t(∞): approaches normal
   */
  _studentT(nu = 4) {
    const z = this._boxMuller();
    let chi2;

    if (nu % 2 === 0) {
      // Efficient path for even ν: chi²(2k) = -2·Σln(U_i), k = ν/2
      chi2 = 0;
      for (let i = 0; i < nu / 2; i++) {
        chi2 += -2 * Math.log(Math.random() || 1e-10);
      }
    } else {
      // General path: sum of ν squared normals
      chi2 = 0;
      for (let i = 0; i < nu; i++) {
        const n = this._boxMuller();
        chi2 += n * n;
      }
    }

    const raw = z / Math.sqrt(chi2 / nu);
    // Normalize to unit variance: Var(T_ν) = ν/(ν-2) for ν > 2
    return raw / Math.sqrt(nu / (nu - 2));
  },

  /** Box-Muller transform for standard normal random variable */
  _boxMuller() {
    let u1;
    do { u1 = Math.random(); } while (u1 === 0);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  },
};
