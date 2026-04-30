# Adaptive Intake Governance Report

## 入口

优先入口：

```bash
npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-orchestration.ts \
  --cwd <project-root> \
  --action route-intake \
  --input <candidate.json> \
  --apply
```

底层治理脚本也可直接执行：

```bash
npx ts-node --project tsconfig.node.json --transpile-only scripts/adaptive-intake-governance-gate.ts \
  --cwd <project-root> \
  --input <candidate.json> \
  --apply
```

## 输入候选最小结构

```json
{
  "requirementId": "REQ-123",
  "sourceType": "churn_in",
  "flow": "story",
  "sprintId": "SPRINT-1",
  "epicId": "epic-payments",
  "storyId": "story-payments",
  "changedPaths": ["src/payments/charge.ts"],
  "readiness": {
    "implementationReady": true,
    "riskLevel": "low"
  }
}
```

## 输出工件

运行后会生成：

- `user_story_mapping.json` 的真实映射更新（仅 `--apply` 时）
- `_bmad-output/runtime/governance/adaptive-intake-queue-sync/<requirement-id>.json`
- `_bmad-output/runtime/governance/adaptive-intake-drafts/<requirement-id>.json`
  - 仅当 `decision.reason=draft_pending_readiness_required` 时生成

## 判定规则

1. 先做 route scoring：
   - `domainFit`
   - `dependencyFit`
   - `sprintFit`
   - `riskFit`
   - `readinessFit`
2. 再做三类一致性检查：
   - `mappingConsistency`
   - `lifecycleConsistency`
   - `sprintConsistency`
3. 最后生成 verdict：
   - `pass`
   - `warn`
   - `block`
   - `reroute`

## 运维检查点

1. `decision.queueSyncPath` 必须存在。
2. `decision.applied=true` 才表示 mapping 真正回写成功。
3. `reroute` 时必须检查旧 route 已被置为 `blocked`。
4. `block` 时必须检查 `consistency.*.failed[]` 中的 machine-readable 原因。
5. `draft_pending_readiness_required` 时必须检查 `decision.draftPath` 已落盘。
6. 主 Agent 后续 `dispatch-plan` 生成的 packet，`allowedWriteScope` 必须与映射记录一致。
