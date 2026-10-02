import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, RotateCcw, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { C, jump, newGame, rng, step, type GameState } from '../game/engine';
import { TelemetryClient, type TelemetryStats } from '../game/telemetry';
import { api } from '../lib/api';
import { accessToken } from '../lib/auth';
import { getConfig } from '../lib/config';
import type { LeaderboardEntry } from '../lib/types';
import { Button, Card, Chip, ErrorNote, Inset, SectionLabel, Stat, cx } from '../components/ui';

const W = 800;
const H = 360;
const NAME_RE = /^[A-Za-z0-9_-]{1,16}$/;

function draw(ctx: CanvasRenderingContext2D, g: GameState, phase: 'ready' | 'running' | 'over', t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060a1a');
  bg.addColorStop(1, '#0b1430');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // parallax grid
  ctx.strokeStyle = 'rgba(34,211,238,0.07)';
  ctx.lineWidth = 1;
  const off = (g.distance * 0.5) % 40;
  for (let x = -off; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.GROUND_Y);
    ctx.stroke();
  }
  for (let y = 20; y < C.GROUND_Y; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // skyline
  ctx.fillStyle = 'rgba(42,54,85,0.55)';
  const sky = (g.distance * 0.15) % 160;
  for (let i = -1; i < 7; i++) {
    const bx = i * 160 - sky;
    ctx.fillRect(bx + 10, 170, 50, C.GROUND_Y - 170);
    ctx.fillRect(bx + 70, 210, 36, C.GROUND_Y - 210);
    ctx.fillRect(bx + 112, 140, 30, C.GROUND_Y - 140);
  }
  // ground
  ctx.fillStyle = '#0d1631';
  ctx.fillRect(0, C.GROUND_Y, W, H - C.GROUND_Y);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#f5c518';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, C.GROUND_Y + 1);
  ctx.lineTo(W, C.GROUND_Y + 1);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(245,197,24,0.18)';
  const gOff = (g.distance) % 48;
  for (let x = -gOff; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, C.GROUND_Y + 2);
    ctx.lineTo(x - 30, H);
    ctx.stroke();
  }

  // obstacles
  for (const o of g.obstacles) {
    ctx.fillStyle = 'rgba(34,211,238,0.18)';
    ctx.fillRect(o.x, C.GROUND_Y - o.height, o.width, o.height);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.strokeRect(o.x + 1, C.GROUND_Y - o.height + 1, o.width - 2, o.height - 2);
    ctx.shadowBlur = 0;
  }

  // player (y = feet position, per RESS BR-02/BR-08)
  const top = g.y - C.PLAYER_H;
  ctx.fillStyle = g.state === 'DEAD' ? '#f87171' : '#f5c518';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 18;
  ctx.fillRect(C.PLAYER_X, top, C.PLAYER_W, C.PLAYER_H);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#050816';
  ctx.fillRect(C.PLAYER_X + 14, top + 8, 6, 4);
  if (g.state === 'RUNNING' && phase === 'running') {
    const leg = Math.floor(t / 80) % 2;
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(C.PLAYER_X + (leg ? 3 : 13), g.y, 7, 3);
  }

  // speed lines
  if (g.speed > C.DOUBLE_SCORE_SPEED && phase === 'running') {
    ctx.strokeStyle = 'rgba(245,197,24,0.35)';
    for (let i = 0; i < 6; i++) {
      const y = 60 + ((i * 47 + g.tick * 3) % 220);
      ctx.beginPath();
      ctx.moveTo(W - ((g.tick * 9 + i * 133) % W), y);
      ctx.lineTo(W - ((g.tick * 9 + i * 133) % W) + 40, y);
      ctx.stroke();
    }
  }

  if (phase !== 'running') {
    ctx.fillStyle = 'rgba(5,8,22,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c518';
    ctx.font = '700 34px "Inter Variable", sans-serif';
    ctx.fillText(phase === 'ready' ? 'CYBERRUNNER 2026' : 'RUN TERMINATED', W / 2, 150);
    ctx.fillStyle = '#eef1f7';
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillText(phase === 'ready' ? 'SPACE / ↑ / TAP to start · jump to dodge' : `score ${g.score} · tick ${g.tick} · ENTER / TAP to retry`, W / 2, 190);
  }
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameState>(newGame());
  const random = useRef(rng(Date.now() >>> 0));
  const phaseRef = useRef<'ready' | 'running' | 'over'>('ready');
  const jumpQueued = useRef(false);
  const telemetry = useRef<TelemetryClient | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [hud, setHud] = useState<{ tick: number; speed: number; score: number }>({ tick: 0, speed: C.BASE_SPEED, score: 0 });
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [name, setName] = useState('');
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const backend = !!getConfig();

  const loadBoard = useCallback(() => {
    if (backend) api.leaderboard().then(setBoard).catch(() => undefined);
  }, [backend]);
  useEffect(loadBoard, [loadBoard]);

  const start = useCallback(async () => {
    telemetry.current?.close();
    game.current = newGame();
    random.current = rng((Math.random() * 2 ** 32) >>> 0);
    sessionId.current = crypto.randomUUID();
    setSubmitMsg(null);
    phaseRef.current = 'running';
    setPhase('running');
    const cfg = getConfig();
    const token = cfg ? await accessToken() : null;
    if (cfg && token) {
      const client = new TelemetryClient(sessionId.current, setStats);
      telemetry.current = client;
      client.connect(cfg.wsUrl, token);
    } else {
      telemetry.current = null;
      setStats(null);
    }
  }, []);

  const action = useCallback(() => {
    if (phaseRef.current === 'running') jumpQueued.current = true;
    else void start();
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        action();
      } else if (['Enter', 'KeyR'].includes(e.code) && phaseRef.current !== 'running') {
        e.preventDefault();
        void start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, start]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const frame = (now: number) => {
      acc += Math.min(now - last, 250);
      last = now;
      if (phaseRef.current === 'running') {
        let steps = 0;
        while (acc >= C.TICK_MS && steps < 8) {
          const g = game.current;
          if (jumpQueued.current) {
            jump(g);
            jumpQueued.current = false;
          }
          step(g, random.current);
          telemetry.current?.push({ tick: g.tick, distance: g.distance, speed: g.speed, score: g.score, y: g.y, state: g.state });
          acc -= C.TICK_MS;
          steps++;
          if (g.state === 'DEAD') {
            phaseRef.current = 'over';
            setPhase('over');
            telemetry.current?.flush();
            break;
          }
        }
        if (steps === 8) acc = 0;
      } else {
        acc = 0;
      }
      if (now - hudAt > 100) {
        hudAt = now;
        const g = game.current;
        setHud({ tick: g.tick, speed: g.speed, score: g.score });
      }
      draw(ctx, game.current, phaseRef.current, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      telemetry.current?.close();
    };
  }, []);

  const submit = async () => {
    if (!NAME_RE.test(name)) {
      setSubmitMsg({ ok: false, text: 'Name must be 1–16 letters, digits, - or _' });
      return;
    }
    telemetry.current?.flush();
    await new Promise((r) => setTimeout(r, 700)); // allow the final batch to be acknowledged
    try {
      const res = await api.submitScore(sessionId.current, name);
      setSubmitMsg({ ok: true, text: `Server-verified score ${res.score} recorded (${res.ticks} ticks replayed against RESS rules).` });
      loadBoard();
    } catch (e) {
      setSubmitMsg({ ok: false, text: (e as Error).message });
    }
  };

  const multiplier = hud.speed > C.DOUBLE_SCORE_SPEED;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow text-amber">FR-05 · Live modernized runtime</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">CyberRunner 2026</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="amber">{(1000 / C.TICK_MS).toFixed(1)} Hz fixed-step</Chip>
              <Chip>gravity {C.GRAVITY}</Chip>
              <Chip>jump {C.JUMP_VELOCITY}</Chip>
              {multiplier && <Chip tone="ok"><Zap size={12} /> 2× score</Chip>}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => { e.preventDefault(); action(); }}
              className="block aspect-[800/360] w-full touch-none select-none"
              aria-label="CyberRunner 2026 game canvas. Press space, up arrow or tap to jump."
              role="img"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Score" value={hud.score} tone="amber" />
            <Stat label="Speed" value={hud.speed.toFixed(2)} sub="px / tick" />
            <Stat label="Tick" value={hud.tick} sub={`${(hud.tick * C.TICK_MS / 1000).toFixed(1)}s`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => void start()}><RotateCcw size={15} /> {phase === 'running' ? 'Restart' : 'Start'}</Button>
            <span>Desktop: <kbd className="font-mono text-fg">Space</kbd> / <kbd className="font-mono text-fg">↑</kbd> · Mobile: tap the canvas</span>
          </div>
        </Card>

        {phase === 'over' && (
          <Card className="p-6">
            <SectionLabel>Submit server-verified score</SectionLabel>
            {backend ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={16}
                  placeholder="Player name"
                  className="flex-1 rounded-xl border border-line-strong bg-ink-950 px-4 py-2.5 font-mono outline-none focus:border-amber"
                  aria-label="Player name"
                />
                <Button onClick={submit}><Trophy size={17} /> Submit</Button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Score submission requires the deployed backend.</p>
            )}
            {submitMsg && <div className={cx('mt-3 text-sm', submitMsg.ok ? 'text-teal' : 'text-bad')}>{submitMsg.text}</div>}
            <p className="mt-3 text-xs text-fg-dim">The client never sends a score to the leaderboard. The server replays every telemetry batch against RESS rules BR-05/BR-06 and records only its own computed score (fixes legacy CWE-602 high-score injection).</p>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <SectionLabel className="flex items-center gap-2"><Radio size={14} /> Cloud telemetry (WebSocket)</SectionLabel>
          {stats ? (
            <div className="space-y-2 font-mono text-sm">
              <Row k="connection" v={stats.status} tone={stats.status === 'open' ? 'ok' : stats.status === 'error' ? 'bad' : undefined} />
              <Row k="batches sent / acked" v={`${stats.sent} / ${stats.acked}`} />
              <Row k="tick samples" v={stats.samples} />
              <Row k="round-trip" v={stats.rttMs !== null ? `${stats.rttMs} ms` : '—'} />
              <Row k="server tick" v={stats.serverTick} />
              <Row k="server score" v={stats.serverScore} tone="ok" />
              <Row k="validation" v={stats.rejected ? `REJECTED: ${stats.rejected}` : 'parity OK'} tone={stats.rejected ? 'bad' : 'ok'} />
            </div>
          ) : (
            <p className="text-sm text-fg-muted">{backend ? 'Starts with the next run. Authenticated with your Cognito access token.' : 'Offline preview — telemetry streams when deployed.'}</p>
          )}
        </Card>
        <Card className="p-6">
          <SectionLabel className="flex items-center gap-2"><Trophy size={14} /> Leaderboard</SectionLabel>
          {board.length ? (
            <ol className="space-y-1.5">
              {board.map((b, i) => (
                <li key={`${b.playerName}-${b.createdAt}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 font-mono text-sm odd:bg-ink-925">
                  <span><span className={cx('mr-3', i === 0 ? 'text-amber' : 'text-fg-dim')}>{String(i + 1).padStart(2, '0')}</span>{b.playerName}</span>
                  <span className="text-amber">{b.score}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-fg-muted">No verified scores yet.</p>}
        </Card>
        <Inset className="flex gap-3 px-4 py-3 text-xs leading-relaxed text-fg-muted">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" />
          Physics, scoring and spawn cadence are the exact rules recovered in the RESS from CyberRunner 1998 and covered by parity tests in both the Java target and this client.
        </Inset>
        {stats?.status === 'error' && <ErrorNote>WebSocket connection failed — check that your session is still valid.</ErrorNote>}
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string | number; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-dim">{k}</span>
      <span className={cx('truncate text-right', tone === 'ok' && 'text-teal', tone === 'bad' && 'text-bad')}>{v}</span>
    </div>
  );
}
