{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "requirements-contract-stage-gap-ledger/v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "contractHash",
    "frozenUniverseHash",
    "transactionId",
    "implementationAttemptId",
    "auditAttemptId",
    "gaps",
    "invalidations",
    "openGapCount",
    "closedGapCount",
    "invalidatedStageCount",
    "ledgerHash",
    "decision"
  ],
  "properties": {
    "schemaVersion": { "const": "requirements-contract-stage-gap-ledger/v1" },
    "contractHash": { "$ref": "#/$defs/hash" },
    "frozenUniverseHash": { "$ref": "#/$defs/hash" },
    "transactionId": { "type": "string", "minLength": 1 },
    "implementationAttemptId": { "type": "string", "minLength": 1 },
    "auditAttemptId": { "type": "string", "minLength": 1 },
    "gaps": { "type": "array", "items": { "$ref": "#/$defs/gap" } },
    "invalidations": { "type": "array", "items": { "$ref": "#/$defs/invalidation" } },
    "openGapCount": { "type": "integer", "minimum": 0 },
    "closedGapCount": { "type": "integer", "minimum": 0 },
    "invalidatedStageCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "ledgerHash": { "$ref": "#/$defs/hash" },
    "decision": { "enum": ["PASS", "BLOCK"] }
  },
  "$defs": {
    "hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "refs": { "type": "array", "items": { "type": "string", "minLength": 1 }, "uniqueItems": true },
    "nonEmptyRefs": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "status": {
      "enum": [
        "open",
        "red_dispositioned",
        "remediated_pending_verification",
        "verified_pending_reaudit",
        "blocked_semantic",
        "blocked_environment",
        "closed"
      ]
    },
    "transition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "fromStatus",
        "toStatus",
        "auditAttemptId",
        "receiptRef",
        "transitionHash",
        "createdAt"
      ],
      "properties": {
        "fromStatus": {
          "enum": [
            "none",
            "open",
            "red_dispositioned",
            "remediated_pending_verification",
            "verified_pending_reaudit",
            "blocked_semantic",
            "blocked_environment",
            "closed"
          ]
        },
        "toStatus": { "$ref": "#/$defs/status" },
        "auditAttemptId": { "type": "string", "minLength": 1 },
        "receiptRef": { "type": "string", "minLength": 1 },
        "transitionHash": { "$ref": "#/$defs/hash" },
        "createdAt": { "type": "string", "format": "date-time" }
      }
    },
    "gap": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "gapId",
        "stageId",
        "failedStar",
        "failedPredicate",
        "contractRefs",
        "acceptanceRefs",
        "traceRefs",
        "observedEvidence",
        "missingEvidence",
        "counterexample",
        "rootCauseClass",
        "rootCause",
        "affectedProductionPaths",
        "affectedTests",
        "affectedArtifacts",
        "downstreamInvalidationSet",
        "remediationSteps",
        "qualifiedRedRequired",
        "verificationCommands",
        "expectedEvidence",
        "failureSignatureHash",
        "status",
        "statusTransitions"
      ],
      "properties": {
        "gapId": { "type": "string", "pattern": "^GAP-[A-Z0-9-]+$" },
        "stageId": { "type": "string", "pattern": "^STAGE-(?:0[1-9]|1[01])$" },
        "failedStar": { "enum": ["STAR-1", "STAR-2", "STAR-3", "STAR-4", "STAR-5"] },
        "failedPredicate": { "type": "string", "minLength": 1 },
        "contractRefs": { "$ref": "#/$defs/nonEmptyRefs" },
        "acceptanceRefs": { "$ref": "#/$defs/nonEmptyRefs" },
        "traceRefs": { "$ref": "#/$defs/nonEmptyRefs" },
        "observedEvidence": { "$ref": "#/$defs/refs" },
        "missingEvidence": { "$ref": "#/$defs/nonEmptyRefs" },
        "counterexample": { "type": "string", "minLength": 1 },
        "rootCauseClass": {
          "enum": [
            "implementation_defect",
            "test_or_oracle_defect",
            "evidence_pipeline_defect",
            "authority_or_semantic_gap",
            "environment_blocker"
          ]
        },
        "rootCause": {
          "type": "string",
          "minLength": 8,
          "not": {
            "enum": [
              "quality improvement",
              "insufficient coverage",
              "missing evidence",
              "质量需要提升",
              "覆盖不足",
              "证据缺失"
            ]
          }
        },
        "affectedProductionPaths": { "$ref": "#/$defs/refs" },
        "affectedTests": { "$ref": "#/$defs/refs" },
        "affectedArtifacts": { "$ref": "#/$defs/refs" },
        "downstreamInvalidationSet": { "$ref": "#/$defs/refs" },
        "remediationSteps": { "$ref": "#/$defs/nonEmptyRefs" },
        "qualifiedRedRequired": { "type": "boolean" },
        "verificationCommands": { "$ref": "#/$defs/nonEmptyRefs" },
        "expectedEvidence": { "$ref": "#/$defs/nonEmptyRefs" },
        "failureSignatureHash": { "$ref": "#/$defs/hash" },
        "status": { "$ref": "#/$defs/status" },
        "statusTransitions": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/transition" }
        }
      }
    },
    "invalidation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "invalidationId",
        "changedDependencyRef",
        "changedDependencyHash",
        "invalidatedStageIds",
        "invalidatedReceiptRefs",
        "reachabilityProofRef",
        "auditAttemptId"
      ],
      "properties": {
        "invalidationId": { "type": "string", "minLength": 1 },
        "changedDependencyRef": { "type": "string", "minLength": 1 },
        "changedDependencyHash": { "$ref": "#/$defs/hash" },
        "invalidatedStageIds": {
          "type": "array",
          "items": { "type": "string", "pattern": "^STAGE-(?:0[1-9]|1[01])$" },
          "uniqueItems": true
        },
        "invalidatedReceiptRefs": { "$ref": "#/$defs/refs" },
        "reachabilityProofRef": { "type": "string", "minLength": 1 },
        "auditAttemptId": { "type": "string", "minLength": 1 }
      }
    }
  }
}
