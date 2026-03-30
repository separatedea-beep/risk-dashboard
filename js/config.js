export const CONFIG = {
  // ── API Configuration ──────────────────────────────────────
  // Set these to your back office / bridge endpoints
  API_BASE_URL: '',          // e.g. 'https://your-backoffice.com/api/v1'
  API_TOKEN: '',             // Bearer token for REST API auth

  // ── WebSocket Configuration ────────────────────────────────
  WS_URL: '',                // e.g. 'wss://your-backoffice.com/ws/risk'
  WS_RECONNECT_DELAY: 3000, // ms before reconnect attempt
  WS_MAX_RECONNECT: 10,     // max consecutive reconnect attempts

  // ── Data Mode ──────────────────────────────────────────────
  // When true OR when API_BASE_URL is empty, uses simulated data
  USE_MOCK: true,

  // ── Polling (REST fallback when no WebSocket) ──────────────
  POLL_INTERVAL: 5000,       // ms between REST polls

  // ── Mock update interval ───────────────────────────────────
  MOCK_INTERVAL: 4000,       // ms between simulated updates

  // ── Thresholds ─────────────────────────────────────────────
  THRESHOLDS: {
    EXPOSURE_WARNING: 70,    // % of limit → amber
    EXPOSURE_CRITICAL: 90,   // % of limit → red
    MARGIN_WARNING: 70,      // % used → amber
    MARGIN_CRITICAL: 85,     // % used → red
    STOPOUT_LEVEL: 150,      // margin % below which accounts flagged
  },
};
