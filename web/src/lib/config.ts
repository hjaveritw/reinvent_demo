export interface RuntimeConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  wsUrl: string;
  modelId: string;
}

let cached: RuntimeConfig | null | undefined;

/** Loads /config.json written by the CDK deployment. Returns null when running without a backend (local preview). */
export async function loadConfig(): Promise<RuntimeConfig | null> {
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    cached = res.ok && res.headers.get('content-type')?.includes('json') ? ((await res.json()) as RuntimeConfig) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const getConfig = () => cached ?? null;
