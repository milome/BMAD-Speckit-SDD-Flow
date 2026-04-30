# Long-Run Runtime Policy

`LongRunPolicy` is the only machine-readable contract for autonomous long-run execution.
The canonical implementation is `scripts/long-run-runtime-policy.ts`.

Required fields:

- `tick_interval_ms`
- `progress_probe_every_n_ticks`
- `max_no_progress_ticks`
- `lease_ttl_ms`
- `heartbeat_interval_ms`
- `heartbeat_timeout_ms`
- `max_retries_by_error_class`
- `cooldown_ms_by_error_class`
- `degradation_policy`
- `resume_policy`
- `checkpoint_every_n_ticks`
- `compaction_threshold_tokens`

Runtime state requirements:

- `orchestrationState.longRun` records `policyVersion`, `policyHash`, `loop_seq`, `running_for_ms`, `last_tick_ts`, `last_progress_ts`, `degradation_level`, `active_host_mode`, `resume_count`, and `resumed_from_checkpoint`.
- Each active `pendingPacket` records `lease_owner`, `lease_expires_ts`, `last_heartbeat_ts`, `heartbeat_seq`, `retry_count`, and `stale_recovered_count`.
- Resume must preserve `loop_seq`, `retry_count`, `originalExecutionPacketId`, and `gatesLoop`; it must increment `resume_count` and set `resumed_from_checkpoint`.

Fail-closed rules:

- A missing required policy field fails the contract.
- Lease, heartbeat, degradation, or resume behavior that cannot be replayed from artifacts fails the contract.
- Main loop, recovery, and chaos checks must consume this policy rather than a parallel policy source.
