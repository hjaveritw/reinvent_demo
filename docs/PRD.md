# AWS Transform Modernization Studio - Reverse & Forward Engineering PRD
Version: 3.0.0-PROD | Status: Approved for Implementation
Organization: Thoughtworks & AWS AI Works Learning Path | Last Updated: October 2026
Target Release: GA Platform
Core Tooling: AWS Transform, Kiro, AI Works Modernization Accelerators, Amazon Bedrock, AWS CodeBuild

## Required Guardrails
- **Reverse Engineering Step:** MANDATORY: Assess and document the legacy code before touching it. Ingest legacy source trees, decompile ASTs, extract business logic rules, document protocols, and generate the formal Kiro/AI Works Reverse-Engineered System Specification (RESS) prior to any code generation.
- **Forward Engineering Step:** MANDATORY: Produce working, modernized code strictly derived from that assessment. Employ AWS Transform AST-directed deterministic recipes and Amazon Q Developer generative agents to synthesize production-ready modern architectures that compile cleanly in isolated sandboxes.
- **Core Demo Runtime Budget:** Strict 5–10 minute execution window for executive evaluation and interactive demonstration.

## 1. Executive Summary
To deliver a deterministic, two-phase modernization platform that first reverse-engineers and documents unmaintained legacy systems (including retro arcade engines and monolithic enterprise servers) with zero ambiguity, and subsequently forward-engineers them into production-ready, cloud-native architectures using AWS Transform, Kiro, and AI Works tooling.

### Problem Statement
Legacy systems—ranging from 1990s arcade game loops and socket servers to enterprise Java 8 monoliths—suffer from lost documentation, obsolete binary protocols, and unpatched CVEs. Blind refactoring fails because developers do not understand implicit business rules, while manual rewrites take quarters and introduce catastrophic regressions.

### Solution Overview
A disciplined, two-stage modernization workbench that bridges reverse engineering and forward engineering: (1) Stage 1: Ingests legacy code with Kiro and AI Works to extract system boundaries, state machines, protocol contracts, and CVE audits without altering a single source line; (2) Stage 2: Feeds this verified specification into AWS Transform to synthesize modernized Java 21, Spring Boot 3, and cloud-native HTML5/WebSocket runtimes with 100% build validity verified in AWS CodeBuild.

### Strategic Objectives
- Phase 1 Reverse Engineering: 100% architectural transparency and business rule extraction before code mutation.
- Phase 2 Forward Engineering: Automated AST and generative modernization using AWS Transform, cutting turnaround by 80–90%.
- Ecosystem Alignment: Native integration with AWS Transform, Kiro, and AI Works tooling from the learning path.
- Measurable Outcome: A working, verified application (including a playable modernized retro arcade game) demonstratable in 5–10 minutes.

### Target Metrics
- Core demonstration runtime: Exactly 5–10 minutes for complete end-to-end evaluation.
- Reverse engineering specification generation: < 90 seconds for legacy repositories.
- Automated compilation & test pass rate: 100% in isolated AWS CodeBuild sandboxes.
- Zero customer code retention across all AWS Transform and Kiro inference endpoints.

## 2. Target Personas
### Modernization Lead & Demo Evaluator: Enterprise Solutions Architect (Thoughtworks / AWS)
- **Pain Points:** Presenting complex refactoring tools without proving working functional parity.; Demonstrations that overrun 15+ minutes or stall on opaque compilation failures.; Refactoring code blindly without an immutable pre-audit of business logic.
- **Goals:** Conduct a tight, compelling 5–10 minute live walkthrough from legacy assessment to working code.; Demonstrate tangible execution: show working modernized code running live (e.g. playable arcade game and enterprise microservice).
- **Journey:** Selects legacy scenario -> Ingests with Kiro -> Reviews extracted Reverse-Engineering Spec -> Executes AWS Transform -> Inspects side-by-side diff -> Tests running modernized app.

### Lead Software Engineer: Application Modernization Developer
- **Pain Points:** Deciphering 20-year-old spaghetti code with no documentation and mutable global variables.; Manually upgrading deprecated APIs (Thread.sleep game loops, javax to jakarta, raw sockets).
- **Goals:** Rely on Kiro to generate clean architectural specifications from legacy source.; Use AWS Transform to execute mechanical transformations, dependency upgrades, and test synthesis automatically.
- **Journey:** Reviews Kiro business rule extraction -> Validates AWS Transform AST recipes -> Runs sandboxed build -> Merges verified PR.

