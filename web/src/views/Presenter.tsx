import { ArrowRight, CheckCircle2, Circle, Gamepad2, Pause, Play, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDemo } from '../state/DemoContext';
import { STAGES, TARGET_SECONDS } from '../lib/stages';
import { mmss, secs } from '../lib/format';
import { Card, Inset, cx } from '../components/ui';

function DemoClock() {
  const { clock } = useDemo();
  const over = clock.remaining < 0;
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-line bg-ink-950 px-6 py-4">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Demo Clock</div>
        <div className={cx('mt-1 font-mono text-[36px] font-semibold leading-none tabular-nums', over ? 'text-bad' : 'text-amber')} aria-live="off">
          {over ? '+' : ''}{mmss(Math.abs(clock.remaining))}
        </div>
      </div>
      <button
        type="button"
        onClick={clock.toggle}
        aria-label={clock.running ? 'Pause demo clock' : 'Start demo clock'}
        className="grid h-12 w-12 place-items-center rounded-xl bg-amber text-[#111] transition hover:bg-amber-soft"
      >
        {clock.running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
      </button>
      <button
        type="button"
        onClick={clock.reset}
        aria-label="Reset demo clock"
        className="grid h-12 w-12 place-items-center rounded-xl border border-line-strong bg-ink-850 text-fg-muted transition hover:text-fg"
      >
        <RotateCcw size={19} />
      </button>
    </div>
  );
}

