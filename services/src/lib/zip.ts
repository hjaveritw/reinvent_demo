import { strToU8, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import type { SourceFile } from './types';

/** Deterministic zip (fixed mtime, sorted entries) so identical sources produce identical digests. */
export function zipFiles(files: SourceFile[]): { bytes: Uint8Array; sha256: string } {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    entries[f.path] = [strToU8(f.content), { mtime: new Date('2026-01-01T00:00:00Z') }];
  }
  const bytes = zipSync(entries, { level: 6 });
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export const sha256Hex = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