### Chief Technology & Security Officer: VP of Engineering & Security
- **Pain Points:** Unauthenticated legacy protocols and unpatched vulnerabilities (Log4j, buffer overflows).; Risk of IP exfiltration when using AI tooling on proprietary source code.
- **Goals:** Guarantee zero code retention across AWS Transform and AI Works tooling.; Obtain automated CVE remediation certificates and SLSA Level 3 provenance.
- **Journey:** Inspects reverse-engineered vulnerability manifest -> Confirms automated remediation in modernized target -> Reviews KMS cryptographic sign-off.

## 3. Functional Requirements

### [P0] FR-01: Step 1: Reverse-Engineering & Codebase Assessment Engine (Reverse Engineering & Spec Recovery)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** Kiro, AI Works
- **User Story:** As an Architect, I want the legacy codebase assessed and fully documented first so we understand all hidden business rules, state machines, and protocols before writing new code.
- **Description:** Must ingest legacy source code (e.g. Java 8 arcade servers, C/C++ game loops, .NET WCF) and generate a comprehensive Reverse-Engineered System Specification (RESS) using Kiro and AI Works tooling before any forward engineering code mutation occurs.
- **AWS Services:** Kiro Architecture Agent, AI Works Code Ingest, Amazon S3
- **Acceptance Criteria:**
  - [ ] Documents complete system topology, state machines, and component boundaries prior to code changes.
  - [ ] Extracts discrete business rules and physics/tick timing logic into a structured specification.
  - [ ] Audits all network protocols, mapping legacy binary/socket packets to modern event-driven schemas.
  - [ ] Identifies 100% of deprecated libraries, blocking locks, and active CVE vulnerabilities.


### [P0] FR-02: Step 2: Forward-Engineering via AWS Transform Agent (Forward Engineering & Code Generation)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** AWS Transform, Amazon Bedrock
- **User Story:** As a Developer, I want AWS Transform to generate clean, modern code from the reverse-engineered specification that compiles and executes without manual rewriting.
- **Description:** Translates the Reverse-Engineered System Specification (RESS) into working, modernized cloud-native code using AWS Transform (Amazon Q Developer Transformation) with deterministic OpenRewrite recipes and LLM refactoring.
- **AWS Services:** Amazon Q Developer Transformation, Amazon Bedrock, AWS CodeBuild
- **Acceptance Criteria:**
  - [ ] Synthesizes target LTS code (Java 21 / Spring Boot 3 / modern TypeScript Canvas) matching RESS rules.
  - [ ] Replaces deprecated concurrency (Thread.sleep loops, raw sockets) with modern event streams and Virtual Threads.
  - [ ] Eliminates 100% of identified CVEs by upgrading to secure, maintained frameworks.
  - [ ] Produces verified working software capable of live interactive execution.


### [P0] FR-03: Sandboxed Cloud Compilation & Test Verification (Build & Verification)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** AWS CodeBuild, AI Works
- **User Story:** As an SRE, I want transformed code compiled in an isolated sandbox to ensure zero build errors before deployment.
- **Description:** Executes modernized code in an ephemeral, VPC-isolated AWS CodeBuild sandbox to compile, link dependencies, and execute synthesized regression test suites.
- **AWS Services:** AWS CodeBuild, Amazon VPC, AWS KMS
- **Acceptance Criteria:**
  - [ ] Compiles with 0 warnings or errors under strict modern compiler flags.
  - [ ] Executes synthetic unit tests validating business rule parity against the legacy specification.
  - [ ] Container purges all ephemeral storage post-execution to guarantee zero code retention.


### [P0] FR-04: Interactive Split-Diff Review with Transformation Annotations (Developer Experience & IDE)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** AWS Transform, AI Works
- **User Story:** As a Developer, I want to see side-by-side diffs with contextual explanations of what changed and why.
- **Description:** Provides side-by-side split diff inspection comparing the assessed legacy code against the forward-engineered target, highlighting security patches, namespace updates, and algorithmic modernizations.
- **AWS Services:** Amazon API Gateway, Amazon S3
- **Acceptance Criteria:**
  - [ ] Renders syntax-highlighted legacy versus modern diff with line-level change indicators.
  - [ ] Displays clickable annotations explaining the exact modernization recipe applied.
  - [ ] Allows developers to review and approve changes prior to pull request generation.


