import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { GetPublicKeyCommand, KMSClient, SignCommand, VerifyCommand } from '@aws-sdk/client-kms';
import { createTwoFilesPatch } from 'diff';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { SAMPLES } from '../generated/bundle';
import { attemptPrefix, ddb, env, getJson, jobPrefix, keys, projectOfJob, putJson, ttl24h } from '../lib/aws';
import { RECIPES } from '../lib/recipes';
import type { ScanReport, SourceFile } from '../lib/types';
import { sha256Hex } from '../lib/zip';

const sfn = new SFNClient({});
const kms = new KMSClient({});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

const json = (status: number, body: unknown): APIGatewayProxyResult => ({ statusCode: status, headers: SECURITY_HEADERS, body: JSON.stringify(body) });

function parseBody<T>(event: APIGatewayProxyEvent, schema: z.ZodType<T>): T {
  if ((event.body?.length ?? 0) > 16_384) throw new HttpError(413, 'payload too large');
  let raw: unknown = {};
  try {
    raw = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {};
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
  const res = schema.safeParse(raw);
  if (!res.success) throw new HttpError(400, res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return res.data;
}

const user = (event: APIGatewayProxyEvent) => {
  const claims = (event.requestContext.authorizer?.claims ?? {}) as Record<string, string>;
  if (!claims.sub) throw new HttpError(401, 'unauthenticated');
  return { sub: claims.sub, username: claims['cognito:username'] ?? claims.username ?? claims.sub };
};

const jobIdParam = (id: string | undefined) => {
  if (!id) throw new HttpError(400, 'missing job id');
  try {
    projectOfJob(id);
  } catch {
    throw new HttpError(400, 'invalid job id');
  }
  return id;
};

async function getJob(jobId: string) {
  const res = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.job(projectOfJob(jobId), jobId) }));
  if (!res.Item) throw new HttpError(404, 'job not found');
  return res.Item;
}

// ---------- routes ----------

function listSamples() {
  return Object.values(SAMPLES).map(({ files, ...meta }) => ({ ...meta, fileCount: files.length, loc: files.reduce((n, f) => n + f.content.split('\n').length, 0) }));
}

function getSample(id: string) {
  const s = SAMPLES[id];
  if (!s) throw new HttpError(404, 'sample not found');
  return s;
}

const StartJob = z.object({ sampleId: z.string().regex(/^[a-z0-9-]{1,40}$/), mode: z.enum(['live', 'golden']) });

async function startJob(event: APIGatewayProxyEvent) {
  const { sub, username } = user(event);
  const body = parseBody(event, StartJob);
  const sample = getSample(body.sampleId);
  const jobId = `${sample.id}--${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();
  const table = env('TABLE_NAME');
  await ddb.send(new PutCommand({ TableName: table, Item: { ...keys.workspace('default'), name: 'Modernization Workspace', updatedAt: now } }));
  await ddb.send(new PutCommand({ TableName: table, Item: { ...keys.project('default', sample.id), projectId: sample.id, name: sample.name, language: sample.language, updatedAt: now } }));
  await ddb.send(new PutCommand({
    TableName: table,
    Item: {
      ...keys.job(sample.id, jobId),
      GSI1PK: 'STATUS#QUEUED',
      GSI1SK: now,
      jobId,
      projectId: sample.id,
      sampleName: sample.name,
      mode: body.mode,
      status: 'QUEUED',
      startedBy: sub,
      startedByName: username,
      createdAt: now,
      updatedAt: now,
      stages: { QUEUED: now },
      events: [{ at: now, stage: 'QUEUED', message: `Job queued (${body.mode === 'live' ? 'live Bedrock run' : 'golden run'}) for ${sample.name}`, level: 'info' }],
      ttl: ttl24h(),
    },
  }));
  await sfn.send(new StartExecutionCommand({
    stateMachineArn: env('STATE_MACHINE_ARN'),
    name: jobId,
    input: JSON.stringify({ jobId, sampleId: sample.id, mode: body.mode }),
  }));
  return { jobId };
}

async function listJobs() {
  const results = await Promise.all(Object.keys(SAMPLES).map((pid) => ddb.send(new QueryCommand({
    TableName: env('TABLE_NAME'),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `PROJ#${pid}`, ':sk': 'JOB#' },
    ProjectionExpression: 'jobId, projectId, sampleName, #m, #s, createdAt, updatedAt, totalSeconds',
    ExpressionAttributeNames: { '#m': 'mode', '#s': 'status' },
    ScanIndexForward: false,
    Limit: 10,
  }))));
  return results.flatMap((r) => r.Items ?? []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 15);
}