function StageStrip() {
  const { stageIndex, setStageIndex, clock } = useDemo();
  return (
    <div className="scroll-thin -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
      {STAGES.map((s, i) => {
        const active = i === stageIndex;
        const done = clock.elapsed >= s.endSec;
        return (
          <button
            key={s.index}
            type="button"
            onClick={() => setStageIndex(i)}
            className={cx(
              'min-w-[220px] snap-start rounded-2xl border px-4 py-4 text-left transition lg:min-w-0',
              active ? 'border-amber bg-ink-800' : 'border-line bg-ink-900 hover:border-line-strong',
            )}
          >
            <div className="flex items-start justify-between gap-3 font-mono text-[12px]">
              <span className={cx('whitespace-nowrap', active ? 'font-semibold text-amber' : 'text-fg-dim')}>Stage {String(s.index).padStart(2, '0')}</span>
              <span className={cx('text-right', active ? 'text-fg' : 'text-fg-dim')}>{s.category}</span>
            </div>
            <div className="mt-2 truncate text-[14.5px] font-semibold">{s.title}</div>
            <div className={cx('mt-1.5 flex items-center gap-2 font-mono text-[12.5px]', done ? 'text-teal' : 'text-fg-muted')}>
              {mmss(s.startSec)}
              {done && <CheckCircle2 size={13} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Guardrails() {
  const { job, clock, go } = useDemo();
  const items = [
    {
      title: 'Reverse Engineering Step:',
      body: 'Assessed & documented legacy code before touching via Kiro & AI Works.',
      live: job?.ressSummary ? `RESS: ${job.ressSummary.rules} rules · ${job.ressSummary.vulnerabilities} vulns · ${secs(job.ressSummary.durationMs)}` : null,
    },
    {
      title: 'Forward Engineering Step:',
      body: 'Produced working modernized code from that assessment using AWS Transform.',
      live: job?.forwardSummary ? `${job.forwardSummary.files} files · ${job.forwardSummary.testFiles} test classes` : null,
    },
    {
      title: 'Tooling Verified:',
      body: 'AWS Transform, Kiro, AI Works learning path stack.',
      live: job?.status === 'VERIFIED' && job.build?.latest ? `CodeBuild ✓ ${job.build.latest.tests.total.run} tests · 0 failures` : null,
    },
    {
      title: 'Runtime Budget:',
      body: 'Timed 5–10 minute execution window.',
      live: clock.elapsed > 0 ? `${mmss(clock.elapsed)} elapsed of ${mmss(TARGET_SECONDS)}` : null,
    },
  ];
  return (
    <Card className="p-7">
      <h2 className="text-[15px] font-bold uppercase tracking-[0.12em]">Demo Guardrails Checklist</h2>
      <div className="mt-4 border-t border-line" />
      <ul className="mt-5 space-y-5">
        {items.map((it) => (
          <li key={it.title} className="flex gap-4">
            <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-teal" strokeWidth={1.75} />
            <div>
              <div className="text-[15px] font-bold">{it.title}</div>
              <div className="mt-0.5 text-[14px] leading-relaxed text-fg-muted">{it.body}</div>
              {it.live ? (
                <div className="mt-1.5 font-mono text-xs text-teal">● {it.live}</div>
              ) : (
                <div className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-fg-dim"><Circle size={8} /> awaiting live run</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-line" />
      <button
        type="button"
        onClick={() => go('game')}
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-amber/50 bg-amber-deep/40 px-5 py-3.5 text-[15px] font-bold text-amber transition hover:bg-amber-deep"
      >
        <Gamepad2 size={20} /> Test Playable Modernized Game
      </button>
    </Card>
  );
}

export function Presenter() {
  const { stageIndex, go } = useDemo();
  const stage = STAGES[stageIndex];
  const dur = stage.endSec - stage.startSec;
  return (
    <div className="space-y-8">
      <Card className="p-6 sm:p-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[14px] sm:text-[15px]">
              <span className="text-amber">Required Guardrail: 5–10 Minutes Runtime Budget</span>
              <span className="mx-2 text-fg-dim">·</span>
              <span className="text-fg-muted">Thoughtworks &amp; AWS AI Works Walkthrough</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <h1 className="text-[26px] font-extrabold tracking-tight sm:text-[30px]">Guided 5–10 Minute Core Demo Presenter</h1>
              <span className="rounded-xl border border-amber/40 bg-amber-deep/60 px-3.5 py-1 font-mono text-[15px] font-semibold text-amber">8m 30s Target</span>
            </div>
            <p className="mt-4 max-w-4xl text-[15.5px] leading-relaxed text-fg-muted">
              Use this interactive presenter controller to deliver a crisp, authoritative demonstration showcasing legacy reverse engineering with Kiro and forward engineering with AWS Transform.
            </p>
          </div>
          <DemoClock />
        </div>
        <div className="my-8 border-t border-line" />
        <StageStrip />
      </Card>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <Card className="p-6 sm:p-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={stage.index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="eyebrow text-[14.5px] text-amber">Stage {stage.index} of 5 · {stage.category}</div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">{stage.title}</h2>
                  <div className="mt-1.5 font-mono text-[15px] text-fg-muted sm:text-[16px]">
                    Allocated Time: {mmss(stage.startSec)} – {mmss(stage.endSec)} ({Math.floor(dur / 60)}m {String(dur % 60).padStart(2, '0')}s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => go(stage.cta.view, stage.cta.tab)}
                  className="inline-flex shrink-0 items-center gap-3 self-start rounded-xl bg-amber px-5 py-3 text-[15.5px] font-bold text-[#111] transition hover:bg-amber-soft"
                >
                  {stage.cta.label} <ArrowRight size={18} />
                </button>
              </div>
              <div className="my-7 border-t border-line" />
              <h3 className="text-[13.5px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Presenter Talking Points &amp; Speaker Script</h3>
              <Inset className="mt-4 bg-ink-950 px-6 py-6 sm:px-8">
                <p className="text-[16px] italic leading-[1.75] text-amber-soft sm:text-[18.5px]">“{stage.script}”</p>
              </Inset>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <Inset className="px-6 py-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Stage Objective</div>
                  <p className="mt-3 text-[15px] leading-relaxed text-fg">{stage.objective}</p>
                </Inset>
                <Inset className="px-6 py-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-muted">Key Action to Demonstrate</div>
                  <p className="mt-3 text-[15.5px] font-bold leading-relaxed text-amber">{stage.keyAction}</p>
                </Inset>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Guardrails />
        </div>
      </div>
    </div>
  );
}
