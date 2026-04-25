# Consumer Governance Validation Playbook

> 日期：2026-04-09  
> 状态：**历史归档 / pre-hard-cut 记录**  
> 当前 accepted runtime path 请改看：[2026-04-25-main-agent-orchestration-live-smoke.md](./2026-04-25-main-agent-orchestration-live-smoke.md)

---

## 说明

这份文档记录的是 **hard cut autonomous fallback 之前**，在真实 consumer 项目上验证 `background worker / queue auto-drain` 的历史过程。

它**不再代表当前仓库的正式运行路径**。

当前 accepted runtime path 已经收敛为：

1. hook 在 implementation-entry 或 pre-continue 阶段写入 `orchestration_state` 与 `pending_packet`
2. 主 Agent 执行 `npm run main-agent-orchestration -- --cwd {project-root} --action inspect`
3. 必要时主 Agent 执行 `npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan`
4. 主 Agent claim / dispatch bounded packet，子代理只执行 bounded work
5. 主 Agent 回读 state / packet / child result，决定下一步
6. `runAuditorHost` 只负责 post-audit close-out，不再承担全局编排权
7. **不再接受** autonomous fallback、background worker 自动吃队列、或 queue 自动推进到 running / gate_passed 作为当前运行成功标准

---

## 当前验证标准

如果你今天要验证 consumer 项目上的治理运行链，请使用下面这组标准：

1. `.claude/hooks/runtime-policy-inject.cjs` 与 `.cursor/hooks/runtime-policy-inject.cjs` 存在且可执行
2. `.claude/hooks/pre-continue-check.cjs` 与 `.cursor/hooks/pre-continue-check.cjs` 存在且可执行
3. hook 能在阻断实现链时输出 `orchestration_state` 与 `pending_packet`
4. `npm run main-agent-orchestration -- --cwd {project-root} --action inspect` 可读取当前 authoritative surface
5. `npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan` 可生成正式派发计划
6. 主 Agent 读取 state、消费 packet、调度子代理、回写结果、决定下一步，直到 closeout
7. `fallbackAutonomousMode` 保持关闭，queue / worker 路径不再作为 accepted runtime path

建议直接参考：

- [2026-04-25-main-agent-orchestration-live-smoke.md](./2026-04-25-main-agent-orchestration-live-smoke.md)
- [fallback-autonomous-dispatch-mode.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/fallback-autonomous-dispatch-mode.test.ts)
- [main-agent-fallback-plane-hard-cut.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/main-agent-fallback-plane-hard-cut.test.ts)
- [main-agent-orchestration-consumer.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/main-agent-orchestration-consumer.test.ts)

---

## 历史结论

2026-04-09 这份 playbook 当时证明过：

1. `hook -> background worker -> queue -> execution record`
2. queue item 可自动进入 `done`
3. execution record 可自动推进到 `running`

这些结论现在只保留为**历史实现证据**，不再作为当前产品路径、当前安装说明或当前运营验收标准。

---

## 迁移说明

如果你正在从旧文档迁移，请直接把下面这些表述视为过时：

- `background worker 能自动把 queue 从 pending 吃到 done`
- `hook -> background worker -> 自动吃队列`
- `execution record 自动推进到 running`
- `消费项目里真的看到 governance-runtime-worker / governance-remediation-runner 并能执行`

这些都不再是当前 accepted runtime path 的目标。

当前目标只有一个：

> 主 Agent 读取 state、消费 packet、调度子代理、回写结果、决定下一步，直到 closeout。