async function jobDetail(jobId: string) {
  const job = await getJob(jobId);
  const build = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.build(jobId) }));
  const { PK: _pk, SK: _sk, GSI1PK: _g, GSI1SK: _gs, ...rest } = job;
  return { ...rest, build: build.Item ? { attempts: build.Item.attempts, latest: build.Item.latest } : null };
}

async function jobScan(jobId: string) {
  await getJob(jobId);
  try {
    return await getJson<ScanReport>(env('ARTIFACT_BUCKET'), `${jobPrefix(jobId)}/scan.json`);
  } catch {
    throw new HttpError(404, 'scan not available yet');
  }
}

async function jobSpec(jobId: string) {
  const job = await getJob(jobId);
  const res = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.spec(job.projectId, jobId) }));
  if (!res.Item) throw new HttpError(404, 'spec not available yet');
  return { specId: res.Item.specId, ress: res.Item.ress, generatedBy: res.Item.generatedBy, modelId: res.Item.modelId, usage: res.Item.usage, latencyMs: res.Item.latencyMs };
}

async function loadFinalFiles(job: Record<string, unknown>) {
  const attempt = (job.finalAttempt as number | undefined) ?? 1;
  return getJson<SourceFile[]>(env('ARTIFACT_BUCKET'), `${attemptPrefix(String(job.jobId), attempt)}/files.json`).catch(() => {
    throw new HttpError(404, 'code not available yet');
  });
}

async function diffItems(jobId: string) {
  const res = await ddb.send(new QueryCommand({
    TableName: env('TABLE_NAME'),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `JOB#${jobId}`, ':sk': 'DIFF#' },
  }));
  return res.Items ?? [];
}

async function jobDiffs(jobId: string) {
  const job = await getJob(jobId);
  const sample = getSample(job.projectId);
  const files = await loadFinalFiles(job);
  const items = new Map((await diffItems(jobId)).map((i) => [i.modernPath as string, i]));
  const legacy = new Map(sample.files.map((f) => [f.path, f.content]));
  return files.map((f) => {
    const meta = items.get(f.path);
    const legacyPath = (meta?.legacyPath as string | null | undefined) ?? null;
    return {
      modernPath: f.path,
      legacyPath,
      legacyContent: legacyPath ? legacy.get(legacyPath) ?? '' : '',
      modernContent: f.content,
      summary: meta?.summary ?? 'Updated by self-healing build loop',
      recipes: meta?.recipes ?? [],
      added: meta?.added ?? 0,
      removed: meta?.removed ?? 0,
      approved: meta?.approved ?? false,
    };
  });
}

const Approve = z.object({ paths: z.array(z.string().max(300)).max(200).optional(), approveAll: z.boolean().optional() });

/** DSSE pre-authentication encoding (in-toto attestation envelope). */
const pae = (type: string, body: Buffer) => Buffer.concat([Buffer.from(`DSSEv1 ${Buffer.byteLength(type)} ${type} ${body.length} `), body]);

