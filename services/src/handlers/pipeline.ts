import { BatchGetBuildsCommand, CodeBuildClient, ListBuildsForProjectCommand, type Build } from '@aws-sdk/client-codebuild';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { BatchWriteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GOLDEN, SAMPLES } from '../generated/bundle';
import { attemptPrefix, ddb, env, getJson, jobPrefix, keys, projectOfJob, putJson, ttl24h } from '../lib/aws';
import { callTool } from '../lib/bedrock';
import { sanitizeProject, storeAttempt, writeDiffs } from '../lib/codegen';
import { logEvent, setStage } from '../lib/job';
import { FIX_SYSTEM, FORWARD_SYSTEM, REVERSE_SYSTEM, fixUser, forwardUser, reverseUser } from '../lib/prompts';
import { scan as runScan } from '../lib/scanner';
import { CODEGEN_SCHEMA, FIX_SCHEMA, RESS_SCHEMA } from '../lib/schemas';
import type { FileAnnotation, JobMode, Ress, ScanReport, SourceFile } from '../lib/types';

export interface PipelineState {
  jobId: string;
  sampleId: string;
  mode: JobMode;
  attempt?: number;
  sourceLocation?: string;
  sourceSha256?: string;
  build?: unknown;
  buildError?: { Error?: string; Cause?: string };
  buildResult?: { succeeded: boolean; buildId?: string };
}

const MAX_ATTEMPTS = 3;
const codebuild = new CodeBuildClient({});
const logs = new CloudWatchLogsClient({});

const sampleOf = (id: string) => {
  const s = SAMPLES[id];
  if (!s) throw new Error(`unknown sample ${id}`);
  return s;
};

/** Stage 1a — deterministic pre-scan (always live, < 1s). */
export async function scan(state: PipelineState): Promise<PipelineState> {
  const sample = sampleOf(state.sampleId);
  await setStage(state.jobId, 'SCANNING', `Ingesting ${sample.files.length} legacy files (${sample.language}) — read-only, no source mutation`);
  const report = runScan(sample.files);
  await putJson(env('ARTIFACT_BUCKET'), `${jobPrefix(state.jobId)}/scan.json`, report);
  const cves = new Set(report.findings.filter((f) => f.cve).map((f) => f.cve)).size;
  await setStage(state.jobId, 'SCANNING', `Pre-scan complete: ${report.totalLoc} LOC, ${report.findings.length} findings, ${cves} CVEs, ${report.summary.secret} hardcoded secrets`, {
    scanSummary: { totalLoc: report.totalLoc, totalFiles: report.totalFiles, findings: report.findings.length, cves, summary: report.summary, durationMs: report.durationMs },
  }, 'success');
  return state;
}

/** Stage 1b — RESS generation with Bedrock (live) or pre-verified RESS (golden). */
export async function reverseEngineer(state: PipelineState): Promise<PipelineState> {
  const sample = sampleOf(state.sampleId);
  const started = Date.now();
  await setStage(state.jobId, 'REVERSE_ENGINEERING', state.mode === 'live'
    ? 'Spec Recovery agent analysing ASTs, state machines, protocols and business rules (Amazon Bedrock)'
    : 'Loading pre-verified RESS from golden run cache');
  let ress: Ress;
  let meta: Record<string, unknown> = {};
  if (state.mode === 'live') {
    const report = await getJson<ScanReport>(env('ARTIFACT_BUCKET'), `${jobPrefix(state.jobId)}/scan.json`);
    const res = await callTool<Ress>({
      system: REVERSE_SYSTEM,
      user: reverseUser(sample, report),
      toolName: 'submit_ress',
      toolDescription: 'Submit the Reverse-Engineered System Specification.',
      schema: RESS_SCHEMA,
      maxTokens: 16000,
    });
    ress = res.output;
    meta = { modelId: res.modelId, usage: res.usage, latencyMs: res.latencyMs };
  } else {
    ress = GOLDEN[state.sampleId].ress;
  }
  const specId = state.jobId;
  const table = env('TABLE_NAME');
  await ddb.send(new PutCommand({ TableName: table, Item: { ...keys.spec(state.sampleId, specId), specId, jobId: state.jobId, ress, generatedBy: state.mode, ...meta, createdAt: new Date().toISOString(), ttl: ttl24h() } }));
  const rules = ress.businessRules.map((r) => ({ PutRequest: { Item: { ...keys.rule(specId, r.id), ...r, ttl: ttl24h() } } }));
  for (let i = 0; i < rules.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: rules.slice(i, i + 25) } }));
  }
  await setStage(state.jobId, 'REVERSE_ENGINEERING', `RESS generated in ${((Date.now() - started) / 1000).toFixed(1)}s: ${ress.topology.components.length} components, ${ress.businessRules.length} business rules, ${ress.protocols.reduce((n, p) => n + p.messages.length, 0)} protocol messages, ${ress.vulnerabilities.length} vulnerabilities`, {
    specId, ressSummary: { components: ress.topology.components.length, rules: ress.businessRules.length, vulnerabilities: ress.vulnerabilities.length, durationMs: Date.now() - started, ...meta },
  }, 'success');
  return state;
}

