export type ViewId = 'presenter' | 'prd' | 'workbench' | 'diff' | 'game';
export type WorkbenchTab = 'scan' | 'ress' | 'build';

export interface DemoStage {
  index: number;
  category: string;
  title: string;
  startSec: number;
  endSec: number;
  script: string;
  objective: string;
  keyAction: string;
  cta: { label: string; view: ViewId; tab?: WorkbenchTab };
}

export const TARGET_SECONDS = 510; // 8m 30s

export const STAGES: DemoStage[] = [
  {
    index: 1,
    category: 'Discovery',
    title: 'Legacy System Assessment & Problem Context',
    startSec: 0,
    endSec: 90,
    script:
      "Welcome everyone. Today we are addressing one of the most critical challenges in cloud engineering: modernizing legacy software without breaking business logic. We are examining CyberRunner 1998, a legacy multiplayer arcade socket server and client. It's written in Java 8 with raw blocking sockets, vulnerable high-score injection, and zero cloud agility. Notice our first rule: we do NOT touch the code yet.",
    objective:
      'Establish the problem: legacy Java 8/socket arcade engine with unauthenticated protocols, EOL Log4j, string-built SQL, hardcoded credentials and Thread.sleep loops.',
    keyAction: 'Show PRD Executive Summary & Legacy Code Ingestion',
    cta: { label: 'Jump to PRD', view: 'prd' },
  },
  {
    index: 2,
    category: 'Reverse Engineering',
    title: 'Reverse Engineering with Kiro & AI Works',
    startSec: 90,
    endSec: 210,
    script:
      "Step one is assessment, and it's mandatory. The deterministic pre-scan ingests the tree read-only: lines of code, dependencies, CVEs, secrets, PII and card numbers — all redacted in the report itself. Then the Spec Recovery agent on Amazon Bedrock produces the Reverse-Engineered System Specification. Look at what it recovered: gravity of exactly 0.6 pixels per tick, a 60-hertz fixed-step loop, the undocumented binary protocol mapped opcode by opcode to modern events, and a score packet that trusts the client. Every rule has a source line and a named parity test.",
    objective:
      'Prove 100% architectural transparency before mutation: topology, state machines, business rules, protocol contracts and the CVE manifest — in under 90 seconds.',
    keyAction: 'Start the pipeline and open the RESS: business rules, protocol map, CVE manifest',
    cta: { label: 'Jump to RESS', view: 'workbench', tab: 'ress' },
  },
  {
    index: 3,
    category: 'Forward Engineering',
    title: 'Forward Engineering with AWS Transform',
    startSec: 210,
    endSec: 330,
    script:
      'Only now do we generate code — strictly from the specification. Deterministic recipes handle the mechanical work: javax to jakarta, the Spring Boot 3.3.4 baseline on Java 21, string-built SQL to Spring Data. Generative refactoring handles the architecture: the Thread.sleep loop becomes a fixed-rate scheduler on virtual threads, raw sockets become STOMP events, and scoring becomes server-authoritative. Click any annotation to see exactly which recipe changed which line, and why.',
    objective:
      'Show modern Java 21 / Spring Boot 3 code derived from the RESS, with every change traceable to a named transformation recipe.',
    keyAction: 'Open the split diff and click recipe annotations (R-VTHREADS, R-STOMP, R-SERVER-AUTH)',
    cta: { label: 'Jump to Diff', view: 'diff' },
  },
  {
    index: 4,
    category: 'Verification',
    title: 'Sandboxed Build & Automated Verification',
    startSec: 330,
    endSec: 420,
    script:
      "Generated code means nothing until it compiles and passes. The project is built in AWS CodeBuild inside a VPC with no internet route at all — the log proves egress is blocked — using a pre-warmed, hermetic image and warnings-as-errors. The synthesized parity tests assert the legacy rules: same gravity, same speed ramp, same scoring. If a build fails, the self-healing loop repairs it, up to three cycles. The workspace is purged afterwards, and approval produces an in-toto provenance statement signed with a KMS key.",
    objective:
      'Demonstrate 100% clean compilation, zero parity regressions, zero code retention and cryptographic provenance (SLSA L3 posture).',
    keyAction: 'Show the CodeBuild result and parity tests, then approve and verify the KMS signature',
    cta: { label: 'Jump to Build', view: 'workbench', tab: 'build' },
  },
  {
    index: 5,
    category: 'Live Modernized Execution',
    title: 'Live Executable Modernized Arcade Game',
    startSec: 420,
    endSec: 510,
    script:
      "And it works. This is CyberRunner 2026, running the exact physics recovered from 1998. Every tick streams telemetry over an authenticated WebSocket, and the server replays the RESS rules to validate it. The legacy high-score injection is gone: the leaderboard only accepts the score the server computed itself. From undocumented legacy code to verified, playable, cloud-native software in under ten minutes.",
    objective:
      'Prove functional parity live: playable HTML5 Canvas game, 60 Hz WebSocket telemetry and server-verified, tamper-proof scoring.',
    keyAction: 'Play CyberRunner 2026 and submit a server-verified score',
    cta: { label: 'Launch Game', view: 'game' },
  },
];

export const stageAt = (elapsed: number) => STAGES.find((s) => elapsed >= s.startSec && elapsed < s.endSec) ?? STAGES[STAGES.length - 1];
