# Gates Loop 机器摘要块分析与实施计划

## 1. 背景

当前 gates loop 的审计/复核报告已经包含大量自然语言结论、表格、批判审计员结论以及可解析评分块。这些内容对人类可读性足够，但对 dashboard / analytics / 历史工件回放的机器消费仍有几个明显问题：

1. 报告正文存在格式漂移。
2. 同一阶段在不同时间的报告模板会逐步增强。
3. 当前 canonical assistant target 提取需要维护大量启发式规则。
4. 历史工件与未来增强后的工件之间，解析成本会继续上升。

因此，需要为 gates loop 报告增加一个稳定、显式、面向机器消费的摘要块。

## 2. 这个摘要块是做什么的

机器摘要块的第一消费者是 dashboard / scoring / analytics。

具体用途包括：

1. 让 `parseAndWriteScore`、dashboard、SFT canonical pipeline 在不依赖正文启发式的情况下，稳定读取关键状态。
2. 为后续 `runtime dashboard`、`sft-validate`、`bundle writer`、`analytics candidate builder` 提供统一锚点。
3. 降低历史工件与未来工件格式漂移带来的解析维护成本。
4. 让后续新增 gates loop 字段时，可以在不破坏旧解析器的前提下做向后兼容扩展。

它不只服务 dashboard。

dashboard 是首要消费者，但同样服务：

1. scoring 写入前的结构化核验。
2. analytics 中 canonical assistant target / provenance / acceptance 决策的稳定提取。
3. 历史报告回灌与数据迁移。
4. 后续模板升级时的兼容层。

## 3. 这个摘要块是否覆盖当前增强后的 gates loop 内容

不能假设“当前模板正文已经天然稳定”。

原因：

1. gates loop 还会继续增强。
2. strict 收敛记录、复核轮、批判审计员附加段、验收表、TDD 追踪、non-blocking score write 证据都可能继续变化。
3. 正文为人写，天然适合表达，不天然适合做长期 schema。

因此，机器摘要块的目标不是替代正文，而是把“当前 gates loop 已经需要被机器消费的核心信息”冻结成稳定 contract。

## 4. 推荐摘要块内容

建议在每类审计报告的结尾、紧邻可解析评分块之前或之后，新增固定标题块，例如：

```md
## 机器摘要块（供 dashboard / analytics / parseAndWriteScore）

```json
{
  "summary_version": "v1",
  "stage": "implement",
  "artifact_kind": "audit_report",
  "audit_result": "passed",
  "strict_convergence": {
    "required": true,
    "achieved": true,
    "rounds_without_gap": 3
  },
  "gates_loop": {
    "has_gap": false,
    "gap_count": 0,
    "blocking_gap_count": 0,
    "non_blocking_findings": 3
  },
  "acceptance": {
    "fully_covered": true,
    "verification_passed": true
  },
  "evidence": {
    "integration_tests_run": true,
    "e2e_tests_run": true,
    "lint_run": true,
    "score_write_attempted": true,
    "score_write_non_blocking": true
  },
  "artifacts": {
    "report_path": "...",
    "artifact_doc_path": "..."
  }
}
```
```

## 5. 推荐最小必填字段

第一版建议最小化，只放当前已被多个消费方重复解析的字段：

1. `summary_version`
2. `stage`
3. `audit_result`
4. `acceptance.fully_covered`
5. `acceptance.verification_passed`
6. `gates_loop.has_gap`
7. `gates_loop.gap_count`
8. `strict_convergence.required`
9. `strict_convergence.achieved`
10. `strict_convergence.rounds_without_gap`
11. `evidence.integration_tests_run`
12. `evidence.e2e_tests_run`
13. `evidence.lint_run`
14. `evidence.score_write_attempted`
15. `evidence.score_write_non_blocking`

## 6. 与现有可解析评分块的关系

两者应并存，不互相替代。

1. 可解析评分块：解决“评分维度解析”。
2. 机器摘要块：解决“gates loop / 审计状态 / strict 收敛 / 验收证据解析”。

也就是说：

1. `总体评级 + 维度评分` 继续保留给 scoring parser。
2. `机器摘要块` 负责补齐 dashboard / analytics 当前依赖正文启发式才能拿到的信息。

## 7. 源文件修改位置

应修改源侧模板，而不是 `.claude` 部署产物。

优先源路径：

1. [`_bmad/claude/skills/speckit-workflow/references/audit-prompts.md`](../../_bmad/claude/skills/speckit-workflow/references/audit-prompts.md)
2. [`_bmad/cursor/skills/speckit-workflow/references/audit-prompts.md`](../../_bmad/cursor/skills/speckit-workflow/references/audit-prompts.md)
3. 若 implement strict 收敛规则在单独参考文件中进一步细化，还要同步检查 [`_bmad/claude/skills/speckit-workflow/references/audit-post-impl-rules.md`](../../_bmad/claude/skills/speckit-workflow/references/audit-post-impl-rules.md) 与 cursor 对应文件。

`.claude/...` 是部署后工件，不应作为权威来源直接维护。

## 8. 是否还需要兼容历史工件

需要，但工作重点应调整。

结论不是“停止解析历史工件”，而是：

1. 对历史工件保留启发式兼容。
2. 对未来工件引入稳定机器摘要块。
3. 让新增工件的解析复杂度不再继续上升。

这会把工作模式从“持续为所有自然语言漂移补 parser”变成“历史兼容一次 + 新工件稳定 contract”。

## 9. 实施计划

### Phase 1：模板补摘要块

修改 `_bmad` 源模板，在 spec / plan / gaps / tasks / implement 对应提示词中强制要求输出机器摘要块。

### Phase 2：约束字段

统一机器摘要块字段名、布尔语义、枚举值，避免不同阶段各写一套。

### Phase 3：消费端接入

让 dashboard / analytics / parseAndWriteScore 优先读取机器摘要块；读不到时再回退旧启发式。

### Phase 4：历史兼容保留

现有 assistant-target / gates-loop 启发式继续保留，直到新模板产物足够覆盖。

## 10. 当前建议

下一步应先做两件事：

1. 在 `_bmad` 源侧 `audit-prompts*.md` 中新增机器摘要块输出要求。
2. 明确第一版机器摘要块的最小 schema，并让未来 dashboard / analytics 优先消费它。

这样可以避免继续为自然语言报告正文做无限制的启发式扩张。
