# Test Fixture Conventions

> **Current path**: stage-semantic fixtures aligned to parser / runtime dashboard / host-runner consumers
> **Legacy path**: cross-stage fixture reuse and semantic drift

## 目标

测试 fixture 必须与被测 `stage`、评分模式、预期验收语义保持一致。  
不得把 `story / prd / tasks` 样本误喂给 `implement`，也不得把低分 fixture 塞进需要 `accepted` 语义的 runtime / SFT smoke。

## 基本规则

1. `fixture` 的语义必须和 `stage` 对齐。
   例：
   `implement` 只能使用 implement 审计样本。
   `tasks` 只能使用 tasks 审计样本。
   `plan` 只能使用 plan 审计样本。

2. 需要验证 `dimension_scores` 时，fixture 必须包含对应模式可解析的维度块。
   `implement` 使用 code 模式四维：
   `功能性 / 代码质量 / 测试覆盖 / 安全性`

3. 需要验证 canonical SFT `accepted` 路径时，fixture 的加权分必须满足当前 floor。
   当前 runtime dashboard / CLI smoke 默认按 `minScore=90` 生成候选，因此 clean / redacted 这类“应被接受”的样本必须是高分 fixture。

4. 需要验证 `rejected` / redaction 路径时，拒绝原因应来自目标行为本身，而不是误用 fixture。
   例：
   blocked 样本应因 `redaction_blocked` 被拒绝，而不是因为 report 本身分数太低。

5. 改 fixture 映射时，必须同步更新相关 smoke 与 contract 测试。

## Runtime Dashboard 专项约定

以下规则适用于：

- `tests/helpers/runtime-dashboard-fixture-manifest.ts`
- `tests/helpers/runtime-dashboard-fixture.ts`
- `tests/acceptance/runtime-cli-e2e-smoke.test.ts`

其中 `tests/helpers/runtime-dashboard-fixture-manifest.ts` 是 runtime dashboard real tool trace 三态映射的单一事实源。

真实 tool trace 三态映射固定为：

- `clean -> implement`
- `redacted -> tasks`
- `blocked -> plan`

当前约定 fixture 为：

- `implement -> sample-implement-report-high-score.md`
- `tasks -> sample-tasks-report-逐条对照.md`
- `plan -> sample-plan-report.md`

## 变更守护

以下情况必须新增或更新自动化回归：

- 修改 runtime dashboard helper 的 stage -> fixture 映射
- 新增新的 real host tool trace 变体
- 调整 SFT floor / split / acceptance 规则
- 修改 implement / tasks / plan parser 的可解析维度契约

推荐最低守护：

- 文档 contract test：规则文档存在且关键映射写明
- fixture contract test：映射到同 stage 的 parseable fixture
- e2e smoke：验证 accepted / rejected / redaction 语义没有被 fixture 误伤
