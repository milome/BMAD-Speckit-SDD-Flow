# Main Agent Runtime Migration Wave 3.9 Summary

Wave ID: main-agent-runtime-migration-wave-3.9
Contract: docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md
Evidence: repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/evidence.json
Mode: final

## Scope

P4 durable helpers are copied as package-local helper surfaces.
No P4 helper is exposed as a public main-agent CLI action.
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

## Durable Helper Entries

- scripts/governance-packet-execution-store.ts -> packages/bmad-speckit/src/main-agent/helpers/governance-packet-execution-store.ts (governance-packet-execution-store)
- scripts/governance-packet-reconciler.ts -> packages/bmad-speckit/src/main-agent/helpers/governance-packet-reconciler.ts (governance-packet-reconciler)
- scripts/governance-remediation-artifact.ts -> packages/bmad-speckit/src/main-agent/helpers/governance-remediation-artifact.ts (governance-remediation-artifact)
- scripts/governance-remediation-config.ts -> packages/bmad-speckit/src/main-agent/helpers/governance-remediation-config.ts (governance-remediation-config)
- scripts/governance-remediation-runner.ts -> packages/bmad-speckit/src/main-agent/helpers/governance-remediation-runner.ts (governance-remediation-runner)
- scripts/i18n/agent-display-names.ts -> packages/bmad-speckit/src/main-agent/helpers/agent-display-names.ts (agent-display-names)
- scripts/i18n/load-manifest.ts -> packages/bmad-speckit/src/main-agent/helpers/load-manifest.ts (load-manifest)
- scripts/i18n/party-mode-runtime-assets.ts -> packages/bmad-speckit/src/main-agent/helpers/party-mode-runtime-assets.ts (party-mode-runtime-assets)
- scripts/model-governance-policy-filter.ts -> packages/bmad-speckit/src/main-agent/helpers/model-governance-policy-filter.ts (model-governance-policy-filter)
- scripts/party-mode-runtime.ts -> packages/bmad-speckit/src/main-agent/helpers/party-mode-runtime.ts (party-mode-runtime)
- scripts/prompt-routing-governance.ts -> packages/bmad-speckit/src/main-agent/helpers/prompt-routing-governance.ts (prompt-routing-governance)
- scripts/prompt-routing-hints-schema.ts -> packages/bmad-speckit/src/main-agent/helpers/prompt-routing-hints-schema.ts (prompt-routing-hints-schema)
- scripts/prompt-routing-hints.ts -> packages/bmad-speckit/src/main-agent/helpers/prompt-routing-hints.ts (prompt-routing-hints)
- scripts/skill-inventory-provider.ts -> packages/bmad-speckit/src/main-agent/helpers/skill-inventory-provider.ts (skill-inventory-provider)

## Commands

- CMD-18: exitCode=0, stdoutHash=sha256:e44657c8f4991d13aca296a68d7311b091e82cc5482d0b0ee966b4da8570f859, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-19: exitCode=0, stdoutHash=sha256:264db1207512549fa6102245a9d83df6e44d3a1dc80822a826dd135b58c21457, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-20: exitCode=0, stdoutHash=sha256:bd04c48acae588363ec08c40172ae846e9f98850ee326420e30c5d7d3c9f6c6a, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-21: exitCode=0, stdoutHash=sha256:530e9be7ec2ffca1efde29e943559d9c5fff91e479131972bf189946e59ca1b6, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- CMD-22: exitCode=0, stdoutHash=sha256:37a291177dc64870261d217cabdfe7a659ace1757d814ec04e4687228e4684eb, stderrHash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
