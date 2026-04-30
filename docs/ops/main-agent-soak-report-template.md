# Main-Agent Soak Report Template

Required machine-readable fields:

- `target_duration_ms`: must be at least 8 hours for release soak.
- `observed_duration_ms`: must be greater than or equal to `target_duration_ms`.
- `manual_restarts`: must be `0`.
- `silent_hangs`: must be `0`.
- `false_completions`: must be `0`.
- `recoveries[]`: each recovery must include `fault_detected_at`, `mitigation_started_at`, and `resumed_at`.
- `recovery_success_rate`: must be greater than or equal to `0.95`.

Each recovery row must prove no duplicate side-effect, no dual owner, and no loss of `originalExecutionPacketId`.
