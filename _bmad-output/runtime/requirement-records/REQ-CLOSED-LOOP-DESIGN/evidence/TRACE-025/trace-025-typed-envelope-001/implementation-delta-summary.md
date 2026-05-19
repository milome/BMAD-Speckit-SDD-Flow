# TRACE-025 Typed Governance Transport Envelope Delta

- Added GovernanceTransportEnvelope validation for eventType-specific payloadKind and control fields.
- no-hook execution ingestion now accepts typed envelopes with status/payload instead of a generic result field.
- Codex no-hook worker adapter now emits a validated execution_iteration_recorded transport envelope.
