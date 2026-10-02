# AWS Transform Modernization Studio

Reverse- and forward-engineering workbench built from `docs/PRD.md` (v3.0.0-PROD).

- **Reverse engineering:** a deterministic pre-scan (LOC, CVEs, deprecated APIs, secrets, PII, PAN) plus an Amazon Bedrock RESS (Reverse-Engineered System Specification).
- **Forward engineering:** Bedrock generates Java 21 / Spring Boot 3.3.4 code from the RESS using a recipe catalog.
- **Verification:** an offline (hermetic) Maven build with parity tests in a VPC-isolated AWS CodeBuild, with up to 3 self-heal cycles.
- **Review and runtime:** a Monaco split diff with recipe annotations, KMS-signed in-toto attestations, the playable CyberRunner 2026 game, and an 8m30s presenter.

> Work in progress. Deployment and usage instructions will be added once the infrastructure is complete.

## Layout
| Path | Purpose |
|---|---|
| `legacy-samples/` | Legacy inputs (CyberRunner 1998, AcmeBank monolith). These contain **intentionally fake** hardcoded credentials and PII for the scanner to detect. |
| `golden-runs/` | Pre-verified modernized outputs used as the demo fallback |
| `sandbox-image/` | Hermetic Java 21 + Maven build image for CodeBuild |
| `services/` | Lambda handlers (TypeScript) |
| `infra/` | AWS CDK app |
| `web/` | React 19 workbench |