async function approve(event: APIGatewayProxyEvent, jobId: string) {
  const { sub, username } = user(event);
  const body = parseBody(event, Approve);
  const job = await getJob(jobId);
  if (job.status !== 'VERIFIED') throw new HttpError(409, 'job must be VERIFIED before approval');
  const items = await diffItems(jobId);
  const targets = body.approveAll ? items.map((i) => i.modernPath as string) : body.paths ?? [];
  const now = new Date().toISOString();
  for (const path of targets) {
    if (!items.some((i) => i.modernPath === path)) continue;
    await ddb.send(new UpdateCommand({
      TableName: env('TABLE_NAME'),
      Key: keys.diff(jobId, path),
      UpdateExpression: 'SET approved = :t, approvedBy = :u, approvedAt = :n',
      ExpressionAttributeValues: { ':t': true, ':u': username, ':n': now },
    }));
  }
  const refreshed = await diffItems(jobId);
  const pending = refreshed.filter((i) => !i.approved).length;
  if (pending > 0) return { approved: targets.length, pending, attestation: null };

  // All files approved → generate patch + SLSA provenance signed with KMS (COMP-SLSA-01).
  const sample = getSample(job.projectId);
  const files = await loadFinalFiles(job);
  const legacy = new Map(sample.files.map((f) => [f.path, f.content]));
  const meta = new Map(refreshed.map((i) => [i.modernPath as string, i]));
  const patch = files.map((f) => {
    const lp = (meta.get(f.path)?.legacyPath as string | null) ?? null;
    return createTwoFilesPatch(lp ? `a/${lp}` : '/dev/null', `b/${f.path}`, lp ? legacy.get(lp) ?? '' : '', f.content, sample.name, `${sample.artifactId} (modernized)`);
  }).join('\n');
  const build = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.build(jobId) }));
  const statement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      { name: 'source.zip', digest: { sha256: job.finalSourceSha256 } },
      { name: `${sample.artifactId}.patch`, digest: { sha256: sha256Hex(patch) } },
    ],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://aws-transform-studio/modernization/v1',
        externalParameters: { sampleId: sample.id, mode: job.mode, jobId },
        internalParameters: { buildImage: 'ats-sandbox (hermetic, offline Maven)', network: 'VPC isolated subnets, no egress' },
        resolvedDependencies: [{ uri: `legacy:${sample.id}`, digest: { sha256: sha256Hex(JSON.stringify(sample.files)) } }],
      },
      runDetails: {
        builder: { id: env('BUILD_PROJECT_ARN') },
        metadata: { invocationId: build.Item?.latest?.buildId, startedOn: job.createdAt, finishedOn: job.updatedAt },
      },
      approvals: { approvedBy: username, approverSub: sub, approvedAt: now, files: refreshed.length },
    },
  };
  const payloadType = 'application/vnd.in-toto+json';
  const payload = Buffer.from(JSON.stringify(statement));
  const digest = Buffer.from(sha256Hex(pae(payloadType, payload)), 'hex');
  const signed = await kms.send(new SignCommand({ KeyId: env('SIGNING_KEY_ID'), Message: digest, MessageType: 'DIGEST', SigningAlgorithm: 'ECDSA_SHA_256' }));
  const envelope = {
    payloadType,
    payload: payload.toString('base64'),
    signatures: [{ keyid: signed.KeyId, sig: Buffer.from(signed.Signature!).toString('base64') }],
  };
  await putJson(env('ARTIFACT_BUCKET'), `${jobPrefix(jobId)}/attestation.json`, envelope);
  await ddb.send(new UpdateCommand({
    TableName: env('TABLE_NAME'),
    Key: keys.job(job.projectId, jobId),
    UpdateExpression: 'SET attestation = :a',
    ExpressionAttributeValues: { ':a': { keyId: signed.KeyId, signedAt: now, approvedBy: username, subjectSha256: job.finalSourceSha256 } },
  }));
  return { approved: targets.length, pending: 0, attestation: envelope, statement, patch };
}

