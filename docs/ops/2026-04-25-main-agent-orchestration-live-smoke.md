# Main Agent Orchestration Live Smoke

**Date**: 2026-04-25  
**Report JSON**: [live-smoke-report.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-25-main-agent-e2e-orchestration-runtime/live-smoke-report.json)

## Summary

Final operational result:

1. `7` checks passed
2. `1` check warned
3. `0` checks failed

## Commands Proven

### Real Claude CLI

Verified:

```bash
claude -p --output-format json --dangerously-skip-permissions --permission-mode bypassPermissions "Reply with exactly: CLAUDE_SMOKE_OK"
```

Observed:

1. exit `0`
2. result contained `CLAUDE_SMOKE_OK`

### Real Cursor Installation

Verified:

```bash
cursor --help
cursor agent --help
```

Observed:

1. Cursor CLI is installed
2. Cursor reports `agent` as a subcommand in help text

### Real Claude Hook Path

Verified:

1. real `.claude` hook entry
2. blocked story implement path
3. `continue=false`
4. `orchestration_state`
5. `pending_packet`

### Real Cursor Hook Path

Verified:

1. real `.cursor` hook entry
2. blocked story implement path
3. blocked bugfix implement path
4. `continue=false`
5. `orchestration_state`
6. `pending_packet`

### Official Repo-native Main Agent Entry

Verified:

```bash
npm run main-agent-orchestration -- --cwd <fixture-root> --action dispatch-plan
```

Observed:

1. exit `0`
2. dispatch plan JSON emitted
3. route resolved to host-native transport
4. packet path emitted

## Warning

### Cursor Terminal Agent Surface

The machine-local Cursor terminal `agent` surface remains unstable in terminal automation mode.

Observed result:

1. Cursor CLI exists
2. `cursor agent --help` is advertised
3. actual terminal execution still returns an `EINVAL` launch failure on this machine

Interpretation:

> Cursor IDE host-hook integration is proven.  
> Cursor terminal-agent prompt mode is not accepted as a stable operational surface on this machine.

This warning does **not** block the final repository-side main-agent orchestration result, because the final accepted path is:

1. main-agent repo-native orchestration surface
2. real `.cursor/.claude` hook integration
3. no autonomous fallback execution

## Conclusion

The final repository-side main-agent orchestration runtime now has operational proof across:

1. real Claude CLI liveness
2. real Cursor installation liveness
3. real Claude hook blocked-flow handoff
4. real Cursor hook blocked-flow handoff
5. official repo-native `main-agent-orchestration` npm entry

The only remaining operational note is the machine-local instability of Cursor terminal-agent prompt automation, which is outside the accepted final runtime path.
