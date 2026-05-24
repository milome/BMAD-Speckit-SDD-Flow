# Retired Context Surface（旧 runtime-context 路径说明）

> **Status**: superseded as a control source
> **Current control source**: `requirement-record.json` + `index.json` + requirement-scoped `runtimePolicySnapshot` / `recoveryContext`
> **Current path**: Active Requirement Resolver reads governed requirement records and produces read-only `ResolvedRuntimeContext`.
> **Legacy path**: registry + activeScope + scoped context file, including `.speckit-state.yaml`, are historical compatibility surfaces only.

旧 `_bmad-output/runtime/context/project.json` 只属于历史 context surface，不再作为主控、恢复、确认或 closeout 的真相源。六个心智模型全链路现在只允许通过 Active Requirement Resolver 生成只读 `ResolvedRuntimeContext`，其数据来源只能是 RequirementRecord、Requirement 当前索引、runtimePolicySnapshot、recoveryContext 和 bmad workflow projection。

`story-scoped 模式` 与 `story-scoped 运行上下文` 仍作为历史迁移术语保留在本文中，表示旧 registry/activeScope 时代曾经通过 story/run 作用域绑定 workflow entry point。当前实现不得把该术语解释为继续读取 `_bmad-output/runtime/context/**` 的控制依据。

`.speckit-state.yaml` 已完全移除，不应创建、分发或复制该文件作为运行时治理依赖；主控、hook、恢复和 closeout 不允许再回退到该模板或旧 runtime context surface。

## 旧 schema 的历史含义

`runtime-context.schema.json` 曾表达项目级 `flow / stage / languagePolicy / runId / artifactRoot` 等信息，但这些信息在新设计中已经拆分为：

- `RequirementRecord.entryFlow`
- `RequirementRecord.currentRunId`
- `RequirementRecord.currentMentalModel`
- `runtimePolicySnapshot.locale`
- `runtimePolicySnapshot.hostMode`
- `recoveryContext`
- `bmadWorkflowProjection`

## 当前建议

- 不要再把 `project.json` 当作必需输入。
- 不要在新脚本或 hook 中读取 `_bmad-output/runtime/context/**` 作为控制依据。
- 如果需要语言偏好、hostMode、hookTrust、stage、strictness、mandatoryGates，改读 `runtimePolicySnapshot`。
- 如果需要恢复点，改读 `recoveryContext` 与 `traceRows checkpoint`。
- 如果需要当前 active requirement，改读 `_bmad-output/runtime/requirement-records/index.json` 和对应 `requirement-record.json`。

## 机器校验

- JSON Schema：[`runtime-context.schema.json`](./runtime-context.schema.json)
- 该 schema 仅作为历史参考，不应再作为新 runtime control contract；目标态只允许使用 `ResolvedRuntimeContext`。