### [P1] FR-05: Live Modernized Application Runtime & Playable Game Verification (Core Transformation)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** AWS Transform, AI Works
- **User Story:** As an Evaluator, I want to play the modernized arcade game directly in the browser to prove that the forward-engineered code actually works.
- **Description:** Instantiates and executes the modernized application live in the browser workbench (including an interactive, playable retro arcade game) to prove functional parity and real-time cloud modernization.
- **AWS Services:** AWS Lambda, Amazon API Gateway WebSocket, Amazon DynamoDB
- **Acceptance Criteria:**
  - [ ] Embeds a functional, playable modernized arcade engine (CyberRunner 2026) running in HTML5 Canvas.
  - [ ] Simulates modern 60Hz cloud WebSocket telemetry and event-driven score persistence.
  - [ ] Supports standard desktop keyboard and mobile touch controls for immediate evaluation.


### [P1] FR-06: Guided 5–10 Minute Core Demo Presenter & Timer (Developer Experience & IDE)
- **Status:** Approved | **Feasibility:** High
- **Tooling:** AI Works
- **User Story:** As a Presenter, I want a structured 5–10 minute demo script and timer so I can showcase the complete reverse-to-forward engineering story crisply within the time budget.
- **Description:** Built-in presenter controller with a 5–10 minute timeline, real-time stopwatch, step-by-step speaker notes, and instant section jumps, tailored specifically for stakeholder evaluations.
- **AWS Services:** AWS Amplify Hosting
- **Acceptance Criteria:**
  - [ ] Includes 5 structured demo phases totaling 5–10 minutes with automated countdown.
  - [ ] Provides ready-to-read speaker script and talking points for each stage.
  - [ ] Enables one-click navigation between Discovery, Reverse Engineering, AWS Transform, and Live Playable Game.


## 4. Non-Functional Requirements
- **NFR-01 (Demo Runtime)**: Total Core Demonstration Window - 5 to 10 Minutes Total. The complete modernization journey—from legacy ingestion to reverse engineering, AWS Transform forward engineering, and live application execution—must comfortably execute within 5–10 minutes. (Verification: Timed walkthrough with live presenter mode countdown.)
- **NFR-02 (Security & Isolation)**: Zero Customer Data Retention (ZDR) - 0 bytes persistent storage post-run. Neither AWS Transform, Kiro, nor AI Works tooling may retain customer source code, AST caches, or prompts after job completion. (Verification: SOC2 Type II compliance audit and KMS lifecycle verification.)
- **NFR-03 (Performance)**: Compilation & Sandboxed Build Speed - < 25 seconds in AWS CodeBuild. Sandboxed builds with target JDK/SDK compilers must execute rapidly using pre-warmed container images. (Verification: CloudWatch build duration telemetry.)
- **NFR-04 (Reliability)**: Syntactic & Behavioral Parity - 100% build validity and 0 test regressions. Forward-engineered code must compile cleanly and pass all synthesized unit tests verifying legacy parity. (Verification: Automated test harness reporting.)

## 5. Technical Architecture & Data Flow
A two-phase cloud pipeline integrating Kiro and AI Works for upfront reverse-engineering and specification synthesis, followed by AWS Transform (Amazon Q Developer Transformation) and AWS CodeBuild for deterministic forward-engineering, build verification, and live serverless execution.

### Data Flow
1. **Legacy Code Ingestion & Pre-Scan** [Reverse Engineering]: Legacy codebase (arcade game loop, banking monolith) ingested into memory; lines of code, dependencies, and CVEs audited. (Developer Workstation -> AI Works Ingest)
2. **Kiro Reverse Engineering & Specification Generation** [Reverse Engineering]: Kiro analyzes ASTs and decompiles implicit business logic, game loop ticks, and socket protocols into the formal RESS document. (Kiro Agent -> System Specification (RESS))
3. **AWS Transform Forward Engineering Synthesis** [Forward Engineering]: AWS Transform ingests the RESS specification, executing deterministic AST rewrites and generative modernization into target modern stacks. (AWS Transform -> Amazon Bedrock)
4. **Sandboxed CodeBuild Compilation & Test Verification** [Verification]: Transformed code bundle compiled in isolated AWS CodeBuild container; synthetic unit tests run with 100% pass verification. (AWS Step Functions -> AWS CodeBuild)
5. **Live Execution & Interactive Verification** [Verification]: Modernized application deployed to live runtime (e.g. playable HTML5/WebSocket arcade game) and Git Pull Request opened with KMS signature. (Live Browser Sandbox -> Git Pull Request)

## 6. Implementation Milestones
### Phase 1: Reverse Engineering: Legacy Code Discovery & Spec Recovery (Kiro / AI Works) (Sprint 1 - 2)
- Deliverables: Automated AST ingestion for legacy Java, C++, and .NET stacks.; Kiro-generated Reverse-Engineered System Specification (RESS).; Comprehensive CVE vulnerability and technical debt audit.
- Exit Criteria: 100% of legacy business rules, protocols, and CVEs documented before any code alteration.

