/**
 * Monte Carlo simulation using Geometric Brownian Motion.
 * Projects trader equity paths forward to estimate B-book risk.
 */

function boxMuller() {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * @param {Object} params
 * @param {number} params.dailyReturn  - mean daily return (from trader's perspective)
 * @param {number} params.volatility   - daily return std deviation
 * @param {number} [params.days=30]    - simulation horizon
 * @param {number} [params.paths=500]  - number of Monte Carlo paths
 * @param {number} [params.startEquity=10000] - starting equity
 * @returns {{ percentiles: { p5: number[], p25: number[], p50: number[], p75: number[], p95: number[] }, stats: { median: number, p5: number, p95: number, probLoss: number, maxDrawdown: number, expectedReturn: number } }}
 */
export function runMonteCarlo({
  dailyReturn,
  volatility,
  days = 30,
  paths = 500,
  startEquity = 10000,
}) {
  const drift = dailyReturn - 0.5 * volatility * volatility;
  const finalValues = [];
  const allPaths = [];

  for (let p = 0; p < paths; p++) {
    const path = new Array(days + 1);
    path[0] = startEquity;
    for (let d = 1; d <= days; d++) {
      const shock = drift + volatility * boxMuller();
      path[d] = path[d - 1] * Math.exp(shock);
    }
    allPaths.push(path);
    finalValues.push(path[days]);
  }

  // Compute percentiles at each day
  const percentiles = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (let d = 0; d <= days; d++) {
    const vals = allPaths.map(p => p[d]).sort((a, b) => a - b);
    percentiles.p5.push(vals[Math.floor(paths * 0.05)]);
    percentiles.p25.push(vals[Math.floor(paths * 0.25)]);
    percentiles.p50.push(vals[Math.floor(paths * 0.50)]);
    percentiles.p75.push(vals[Math.floor(paths * 0.75)]);
    percentiles.p95.push(vals[Math.floor(paths * 0.95)]);
  }

  // Final day stats
  finalValues.sort((a, b) => a - b);
  const median = finalValues[Math.floor(paths * 0.50)];
  const p5     = finalValues[Math.floor(paths * 0.05)];
  const p95    = finalValues[Math.floor(paths * 0.95)];

  // Probability that trader's equity grows (= loss for the house on B-book)
  const probLoss = finalValues.filter(v => v > startEquity).length / paths;

  // Expected max drawdown across all paths (from peak)
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

  const expectedReturn = ((median - startEquity) / startEquity) * 100;

  return {
    percentiles,
    stats: {
      median: Math.round(median),
      p5: Math.round(p5),
      p95: Math.round(p95),
      probLoss: Math.round(probLoss * 100),
      maxDrawdown: Math.round((totalMaxDD / paths) * 100 * 10) / 10,
      expectedReturn: Math.round(expectedReturn * 10) / 10,
    },
  };
}