/** Stage 2 — forward engineering strictly from the RESS. */
export async function forwardEngineer(state: PipelineState): Promise<PipelineState> {
  const sample = sampleOf(state.sampleId);
  const started = Date.now();
  await setStage(state.jobId, 'FORWARD_ENGINEERING', state.mode === 'live'
    ? 'Applying deterministic recipes + generative refactoring from RESS (AWS Transform-style, Amazon Bedrock)'
    : 'Loading pre-verified modernized code from golden run cache');
  let files: SourceFile[];
  let annotations: FileAnnotation[];
  let meta: Record<string, unknown> = {};
  if (state.mode === 'live') {
    const spec = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.spec(state.sampleId, state.jobId) }));
    const ress = spec.Item!.ress as Ress;
    const res = await callTool<{ files: SourceFile[]; annotations: FileAnnotation[] }>({
      system: FORWARD_SYSTEM,
      user: forwardUser(sample, ress),
      toolName: 'submit_modernized_code',
      toolDescription: 'Submit the complete modernized project files and per-file recipe annotations.',
      schema: CODEGEN_SCHEMA,
      maxTokens: 48000,
    });
    files = res.output.files;
    annotations = res.output.annotations ?? [];
    meta = { modelId: res.modelId, usage: res.usage, latencyMs: res.latencyMs };
  } else {
    files = GOLDEN[state.sampleId].files;
    annotations = GOLDEN[state.sampleId].annotations;
  }
  const project = sanitizeProject(sample, files);
  const stored = await storeAttempt(state.jobId, 1, project);
  const diffCount = await writeDiffs(state.jobId, sample, project, annotations);
  const tests = project.filter((f) => f.path.startsWith('src/test/java')).length;
  await setStage(state.jobId, 'FORWARD_ENGINEERING', `Synthesized ${project.length} files (${tests} test classes) in ${((Date.now() - started) / 1000).toFixed(1)}s; ${diffCount} annotated diffs ready`, {
    forwardSummary: { files: project.length, testFiles: tests, durationMs: Date.now() - started, ...meta },
  }, 'success');
  return { ...state, attempt: 1, sourceLocation: stored.sourceLocation, sourceSha256: stored.sourceSha256 };
}

/** Marks the job as building before the CodeBuild .sync task starts. */
export async function beforeBuild(state: PipelineState): Promise<PipelineState> {
  await setStage(state.jobId, 'BUILDING', `Attempt ${state.attempt}/${MAX_ATTEMPTS}: offline Maven verify (-Werror) in VPC-isolated CodeBuild sandbox`);
  return state;
}