### Phase 2: Forward Engineering: AWS Transform Modernization & Sandbox Verification (Sprint 3 - 4)
- Deliverables: AWS Transform deterministic AST recipes for target modern runtimes.; Ephemeral AWS CodeBuild compilation pipeline with self-healing compiler loop.; Synthetic unit test generation validating behavioral parity.
- Exit Criteria: 100% clean compilation and zero regression in CodeBuild test suite.

### Phase 3: Production & Interactive Runtime: Live Cloud Execution & Fleet Git Automation (Sprint 5 - 6)
- Deliverables: Interactive Modernization Workbench with playable modernized application.; Automated Git PR generation with cryptographic KMS signatures.; 5–10 minute guided executive presentation runner.
- Exit Criteria: Successful end-to-end 5–10 minute demonstration showcasing working modernized software.

## 7. Risk Assessment & Mitigation
- **RSK-01 (Reverse engineering fails to capture undocumented business rules or edge-case game loop mechanics)** [Severity: High, Likelihood: Medium]: Use Kiro's multi-pass AST reasoning combined with AI Works rule extraction, generating synthetic test fixtures to verify parity.
- **RSK-02 (Forward-engineered code encounters build errors in sandboxed compilation)** [Severity: High, Likelihood: Low]: Deploy AWS Transform's autonomous iterative repair loop in AWS CodeBuild (up to 3 automated fix cycles) before human review.
- **RSK-03 (Demonstration exceeds the 5–10 minute runtime budget during executive presentations)** [Severity: Medium, Likelihood: Medium]: Provide the built-in 5–10 Minute Demo Presenter with pre-cached states, quick jump anchors, and timed phase indicators.

## 8. Technology Stack Specification
- **Frontend & Presentation:** React 19, TypeScript 5.6, Tailwind CSS v4, Motion, HTML5 Canvas 2D / WebGL 2.0, Monaco Editor Diff Engine, STOMP WebSocket client.
- **Backend & Target Runtime:** Java 21 LTS, Spring Boot 3.3.4 (Jakarta EE 10, Virtual Threads, Spring WebSocket, Spring Security 6), AWS Lambda (SnapStart), Amazon API Gateway, Amazon DynamoDB.
- **Reverse Engineering Tooling:** Kiro AI Architecture & Spec Recovery Agent, AI Works Ingest Accelerator, Tree-Sitter Grammars, NVD/Trivy Vulnerability Scanner.
- **Forward Engineering Tooling:** AWS Transform (Amazon Q Developer Transformation Service), Amazon Bedrock (Claude 3.5 Sonnet Agent), AWS CodeBuild in Private VPC Sandbox.
- **Cloud Infrastructure & Security:** AWS Step Functions, Amazon DynamoDB (Single-Table Design), Amazon S3 with KMS Customer-Managed Keys (BYOK, 24h Auto-Purge), AWS WAF.

## 9. Proposed Enterprise Data Model (Amazon DynamoDB Single-Table Schema)
- **ModernizationWorkspace:** PK: WS#<workspaceId> | SK: METADATA
- **LegacyProject:** PK: WS#<workspaceId> | SK: PROJ#<projectId>
- **ReverseEngineeringSpec (RESS):** PK: PROJ#<projectId> | SK: SPEC#<specId>
- **ExtractedBusinessRule:** PK: SPEC#<specId> | SK: RULE#<ruleId>
- **TransformationJob:** PK: PROJ#<projectId> | SK: JOB#<jobId> | GSI1PK: STATUS#<status>
- **CodeFileDiff:** PK: JOB#<jobId> | SK: DIFF#<filePath>
- **CodeBuildVerification:** PK: JOB#<jobId> | SK: BUILD_VERIFICATION
- **ArcadeGameSession (Telemetry):** PK: SESSION#<sessionId> | SK: TICK#<timestamp>

## 10. Enterprise Compliance & Security Checklist
### [GDPR] COMP-GDPR-01: PII Scrubbing & Cleartext Credential Sanitization
- **Control Domain:** Data Privacy & PII Protection (Art. 25 & 32)
- **Modernization Stage:** Pre-Scan (Reverse Eng)
- **Status:** Verified
- **Description:** Detects and eliminates hardcoded personal identifiable information (emails, phone numbers, SSNs) and hardcoded credentials in legacy code and configuration files.
- **Automated Verification:** Kiro/AI Works regex & entropy AST scanner; zero false negatives on test suite.
- **Target Remediation:** Replaces cleartext secrets with AWS Secrets Manager references and pseudonymizes test fixture PII.

