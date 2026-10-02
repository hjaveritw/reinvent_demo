import type { PlayerState } from './engine';

export interface TelemetrySample { tick: number; distance: number; speed: number; score: number; y: number; state: PlayerState }

export interface TelemetryStats {
  status: 'offline' | 'connecting' | 'open' | 'closed' | 'error';
  sent: number;
  acked: number;
  samples: number;
  rttMs: number | null;
  serverTick: number;
  serverScore: number;
  rejected: string | null;
}

/** Streams fixed-tick samples to the authenticated API Gateway WebSocket in 250 ms batches (≈15 ticks each). */
export class TelemetryClient {
  private ws: WebSocket | null = null;
  private queue: TelemetrySample[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  stats: TelemetryStats = { status: 'offline', sent: 0, acked: 0, samples: 0, rttMs: null, serverTick: 0, serverScore: 0, rejected: null };

  constructor(private sessionId: string, private onChange: (s: TelemetryStats) => void) {}

  connect(url: string, token: string) {
    this.update({ status: 'connecting' });
    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.update({ status: 'open' });
      this.flushTimer = setInterval(() => this.flush(), 250);
      this.pingTimer = setInterval(() => this.send({ action: 'ping', sentAt: Date.now() }), 5000);
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string);
        if (m.type === 'ack') {
          this.update({
            acked: this.stats.acked + 1,
            rttMs: m.sentAt ? Date.now() - m.sentAt : this.stats.rttMs,
            serverTick: m.serverTick ?? this.stats.serverTick,
            serverScore: m.serverScore ?? this.stats.serverScore,
            rejected: m.accepted === false ? m.reason ?? 'rejected' : this.stats.rejected,
          });
        } else if (m.type === 'pong') {
          this.update({ rttMs: Date.now() - m.sentAt });
        }
      } catch {
        /* ignore malformed */
      }
    };
    ws.onerror = () => this.update({ status: 'error' });
    ws.onclose = () => {
      this.stopTimers();
      if (this.stats.status !== 'error') this.update({ status: 'closed' });
    };
  }

  push(sample: TelemetrySample) {
    this.queue.push(sample);
  }

  flush() {
    while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
      const batch = this.queue.splice(0, 60);
      this.send({ action: 'telemetry', sessionId: this.sessionId, sentAt: Date.now(), samples: batch });
      this.update({ sent: this.stats.sent + 1, samples: this.stats.samples + batch.length });
    }
  }

  close() {
    this.flush();
    this.stopTimers();
    setTimeout(() => this.ws?.close(), 1500);
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private stopTimers() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.flushTimer = this.pingTimer = null;
  }

  private update(p: Partial<TelemetryStats>) {
    this.stats = { ...this.stats, ...p };
    this.onChange(this.stats);
  }
}
