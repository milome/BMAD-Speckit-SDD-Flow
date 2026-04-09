---
name: consumer-governance-validation
description: Use when changing runtime hooks, runtime-emit bundles, init deployment, or governance queue/worker/dispatch/ingestor logic and needing to verify a real consumer project reaches pre-continue, post-tool-use, background worker queue draining, execution record creation, and packet closure to gate_passed.
---

# Consumer Governance Validation

验证 hook / runtime governance 改动是否在真实 consumer 项目上形成执行闭环，而不是只在本仓库测试里通过。

## When to Use

- 改了 `.claude/hooks` / `.cursor/hooks`
- 改了 `packages/runtime-emit`
- 改了 `scripts/init-to-root.js` 或 `bmad-speckit-init`
- 改了 governance queue / worker / dispatch / ingestor / packet 闭环
- 需要确认真实 consumer 上 `gates loop` 和 packet closure 仍然健康

## Quick Start

优先直接跑自动验证脚本：

```powershell
# 在源仓库内
pwsh -NoProfile -File scripts/validate-consumer-governance.ps1 -ConsumerRoot <consumer-root>

# 在已安装 consumer 内
pwsh -NoProfile -File node_modules/bmad-speckit-sdd-flow/scripts/validate-consumer-governance.ps1 -ConsumerRoot <consumer-root>
```

期待至少看到：

- `verify-pre-continue-check`
- `verify-post-tool-use-and-background-worker`
- `verify-execution-closure`
- summary 最终 `status=passed`

## Required Evidence

不要只看一句 `background worker started`。至少同时检查：

- hook stdout / stderr
- `.claude/state/runtime/governance-hook.log` 或 `.cursor/state/runtime/governance-hook.log`
- `_bmad-output/runtime/governance/queue/pending|done|failed`
- `_bmad-output/runtime/governance/queue/last-failed-debug.json`
- `_bmad-output/runtime/governance/executions/*.json`

## Closure Standard

真正通过的证据链是：

```text
pre-continue-check -> governance-rerun-result
post-tool-use -> queue/pending
background worker -> queue/done
execution record -> running
execution ingestor -> awaiting_rerun_gate
rerun gate ingestor -> gate_passed
```

`queue/done` 不是终点；`gate_passed` 才是闭环完成。

## Read Next

以下情况读取 `references/consumer-governance-validation.md`：

- 自动脚本不存在
- 自动脚本失败，需要手工定位哪一跳断了
- 想复用手工 playbook 到别的 consumer
- 需要排查 `pending_dispatch`、`EBUSY`、旧 worker entry、schema fallback 之类的真实坑

## Common Mistakes

- 只跑 `npm install`，没用 `npm install --force`
- 并行跑 `npm install` 和 `bmad-speckit-init`
- 看到 queue 进 `done` 就以为闭环完成
- 忽略 canonical `_bmad/_config/governance-remediation.yaml`，导致 execution record 卡在 `pending_dispatch`
