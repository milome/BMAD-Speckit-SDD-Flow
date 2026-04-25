# Speckit-Workflow Main-Agent Smoke

**Date**: 2026-04-25  
**Report JSON**: [live-smoke-report.json](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-25-speckit-workflow-main-agent-smoke/live-smoke-report.json)

## Scope

This smoke proves the current `speckit-workflow` contract is aligned with the accepted main-agent runtime path:

1. active Cursor skill surface contains `main-agent-orchestration`
2. active Claude skill surface contains `main-agent-orchestration`
3. repo-native `dispatch-plan` works on a speckit-style implement fixture
4. follow-up `inspect` shows `pendingPacketStatus=ready_for_main_agent`

## Summary

Final operational result:

1. `4` checks passed
2. `0` checks failed

## Commands Proven

### Skill Surface Contract

Verified:

1. active Cursor `speckit-workflow` skill contains `main-agent-orchestration`
2. active Claude `speckit-workflow` skill contains `main-agent-orchestration`
3. both active skill surfaces contain `dispatch-plan`
4. both active skill surfaces contain `pendingPacketStatus`

### Repo-native Runtime Surface

Verified:

```bash
npm run main-agent-orchestration -- --cwd <fixture-root> --action dispatch-plan
npm run main-agent-orchestration -- --cwd <fixture-root> --action inspect
```

Observed:

1. `dispatch-plan` returned exit `0`
2. dispatch plan emitted a packet path
3. dispatch plan resolved `dispatch_implement`
4. follow-up `inspect` showed `pendingPacketStatus=ready_for_main_agent`

## Accepted Interpretation

`speckit-workflow` itself is a skill/document contract, not an executable transport.

Therefore this smoke proves two things together:

1. the skill text now requires main-agent orchestration
2. the executable runtime surface behind that contract is live
