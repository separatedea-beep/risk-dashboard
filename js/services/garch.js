/**
 * GARCH(1,1) Volatility Model
 * σ²(t) = ω + α·ε²(t-1) + β·σ²(t-1)
 *
 * Used to produce time-varying volatility for more realistic
 * Monte Carlo risk projections (fatter tails, vol clustering).
 */

function boxMuller() {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Fit GARCH(1,1) parameters via simplified grid-search MLE.
 * Coarse but fast enough for in-browser use with small return series.
 *
 * @param {number[]} returns - array of log returns
 * @returns {{ omega: number, alpha: number, beta: number, lastVariance: number, longRunVol: number }}
 */
export function fitGarch(returns) {
  if (returns.length < 5) {
    const v = variance(returns);
    return { omega: v * 0.05, alpha: 0.10, beta: 0.85, lastVariance: v, longRunVol: Math.sqrt(v * 252) };
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const demeaned = returns.map(r => r - mean);

  let bestLL = -Infinity;
  let bestParams = { omega: 0.00001, alpha: 0.10, beta: 0.85 };

  // Grid search over α and β
  for (let alpha = 0.03; alpha <= 0.25; alpha += 0.03) {
    for (let beta = 0.70; beta <= 0.96; beta += 0.03) {
      if (alpha + beta >= 0.999) continue;

      // ω = unconditional variance × (1 - α - β)
      const uncondVar = variance(demeaned);
      const omega = uncondVar * (1 - alpha - beta);
      if (omega <= 0) continue;

      // Evaluate log-likelihood
      let ll = 0;
      let sigma2 = uncondVar;
      for (let t = 1; t < demeaned.length; t++) {
        sigma2 = omega + alpha * demeaned[t - 1] * demeaned[t - 1] + beta * sigma2;
        if (sigma2 <= 0) { ll = -Infinity; break; }
        ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(sigma2) + (demeaned[t] * demeaned[t]) / sigma2);
      }

      if (ll > bestLL) {
        bestLL = ll;
        bestParams = { omega, alpha, beta };
      }
    }
  }

  // Compute last variance from fitted model
  const uncondVar = variance(demeaned);
  let lastVar = uncondVar;
  for (let t = 1; t < demeaned.length; t++) {
    lastVar = bestParams.omega + bestParams.alpha * demeaned[t - 1] * demeaned[t - 1] + bestParams.beta * lastVar;
  }

  const longRunVar = bestParams.omega / (1 - bestParams.alpha - bestParams.beta);

  return {
    ...bestParams,
    lastVariance: lastVar,
    longRunVol: Math.sqrt(Math.max(longRunVar, 0) * 252),
  };
}

/**
 * Forecast GARCH volatility term structure.
 *
 * @param {Object} params
 * @returns {number[]} array of forecasted daily σ values (annualised)
 */
export function forecastVolatility({ omega, alpha, beta, lastReturn, lastVariance, days = 30 }) {
  const vols = [];
  let sigma2 = lastVariance;
  let eps2 = lastReturn * lastReturn;

  for (let d = 0; d < days; d++) {
    sigma2 = omega + alpha * eps2 + beta * sigma2;
    vols.push(Math.sqrt(sigma2 * 252)); // annualised
    // For multi-step forecast, expected ε² = σ² (unconditional)
    eps2 = sigma2;
  }

  return vols;
}

/**
 * Generate Monte Carlo paths using GARCH(1,1) volatility dynamics.
 *
 * @param {Object} params
 * @returns {{ percentiles, stats }} same shape as runMonteCarlo
 */
export function generateGarchPaths({
  omega,
  alpha,
  beta,
  mu,
  lastReturn,
  lastVariance,
  days = 30,
  paths = 500,
  startEquity = 10000,
}) {
  const allPaths = [];
  const finalValues = [];

  for (let p = 0; p < paths; p++) {
    const path = new Array(days + 1);
    path[0] = startEquity;

    let sigma2 = lastVariance;
    let prevEps = lastReturn - mu;

    for (let d = 1; d <= days; d++) {
      // Update variance
      sigma2 = omega + alpha * prevEps * prevEps + beta * sigma2;
      if (sigma2 <= 0) sigma2 = omega / (1 - alpha - beta); // fallback

      const sigma = Math.sqrt(sigma2);
      const z = boxMuller();
      const eps = sigma * z;
      const ret = mu + eps;

      path[d] = path[d - 1] * Math.exp(ret);
      prevEps = eps;
    }

    allPaths.push(path);
    finalValues.push(path[days]);
  }

  // Percentiles at each day
  const percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (let d = 0; d <= days; d++) {
    const vals = allPaths.map(p => p[d]).sort((a, b) => a - b);
    percentiles.p5.push(vals[Math.floor(paths * 0.05)]);
    percentiles.p25.push(vals[Math.floor(paths * 0.25)]);
    percentiles.p50.push(vals[Math.floor(paths * 0.50)]);
    percentiles.p75.push(vals[Math.floor(paths * 0.75)]);
    percentiles.p95.push(vals[Math.floor(paths * 0.95)]);
  }

  // Final stats
  finalValues.sort((a, b) => a - b);
  const median = finalValues[Math.floor(paths * 0.50)];
  const p5     = finalValues[Math.floor(paths * 0.05)];
  const p95    = finalValues[Math.floor(paths * 0.95)];
  const probLoss = finalValues.filter(v => v > startEquity).length / paths;

  let totalMaxDD = 0;
  for (const path of allPaths) {
    let peak = path[0];
    let maxDD = 0;
    for (let d = 1; d <= days; d++) {
      if (path[d] > peak) peak = path[d];
      const dd = (peak - path[d]) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    totalMaxDD += maxDD;
  }

  return {
    percentiles,
    stats: {
      median: Math.round(median),
      p5: Math.round(p5),
      p95: Math.round(p95),
      probLoss: Math.round(probLoss * 100),
      maxDrawdown: Math.round((totalMaxDD / paths) * 100 * 10) / 10,
      expectedReturn: Math.round(((median - startEquity) / startEquity) * 1000) / 10,
    },
  };
}

function variance(arr) {
  const n = arr.length;
  if (n < 2) return 0.0004; // fallback
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  return arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1);
}
