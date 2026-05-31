# Checkpoint Automation Requirement Fixture

This tracked fixture is the test authority for checkpoint automation coverage. Tests materialize it into a temporary `docs/requirements/**` path before reading runtime-style requirement input.

implementationConfirmation:
  targetModificationPaths:
    - id: TARGET-MOD-001
      path: _bmad/skills/requirements-contract-authoring/scripts/assess_contract_authoring_scale.js
    - id: TARGET-MOD-002
      path: _bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js
    - id: TARGET-MOD-003
      path: _bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown.js
    - id: TARGET-MOD-004
      path: _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts
    - id: TARGET-MOD-005
      path: tests/acceptance/requirements-contract-checkpoint-automation.test.ts
    - id: TARGET-MOD-006
      path: tests/acceptance/render-requirements-confirmation-html.test.ts
    - id: TARGET-MOD-007
      path: tests/fixtures/requirements/REQ-CHECKPOINT-AUTOMATION/source.requirement.md
    - id: TARGET-MOD-008
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_contract_confirmability.js
    - id: TARGET-MOD-009
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_implementation_readiness.js
    - id: TARGET-MOD-010
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_delivery_verification.js
    - id: TARGET-MOD-011
      path: _bmad/skills/requirements-contract-authoring/scripts/audit_closeout_integrity.js
    - id: TARGET-MOD-012
      path: _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js
    - id: TARGET-MOD-013
      path: _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_stage_common.js
    - id: TARGET-MOD-014
      path: _bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md
    - id: TARGET-MOD-015
      path: _bmad/skills/requirements-contract-authoring/SKILL.md
    - id: TARGET-MOD-016
      path: tests/acceptance/reverse-audit-contract.test.ts
    - id: TARGET-MOD-017
      path: tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
    - id: TARGET-MOD-018
      path: scripts/main-agent-implementation-readiness-gate.ts
    - id: TARGET-MOD-019
      path: scripts/main-agent-delivery-closeout-gate.ts
    - id: TARGET-MOD-020
      path: scripts/strict-closeout-proof-gate.ts
    - id: TARGET-MOD-021
      path: scripts/requirement-record-control-store.ts
    - id: TARGET-MOD-022
      path: _bmad/_schemas/requirement-record.schema.json
    - id: TARGET-MOD-023
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-stage-cli-capability-report.json
    - id: TARGET-MOD-024
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/reverse-audit-wrapper-compatibility-report.json
    - id: TARGET-MOD-025
      path: _bmad-output/runtime/requirement-records/<recordId>/authoring/stage-boundary-regression-report.json
    - id: TARGET-MOD-026
      path: scripts/ai-tdd-contract-gate.ts
    - id: TARGET-MOD-027
      path: tests/acceptance/ai-tdd-contract-gate.test.ts
  failurePaths:
    - id: FAIL-001
      linkedNegIds:
        - NEG-001
      linkedEvidenceIds:
        - EVD-FAIL-001
  edgeCases:
    - id: EDGE-001
      linkedFailurePathIds:
        - FAIL-001
      linkedEvidenceIds:
        - EVD-EDGE-001
  acceptanceTests:
    - id: ACC-FAIL-001
      failurePathRefs:
        - FAIL-001
    - id: ACC-EDGE-001
      edgeCaseRefs:
        - EDGE-001
  e2eSuites: []
  traceRows:
    - id: TRACE-FAIL-001
      covers:
        - NEG-001
      evidenceRefs:
        - EVD-FAIL-001
    - id: TRACE-EDGE-001
      covers:
        - NEG-001
      evidenceRefs:
        - EVD-EDGE-001
  sequenceViews:
    - id: SEQ-FAIL-001
      covers:
        - FAIL-001
  flowViews:
    - id: FLOW-EDGE-001
      cases:
        - EDGE-001
  edgeCaseViews: []
  boundaryViews: []
