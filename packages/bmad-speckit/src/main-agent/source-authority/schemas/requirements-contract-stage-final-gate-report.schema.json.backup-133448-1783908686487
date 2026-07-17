{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "requirements-contract-stage-final-gate-report/v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "contractHash",
    "frozenUniverseHash",
    "requirementSetId",
    "transactionId",
    "implementationAttemptId",
    "auditAttemptId",
    "consumerIdentityHash",
    "artifactHashes",
    "completionDecisions",
    "stageFiveStarCount",
    "stageBelowFiveStarCount",
    "openGapCount",
    "invalidatedStageCount",
    "evidenceFabricationCount",
    "antiFabricationMetrics",
    "requiredCoverage",
    "terminalExpectation",
    "terminalReceiptPending",
    "residualRisks",
    "reportHash",
    "decision"
  ],
  "properties": {
    "schemaVersion": { "const": "requirements-contract-stage-final-gate-report/v1" },
    "contractHash": { "$ref": "#/$defs/hash" },
    "frozenUniverseHash": { "$ref": "#/$defs/hash" },
    "requirementSetId": { "type": "string", "minLength": 1 },
    "transactionId": { "type": "string", "minLength": 1 },
    "implementationAttemptId": { "type": "string", "minLength": 1 },
    "auditAttemptId": { "type": "string", "minLength": 1 },
    "consumerIdentityHash": { "$ref": "#/$defs/hash" },
    "artifactHashes": {
      "type": "object",
      "minProperties": 5,
      "additionalProperties": { "$ref": "#/$defs/hash" }
    },
    "completionDecisions": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "contractCompletenessDecision",
        "allTaskDecision",
        "allAcceptanceDecision",
        "allTraceDecision",
        "allSourceObligationDecision",
        "allCommandReceiptDecision",
        "allEvidenceDecision",
        "allArtifactReadbackDecision",
        "allCriticalMetricDecision",
        "realConsumerJourneyDecision",
        "finalJudgeDecision",
        "deterministicAcceptanceGate"
      ],
      "properties": {
        "contractCompletenessDecision": { "enum": ["pass", "block"] },
        "allTaskDecision": { "enum": ["pass", "block"] },
        "allAcceptanceDecision": { "enum": ["pass", "block"] },
        "allTraceDecision": { "enum": ["pass", "block"] },
        "allSourceObligationDecision": { "enum": ["pass", "block"] },
        "allCommandReceiptDecision": { "enum": ["pass", "block"] },
        "allEvidenceDecision": { "enum": ["pass", "block"] },
        "allArtifactReadbackDecision": { "enum": ["pass", "block"] },
        "allCriticalMetricDecision": { "enum": ["pass", "block"] },
        "realConsumerJourneyDecision": { "enum": ["pass", "block"] },
        "finalJudgeDecision": { "enum": ["pass", "block", "inconclusive"] },
        "deterministicAcceptanceGate": { "enum": ["pass", "block"] }
      }
    },
    "stageFiveStarCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "stageBelowFiveStarCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "openGapCount": { "type": "integer", "minimum": 0 },
    "invalidatedStageCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "evidenceFabricationCount": { "type": "integer", "minimum": 0 },
    "antiFabricationMetrics": { "$ref": "#/$defs/antiFabricationMetrics" },
    "requiredCoverage": { "$ref": "#/$defs/requiredCoverage" },
    "terminalExpectation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["cwd", "orderedCommandIds", "argvHashes", "receiptPath", "receiptSchemaVersion"],
      "properties": {
        "cwd": { "type": "string", "minLength": 1 },
        "orderedCommandIds": { "const": ["CMD-24", "CMD-25"] },
        "argvHashes": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": { "$ref": "#/$defs/hash" }
        },
        "receiptPath": { "type": "string", "minLength": 1 },
        "receiptSchemaVersion": { "type": "string", "minLength": 1 }
      }
    },
    "terminalReceiptPending": { "type": "boolean" },
    "residualRisks": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "reportHash": { "$ref": "#/$defs/hash" },
    "decision": { "enum": ["block", "preterminal_pass_candidate"] }
  },
  "$defs": {
    "hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "zero": { "type": "integer", "minimum": 0 },
    "antiFabricationMetrics": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "stageScoreFabricationCount",
        "stagePredicateDeletionCount",
        "stageApplicabilityEscapeCount",
        "stageStaleEvidenceReuseCount",
        "stageCrossAttemptEvidenceCount",
        "stageSelfReportedEvidenceAcceptCount",
        "stageAllToAllEvidenceBindingCount",
        "stageManualReceiptFabricationCount",
        "stageTestWeakeningCount",
        "stageUnauthorizedSkipCount",
        "stageDeterministicBlockOverrideCount"
      ],
      "properties": {
        "stageScoreFabricationCount": { "$ref": "#/$defs/zero" },
        "stagePredicateDeletionCount": { "$ref": "#/$defs/zero" },
        "stageApplicabilityEscapeCount": { "$ref": "#/$defs/zero" },
        "stageStaleEvidenceReuseCount": { "$ref": "#/$defs/zero" },
        "stageCrossAttemptEvidenceCount": { "$ref": "#/$defs/zero" },
        "stageSelfReportedEvidenceAcceptCount": { "$ref": "#/$defs/zero" },
        "stageAllToAllEvidenceBindingCount": { "$ref": "#/$defs/zero" },
        "stageManualReceiptFabricationCount": { "$ref": "#/$defs/zero" },
        "stageTestWeakeningCount": { "$ref": "#/$defs/zero" },
        "stageUnauthorizedSkipCount": { "$ref": "#/$defs/zero" },
        "stageDeterministicBlockOverrideCount": { "$ref": "#/$defs/zero" }
      }
    },
    "requiredCoverage": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "stageFiveStarCoverage",
        "stageRegistryCoverage",
        "stageCommandReceiptCoverage",
        "stageArtifactReadbackCoverage",
        "realConsumerJourneyCoverage"
      ],
      "properties": {
        "stageFiveStarCoverage": { "enum": [0, 1] },
        "stageRegistryCoverage": { "enum": [0, 1] },
        "stageCommandReceiptCoverage": { "enum": [0, 1] },
        "stageArtifactReadbackCoverage": { "enum": [0, 1] },
        "realConsumerJourneyCoverage": { "enum": [0, 1] }
      }
    }
  }
}
