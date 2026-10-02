export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type JobStage = 'QUEUED' | 'SCANNING' | 'REVERSE_ENGINEERING' | 'FORWARD_ENGINEERING' | 'BUILDING' | 'SELF_HEALING' | 'VERIFIED' | 'FAILED';

export interface SampleMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  language: string;
  fileCount: number;
  loc: number;
}

export interface JobEvent { at: string; stage: JobStage; message: string; level?: 'info' | 'success' | 'warn' | 'error' }

export interface BuildAttempt {
  attempt: number;
  buildId?: string;
  status: string;
  durationSeconds?: number;
  compileAndTestSeconds?: number;
  phases: { type?: string; status?: string; seconds?: number }[];
  tests: { suites: { name: string; run: number; failures: number; errors: number; skipped: number; time: number }[]; total: { run: number; failures: number; errors: number; skipped: number }; compilerErrors: string[]; warnings: number };
  zdrPurge: string | null;
  logTail: string[];
  sourceSha256?: string;
  at: string;
}

export interface Job {
  jobId: string;
  projectId: string;
  sampleName: string;
  mode: 'live' | 'golden';
  status: JobStage;
  createdAt: string;
  updatedAt: string;
  stages: Partial<Record<JobStage, string>>;
  events: JobEvent[];
  scanSummary?: { totalLoc: number; totalFiles: number; findings: number; cves: number; summary: Record<string, number>; durationMs: number };
  ressSummary?: { components: number; rules: number; vulnerabilities: number; durationMs: number; modelId?: string; usage?: { inputTokens: number; outputTokens: number } };
  forwardSummary?: { files: number; testFiles: number; durationMs: number; modelId?: string; usage?: { inputTokens: number; outputTokens: number } };
  totalSeconds?: number;
  finalAttempt?: number;
  attestation?: { keyId: string; signedAt: string; approvedBy: string; subjectSha256: string };
  build: { attempts: BuildAttempt[]; latest: BuildAttempt } | null;
}

export interface Finding {
  id: string;
  ruleId: string;
  category: string;
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
  control?: string;
  recipe?: string;
  cve?: string;
}

export interface ScanReport {
  totalFiles: number;
  totalLoc: number;
  languages: Record<string, number>;
  dependencies: { coordinate: string; version: string; status: string; cves: { id: string; severity: Severity; summary: string }[]; replacement: string }[];
  findings: Finding[];
  summary: Record<string, number>;
  durationMs: number;
}

export interface Ress {
  projectName: string;
  summary: string;
  topology: { components: { name: string; kind: string; responsibility: string; files: string[] }[]; boundaries: { from: string; to: string; protocol: string; description: string }[] };
  stateMachines: { name: string; states: string[]; transitions: { from: string; to: string; trigger: string }[] }[];
  businessRules: { id: string; category: string; title: string; rule: string; source: { file: string; lines: string }; parityTest: string }[];
  timing: { model: string; tickHz?: number; tickMs?: number; notes: string };
  protocols: { name: string; transport: string; messages: { code: string; name: string; direction: string; legacyLayout: string; modernEvent: string }[]; issues: string[] }[];
  vulnerabilities: { id: string; severity: Severity; component: string; description: string; remediation: string }[];
  concurrencyIssues: { location: string; issue: string; remediation: string }[];
  complianceFindings: { control: string; file: string; finding: string; remediation: string }[];
  modernizationPlan: { recipe: string; description: string; targets: string[] }[];
}

export interface SpecResponse { specId: string; ress: Ress; generatedBy: 'live' | 'golden'; modelId?: string; usage?: { inputTokens: number; outputTokens: number }; latencyMs?: number }

export interface FileDiff {
  modernPath: string;
  legacyPath: string | null;
  legacyContent: string;
  modernContent: string;
  summary: string;
  recipes: { recipeId: string; line?: number; note: string }[];
  added: number;
  removed: number;
  approved: boolean;
}

export interface Recipe { id: string; title: string; kind: 'deterministic' | 'generative'; description: string; control?: string }

export interface ApproveResponse {
  approved: number;
  pending: number;
  attestation: { payloadType: string; payload: string; signatures: { keyid: string; sig: string }[] } | null;
  statement?: unknown;
  patch?: string;
}

export interface VerifyResponse { valid: boolean; keyId: string; algorithm: string; publicKeyPem: string }

export interface LeaderboardEntry { playerName: string; score: number; ticks: number; createdAt: string }