async function verify(jobId: string) {
  await getJob(jobId);
  const envelope = await getJson<{ payloadType: string; payload: string; signatures: { keyid: string; sig: string }[] }>(env('ARTIFACT_BUCKET'), `${jobPrefix(jobId)}/attestation.json`)
    .catch(() => { throw new HttpError(404, 'no attestation yet'); });
  const digest = Buffer.from(sha256Hex(pae(envelope.payloadType, Buffer.from(envelope.payload, 'base64'))), 'hex');
  const res = await kms.send(new VerifyCommand({
    KeyId: env('SIGNING_KEY_ID'),
    Message: digest,
    MessageType: 'DIGEST',
    Signature: Buffer.from(envelope.signatures[0].sig, 'base64'),
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));
  const pub = await kms.send(new GetPublicKeyCommand({ KeyId: env('SIGNING_KEY_ID') }));
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(pub.PublicKey!).toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`;
  return { valid: res.SignatureValid === true, keyId: res.KeyId, algorithm: 'ECDSA_SHA_256 (KMS ECC_NIST_P256)', publicKeyPem };
}

// ---------- scores (server-authoritative, validated against WebSocket telemetry) ----------

const SubmitScore = z.object({ sessionId: z.string().uuid(), playerName: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/) });

async function submitScore(event: APIGatewayProxyEvent) {
  const { sub } = user(event);
  const body = parseBody(event, SubmitScore);
  const summary = await ddb.send(new GetCommand({ TableName: env('TABLE_NAME'), Key: keys.sessionSummary(body.sessionId) }));
  const s = summary.Item;
  if (!s || s.owner !== sub) throw new HttpError(404, 'unknown session');
  if (s.submitted) throw new HttpError(409, 'score already submitted');
  if (!s.finished) throw new HttpError(422, 'run still in progress');
  if (s.suspicious) throw new HttpError(422, 'telemetry failed plausibility checks');
  const score = Number(s.serverScore ?? 0);
  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: env('TABLE_NAME'),
    Key: keys.sessionSummary(body.sessionId),
    UpdateExpression: 'SET submitted = :t',
    ConditionExpression: 'attribute_not_exists(submitted)',
    ExpressionAttributeValues: { ':t': true },
  }));
  await ddb.send(new PutCommand({
    TableName: env('TABLE_NAME'),
    Item: {
      PK: 'LEADERBOARD',
      SK: `SCORE#${String(999_999_999 - score).padStart(9, '0')}#${body.sessionId}`,
      playerName: body.playerName,
      score,
      ticks: s.ticks,
      sessionId: body.sessionId,
      signature: sha256Hex(`${body.playerName}:${score}:${body.sessionId}`),
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    },
  }));
  return { score, ticks: s.ticks };
}

async function leaderboard() {
  const res = await ddb.send(new QueryCommand({
    TableName: env('TABLE_NAME'),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'LEADERBOARD' },
    Limit: 10,
  }));
  return (res.Items ?? []).map(({ playerName, score, ticks, createdAt }) => ({ playerName, score, ticks, createdAt }));
}

// ---------- router ----------

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = (event.path || '').replace(/^\/(prod\/)?/, '/').replace(/\/+$/, '');
  const seg = path.split('/').filter(Boolean); // ['api', ...]
  try {
    user(event);
    if (seg[0] !== 'api') throw new HttpError(404, 'not found');
    const [, r1, r2, r3] = seg;
    if (method === 'GET' && r1 === 'samples' && !r2) return json(200, listSamples());
    if (method === 'GET' && r1 === 'samples' && r2) return json(200, getSample(r2));
    if (method === 'GET' && r1 === 'recipes') return json(200, RECIPES);
    if (r1 === 'jobs' && !r2 && method === 'POST') return json(202, await startJob(event));
    if (r1 === 'jobs' && !r2 && method === 'GET') return json(200, await listJobs());
    if (r1 === 'jobs' && r2) {
      const jobId = jobIdParam(r2);
      if (method === 'GET' && !r3) return json(200, await jobDetail(jobId));
      if (method === 'GET' && r3 === 'scan') return json(200, await jobScan(jobId));
      if (method === 'GET' && r3 === 'spec') return json(200, await jobSpec(jobId));
      if (method === 'GET' && r3 === 'diffs') return json(200, await jobDiffs(jobId));
      if (method === 'POST' && r3 === 'approve') return json(200, await approve(event, jobId));
      if (method === 'POST' && r3 === 'verify') return json(200, await verify(jobId));
    }
    if (r1 === 'scores' && method === 'GET') return json(200, await leaderboard());
    if (r1 === 'scores' && method === 'POST') return json(201, await submitScore(event));
    throw new HttpError(404, 'not found');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(JSON.stringify({ level: 'error', path, method, error: (e as Error).name, message: (e as Error).message }));
    return json(500, { error: 'internal error' });
  }
}