### [GDPR] COMP-GDPR-02: Logging Data Minimization & Identifier Masking
- **Control Domain:** Right to Erasure & Masking (Art. 17)
- **Modernization Stage:** AST Rewrite (Forward Eng)
- **Status:** Verified
- **Description:** Ensures application logging frameworks mask account numbers, user identifiers, and IP addresses to prevent PII leakage into Amazon CloudWatch.
- **Automated Verification:** AST pattern matcher confirms all logger statements use masking interceptors.
- **Target Remediation:** Rewrites unmasked string concatenations into parameterized SLF4J/Logback masking layouts.

### [HIPAA] COMP-HIPAA-01: ePHI Cryptographic Protection in Transit & At Rest
- **Control Domain:** Technical Safeguards (45 CFR § 164.312(a)(2)(iv))
- **Modernization Stage:** AST Rewrite (Forward Eng)
- **Status:** Verified
- **Description:** Mandates TLS 1.3 encryption in transit for all inter-service client calls and AWS KMS AES-256 GCM encryption at rest for all database persistence entities.
- **Automated Verification:** Compiler checks that sensitive entity attributes are annotated with JPA AttributeConverters.
- **Target Remediation:** Injects JPA attribute encryption converters on sensitive health and claims data fields.

### [HIPAA] COMP-HIPAA-02: Immutable Access Audit Controls & Tamper-Evident Logs
- **Control Domain:** Audit Controls (45 CFR § 164.312(b))
- **Modernization Stage:** Sandboxed Build (CodeBuild)
- **Status:** Verified
- **Description:** Modernized microservices must emit structured audit events to CloudWatch and EventBridge whenever healthcare claims or patient data is queried or modified.
- **Automated Verification:** Unit test suite verifies that audit listener interceptors trigger on all entity mutations.
- **Target Remediation:** Modernizes legacy unlogged queries into Spring Data JPA entities with @EntityListeners(AuditingEntityListener.class).

### [SOC 2 Type II] COMP-SOC2-01: Zero Customer Data Retention (ZDR) & Ephemeral Storage Purge
- **Control Domain:** Confidentiality & Data Disposal (CC6.1)
- **Modernization Stage:** Sandboxed Build (CodeBuild)
- **Status:** Verified
- **Description:** Strict prohibition of customer code persistence across AWS Transform, Amazon Bedrock, and CodeBuild runners post-execution.
- **Automated Verification:** Automated verification script confirms CodeBuild ephemeral volumes are wiped with zero residual storage.
- **Target Remediation:** Enforces 24-hour auto-purge S3 lifecycle rules and transient in-memory Docker build containers.

### [PCI-DSS v4.0] COMP-PCI-01: Cardholder Data Environment (CDE) Isolation & PAN Sanitization
- **Control Domain:** Payment Card Security (Req 3.4)
- **Modernization Stage:** Pre-Scan (Reverse Eng)
- **Status:** Verified
- **Description:** Ensures Primary Account Numbers (PAN) and sensitive authentication data are never logged in cleartext, cached in memory heaps, or stored without tokenization.
- **Automated Verification:** Luhn algorithm AST scanner checks regex patterns in source literals, comments, and database schemas.
- **Target Remediation:** Deprecates raw credit card storage in favor of tokenized payment gateways with zero local PAN retention.

### [SLSA Level 3] COMP-SLSA-01: Hermetic Sandboxed Build & KMS Cryptographic Commit Signing
- **Control Domain:** Software Supply Chain Security (SLSA v1.0)
- **Modernization Stage:** Deployment & Git Attestation
- **Status:** Verified
- **Description:** Guarantees transformed code is built in an isolated container without public internet access, signed with AWS KMS customer-managed keys.
- **Automated Verification:** Validates in-toto provenance attestation JSON and verifies KMS asymmetric signature on Git commit.
- **Target Remediation:** Attaches cryptographic provenance attestation to generated GitHub/CodeCommit pull requests.

### [FedRAMP] COMP-FEDRAMP-01: FIPS 140-3 Cryptographic Module Enforcement
- **Control Domain:** Cryptographic Protection (SC-13)
- **Modernization Stage:** AST Rewrite (Forward Eng)
- **Status:** Verified
- **Description:** Replaces deprecated hashing algorithms (MD5, SHA-1) and weak SSL sockets with FIPS 140-3 compliant primitives (SHA-256, AES-256, TLS 1.3).
- **Automated Verification:** AST scan flags all MessageDigest.getInstance("MD5") and insecure cipher suites.
- **Target Remediation:** Replaces insecure algorithms with Bouncy Castle FIPS or AWS KMS crypto providers.
