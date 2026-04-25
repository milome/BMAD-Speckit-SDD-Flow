# Consumer Governance Validation Reference

## Status

This document is kept only as a **historical / forensic reference** for the pre-hard-cut worker-era runtime.

It does **not** define the current accepted runtime path.

## What Changed

Historically, consumer validation focused on:

1. `pre-continue-check`
2. `post-tool-use`
3. background worker queue draining
4. execution record auto-progression
5. packet closure through worker-driven rerun flow

That model is now archived.

## Current Accepted Runtime Proof

Current proof must instead show:

1. hooks emit `orchestration_state` and `pending_packet`
2. `main-agent-orchestration inspect` returns authoritative surface
3. `main-agent-orchestration dispatch-plan` materializes a bounded packet when needed
4. the main Agent consumes packet and dispatches child work
5. the main Agent re-reads state and decides the next branch
6. `fallbackAutonomousMode=false`

## Legacy Terms

The following legacy terms may still appear in old reports and fixtures:

- `background worker`
- `queue/done`
- `pending_dispatch`
- `running`
- `gate_passed`

They are still useful for reading historical evidence, but they are no longer the product truth surface.

## Migration Rule

If an old consumer doc or skill says success requires:

- worker queue draining
- execution record auto-progression
- autonomous fallback reaching `gate_passed`

then that document must be treated as **outdated** and migrated to the current main-agent path.
