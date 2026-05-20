# TRACE-035 Diff Summary

- Added subagentEvidenceEnvelope schema, builder, validator, artifact refs, and acceptance CLI.
- Extended controlled ingest to validate subagentEvidenceEnvelope and append subagent_evidence_envelope_recorded into executionIterations.
- Extended RequirementRecord schema for subagent evidence envelope events.
- Updated Codex worker adapter to emit accepted envelopes only when hash context and trace/task/requirement bindings are present, and to fail closed otherwise.
- Added tests for TaskReport boundary, forbidden fields, hash/attempt mismatch, artifact indexing, and adapter fail-closed behavior.
