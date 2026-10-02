import { structuredPatch } from 'diff';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { POM_TEMPLATE } from '../generated/bundle';
import { attemptPrefix, ddb, env, keys, putBytes, putJson, ttl24h } from './aws';
import { zipFiles } from './zip';
import type { FileAnnotation, Sample, SourceFile } from './types';

const SAFE_PATH = /^src\/(main|test)\/(java|resources)\/[A-Za-z0-9_\-./]+$/;

/** Rejects path traversal / unexpected locations in model output and injects the platform-owned pom.xml. */
export function sanitizeProject(sample: Sample, files: SourceFile[]): SourceFile[] {
  const out = new Map<string, SourceFile>();
  for (const f of files) {
    const path = f.path.replace(/^\.?\//, '');
    if (path === 'pom.xml' || path.includes('..') || !SAFE_PATH.test(path)) continue;
    if (typeof f.content !== 'string' || f.content.length > 200_000) continue;
    out.set(path, { path, content: f.content });
  }
  if (![...out.keys()].some((p) => p === 'src/main/resources/application.properties')) {
    out.set('src/main/resources/application.properties', {
      path: 'src/main/resources/application.properties',
      content: `spring.application.name=${sample.artifactId}\nspring.threads.virtual.enabled=true\nspring.datasource.url=jdbc:h2:mem:app\n`,
    });
  }
  const pom = POM_TEMPLATE.replace('__GROUP_ID__', sample.groupId).replace('__ARTIFACT_ID__', sample.artifactId);
  out.set('pom.xml', { path: 'pom.xml', content: pom });
  return [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Persists one build attempt (files.json + deterministic source.zip) and returns the CodeBuild S3 source location. */
export async function storeAttempt(jobId: string, attempt: number, files: SourceFile[]) {
  const bucket = env('ARTIFACT_BUCKET');
  const prefix = attemptPrefix(jobId, attempt);
  const { bytes, sha256 } = zipFiles(files);
  await putJson(bucket, `${prefix}/files.json`, files);
  await putBytes(bucket, `${prefix}/source.zip`, bytes, 'application/zip');
  return { sourceLocation: `${bucket}/${prefix}/source.zip`, sourceSha256: sha256, fileCount: files.length };
}

function diffStats(oldText: string, newText: string) {
  const patch = structuredPatch('a', 'b', oldText, newText, '', '', { context: 0 });
  let added = 0;
  let removed = 0;
  for (const h of patch.hunks) for (const l of h.lines) {
    if (l.startsWith('+')) added++;
    else if (l.startsWith('-')) removed++;
  }
  return { added, removed };
}

/** Writes CodeFileDiff items (metadata + recipe annotations only; code itself stays in S3). */
export async function writeDiffs(jobId: string, sample: Sample, files: SourceFile[], annotations: FileAnnotation[]) {
  const legacy = new Map(sample.files.map((f) => [f.path, f.content]));
  const ann = new Map(annotations.map((a) => [a.modernPath, a]));
  const items = files.map((f) => {
    const a = ann.get(f.path);
    const legacyPath = a?.legacyPath && legacy.has(a.legacyPath) ? a.legacyPath : f.path === 'pom.xml' ? 'pom.xml' : null;
    const stats = diffStats(legacyPath ? legacy.get(legacyPath)! : '', f.content);
    return {
      ...keys.diff(jobId, f.path),
      jobId,
      modernPath: f.path,
      legacyPath,
      summary: a?.summary ?? (f.path.startsWith('src/test') ? 'Synthesized parity tests' : 'Generated from RESS'),
      recipes: a?.recipes ?? [],
      added: stats.added,
      removed: stats.removed,
      approved: false,
      ttl: ttl24h(),
    };
  });
  for (let i = 0; i < items.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [env('TABLE_NAME')]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) } }));
  }
  return items.length;
}
