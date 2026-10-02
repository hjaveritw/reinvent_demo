import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
});
export const s3 = new S3Client({});

export const env = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
};

/** All job-scoped data expires after 24h (COMP-SOC2-01 zero data retention). */
export const ttl24h = () => Math.floor(Date.now() / 1000) + 24 * 3600;

export const keys = {
  workspace: (ws: string) => ({ PK: `WS#${ws}`, SK: 'METADATA' }),
  project: (ws: string, projectId: string) => ({ PK: `WS#${ws}`, SK: `PROJ#${projectId}` }),
  spec: (projectId: string, specId: string) => ({ PK: `PROJ#${projectId}`, SK: `SPEC#${specId}` }),
  rule: (specId: string, ruleId: string) => ({ PK: `SPEC#${specId}`, SK: `RULE#${ruleId}` }),
  job: (projectId: string, jobId: string) => ({ PK: `PROJ#${projectId}`, SK: `JOB#${jobId}` }),
  diff: (jobId: string, path: string) => ({ PK: `JOB#${jobId}`, SK: `DIFF#${path}` }),
  build: (jobId: string) => ({ PK: `JOB#${jobId}`, SK: 'BUILD_VERIFICATION' }),
  sessionTick: (sessionId: string, ts: number) => ({ PK: `SESSION#${sessionId}`, SK: `TICK#${String(ts).padStart(15, '0')}` }),
  sessionSummary: (sessionId: string) => ({ PK: `SESSION#${sessionId}`, SK: 'SUMMARY' }),
};

/** jobId embeds its projectId so a job can be addressed by id alone: <projectId>--<timestamp><rand>. */
export const projectOfJob = (jobId: string) => {
  const idx = jobId.indexOf('--');
  if (idx < 1 || !/^[a-z0-9-]+--[a-z0-9]+$/.test(jobId)) throw new Error('invalid job id');
  return jobId.slice(0, idx);
};

export const jobPrefix = (jobId: string) => `jobs/${jobId}`;
export const attemptPrefix = (jobId: string, attempt: number) => `${jobPrefix(jobId)}/attempt-${attempt}`;

export async function putJson(bucket: string, key: string, body: unknown) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(body), ContentType: 'application/json' }));
}

export async function getJson<T>(bucket: string, key: string): Promise<T> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await res.Body!.transformToString()) as T;
}

export async function putBytes(bucket: string, key: string, body: Uint8Array, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
