import { CONFIG } from '../config.js';
import { updateState } from '../state.js';

export class WebSocketService {
  constructor() {
    this._ws = null;
    this._subscribers = new Map();  // channel → Set<callback>
    this._messageHandlers = [];
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._intentionalClose = false;
    this.status = 'disconnected'; // 'connecting' | 'connected' | 'disconnected' | 'error'
    this._onStatusChange = null;
  }

  onStatusChange(callback) {
    this._onStatusChange = callback;
  }

  _setStatus(s) {
    this.status = s;
    if (this._onStatusChange) this._onStatusChange(s);
  }

  connect() {
    if (!CONFIG.WS_URL) {
      console.info('[WS] No WS_URL configured — using mock/polling mode');
      return;
    }

    this._intentionalClose = false;
    this._setStatus('connecting');

    try {
      this._ws = new WebSocket(CONFIG.WS_URL);
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this._setStatus('error');
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      console.info('[WS] Connected to', CONFIG.WS_URL);
      this._setStatus('connected');
      this._reconnectAttempts = 0;

      // Re-subscribe to any channels
      for (const channel of this._subscribers.keys()) {
        this._sendSubscribe(channel);
      }
    };

    this._ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        console.warn('[WS] Non-JSON message:', event.data);
        return;
      }

      // Route to channel subscribers
      const channel = msg.channel || msg.type || 'default';
      const subs = this._subscribers.get(channel);
      if (subs) {
        for (const cb of subs) cb(msg.data || msg);
      }

      // Route to generic handlers
      for (const handler of this._messageHandlers) {
        handler(msg);
      }

      // Auto-update state if message has a `state` payload
      if (msg.state) {
        updateState(msg.state);
      }
    };

    this._ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this._setStatus('error');
    };

    this._ws.onclose = () => {
      this._setStatus('disconnected');
      if (!this._intentionalClose) {
        console.info('[WS] Connection lost — will reconnect');
        this._scheduleReconnect();
      }
    };
  }

  disconnect() {
    this._intentionalClose = true;
    clearTimeout(this._reconnectTimer);
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._setStatus('disconnected');
  }

  subscribe(channel, callback) {
    if (!this._subscribers.has(channel)) {
      this._subscribers.set(channel, new Set());
    }
    this._subscribers.get(channel).add(callback);

    // If already connected, send subscribe message
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._sendSubscribe(channel);
    }

    // Return unsubscribe function
    return () => {
      const subs = this._subscribers.get(channel);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this._subscribers.delete(channel);
      }
    };
  }

  onMessage(handler) {
    this._messageHandlers.push(handler);
    return () => {
      this._messageHandlers = this._messageHandlers.filter(h => h !== handler);
    };
  }

  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  _sendSubscribe(channel) {
    this.send({ action: 'subscribe', channel });
  }

  _scheduleReconnect() {
    if (this._reconnectAttempts >= CONFIG.WS_MAX_RECONNECT) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = CONFIG.WS_RECONNECT_DELAY * Math.pow(1.5, this._reconnectAttempts);
    this._reconnectAttempts++;

    console.info(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this._reconnectAttempts})`);
    this._reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
