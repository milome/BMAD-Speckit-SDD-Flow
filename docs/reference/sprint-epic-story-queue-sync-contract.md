# Sprint Epic/Story Queue Sync Contract

`adaptive-intake-governance-gate` 与 `main-agent-orchestration --action route-intake` 会把增量需求纳管结果写入：

- `_bmad-output/runtime/governance/adaptive-intake-queue-sync/<requirement-id>.json`

## 目的

该工件是 `T3.2 Sprint Epic/Story Queue 自动联动` 的运行时真相面，用于记录：

- 本次 intake 候选是什么
- 主 Agent 选择了哪个 epic/story 路由
- 是否触发 `reroute`
- 旧 active mapping 是否被降级
- 本次 queue 变更是否已经实际写回 `user_story_mapping.json`

## 最小字段

运行时文件直接复用 `AdaptiveIntakeGateResult`：

- `candidate`
  - `requirementId`
  - `sourceType`
  - `flow`
  - `sprintId`
  - `epicId`
  - `storyId`
  - `changedPaths[]`
- `scoring[]`
  - `route`
  - `scoreBreakdown.domainFit`
  - `scoreBreakdown.dependencyFit`
  - `scoreBreakdown.sprintFit`
  - `scoreBreakdown.riskFit`
  - `scoreBreakdown.readinessFit`
  - `scoreBreakdown.impact`
  - `scoreBreakdown.dependency`
  - `scoreBreakdown.capacity`
  - `scoreBreakdown.weightedTotal`
  - `reasons[]`
- `consistency`
  - `mappingConsistency`
  - `lifecycleConsistency`
  - `sprintConsistency`
- `decision`
  - `verdict`
  - `confidence`
  - `reason`
  - `route`
  - `queueSyncPath`
  - `draftPath`
  - `applied`

## 语义约束

1. `verdict=block` 时，不允许写回新的 active mapping。
2. `verdict=reroute` 时，必须把同一 `requirementId` 的旧 active mapping 降级为 `blocked`，再写入新 route。
3. `decision.applied=true` 才表示 `user_story_mapping.json` 已被真正更新。
4. `decision.reason=draft_pending_readiness_required` 时，必须同时生成：
   - `_bmad-output/runtime/governance/adaptive-intake-drafts/<requirement-id>.json`
5. `scoreBreakdown` 同时保留治理五因子和可解释别名：
   - `impact = domainFit`
   - `dependency = dependencyFit`
   - `capacity = sprintFit`
6. 主 Agent 后续 dispatch packet 的 `allowedWriteScope` 必须来自 `decision.route.allowedWriteScope` 对应的 mapping，而不是本地硬编码 fallback。

## 主 Agent 消费点

- `scripts/main-agent-orchestration.ts`
  - `--action route-intake`
  - `--action adaptive-intake`
  - `dispatch-plan` / `hydratePacket` 时消费 `user_story_mapping.json` 的 `allowedWriteScope`
