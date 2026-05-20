# Retired Context Surface（旧 runtime-context 路径说明）

> **Status**: superseded as a control source
> **Current control source**: `requirement-record.json` + `index.json` + requirement-scoped `runtimePolicySnapshot` / `recoveryContext`

旧 `_bmad-output/runtime/context/project.json` 只属于历史 context surface，不再作为主控、恢复、确认或 closeout 的真相源。六个心智模型全链路现在只允许通过 Active Requirement Resolver 生成只读 `ResolvedRuntimeContext`，其数据来源只能是 RequirementRecord、Requirement 当前索引、runtimePolicySnapshot、recoveryContext 和 bmad workflow projection。

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
