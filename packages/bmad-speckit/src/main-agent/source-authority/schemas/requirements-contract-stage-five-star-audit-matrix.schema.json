{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "requirements-contract-stage-five-star-audit-matrix/v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "contractHash",
    "frozenUniverseHash",
    "stageRegistryHash",
    "sourceHashes",
    "semanticModelHashes",
    "requirementSetId",
    "transactionId",
    "implementationAttemptId",
    "auditAttemptId",
    "consumerIdentityHash",
    "taskOwnerStageRegistry",
    "rows",
    "rowSetHash",
    "matrixHash",
    "stageFiveStarCount",
    "stageBelowFiveStarCount",
    "invalidatedStageCount",
    "decision"
  ],
  "properties": {
    "schemaVersion": { "const": "requirements-contract-stage-five-star-audit-matrix/v1" },
    "contractHash": { "$ref": "#/$defs/hash" },
    "frozenUniverseHash": { "$ref": "#/$defs/hash" },
    "stageRegistryHash": { "$ref": "#/$defs/hash" },
    "sourceHashes": { "$ref": "#/$defs/hashMap" },
    "semanticModelHashes": { "$ref": "#/$defs/hashMap" },
    "requirementSetId": { "type": "string", "minLength": 1 },
    "transactionId": { "type": "string", "minLength": 1 },
    "implementationAttemptId": { "type": "string", "minLength": 1 },
    "auditAttemptId": { "type": "string", "minLength": 1 },
    "consumerIdentityHash": { "$ref": "#/$defs/hash" },
    "taskOwnerStageRegistry": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "G00",
        "G01",
        "G02",
        "G03",
        "G04",
        "G05",
        "G06",
        "G07",
        "G08",
        "G09",
        "G10",
        "G11",
        "G12",
        "G13",
        "G14",
        "G15"
      ],
      "properties": {
        "G00": { "const": "STAGE-01" },
        "G01": { "const": "STAGE-03" },
        "G02": { "const": "STAGE-03" },
        "G03": { "const": "STAGE-04" },
        "G04": { "const": "STAGE-04" },
        "G05": { "const": "STAGE-07" },
        "G06": { "const": "STAGE-09" },
        "G07": { "const": "STAGE-10" },
        "G08": { "const": "STAGE-08" },
        "G09": { "const": "STAGE-05" },
        "G10": { "const": "STAGE-06" },
        "G11": { "const": "STAGE-02" },
        "G12": { "const": "STAGE-10" },
        "G13": { "const": "STAGE-10" },
        "G14": { "const": "STAGE-10" },
        "G15": { "const": "STAGE-11" }
      }
    },
    "rows": {
      "type": "array",
      "minItems": 11,
      "maxItems": 11,
      "uniqueItems": true,
      "items": { "$ref": "#/$defs/row" }
    },
    "rowSetHash": { "$ref": "#/$defs/hash" },
    "matrixHash": { "$ref": "#/$defs/hash" },
    "stageFiveStarCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "stageBelowFiveStarCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "invalidatedStageCount": { "type": "integer", "minimum": 0, "maximum": 11 },
    "decision": { "enum": ["PASS", "BLOCK"] }
  },
  "$defs": {
    "hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "hashMap": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": { "$ref": "#/$defs/hash" }
    },
    "refs": { "type": "array", "items": { "type": "string", "minLength": 1 }, "uniqueItems": true },
    "nonEmptyRefs": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    },
    "stageIdentity": {
      "oneOf": [
        {
          "properties": {
            "stageId": { "const": "STAGE-01" },
            "stageName": { "const": "Main-session requirement intake" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-02" },
            "stageName": { "const": "BMAD Product PRD" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-03" },
            "stageName": { "const": "Requirement Source PRD" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-04" },
            "stageName": { "const": "cp-00 through cp-08" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-05" },
            "stageName": { "const": "Requirements confirmation page" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-06" },
            "stageName": { "const": "Architecture confirmation page" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-07" },
            "stageName": { "const": "AI-TDD readiness" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-08" },
            "stageName": { "const": "Dispatch and prompts" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-09" },
            "stageName": { "const": "Execution closure" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-10" },
            "stageName": { "const": "Delivery audit and evidence chain" }
          }
        },
        {
          "properties": {
            "stageId": { "const": "STAGE-11" },
            "stageName": { "const": "Final delivery confirmation page" }
          }
        }
      ]
    },
    "row": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "stageId",
        "stageName",
        "contractRefs",
        "sourceObligationRefs",
        "acceptanceRefs",
        "traceRefs",
        "star1Decision",
        "star2Decision",
        "star3Decision",
        "star4Decision",
        "star5Decision",
        "stageScore",
        "commandReceiptRefs",
        "artifactRefs",
        "independentEvidenceRefs",
        "consumerJourneyEvidenceRefs",
        "failedPredicateIds",
        "blockers",
        "auditAttemptId"
      ],
      "properties": {
        "stageId": { "pattern": "^STAGE-(?:0[1-9]|1[01])$" },
        "stageName": { "type": "string", "minLength": 1 },
        "contractRefs": { "$ref": "#/$defs/nonEmptyRefs" },
        "sourceObligationRefs": { "$ref": "#/$defs/refs" },
        "acceptanceRefs": { "$ref": "#/$defs/refs" },
        "traceRefs": { "$ref": "#/$defs/refs" },
        "star1Decision": { "enum": ["PASS", "BLOCK"] },
        "star2Decision": { "enum": ["PASS", "BLOCK"] },
        "star3Decision": { "enum": ["PASS", "BLOCK"] },
        "star4Decision": { "enum": ["PASS", "BLOCK"] },
        "star5Decision": { "enum": ["PASS", "BLOCK"] },
        "stageScore": { "type": "integer", "minimum": 0, "maximum": 5 },
        "commandReceiptRefs": { "$ref": "#/$defs/refs" },
        "artifactRefs": { "$ref": "#/$defs/refs" },
        "independentEvidenceRefs": { "$ref": "#/$defs/refs" },
        "consumerJourneyEvidenceRefs": { "$ref": "#/$defs/refs" },
        "failedPredicateIds": { "$ref": "#/$defs/refs" },
        "blockers": { "$ref": "#/$defs/refs" },
        "auditAttemptId": { "type": "string", "minLength": 1 }
      },
      "allOf": [
        { "$ref": "#/$defs/stageIdentity" },
        {
          "if": { "properties": { "star1Decision": { "const": "PASS" } } },
          "then": { "properties": { "contractRefs": { "$ref": "#/$defs/nonEmptyRefs" } } }
        },
        {
          "if": { "properties": { "star2Decision": { "const": "PASS" } } },
          "then": {
            "properties": {
              "sourceObligationRefs": { "$ref": "#/$defs/nonEmptyRefs" },
              "acceptanceRefs": { "$ref": "#/$defs/nonEmptyRefs" },
              "traceRefs": { "$ref": "#/$defs/nonEmptyRefs" }
            }
          }
        },
        {
          "if": { "properties": { "star3Decision": { "const": "PASS" } } },
          "then": { "properties": { "commandReceiptRefs": { "$ref": "#/$defs/nonEmptyRefs" } } }
        },
        {
          "if": { "properties": { "star4Decision": { "const": "PASS" } } },
          "then": {
            "properties": {
              "artifactRefs": { "$ref": "#/$defs/nonEmptyRefs" },
              "independentEvidenceRefs": { "$ref": "#/$defs/nonEmptyRefs" }
            }
          }
        },
        {
          "if": { "properties": { "star5Decision": { "const": "PASS" } } },
          "then": {
            "properties": { "consumerJourneyEvidenceRefs": { "$ref": "#/$defs/nonEmptyRefs" } }
          }
        },
        {
          "if": {
            "required": [
              "star1Decision",
              "star2Decision",
              "star3Decision",
              "star4Decision",
              "star5Decision"
            ],
            "properties": {
              "star1Decision": { "const": "PASS" },
              "star2Decision": { "const": "PASS" },
              "star3Decision": { "const": "PASS" },
              "star4Decision": { "const": "PASS" },
              "star5Decision": { "const": "PASS" }
            }
          },
          "then": {
            "properties": {
              "stageScore": { "const": 5 },
              "failedPredicateIds": { "maxItems": 0 },
              "blockers": { "maxItems": 0 }
            }
          },
          "else": {
            "not": { "properties": { "stageScore": { "const": 5 } }, "required": ["stageScore"] }
          }
        }
      ]
    }
  }
}