async function findBuild(state: PipelineState): Promise<Build | undefined> {
  const fromOutput = (state.build as { Build?: { Id?: string } } | undefined)?.Build;
  let id = fromOutput?.Id;
  if (!id && state.buildError?.Cause) {
    try {
      const cause = JSON.parse(state.buildError.Cause);
      id = cause?.Build?.Id ?? cause?.Id;
    } catch { /* not JSON */ }
  }
  if (!id) {
    const list = await codebuild.send(new ListBuildsForProjectCommand({ projectName: env('BUILD_PROJECT'), sortOrder: 'DESCENDING' }));
    const recent = await codebuild.send(new BatchGetBuildsCommand({ ids: (list.ids ?? []).slice(0, 20) }));
    return recent.builds?.find((b) => b.environment?.environmentVariables?.some((v) => v.name === 'JOB_ID' && v.value === state.jobId)
      && b.environment?.environmentVariables?.some((v) => v.name === 'ATTEMPT' && v.value === String(state.attempt)));
  }
  const res = await codebuild.send(new BatchGetBuildsCommand({ ids: [id] }));
  return res.builds?.[0];
}

async function readLog(build: Build | undefined): Promise<string[]> {
  const group = build?.logs?.groupName;
  const stream = build?.logs?.streamName;
  if (!group || !stream) return [];
  const lines: string[] = [];
  let token: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res = await logs.send(new GetLogEventsCommand({ logGroupName: group, logStreamName: stream, startFromHead: true, nextToken: token }));
    for (const e of res.events ?? []) if (e.message) lines.push(e.message.replace(/\n$/, ''));
    if (!res.nextForwardToken || res.nextForwardToken === token) break;
    token = res.nextForwardToken;
  }
  return lines;
}

export function parseTests(lines: string[]) {
  const suites: { name: string; run: number; failures: number; errors: number; skipped: number; time: number }[] = [];
  const re = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)(?:, Time elapsed: ([\d.]+) s)?.*? (?:--|-) in ([\w.$]+)/;
  for (const l of lines) {
    const m = l.match(re);
    if (m) suites.push({ name: m[6], run: +m[1], failures: +m[2], errors: +m[3], skipped: +m[4], time: +(m[5] ?? 0) });
  }
  const total = suites.reduce((a, s) => ({ run: a.run + s.run, failures: a.failures + s.failures, errors: a.errors + s.errors, skipped: a.skipped + s.skipped }), { run: 0, failures: 0, errors: 0, skipped: 0 });
  const compilerErrors = lines.filter((l) => /\[ERROR\].*\.java/.test(l)).slice(0, 50);
  const warnings = lines.filter((l) => /\[WARNING\].*\.java/.test(l)).length;
  return { suites, total, compilerErrors, warnings };
}

