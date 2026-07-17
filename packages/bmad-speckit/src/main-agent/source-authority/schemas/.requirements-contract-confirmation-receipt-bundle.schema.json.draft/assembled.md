{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "requirements-contract-confirmation-receipt-bundle/v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "contractHash",
    "sourceHash",
    "semanticModelHash",
    "requirementSetId",
    "transactionId",
    "implementationAttemptId",
    "auditAttemptId",
    "stageRegistryHash",
    "authorizationSourceHash",
    "receipts",
    "bundleHash",
    "decision"
  ],
  "properties": {
    "schemaVersion": { "const": "requirements-contract-confirmation-receipt-bundle/v1" },
    "contractHash": { "$ref": "#/$defs/hash" },
    "sourceHash": { "$ref": "#/$defs/hash" },
    "semanticModelHash": { "$ref": "#/$defs/hash" },
    "requirementSetId": { "type": "string", "minLength": 1 },
    "transactionId": { "type": "string", "minLength": 1 },
    "implementationAttemptId": { "type": "string", "minLength": 1 },
    "auditAttemptId": { "type": "string", "minLength": 1 },
    "stageRegistryHash": { "$ref": "#/$defs/hash" },
    "authorizationSourceHash": { "$ref": "#/$defs/hash" },
    "receipts": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "uniqueItems": true,
      "items": { "$ref": "#/$defs/receipt" },
      "allOf": [
        {
          "contains": {
            "properties": { "pageKind": { "const": "requirements" } },
            "required": ["pageKind"]
          },
          "minContains": 1,
          "maxContains": 1
        },
        {
          "contains": {
            "properties": { "pageKind": { "const": "architecture" } },
            "required": ["pageKind"]
          },
          "minContains": 1,
          "maxContains": 1
        },
        {
          "contains": {
            "properties": { "pageKind": { "const": "final_delivery" } },
            "required": ["pageKind"]
          },
          "minContains": 1,
          "maxContains": 1
        }
      ]
    },
    "bundleHash": { "$ref": "#/$defs/hash" },
    "decision": { "enum": ["PASS", "BLOCK"] }
  },
  "$defs": {
    "hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "receipt": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "pageKind",
        "pagePath",
        "pageHash",
        "receiptPath",
        "receiptHash",
        "sourceHash",
        "semanticModelHash",
        "requirementSetId",
        "transactionId",
        "implementationAttemptId",
        "auditAttemptId",
        "stageRegistryHash",
        "contentValidationReceiptRef",
        "safeWriteReceiptRef",
        "publicationReceiptRef",
        "readbackReceiptRef",
        "confirmedAt"
      ],
      "properties": {
        "pageKind": { "enum": ["requirements", "architecture", "final_delivery"] },
        "pagePath": { "type": "string", "minLength": 1 },
        "pageHash": { "$ref": "#/$defs/hash" },
        "receiptPath": { "type": "string", "minLength": 1 },
        "receiptHash": { "$ref": "#/$defs/hash" },
        "sourceHash": { "$ref": "#/$defs/hash" },
        "semanticModelHash": { "$ref": "#/$defs/hash" },
        "requirementSetId": { "type": "string", "minLength": 1 },
        "transactionId": { "type": "string", "minLength": 1 },
        "implementationAttemptId": { "type": "string", "minLength": 1 },
        "auditAttemptId": { "type": "string", "minLength": 1 },
        "stageRegistryHash": { "$ref": "#/$defs/hash" },
        "contentValidationReceiptRef": { "type": "string", "minLength": 1 },
        "safeWriteReceiptRef": { "type": "string", "minLength": 1 },
        "publicationReceiptRef": { "type": "string", "minLength": 1 },
        "readbackReceiptRef": { "type": "string", "minLength": 1 },
        "preConfirmationEvidenceSetHash": { "$ref": "#/$defs/hash" },
        "preConfirmationStageSnapshotHash": { "$ref": "#/$defs/hash" },
        "confirmedAt": { "type": "string", "format": "date-time" }
      },
      "allOf": [
        {
          "if": {
            "properties": { "pageKind": { "const": "final_delivery" } },
            "required": ["pageKind"]
          },
          "then": {
            "required": ["preConfirmationEvidenceSetHash", "preConfirmationStageSnapshotHash"]
          },
          "else": {
            "not": {
              "anyOf": [
                { "required": ["preConfirmationEvidenceSetHash"] },
                { "required": ["preConfirmationStageSnapshotHash"] }
              ]
            }
          }
        }
      ]
    }
  }
}
