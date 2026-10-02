export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SourceFile {
  path: string;
  content: string;
}

export interface Sample {
  id: string;
  name: string;
  tagline: string;
  description: string;
  language: string;
  groupId: string;
  artifactId: string;
  files: SourceFile[];
}

export interface Finding {
  id: string;
  ruleId: string;
  category: 'deprecated-api' | 'concurrency' | 'secret' | 'pii' | 'pan' | 'crypto' | 'injection' | 'dependency' | 'logging' | 'auth';
  severity: Severity;
  file: string;
  line: number;
  snippet: string;
  message: string;
  control?: string;
  recipe?: string;
  cve?: string;
}

export interface DependencyInfo {
  coordinate: string;
  version: string;
  status: 'eol' | 'vulnerable' | 'deprecated' | 'ok';
  cves: { id: string; severity: Severity; summary: string }[];
  replacement: string;
}

export interface ScanReport {
  totalFiles: number;
  totalLoc: number;
  languages: Record<string, number>;
  dependencies: DependencyInfo[];
  findings: Finding[];
  summary: Record<Finding['category'], number>;
  durationMs: number;
}

/** Reverse-Engineered System Specification. */
export interface Ress {
  projectName: string;
  summary: string;
  topology: {
    components: { name: string; kind: string; responsibility: string; files: string[] }[];
    boundaries: { from: string; to: string; protocol: string; description: string }[];
  };
  stateMachines: { name: string; states: string[]; transitions: { from: string; to: string; trigger: string }[] }[];
  businessRules: {
    id: string;
    category: 'physics' | 'timing' | 'scoring' | 'validation' | 'financial' | 'security' | 'data';
    title: string;
    rule: string;
    source: { file: string; lines: string };
    parityTest: string;
  }[];
  timing: { model: string; tickHz?: number; tickMs?: number; notes: string };
  protocols: {
    name: string;
    transport: string;
    messages: { code: string; name: string; direction: string; legacyLayout: string; modernEvent: string }[];
    issues: string[];
  }[];
  vulnerabilities: { id: string; severity: Severity; component: string; description: string; remediation: string }[];
  concurrencyIssues: { location: string; issue: string; remediation: string }[];
  complianceFindings: { control: string; file: string; finding: string; remediation: string }[];
  modernizationPlan: { recipe: string; description: string; targets: string[] }[];
}

export interface RecipeAnnotation {
  recipeId: string;
  line?: number;
  note: string;
}

export interface FileAnnotation {
  modernPath: string;
  legacyPath: string | null;
  summary: string;
  recipes: RecipeAnnotation[];
}

export type JobStage =
  | 'QUEUED' | 'SCANNING' | 'REVERSE_ENGINEERING' | 'FORWARD_ENGINEERING'
  | 'BUILDING' | 'SELF_HEALING' | 'VERIFIED' | 'FAILED';

export type JobMode = 'live' | 'golden';
