import { useEffect, useMemo, useState } from 'react';
import { Boxes, Cpu, FileCode2, FlaskConical, Hammer, History, Play, ScanSearch, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { api } from '../lib/api';
import { mmss, secs, timeAgo } from '../lib/format';
import type { Job, JobStage, SampleMeta, ScanReport, SpecResponse } from '../lib/types';
import type { WorkbenchTab } from '../lib/stages';
import { useDemo } from '../state/DemoContext';
import { Button, Card, Chip, Empty, ErrorNote, Inset, SectionLabel, SeverityBadge, Stat, StatusIcon, cx } from '../components/ui';

const PIPELINE: { stage: JobStage; label: string; sub: string; icon: typeof ScanSearch }[] = [
  { stage: 'SCANNING', label: 'Ingest & Pre-scan', sub: 'AI Works ingest · CVE / secret / PII audit', icon: ScanSearch },
  { stage: 'REVERSE_ENGINEERING', label: 'Reverse Engineering', sub: 'Kiro-style spec recovery → RESS', icon: Sparkles },
  { stage: 'FORWARD_ENGINEERING', label: 'Forward Engineering', sub: 'AWS Transform recipes + Bedrock', icon: Workflow },
  { stage: 'BUILDING', label: 'Sandboxed Build', sub: 'VPC-isolated CodeBuild · -Werror · parity tests', icon: Hammer },
  { stage: 'VERIFIED', label: 'Verified', sub: 'Ready for review & approval', icon: ShieldCheck },
];
const ORDER: JobStage[] = ['QUEUED', 'SCANNING', 'REVERSE_ENGINEERING', 'FORWARD_ENGINEERING', 'BUILDING', 'SELF_HEALING', 'VERIFIED'];

function stepState(job: Job | null, stage: JobStage): 'done' | 'active' | 'pending' | 'failed' {
  if (!job) return 'pending';
  const cur = job.status === 'SELF_HEALING' ? 'BUILDING' : job.status;
  if (job.status === 'VERIFIED') return 'done';
  if (job.status === 'FAILED') {
    if (!job.stages[stage]) return 'pending';
    const later = PIPELINE.slice(PIPELINE.findIndex((p) => p.stage === stage) + 1).some((p) => job.stages[p.stage]);
    return later ? 'done' : 'failed';
  }
  const ci = ORDER.indexOf(cur);
  const si = ORDER.indexOf(stage);
  return si < ci ? 'done' : si === ci ? 'active' : 'pending';
}

function stageDuration(job: Job, stage: JobStage) {
  const start = job.stages[stage];
  if (!start) return null;
  const idx = PIPELINE.findIndex((p) => p.stage === stage);
  const next = PIPELINE.slice(idx + 1).map((p) => job.stages[p.stage]).find(Boolean) ?? (job.status === 'FAILED' ? job.updatedAt : undefined);
  const end = next ? Date.parse(next) : Date.now();
  return (end - Date.parse(start)) / 1000;
}

function Launcher() {
  const { setJobId, jobId, go } = useDemo();
  const [samples, setSamples] = useState<SampleMeta[]>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof api.jobs>>>([]);
  const [sampleId, setSampleId] = useState('cyberrunner-1998');
  const [mode, setMode] = useState<'live' | 'golden'>('live');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.samples().then(setSamples).catch((e) => setErr(e.message));
    api.jobs().then(setRecent).catch(() => undefined);
  }, [jobId]);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { jobId: id } = await api.startJob(sampleId, mode);
      setJobId(id);
      go('workbench', 'scan');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <SectionLabel>Legacy scenario</SectionLabel>
      <div className="space-y-3">
        {(samples.length ? samples : [{ id: 'cyberrunner-1998', name: 'CyberRunner 1998', tagline: 'Java 8 multiplayer arcade socket server', language: 'Java 8', fileCount: 8, loc: 0, description: '' }]).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSampleId(s.id)}
            className={cx('w-full rounded-2xl border px-4 py-3 text-left transition', sampleId === s.id ? 'border-amber bg-ink-800' : 'border-line hover:border-line-strong')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{s.name}</span>
              <span className="font-mono text-[11px] text-fg-dim">{s.language}</span>
            </div>
            <div className="mt-0.5 text-sm text-fg-muted">{s.tagline}</div>
            {s.loc > 0 && <div className="mt-1 font-mono text-[11px] text-fg-dim">{s.fileCount} files · {s.loc} lines</div>}
          </button>
        ))}
      </div>

      <SectionLabel className="mt-6">Execution mode</SectionLabel>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink-925 p-1">
        {(['live', 'golden'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cx('rounded-lg px-3 py-2 text-sm font-semibold transition', mode === m ? 'bg-ink-800 text-amber' : 'text-fg-muted hover:text-fg')}>
            {m === 'live' ? 'Live (Bedrock)' : 'Golden (cached)'}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-dim">
        {mode === 'live'
          ? 'Generates the RESS and modern code with Amazon Bedrock in real time, then builds in the sandbox. Typically 3–6 minutes.'
          : 'Uses the pre-verified RESS and code (RSK-03 fallback). Pre-scan and the sandboxed CodeBuild still run live.'}
      </p>
      <Button className="mt-5 w-full" onClick={start} disabled={busy}>
        <Play size={18} fill="currentColor" /> {busy ? 'Starting…' : 'Run Reverse → Forward Pipeline'}
      </Button>
      {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}

      {recent.length > 0 && (
        <>
          <SectionLabel className="mt-8 flex items-center gap-2"><History size={14} /> Recent runs</SectionLabel>
          <ul className="space-y-1.5">
            {recent.slice(0, 6).map((j) => (
              <li key={j.jobId}>
                <button
                  type="button"
                  onClick={() => setJobId(j.jobId)}
                  className={cx('flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-ink-850', j.jobId === jobId && 'bg-ink-850')}
                >
                  <span className="truncate">{j.sampleName} <span className="text-fg-dim">· {j.mode}</span></span>
                  <span className={cx('shrink-0 font-mono text-[11px]', j.status === 'VERIFIED' ? 'text-teal' : j.status === 'FAILED' ? 'text-bad' : 'text-amber')}>
                    {j.status === 'VERIFIED' && j.totalSeconds ? mmss(j.totalSeconds) : j.status} · {timeAgo(j.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Timeline({ job }: { job: Job }) {
  const attempts = job.build?.attempts?.length ?? 0;
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {PIPELINE.map((p) => {
        const st = stepState(job, p.stage);
        const d = stageDuration(job, p.stage);
        const Icon = p.icon;
        return (
          <Inset key={p.stage} className={cx('px-4 py-4', st === 'active' && 'border-amber/60', st === 'failed' && 'border-bad/50')}>
            <div className="flex items-center justify-between">
              <Icon size={18} className={st === 'done' ? 'text-teal' : st === 'active' ? 'text-amber' : 'text-fg-dim'} />
              <StatusIcon state={st} />
            </div>
            <div className="mt-3 text-sm font-semibold">{p.label}</div>
            <div className="mt-0.5 text-xs leading-snug text-fg-dim">{p.sub}</div>
            <div className="mt-2 font-mono text-xs text-fg-muted">
              {p.stage !== 'VERIFIED' && d !== null ? `${d.toFixed(0)}s` : ''}
              {p.stage === 'BUILDING' && attempts > 0 ? ` · attempt ${attempts}/3` : ''}
              {p.stage === 'VERIFIED' && job.totalSeconds ? `total ${mmss(job.totalSeconds)}` : ''}
            </div>
          </Inset>
        );
      })}
    </div>
  );
}

function EventLog({ job }: { job: Job }) {
  return (
    <Inset className="scroll-thin max-h-56 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed">
      {[...job.events].reverse().map((e, i) => (
        <div key={`${e.at}-${i}`} className="flex gap-3">
          <span className="shrink-0 text-fg-dim">{new Date(e.at).toLocaleTimeString()}</span>
          <span className={cx(e.level === 'success' && 'text-teal', e.level === 'warn' && 'text-warn', e.level === 'error' && 'text-bad', (!e.level || e.level === 'info') && 'text-fg-muted')}>{e.message}</span>
        </div>
      ))}
    </Inset>
  );
}

function ScanPanel({ jobId, ready }: { jobId: string; ready: boolean }) {
  const [scan, setScan] = useState<ScanReport | null>(null);
  const [filter, setFilter] = useState<string>('all');
  useEffect(() => {
    if (ready && !scan) api.scan(jobId).then(setScan).catch(() => undefined);
  }, [jobId, ready, scan]);
  const findings = useMemo(() => (scan?.findings ?? []).filter((f) => filter === 'all' || f.category === filter), [scan, filter]);
  if (!scan) return <Empty icon={<ScanSearch size={28} />} title="Pre-scan pending">The deterministic ingest scan runs first and never modifies source.</Empty>;
  const cves = scan.dependencies.flatMap((d) => d.cves);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Lines of code" value={scan.totalLoc} sub={`${scan.totalFiles} files`} />
        <Stat label="Findings" value={scan.findings.length} sub={`scan ${scan.durationMs} ms`} tone="amber" />
        <Stat label="CVEs" value={cves.length} sub={`${cves.filter((c) => c.severity === 'critical').length} critical`} tone="bad" />
        <Stat label="Secrets" value={scan.summary.secret ?? 0} sub="hardcoded credentials" tone="bad" />
        <Stat label="PII / PAN" value={(scan.summary.pii ?? 0) + (scan.summary.pan ?? 0)} sub="GDPR · PCI-DSS" tone="amber" />
      </div>
      <div>
        <SectionLabel>Dependency audit</SectionLabel>
        <Inset className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-fg-dim"><tr><th className="px-4 py-2">Dependency</th><th>Status</th><th>CVEs</th><th className="pr-4">Modern replacement</th></tr></thead>
            <tbody>
              {scan.dependencies.map((d) => (
                <tr key={d.coordinate} className="border-t border-line align-top">
                  <td className="px-4 py-2 font-mono text-xs">{d.coordinate}:{d.version}</td>
                  <td className="py-2"><Chip tone={d.status === 'ok' ? 'ok' : d.status === 'deprecated' ? 'default' : 'bad'}>{d.status.toUpperCase()}</Chip></td>
                  <td className="space-y-1 py-2">{d.cves.length ? d.cves.map((c) => <div key={c.id} className="flex items-center gap-2"><SeverityBadge severity={c.severity} /><span className="font-mono text-xs">{c.id}</span></div>) : <span className="text-fg-dim">—</span>}</td>
                  <td className="py-2 pr-4 text-xs text-fg-muted">{d.replacement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Inset>
      </div>
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="label mr-2">Findings (snippets redacted)</h3>
          {['all', ...Object.entries(scan.summary).filter(([, n]) => n > 0).map(([k]) => k)].map((c) => (
            <Chip key={c} onClick={() => setFilter(c)} active={filter === c} tone={filter === c ? 'amber' : 'default'}>{c}{c !== 'all' ? ` ${scan.summary[c]}` : ''}</Chip>
          ))}
        </div>
        <Inset className="scroll-thin max-h-[420px] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-ink-925 text-left text-xs text-fg-dim"><tr><th className="px-4 py-2">Sev</th><th>Finding</th><th>Location</th><th>Control / Recipe</th></tr></thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className="border-t border-line align-top">
                  <td className="px-4 py-2"><SeverityBadge severity={f.severity} /></td>
                  <td className="py-2 pr-3">
                    <div>{f.message}{f.cve && <span className="ml-2 font-mono text-xs text-bad">{f.cve}</span>}</div>
                    <code className="mt-1 block break-all font-mono text-[11.5px] text-fg-dim">{f.snippet}</code>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-fg-muted">{f.file.split('/').pop()}:{f.line}</td>
                  <td className="space-x-1 py-2 pr-4">{f.control && <Chip>{f.control}</Chip>}{f.recipe && <Chip tone="amber">{f.recipe}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Inset>
      </div>
    </div>
  );
}

function RessPanel({ jobId, ready }: { jobId: string; ready: boolean }) {
  const [spec, setSpec] = useState<SpecResponse | null>(null);
  useEffect(() => {
    if (ready && !spec) api.spec(jobId).then(setSpec).catch(() => undefined);
  }, [jobId, ready, spec]);
  if (!spec) return <Empty icon={<Sparkles size={28} />} title="RESS not generated yet">The Reverse-Engineered System Specification appears here before any code is generated.</Empty>;
  const r = spec.ress;
  return (
    <div className="space-y-8">
      <Inset className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-amber">RESS · {r.projectName}</span>
          <Chip tone={spec.generatedBy === 'live' ? 'ok' : 'default'}>{spec.generatedBy === 'live' ? `live · ${spec.modelId}` : 'golden run'}</Chip>
          {spec.latencyMs && <Chip>{secs(spec.latencyMs)}</Chip>}
          {spec.usage && <Chip>{spec.usage.inputTokens.toLocaleString()} in / {spec.usage.outputTokens.toLocaleString()} out tokens</Chip>}
        </div>
        <p className="mt-3 leading-relaxed text-fg-muted">{r.summary}</p>
      </Inset>

      <div>
        <SectionLabel>System topology</SectionLabel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {r.topology.components.map((c) => (
            <Inset key={c.name} className="px-4 py-3">
              <div className="flex items-center gap-2"><Boxes size={15} className="text-amber" /><span className="font-semibold">{c.name}</span></div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-dim">{c.kind}</div>
              <p className="mt-2 text-sm text-fg-muted">{c.responsibility}</p>
            </Inset>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {r.topology.boundaries.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <Chip>{b.from}</Chip><span className="text-fg-dim">→</span><Chip>{b.to}</Chip><Chip tone="amber">{b.protocol}</Chip><span className="text-fg-muted">{b.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Extracted business rules ({r.businessRules.length})</SectionLabel>
        <Inset className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-fg-dim"><tr><th className="px-4 py-2">ID</th><th>Rule</th><th>Source</th><th className="pr-4">Parity test</th></tr></thead>
            <tbody>
              {r.businessRules.map((b) => (
                <tr key={b.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 font-mono text-xs text-amber">{b.id}<div className="text-fg-dim">{b.category}</div></td>
                  <td className="py-2.5 pr-3"><div className="font-semibold">{b.title}</div><div className="text-fg-muted">{b.rule}</div></td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-fg-muted">{b.source.file.split('/').pop()}:{b.source.lines}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-teal">{b.parityTest}()</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Inset>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionLabel>State machines</SectionLabel>
          <div className="space-y-3">
            {r.stateMachines.map((m) => (
              <Inset key={m.name} className="px-4 py-3">
                <div className="font-semibold">{m.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{m.states.map((s) => <Chip key={s} tone="amber">{s}</Chip>)}</div>
                <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                  {m.transitions.map((t, i) => <li key={i}><span className="font-mono text-fg">{t.from} → {t.to}</span> · {t.trigger}</li>)}
                </ul>
              </Inset>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Timing model</SectionLabel>
          <Inset className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {r.timing.tickHz && <Chip tone="amber">{r.timing.tickHz} Hz</Chip>}
              {r.timing.tickMs && <Chip tone="amber">{r.timing.tickMs} ms tick</Chip>}
              <Chip>{r.timing.model}</Chip>
            </div>
            <p className="mt-2 text-sm text-fg-muted">{r.timing.notes}</p>
          </Inset>
          <SectionLabel className="mt-6">Concurrency issues</SectionLabel>
          <div className="space-y-2">
            {r.concurrencyIssues.map((c, i) => (
              <Inset key={i} className="px-4 py-3 text-sm">
                <div className="font-mono text-xs text-amber">{c.location}</div>
                <div className="mt-1 text-fg-muted">{c.issue}</div>
                <div className="mt-1 text-teal">→ {c.remediation}</div>
              </Inset>
            ))}
          </div>
        </div>
      </div>

      {r.protocols.map((p) => (
        <div key={p.name}>
          <SectionLabel>Protocol audit · {p.name}</SectionLabel>
          <div className="mb-2 text-sm text-fg-muted">{p.transport}</div>
          <Inset className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-fg-dim"><tr><th className="px-4 py-2">Code</th><th>Message</th><th>Legacy layout</th><th className="pr-4">Modern event-driven schema</th></tr></thead>
              <tbody>
                {p.messages.map((m) => (
                  <tr key={m.code + m.name} className="border-t border-line align-top">
                    <td className="px-4 py-2 font-mono text-xs text-amber">{m.code}</td>
                    <td className="py-2 pr-3"><div className="font-semibold">{m.name}</div><div className="text-xs text-fg-dim">{m.direction}</div></td>
                    <td className="py-2 pr-3 font-mono text-[11.5px] text-fg-muted">{m.legacyLayout}</td>
                    <td className="py-2 pr-4 font-mono text-[11.5px] text-teal">{m.modernEvent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Inset>
          {p.issues.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-warn">{p.issues.map((x) => <li key={x}>{x}</li>)}</ul>}
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionLabel>Vulnerability manifest</SectionLabel>
          <div className="space-y-2">
            {r.vulnerabilities.map((v) => (
              <Inset key={v.id + v.component} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={v.severity} /><span className="font-mono text-xs">{v.id}</span><span className="text-fg-dim">{v.component}</span></div>
                <div className="mt-1 text-fg-muted">{v.description}</div>
                <div className="mt-1 text-teal">→ {v.remediation}</div>
              </Inset>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Compliance findings</SectionLabel>
          <div className="space-y-2">
            {r.complianceFindings.map((c, i) => (
              <Inset key={i} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2"><Chip tone="amber">{c.control}</Chip><span className="font-mono text-xs text-fg-dim">{c.file.split('/').pop()}</span></div>
                <div className="mt-1 text-fg-muted">{c.finding}</div>
                <div className="mt-1 text-teal">→ {c.remediation}</div>
              </Inset>
            ))}
          </div>
          <SectionLabel className="mt-6">Modernization plan</SectionLabel>
          <div className="space-y-1.5">
            {r.modernizationPlan.map((m, i) => (
              <div key={i} className="flex gap-2 text-sm"><Chip tone="amber">{m.recipe}</Chip><span className="text-fg-muted">{m.description}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildPanel({ job }: { job: Job }) {
  const latest = job.build?.latest;
  if (!latest) return <Empty icon={<Hammer size={28} />} title="No sandbox build yet">The forward-engineered project is compiled and tested in an isolated CodeBuild sandbox with no internet route.</Empty>;
  const ok = latest.status === 'SUCCEEDED';
  const egress = latest.logTail.find((l) => l.includes('network egress'));
  const sandbox = latest.logTail.find((l) => l.startsWith('SANDBOX java'));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Build" value={latest.status} tone={ok ? 'ok' : 'bad'} sub={`attempt ${latest.attempt}/3`} />
        <Stat label="Wall time" value={latest.durationSeconds ? `${latest.durationSeconds.toFixed(0)}s` : '—'} sub={`compile+test ${latest.compileAndTestSeconds ?? '—'}s`} />
        <Stat label="Tests" value={latest.tests.total.run} sub={`${latest.tests.suites.length} suites`} tone="amber" />
        <Stat label="Failures" value={latest.tests.total.failures + latest.tests.total.errors} tone={latest.tests.total.failures + latest.tests.total.errors === 0 ? 'ok' : 'bad'} sub="parity regressions" />
        <Stat label="Warnings" value={latest.tests.warnings} tone={latest.tests.warnings === 0 ? 'ok' : 'bad'} sub="-Xlint:all -Werror" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Inset className="px-4 py-3 text-sm"><div className="label">Network isolation</div><div className={cx('mt-1 font-mono text-xs', egress?.includes('BLOCKED') ? 'text-teal' : 'text-warn')}>{egress ?? 'n/a'}</div></Inset>
        <Inset className="px-4 py-3 text-sm"><div className="label">Zero data retention</div><div className="mt-1 font-mono text-xs text-teal">{latest.zdrPurge ?? 'n/a'}</div></Inset>
        <Inset className="px-4 py-3 text-sm"><div className="label">Toolchain</div><div className="mt-1 font-mono text-xs text-fg-muted">{sandbox?.replace('SANDBOX ', '') ?? 'n/a'}</div></Inset>
      </div>
      <div>
        <SectionLabel>Parity test suites</SectionLabel>
        <Inset className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-fg-dim"><tr><th className="px-4 py-2">Suite</th><th>Tests</th><th>Failures</th><th className="pr-4">Time</th></tr></thead>
            <tbody>
              {latest.tests.suites.map((s) => (
                <tr key={s.name} className="border-t border-line">
                  <td className="px-4 py-2 font-mono text-xs"><FlaskConical size={13} className="mr-2 inline text-teal" />{s.name}</td>
                  <td className="py-2 font-mono">{s.run}</td>
                  <td className={cx('py-2 font-mono', s.failures + s.errors ? 'text-bad' : 'text-teal')}>{s.failures + s.errors}</td>
                  <td className="py-2 pr-4 font-mono text-fg-muted">{s.time.toFixed(2)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Inset>
      </div>
      {(job.build?.attempts?.length ?? 0) > 1 && (
        <div>
          <SectionLabel>Self-healing history</SectionLabel>
          <div className="flex flex-wrap gap-2">{job.build!.attempts.map((a) => <Chip key={a.attempt} tone={a.status === 'SUCCEEDED' ? 'ok' : 'bad'}>#{a.attempt} {a.status} {a.tests.compilerErrors.length ? `· ${a.tests.compilerErrors.length} errors` : ''}</Chip>)}</div>
        </div>
      )}
      <div>
        <SectionLabel>Build log (tail)</SectionLabel>
        <Inset className="scroll-thin max-h-80 overflow-auto bg-ink-950 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-fg-muted">
          {latest.logTail.map((l, i) => <div key={i} className={cx('whitespace-pre-wrap break-all', /ERROR|FAIL/.test(l) && 'text-bad', /BUILD SUCCESS|Tests run:.*Failures: 0, Errors: 0/.test(l) && 'text-teal')}>{l}</div>)}
        </Inset>
      </div>
    </div>
  );
}

export function Workbench() {
  const { job, jobId, jobError, tab, go } = useDemo();
  const tabs: { id: WorkbenchTab; label: string; icon: typeof ScanSearch }[] = [
    { id: 'scan', label: 'Pre-scan & CVE audit', icon: ScanSearch },
    { id: 'ress', label: 'Reverse-Engineered Spec', icon: FileCode2 },
    { id: 'build', label: 'Sandbox build', icon: Cpu },
  ];
  const reached = (s: JobStage) => !!job && (job.status === 'VERIFIED' || ORDER.indexOf(job.status) > ORDER.indexOf(s) || (job.status === 'FAILED' && !!job.stages[s]));
  return (
    <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="xl:sticky xl:top-24 xl:self-start"><Launcher /></div>
      <div className="min-w-0 space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow text-amber">Modernization pipeline</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{job ? `${job.sampleName}` : 'No active run'}</h1>
              {job && <div className="mt-1 font-mono text-xs text-fg-dim">{job.jobId} · {job.mode} · started {timeAgo(job.createdAt)}</div>}
            </div>
            {job?.status === 'VERIFIED' && <Button onClick={() => go('diff')}>Review diff &amp; approve →</Button>}
          </div>
          {jobError && <div className="mt-4"><ErrorNote>{jobError}</ErrorNote></div>}
          {job ? (
            <div className="mt-6 space-y-4"><Timeline job={job} /><EventLog job={job} /></div>
          ) : (
            !jobId && <p className="mt-4 text-fg-muted">Choose a legacy scenario and run the pipeline. Reverse engineering always completes before any code is generated.</p>
          )}
        </Card>
        {job && jobId && (
          <Card className="p-6">
            <div className="scroll-thin -mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => go('workbench', id)} className={cx('flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold', tab === id ? 'bg-ink-800 text-amber' : 'text-fg-muted hover:text-fg')}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            {tab === 'scan' && <ScanPanel key={jobId} jobId={jobId} ready={reached('SCANNING')} />}
            {tab === 'ress' && <RessPanel key={jobId} jobId={jobId} ready={reached('REVERSE_ENGINEERING')} />}
            {tab === 'build' && <BuildPanel job={job} />}
          </Card>
        )}
      </div>
    </div>
  );
}
