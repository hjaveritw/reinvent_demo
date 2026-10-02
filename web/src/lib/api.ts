import { accessToken } from './auth';
import type { ApproveResponse, FileDiff, Job, LeaderboardEntry, Recipe, SampleMeta, ScanReport, SpecResponse, VerifyResponse } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new ApiError(0, 'Backend not connected (local preview)');
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: token, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? body?.message ?? res.statusText);
  return body as T;
}

export const api = {
  samples: () => call<SampleMeta[]>('/samples'),
  recipes: () => call<Recipe[]>('/recipes'),
  startJob: (sampleId: string, mode: 'live' | 'golden') => call<{ jobId: string }>('/jobs', { method: 'POST', body: JSON.stringify({ sampleId, mode }) }),
  jobs: () => call<Pick<Job, 'jobId' | 'projectId' | 'sampleName' | 'mode' | 'status' | 'createdAt' | 'totalSeconds'>[]>('/jobs'),
  job: (id: string) => call<Job>(`/jobs/${encodeURIComponent(id)}`),
  scan: (id: string) => call<ScanReport>(`/jobs/${encodeURIComponent(id)}/scan`),
  spec: (id: string) => call<SpecResponse>(`/jobs/${encodeURIComponent(id)}/spec`),
  diffs: (id: string) => call<FileDiff[]>(`/jobs/${encodeURIComponent(id)}/diffs`),
  approve: (id: string, body: { paths?: string[]; approveAll?: boolean }) => call<ApproveResponse>(`/jobs/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  verify: (id: string) => call<VerifyResponse>(`/jobs/${encodeURIComponent(id)}/verify`, { method: 'POST', body: '{}' }),
  leaderboard: () => call<LeaderboardEntry[]>('/scores'),
  submitScore: (sessionId: string, playerName: string) => call<{ score: number; ticks: number }>('/scores', { method: 'POST', body: JSON.stringify({ sessionId, playerName }) }),
};