/** Records the outcome of one CodeBuild attempt as BUILD_VERIFICATION. */
export async function recordBuild(state: PipelineState): Promise<PipelineState> {
  const build = await findBuild(state);
  const lines = await readLog(build);
  const tests = parseTests(lines);
  const succeeded = build?.buildStatus === 'SUCCEEDED' && !state.buildError;
  const phases = (build?.phases ?? []).map((p) => ({ type: p.phaseType, status: p.phaseStatus, seconds: p.durationInSeconds }));
  const durationSeconds = build?.startTime && build?.endTime ? (build.endTime.getTime() - build.startTime.getTime()) / 1000 : undefined;
  const buildPhase = phases.find((p) => p.type === 'BUILD')?.seconds;
  const zdr = lines.find((l) => l.includes('ZDR-PURGE'));
  const attemptRecord = {
    attempt: state.attempt,
    buildId: build?.id,
    status: build?.buildStatus ?? 'UNKNOWN',
    durationSeconds,
    compileAndTestSeconds: buildPhase,
    phases,
    tests,
    zdrPurge: zdr ?? null,
    logTail: lines.slice(-120),
    sourceSha256: state.sourceSha256,
    at: new Date().toISOString(),
  };
  await putJson(env('ARTIFACT_BUCKET'), `${attemptPrefix(state.jobId, state.attempt ?? 1)}/build.json`, { ...attemptRecord, log: lines });
  await ddb.send(new UpdateCommand({
    TableName: env('TABLE_NAME'),
    Key: keys.build(state.jobId),
    UpdateExpression: 'SET #a = list_append(if_not_exists(#a, :empty), :rec), #l = :rec0, jobId = :j, #ttl = :ttl',
    ExpressionAttributeNames: { '#a': 'attempts', '#l': 'latest', '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':rec': [{ ...attemptRecord, logTail: attemptRecord.logTail.slice(-40) }], ':rec0': attemptRecord, ':empty': [], ':j': state.jobId, ':ttl': ttl24h() },
  }));
  const msg = succeeded
    ? `BUILD SUCCEEDED in ${durationSeconds?.toFixed(0)}s (compile+test ${buildPhase ?? '?'}s): ${tests.total.run} tests, ${tests.total.failures + tests.total.errors} failures, 0 warnings (-Werror)`
    : `Build attempt ${state.attempt} FAILED: ${tests.compilerErrors.length} compiler errors, ${tests.total.failures + tests.total.errors} test failures`;
  await logEvent(state.jobId, 'BUILDING', msg, succeeded ? 'success' : 'warn');
  return { ...state, build: undefined, buildError: undefined, buildResult: { succeeded, buildId: build?.id } };
}

/** RSK-02 — autonomous repair loop: feed the failing log back to the model and rebuild (max 3 attempts). */
export async function selfHeal(state: PipelineState): Promise<PipelineState> {
  const sample = sampleOf(state.sampleId);
  const bucket = env('ARTIFACT_BUCKET');
  const attempt = state.attempt ?? 1;
  await setStage(state.jobId, 'SELF_HEALING', `Self-healing cycle ${attempt}: diagnosing compiler/test failures`);
  const files = await getJson<SourceFile[]>(bucket, `${attemptPrefix(state.jobId, attempt)}/files.json`);
  const build = await getJson<{ log: string[] }>(bucket, `${attemptPrefix(state.jobId, attempt)}/build.json`);
  const relevant = build.log.filter((l) => /ERROR|FAIL|Exception|expected|warning:|error:/i.test(l)).slice(-150).join('\n');
  const spec = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.spec(state.sampleId, state.jobId) }));
  const res = await callTool<{ diagnosis: string; files: SourceFile[]; deletePaths?: string[] }>({
    system: FIX_SYSTEM,
    user: fixUser(files, relevant || build.log.slice(-150).join('\n'), spec.Item!.ress as Ress),
    toolName: 'submit_fixes',
    toolDescription: 'Submit full replacement contents of changed files.',
    schema: FIX_SCHEMA,
    maxTokens: 32000,
  });
  const merged = new Map(files.map((f) => [f.path, f]));
  for (const p of res.output.deletePaths ?? []) if (p !== 'pom.xml') merged.delete(p);
  for (const f of res.output.files) merged.set(f.path, f);
  const project = sanitizeProject(sample, [...merged.values()]);
  const stored = await storeAttempt(state.jobId, attempt + 1, project);
  await logEvent(state.jobId, 'SELF_HEALING', `Repair applied to ${res.output.files.length} file(s): ${res.output.diagnosis.slice(0, 300)}`, 'info');
  return { ...state, attempt: attempt + 1, sourceLocation: stored.sourceLocation, sourceSha256: stored.sourceSha256, buildResult: undefined };
}

/** Terminal step: mark job VERIFIED or FAILED. */
export async function finalize(state: PipelineState & { failed?: boolean; error?: { Error?: string; Cause?: string } }): Promise<PipelineState> {
  const ok = state.buildResult?.succeeded === true && !state.failed;
  const job = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.job(projectOfJob(state.jobId), state.jobId) }));
  const createdAt = job.Item?.createdAt ? Date.parse(job.Item.createdAt) : Date.now();
  const totalSeconds = Math.round((Date.now() - createdAt) / 1000);
  const reason = state.error?.Cause ? String(state.error.Cause).slice(0, 400) : `exhausted ${MAX_ATTEMPTS} build attempts`;
  await setStage(state.jobId, ok ? 'VERIFIED' : 'FAILED',
    ok ? `Modernization verified end-to-end in ${totalSeconds}s — ready for diff review and approval` : `Pipeline failed: ${reason}`,
    { totalSeconds, finalAttempt: state.attempt, finalSourceSha256: state.sourceSha256, finalSourceLocation: state.sourceLocation },
    ok ? 'success' : 'error');
  return state;
}
