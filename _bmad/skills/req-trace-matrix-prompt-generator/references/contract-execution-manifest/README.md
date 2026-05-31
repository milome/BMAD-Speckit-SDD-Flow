# Contract Execution Manifest

This directory owns the canonical `ContractExecutionManifest` normalization layer.

## Authority Model

- `implementationConfirmation` is the confirmed semantic authority.
- `implementationConfirmation.aiTddContractExecutionManifestProjection` is a YAML authoring projection. It is not the final runtime manifest object.
- Canonical JSON from `build-contract-execution-manifest.js` is the shared machine-readable manifest for AI-TDD gate and req-trace.
- `model_packet.json` remains the machine-readable execution authority for req-trace execution packets.
- `human_prompt.txt` and `goal_execution.md` are projection-only surfaces.

## Required Consumers

- `scripts/ai-tdd-contract-gate.ts` must wrap its manifest output with the shared builder before writing `contractExecutionManifest`.
- `_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js` must build `model_packet.json.contractExecutionManifest` through the shared builder.

## Fail-Closed Drift Cases

The audit blocks when:

- Canonical manifest hashes differ across source projection, req-trace packet, or AI-TDD gate report.
- `recordId`, `sourceDocumentHash`, or `implementationConfirmationHash` disagree where present.
- `closeoutProof.requiredCommands[]` references a missing canonical `requiredCommands[]` ID.
- Legacy aliases such as `commandTargets` and `commandTargetCollection` carry conflicting values.

## Hash Policy

`manifestHash` is computed from normalized canonical JSON with generated hash fields removed. Presentation-only authoring fields such as `title`, `note`, and `description` are ignored. Semantic projection changes must change the hash.
