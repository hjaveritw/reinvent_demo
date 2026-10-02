import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { BadgeCheck, Check, Download, FileDiff as FileDiffIcon, FilePlus2, KeyRound, ShieldCheck, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { download } from '../lib/format';
import { languageFor, monaco } from '../lib/monaco';
import type { ApproveResponse, FileDiff, Recipe, VerifyResponse } from '../lib/types';
import { useDemo } from '../state/DemoContext';
import { Button, Card, Chip, Empty, ErrorNote, Inset, SectionLabel, cx } from '../components/ui';

type DiffEditorInstance = monaco.editor.IStandaloneDiffEditor;

function AttestationPanel({ jobId, result }: { jobId: string; result: ApproveResponse }) {
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const env = result.attestation!;
  const statement = useMemo(() => JSON.parse(atob(env.payload)), [env.payload]);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setVerify(await api.verify(jobId));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-teal" />
          <div>
            <div className="eyebrow text-teal">SLSA provenance · in-toto · KMS signed</div>
            <div className="text-lg font-bold">Approved modernization attested</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.patch && <Button variant="ghost" onClick={() => download(`${jobId}.patch`, result.patch!, 'text/x-diff')}><Download size={16} /> Patch</Button>}
          <Button variant="ghost" onClick={() => download(`${jobId}.intoto.json`, JSON.stringify(env, null, 2), 'application/json')}><Download size={16} /> Attestation</Button>
          <Button onClick={run} disabled={busy}><KeyRound size={16} /> {busy ? 'Verifying…' : 'Verify signature'}</Button>
        </div>
      </div>
      {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      {verify && (
        <Inset className={cx('mt-4 px-4 py-3', verify.valid ? 'border-teal/40' : 'border-bad/40')}>
          <div className={cx('flex items-center gap-2 font-semibold', verify.valid ? 'text-teal' : 'text-bad')}>
            <BadgeCheck size={18} /> {verify.valid ? 'Signature VALID' : 'Signature INVALID'} · {verify.algorithm}
          </div>
          <div className="mt-1 break-all font-mono text-[11px] text-fg-dim">{verify.keyId}</div>
          <pre className="mt-2 overflow-x-auto font-mono text-[10.5px] text-fg-muted">{verify.publicKeyPem}</pre>
        </Inset>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionLabel>Subjects</SectionLabel>
          {statement.subject.map((s: { name: string; digest: { sha256: string } }) => (
            <div key={s.name} className="mb-1.5 text-sm"><span className="font-mono">{s.name}</span><div className="break-all font-mono text-[11px] text-fg-dim">sha256:{s.digest.sha256}</div></div>
          ))}
        </div>
        <div>
          <SectionLabel>DSSE signature</SectionLabel>
          <div className="break-all font-mono text-[11px] text-fg-muted">{env.signatures[0].sig}</div>
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-fg-muted">In-toto statement</summary>
        <pre className="scroll-thin mt-2 max-h-72 overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-[11px] text-fg-muted">{JSON.stringify(statement, null, 2)}</pre>
      </details>
    </Card>
  );
}

export function DiffReview() {
  const { jobId, job, go } = useDemo();
  const [diffs, setDiffs] = useState<FileDiff[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState(0);
  const [activeRecipe, setActiveRecipe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState<ApproveResponse | null>(null);
  const editorRef = useRef<DiffEditorInstance | null>(null);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const verified = job?.status === 'VERIFIED';
  useEffect(() => {
    if (!jobId || !verified) return;
    api.diffs(jobId).then((d) => {
      setDiffs(d);
      const idx = d.findIndex((f) => f.legacyPath && f.recipes.length > 1);
      setSelected(idx >= 0 ? idx : 0);
    }).catch((e) => setErr(e.message));
    api.recipes().then(setRecipes).catch(() => undefined);
  }, [jobId, verified]);

  const file = diffs?.[selected];
  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const reveal = useCallback((line?: number, recipeId?: string) => {
    setActiveRecipe(recipeId ?? null);
    const ed = editorRef.current?.getModifiedEditor();
    if (!ed || !line) return;
    ed.revealLineInCenter(line);
    decorations.current?.clear();
    decorations.current = ed.createDecorationsCollection([
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'ats-recipe-line', glyphMarginClassName: 'ats-recipe-glyph' } },
    ]);
  }, []);

  useEffect(() => {
    setActiveRecipe(null);
    decorations.current?.clear();
  }, [selected]);

  const approve = async (body: { paths?: string[]; approveAll?: boolean }) => {
    if (!jobId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.approve(jobId, body);
      setDiffs((d) => d?.map((f) => (body.approveAll || body.paths?.includes(f.modernPath) ? { ...f, approved: true } : f)) ?? null);
      if (res.attestation) setApproval(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!jobId || !job) return <Card><Empty icon={<FileDiffIcon size={28} />} title="No modernization run selected">Run the pipeline in the Workbench first.<div className="mt-4"><Button onClick={() => go('workbench')}>Open Workbench</Button></div></Empty></Card>;
  if (!verified) return <Card><Empty icon={<FileDiffIcon size={28} />} title={job.status === 'FAILED' ? 'Run failed — no verified code to review' : 'Waiting for sandbox verification'}>Diffs open for review once the forward-engineered code compiles cleanly and passes parity tests ({job.status}).</Empty></Card>;
  if (!diffs) return <Card><Empty title="Loading diffs…" /></Card>;

  const pending = diffs.filter((d) => !d.approved).length;
  const totals = diffs.reduce((a, d) => ({ add: a.add + d.added, rem: a.rem + d.removed }), { add: 0, rem: 0 });

  return (
    <div className="space-y-6">
      <style>{`.ats-recipe-line{background:rgba(245,197,24,.14)}.ats-recipe-glyph{background:#f5c518;width:4px!important;margin-left:4px}`}</style>
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow text-amber">FR-04 · Interactive split-diff review</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{job.sampleName} → modernized</h1>
            <div className="mt-1 font-mono text-xs text-fg-muted">{diffs.length} files · <span className="text-teal">+{totals.add}</span> <span className="text-bad">−{totals.rem}</span> · build attempt {job.finalAttempt ?? 1} · {pending} pending approval</div>
          </div>
          <Button onClick={() => approve({ approveAll: true })} disabled={busy || pending === 0}>
            <Check size={18} /> {pending === 0 ? 'All approved' : busy ? 'Signing…' : `Approve all & sign (${pending})`}
          </Button>
        </div>
        {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      </Card>

      {approval && <AttestationPanel jobId={jobId} result={approval} />}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="scroll-thin max-h-[78vh] overflow-y-auto p-3">
          {diffs.map((d, i) => (
            <button key={d.modernPath} type="button" onClick={() => setSelected(i)} className={cx('mb-1 w-full rounded-xl px-3 py-2.5 text-left transition', i === selected ? 'bg-ink-800 ring-1 ring-amber/50' : 'hover:bg-ink-850')}>
              <div className="flex items-center gap-2">
                {d.legacyPath ? <FileDiffIcon size={14} className="shrink-0 text-amber" /> : <FilePlus2 size={14} className="shrink-0 text-teal" />}
                <span className="truncate font-mono text-[12px]">{d.modernPath.replace(/^src\/(main|test)\/java\//, '')}</span>
                {d.approved && <Check size={14} className="ml-auto shrink-0 text-teal" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 pl-[22px]">
                <span className="font-mono text-[11px] text-teal">+{d.added}</span>
                <span className="font-mono text-[11px] text-bad">−{d.removed}</span>
                {d.recipes.slice(0, 3).map((r) => <span key={r.recipeId} className="font-mono text-[10px] text-amber/80">{r.recipeId}</span>)}
              </div>
            </button>
          ))}
        </Card>

        {file && (
          <div className="min-w-0 space-y-4">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <div className="min-w-0 font-mono text-xs">
                  <span className="text-bad">{file.legacyPath ?? '/dev/null (new file)'}</span>
                  <span className="mx-2 text-fg-dim">→</span>
                  <span className="text-teal">{file.modernPath}</span>
                </div>
                <Button variant={file.approved ? 'ghost' : 'outline'} className="px-3 py-1.5 text-sm" disabled={file.approved || busy} onClick={() => approve({ paths: [file.modernPath] })}>
                  <Check size={15} /> {file.approved ? 'Approved' : 'Approve file'}
                </Button>
              </div>
              <div className="h-[62vh] min-h-[420px]">
                <DiffEditor
                  key={file.modernPath}
                  original={file.legacyContent}
                  modified={file.modernContent}
                  originalLanguage={languageFor(file.legacyPath ?? file.modernPath)}
                  modifiedLanguage={languageFor(file.modernPath)}
                  theme="ats-dark"
                  onMount={(ed) => { editorRef.current = ed; }}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    useInlineViewWhenSpaceIsLimited: true,
                    minimap: { enabled: false },
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12.5,
                    scrollBeyondLastLine: false,
                    glyphMargin: true,
                    renderOverviewRuler: false,
                    ignoreTrimWhitespace: false,
                  }}
                />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Wand2 size={18} className="mt-0.5 shrink-0 text-amber" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{file.summary}</div>
                  <div className="mt-3 space-y-2">
                    {file.recipes.length === 0 && <div className="text-sm text-fg-dim">No recipe annotations for this file.</div>}
                    {file.recipes.map((r, i) => {
                      const rec = recipeMap.get(r.recipeId);
                      return (
                        <button key={i} type="button" onClick={() => reveal(r.line, r.recipeId)} className={cx('w-full rounded-xl border px-4 py-3 text-left transition', activeRecipe === r.recipeId ? 'border-amber bg-amber-deep/40' : 'border-line hover:border-line-strong')}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone="amber">{r.recipeId}</Chip>
                            {rec && <span className="font-semibold">{rec.title}</span>}
                            {rec && <Chip tone={rec.kind === 'deterministic' ? 'default' : 'ok'}>{rec.kind}</Chip>}
                            {rec?.control && <Chip>{rec.control}</Chip>}
                            {r.line && <span className="ml-auto font-mono text-[11px] text-fg-dim">line {r.line} →</span>}
                          </div>
                          <div className="mt-1.5 text-sm text-fg-muted">{r.note}</div>
                          {rec && activeRecipe === r.recipeId && <div className="mt-1.5 text-xs text-fg-dim">{rec.description}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
