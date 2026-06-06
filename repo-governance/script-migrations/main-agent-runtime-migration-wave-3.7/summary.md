# Main Agent Runtime Migration Wave 3.7 Summary

Wave ID: main-agent-runtime-migration-wave-3.7
Contract: docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md
Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/evidence.json
Mode: final

## Scope

Wave 3.7 hardens the package install/runtime dispatch surface for exactly the eight P2 scripts in the frozen P1-P4 goal contract.
It does not assert that every source repository scripts/* consumer can run directly in consumer projects.
Root scripts are retained as source-repository development files.

## Runtime Proof

usedRootScript: false
usedTsx: false
usedTsNode: false
usedCompiledFallback: false
rootScriptsDeleted: false
rootScriptDeletionApproved: false
Deletion is not approved.

## Entries

- scripts/initialize-six-model-requirement-confirmation.ts -> bmad-speckit main-agent initialize-six-model-requirement-confirmation
- scripts/reconfirmation-runtime.ts -> bmad-speckit main-agent reconfirmation-runtime
- scripts/requirement-record-control-store.ts -> bmad-speckit main-agent requirement-record-control-store
- scripts/requirement-record-live-schema-gate.ts -> bmad-speckit main-agent requirement-record-live-schema-gate
- scripts/requirement-record-schema-evolution.ts -> bmad-speckit main-agent requirement-record-schema-evolution
- scripts/resolve-active-requirement.ts -> bmad-speckit main-agent resolve-active-requirement
- scripts/runtime-scoring-data-path.ts -> bmad-speckit main-agent runtime-scoring-data-path
- scripts/six-model-runtime-decision.ts -> bmad-speckit main-agent six-model-runtime-decision

## Commands

- CMD-08: exitCode=0, stdoutHash=sha256:30a75f932c7316911e359b0cf2f44bc64f6cabe4ffac9c3a14a2e9c30b0d41f6, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-09: exitCode=0, stdoutHash=sha256:12293c944e7eba47668bc02b88d9db2f6094b433b21502a55b1cdbf566b9ae82, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-10: exitCode=0, stdoutHash=sha256:86f47ed80ebfcfa43ac4e71b599ee8471efdc324403fd6b2c99a170fd6a855b2, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-11: exitCode=0, stdoutHash=sha256:8929db5869b4fa680a930ccd8a74c2dc1f50fc4fc91f1fa36ea82a2c98903cc0, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-12: exitCode=0, stdoutHash=sha256:0997fe0ada06f45d7594ab3f83a16cbef617fc3bd7a20afa124661e2294ebd47, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
