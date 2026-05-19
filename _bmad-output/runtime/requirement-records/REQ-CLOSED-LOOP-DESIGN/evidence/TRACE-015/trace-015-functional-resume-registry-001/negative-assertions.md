# TRACE-015 Negative Assertions

- Missing `functionalResumeFailureCaseRegistry` blocks resume and is recorded as a functional resume gate failure.
- Failure cases without explicit group ownership are invalid; the checker does not infer grouping by regex or prose.
- Failure cases without `expectedRecoveryActions[]` are invalid.
- Recovery actions that write control fields must bind `recordEventTypes[]`.
- Action event types must exist in the global `governanceEventTypeRegistry[]` and must carry `payloadContract`.
- Packet, task, and worker state remain non-authoritative for resume; the checker anchors resume on traceRows checkpoint and controlled RequirementRecord fields.
- Unexercised failure cases are listed in the coverage matrix and are not silently treated as complete.
