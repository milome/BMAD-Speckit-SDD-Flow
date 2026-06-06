# Main Agent Runtime Migration Wave 3.8 Summary

Wave ID: main-agent-runtime-migration-wave-3.8
Contract: docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md
Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/evidence.json
Mode: final

## Scope

Wave 3.8 classifies all 38 P3 scripts and migrates only the entries selected as package_runtime_module.
It does not assert that every source repository scripts/* consumer can run directly in consumer projects.
Root scripts are retained as source-repository development files.

## Classification

selectedPackageRuntimeCount: 21
deterministicExclusionCount: 17

## Runtime Proof

usedRootScript: false
usedTsx: false
usedTsNode: false
usedCompiledFallback: false
rootScriptsDeleted: false
rootScriptDeletionApproved: false
Deletion is not approved.

## Runtime Entries

- scripts/adaptive-intake-governance-gate.ts -> bmad-speckit main-agent adaptive-intake-governance-gate
- scripts/adaptive-intake-proof-gate.ts -> bmad-speckit main-agent adaptive-intake-proof-gate
- scripts/ai-tdd-contract-gate.ts -> bmad-speckit main-agent ai-tdd-contract-gate
- scripts/audit-stage-routing.ts -> bmad-speckit main-agent audit-stage-routing
- scripts/auditor-post-actions.ts -> bmad-speckit main-agent auditor-post-actions
- scripts/auditor-spec.ts -> bmad-speckit main-agent auditor-spec
- scripts/bmad-runtime-worker.ts -> bmad-speckit main-agent bmad-runtime-worker
- scripts/e2e-dual-host-journey-runner.ts -> bmad-speckit main-agent e2e-dual-host-journey-runner
- scripts/e2e-host-matrix-journey-runner.ts -> bmad-speckit main-agent e2e-host-matrix-journey-runner
- scripts/final-closeout-evidence-runner.ts -> bmad-speckit main-agent final-closeout-evidence-runner
- scripts/governance-packet-dispatch-worker.ts -> bmad-speckit main-agent governance-packet-dispatch-worker
- scripts/i18n/print-resolved-audit-prompt.ts -> bmad-speckit main-agent print-resolved-audit-prompt
- scripts/i18n/render-audit-block-cli.ts -> bmad-speckit main-agent render-audit-block-cli
- scripts/ingest-implementation-evidence.ts -> bmad-speckit main-agent ingest-implementation-evidence
- scripts/per-must-closure-evidence-index.ts -> bmad-speckit main-agent per-must-closure-evidence-index
- scripts/pre-rerun-anti-false-positive-gate.ts -> bmad-speckit main-agent pre-rerun-anti-false-positive-gate
- scripts/strict-closeout-proof-gate.ts -> bmad-speckit main-agent strict-closeout-proof-gate
- scripts/target-artifact-realization-gate.ts -> bmad-speckit main-agent target-artifact-realization-gate
- scripts/trace-040-evidence-packet-generator.ts -> bmad-speckit main-agent trace-040-evidence-packet-generator
- scripts/update-runtime-audit-index.ts -> bmad-speckit main-agent update-runtime-audit-index
- scripts/verify-cursor-audit-granularity.ts -> bmad-speckit main-agent verify-cursor-audit-granularity

## Deterministic Exclusions

- scripts/audit-scoring-convergence-policy.ts -> repo_internal_reclassify: policy library with no direct consumer CLI entrypoint
- scripts/audit-triad-orchestrator.ts -> repo_internal_reclassify: audit orchestration library functions without direct CLI dispatch
- scripts/controlled-readiness-audit-bridge.ts -> repo_internal_reclassify: controlled writer bridge library invoked by source runtime
- scripts/critical-auditor-profile.ts -> repo_internal_reclassify: profile resolver library with no package CLI surface
- scripts/governance-host-dispatch-adapter.ts -> repo_internal_reclassify: host dispatch adapter library with no direct CLI entrypoint
- scripts/host-runtime-mode.ts -> repo_internal_reclassify: runtime mode decision helper with no direct CLI entrypoint
- scripts/i18n/resolve-audit-prompt-path.ts -> repo_internal_reclassify: i18n resolver library used by runtime surfaces
- scripts/parse-bmad-audit-result.ts -> repo_internal_reclassify: audit parser library with no direct CLI entrypoint
- scripts/party-mode-gate-check.ts -> deprecated_no_migration: repo-source debugging wrapper; installed party-mode runtime must not require project-root scripts
- scripts/reviewer-contract.ts -> repo_internal_reclassify: reviewer contract constants and type definitions
- scripts/reviewer-registry.ts -> repo_internal_reclassify: reviewer registry data and lookup library
- scripts/reviewer-rollout-gate.ts -> repo_internal_reclassify: reviewer rollout gate library with no direct CLI entrypoint
- scripts/reviewer-runtime-definition.ts -> repo_internal_reclassify: reviewer runtime definition materializer helper
- scripts/reviewer-schema.ts -> repo_internal_reclassify: reviewer schema constants and validators
- scripts/run-ci-release-gate-fixture.js -> deprecated_no_migration: source-repository CI fixture command, not a consumer runtime command
- scripts/subagent-evidence-envelope.ts -> repo_internal_reclassify: subagent evidence schema and validator library
- scripts/supervised-worker-runtime.ts -> repo_internal_reclassify: supervised worker helper library with no direct CLI entrypoint

## Commands

- CMD-13: exitCode=0, stdoutHash=sha256:1132001f2974331a564721944d973fd486cfc6368047b60dcb3aece9863a24ef, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-14: exitCode=0, stdoutHash=sha256:ed530f3177fe1e15a1bb08087671854c4eece0b4a1b15cdad80c02c43494b153, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-15: exitCode=0, stdoutHash=sha256:bb02edb5560f11abd9786d2bfccee82fa68aaa262390957eb9b191307c45a1ed, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-16: exitCode=0, stdoutHash=sha256:e1c703487847a33b12f344d68bdf0964eeed158211f94ee54b00de7f227803fc, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-17: exitCode=0, stdoutHash=sha256:26401795438f3247280554f219933c4024b980b3fb420280a40defbf4664cbde, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
