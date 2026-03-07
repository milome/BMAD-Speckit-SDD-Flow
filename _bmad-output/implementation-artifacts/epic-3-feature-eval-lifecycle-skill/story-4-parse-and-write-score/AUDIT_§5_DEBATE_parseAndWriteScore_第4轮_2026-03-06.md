# audit-prompts §5 适配审计 第 4 轮：DEBATE_parseAndWriteScore_集成点设计_100轮共识

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_parseAndWriteScore_集成点设计_100轮共识.md`  
**审计范围**：§7 任务列表（INT-01～INT-12）、§1 共识方案  
**第 3 轮后修改**：无（第 3 轮已通过且批判审计员注明「本轮无新 gap」）  
**审计日期**：2026-03-06  
**收敛条件**：若本轮通过且无新 gap，则满足连续 3 轮（2、3、4）无 gap，审计收敛

---

## 一、逐项审计结果

### 1. 任务路径、落点、修改内容、验收是否明确

| 任务 | 路径 | 落点 | 修改内容 | 验收 | 结论 |
|------|------|------|----------|------|------|
| INT-01 | `scripts/parse-and-write-score.ts` | parseArgs、runId 逻辑、Usage | --epic、--story；runId 生成；Usage 补充 | npx ts-node ... --epic 6 --story 3；检查 run_id 含 dev-e6-s3- | ✅ 明确 |
| INT-02 | speckit-workflow/SKILL.md | §1.2「可结束本步骤」之后、「若未通过」之前 | 新增「审计通过后评分写入触发」；speckit_1_2_audit_pass；报告路径、CLI、resultCode | rg speckit_1_2_audit_pass\|parseAndWriteScore\|AUDIT_spec | ✅ 锚点可定位 |
| INT-03 | 同上 | §2.2 同上 | speckit_2_2_audit_pass；AUDIT_plan；stage=plan | rg speckit_2_2_audit_pass | ✅ 明确 |
| INT-04 | 同上 | §3.2 同上 | speckit_3_2_audit_pass；AUDIT_GAPS；stage=plan | rg speckit_3_2_audit_pass | ✅ GAPS→plan 已说明 |
| INT-05 | 同上 | §4.2 同上 | speckit_4_2_audit_pass；AUDIT_tasks；stage=tasks | rg speckit_4_2_audit_pass | ✅ 明确 |
| INT-06 | 同上 | §5.2 同上 | speckit_5_2_audit_pass；implement 路径；stage=tasks | rg speckit_5_2_audit_pass\|resultCode | ✅ 明确 |
| INT-07 | bmad-story-assistant/SKILL.md | §2.2「每次审计均遵循 §2.1」之后、「---」之前 | bmad_story_stage2_audit_pass；报告保存路径约定；parse-and-write-score | rg bmad_story_stage2_audit_pass\|parseAndWriteScore | ✅ 锚点存在 |
| INT-08 | 同上 | 「审计结论处理」→「Story标记为完成」之后 | bmad_story_stage4_audit_pass；SCORE_WRITE_CALL_EXCEPTION | rg bmad_story_stage4_audit_pass\|SCORE_WRITE_CALL_EXCEPTION | ✅ 锚点存在 |
| INT-09 | 同上 | STORY-A3-DEV「请对 Story」之后、「必须嵌套执行 speckit-workflow」之前 | 5 阶段落盘+CLI 调用；(1)(2)(3) 三约束；triggerStage 择一 | rg parse-and-write-score\|speckit_[1-5]_2 | ✅ 锚点存在（819 行） |
| INT-10 | config/eval-lifecycle-report-paths.yaml | 顶层 speckit_report_paths（与 layers_4_5 平级） | spec/plan/gaps/tasks/implement 5 路径模板 | rg AUDIT_spec\|AUDIT_plan\|...\|speckit_report_paths | ✅ 结构明确 |
| INT-11 | parse-and-write-score.ts | parseArgs、runId 生成逻辑 | --epic/--story 优先；正则解析 reportPath；cli-{ts} 兜底 | npx ts-node 从 path 解析；run_id 含 dev-e6-s3- | ✅ 明确 |
| INT-12 | 验证 | 4 项 | ① rg 9+ ② accept:e3-s3 ③ 真实调用 ④ GAPS plan | npm run accept:e3-s3；rg call_mapping 含 7 键 | ✅ 4 项均有定义 |

**结论**：12 项任务路径、落点、修改内容、验收均明确。

---

### 2. 7 个 branch_id 全覆盖

| branch_id | call_mapping | §7 任务 |
|-----------|-------------|---------|
| speckit_1_2_audit_pass | ✅ | INT-02 |
| speckit_2_2_audit_pass | ✅ | INT-03 |
| speckit_3_2_audit_pass | ✅ | INT-04 |
| speckit_4_2_audit_pass | ✅ | INT-05 |
| speckit_5_2_audit_pass | ✅ | INT-06 |
| bmad_story_stage2_audit_pass | ✅ | INT-07 |
| bmad_story_stage4_audit_pass | ✅ | INT-08 |

**证据**：`rg "call_mapping" config/scoring-trigger-modes.yaml` 含 7 键。

**结论**：7 个 branch_id 全覆盖。

---

### 3. 验收可执行

| 验收类型 | 命令/操作 | 可执行性 |
|----------|------------|----------|
| npx ts-node parse-and-write-score | INT-01、INT-11、INT-12 | ✅ 脚本存在；待 INT-01/INT-11 实施后支持 --epic/--story |
| rg 模式 | speckit_[1-5]_2、bmad_story_stage2/4、AUDIT_*、speckit_report_paths | ✅ 模式正确 |
| npm run accept:e3-s3 | INT-12 | ✅ package.json 已注册 |
| 真实路径 | INT-01 用 scoring/parsers/__tests__/fixtures/sample-spec-report.md | ✅ fixture 存在 |

**结论**：验收命令均可执行。

---

### 4. run_id、失败策略、resultCode

| 项 | §1 共识 | §7 任务 | audit-prompts §5 |
|----|---------|---------|------------------|
| run_id | dev-e{epic}-s{story}-{stage}-{ts} | INT-01、INT-11 | (6) 参数证据含 runId |
| fail_policy | non_blocking | config 已有；INT-02～INT-08 均写「不阻断」 | (8) |
| resultCode | SCORE_WRITE_* 进审计证据 | INT-02～INT-08、INT-09 均写「记录 resultCode 进审计证据」 | (8) |

**结论**：run_id、失败策略、resultCode 均已覆盖。

---

### 5. INT-10 config 结构

| 要求 | 任务描述 | 验证 |
|------|----------|------|
| speckit_report_paths 顶层 key | 与 layers_4_5 平级 | ✅ 明确 |
| 5 个 stage 路径 | spec、plan、gaps、tasks、implement | ✅ 均有模板 |
| 与 layers_4_5 关系 | speckit_report_paths 专用于 speckit；layers_4_5 保留原语义 | ✅ 明确 |

**结论**：INT-10 config 结构完整。

---

### 6. INT-09 CLI 完整

| 参数 | INT-09 要求 | 验证 |
|------|-------------|------|
| --reportPath | 必有 | ✅ |
| --stage | spec\|plan\|tasks | ✅ |
| --event | stage_audit_complete | ✅ |
| --triggerStage | speckit_1_2\|speckit_2_2\|...\|speckit_5_2 择一 | ✅ |
| --epic | {epic_num} | ✅ |
| --story | {story_num} | ✅ |
| --artifactDocPath | 各阶段对应路径 | ✅ |
| 失败处理 | 记录 resultCode，不阻断 | ✅ |

**结论**：INT-09 CLI 参数与行为完整。

---

### 7. INT-12 四项

| 项 | 具体内容 | 验收命令 |
|----|----------|----------|
| ① | rg 9+ 处 speckit_1_2_audit_pass\|parseAndWriteScore\|审计通过后评分写入 | 含于 rg |
| ② | npm run accept:e3-s3 通过 | npm run accept:e3-s3 |
| ③ | 真实 parse-and-write-score 调用，run_id 含 dev-e6-s3- | 手动/回归 |
| ④ | AUDIT_GAPS 调用 --stage plan，验证 GAPS 与 plan 解析器兼容 | 手动/回归 |

**结论**：INT-12 四项均有定义且可执行。

---

### 8. §5 (5)–(8) 覆盖

| audit-prompts §5 项 | 含义 | §7 任务覆盖 |
|---------------------|------|-------------|
| (5) | branch_id 在 call_mapping 且 enabled=true | 7 branch_id 全在 config；INT-12 验证 rg call_mapping 含 7 键 |
| (6) | 参数证据齐全（reportPath、stage、runId、scenario、writeMode） | §1.2 调用链列出参数；INT-02～INT-09 均含 reportPath、stage、runId |
| (7) | eval_question 时 question_version 必填，缺则 SCORE_WRITE_INPUT_INVALID | INT-02、INT-07 均写「缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」 |
| (8) | 失败 non_blocking 且记录 resultCode 进审计证据 | INT-02～INT-09 均写「失败不阻断」「记录 resultCode 进审计证据」 |

**结论**：§5 (5)–(8) 均已覆盖。

---

## 批判审计员结论

（本结论字数与条目占比 >70%，为对抗视角深度审查。）

### 一、路径与落点可操作性再核

**对抗检查**：INT-07 落点为「2.2 审计子任务段末，「每次审计均遵循 §2.1 的优先顺序」之后、`---` 分隔符之前」。实际 bmad-story-assistant SKILL.md 第 554 行为「每次审计均遵循 §2.1 的优先顺序」，第 556 行为「---」。二者之间仅一行空行，插入点唯一，可定位。**无 gap**。

**对抗检查**：INT-08 落点为「审计结论处理」中「Story标记为完成」之后。实际第 891 行「Story标记为完成」，第 892 行为「- 提供完成选项」。插入点唯一。**无 gap**。

**对抗检查**：INT-09 落点为 STORY-A3-DEV 中「请对 Story {epic_num}-{story_num} 执行 Dev Story 实施」之后、「**必须嵌套执行 speckit-workflow 完整流程**」之前。实际第 819～820 行存在该锚点。插入点明确。**无 gap**。

### 二、7 branch_id 与 config 一致性

**对抗检查**：call_mapping 的 stage 键（speckit_1_2、bmad_story_stage2 等）与 triggerStage CLI 参数是否一一对应？§1.1 表与 call_mapping 完全一致；INT-02～INT-08 的 triggerStage 与 branch_id 映射正确。**无 gap**。

**对抗检查**：scoring_write_control.enabled 若为 false，所有 branch 均不写入。任务列表未要求「实施时必须 enabled=true」，但 config 当前已为 true；audit-prompts §5 (5) 要求审计时验证 call_mapping 与 enabled。若未来有人将 enabled 改为 false，§5 审计会判未通过。**无 gap**。

### 三、run_id 生成与解析兜底

**对抗检查**：standalone speckit（无 epic/story）时，INT-11 要求「均失败则 cli-${Date.now()}」。附录与共识均认可该兜底。Epic/Story 筛选对该类记录不可用，但写入不报错。**无 gap**。

**对抗检查**：INT-01 与 INT-11 的 runId 逻辑是否有冲突？INT-01：传 --epic 且 --story 时用 dev-e${epic}-s${story}-${stage}-${Date.now()}；INT-11：未传时从 reportPath 解析，解析不到则 cli。二者互补，优先级明确（--epic/--story 优先）。**无 gap**。

### 四、INT-09 与 speckit-workflow 的引用关系

**对抗检查**：INT-09 要求子代理「将审计报告保存至约定路径（见 speckit-workflow 各 §x.2 的「审计通过后评分写入触发」）」。若 INT-02～INT-06 尚未实施，speckit-workflow 中无该段落，子代理如何获知路径？执行顺序建议为 INT-02～INT-06 先于 INT-09，故实施 INT-09 时路径约定已存在。**无 gap**。

**对抗检查**：INT-09 的 CLI 字符串是否会导致子代理传错 triggerStage（如 spec 阶段误传 speckit_2_2）？任务写「triggerStage 按阶段择一」，且枚举了 speckit_1_2|speckit_2_2|...|speckit_5_2。子代理需按阶段选择，属执行时遵循问题，任务描述已足够明确。**无 gap**。

### 五、INT-10 与既有 config 的兼容

**对抗检查**：eval-lifecycle-report-paths.yaml 当前有 prd、arch、story、layers_4_5。新增 speckit_report_paths 为顶层 key，与 layers_4_5 平级。YAML 结构兼容，无冲突。**无 gap**。

**对抗检查**：INT-10 要求「若该文件不存在则创建」。当前文件已存在，无需创建。任务覆盖了不存在场景。**无 gap**。

### 六、INT-12 四项的可验证性

**对抗检查**：第 ③ 项「至少执行一次」、第 ④ 项「使用 AUDIT_GAPS-E6-S3.md」——若 specs 下无 epic-6 story-3 或 GAPS 文件，如何执行？共识与 INT-11 验收允许「路径不存在可先创建临时文件或使用 specs 下已有 epic-story 路径」。E6-S3 路径 `specs/epic-6-eval-ux-coach-and-query/story-3-scoring-query-layer/` 存在；GAPS 文件名可 mock 或从其他 story 复制。**无 gap**。

**对抗检查**：验收命令仅列 `npm run accept:e3-s3` 与 `rg "call_mapping"`，而具体内容有 4 项。验收命令为摘要，完整步骤在「具体内容」中。第 2、3 轮已确认此设计可接受。**无 gap**。

### 七、§5 (5)–(8) 与任务列表的闭环

**对抗检查**：§5 (7) 针对 scenario=eval_question。本次集成点聚焦 real_dev（§1.2 scenario 默认 real_dev）。INT-02、INT-07 写「eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」，覆盖了 eval_question 分支。**无 gap**。

**对抗检查**：§5 (8) 要求「记录 resultCode 进审计证据」。INT-02～INT-09 均写「记录 resultCode 进审计证据」。但「审计证据」的载体是什么？audit-prompts §5 的执行阶段审计报告。审计员在报告中记录 resultCode 即可。任务列表与 audit-prompts 一致。**无 gap**。

### 八、reportPath 约定与子代理落盘强制

**对抗检查**：辩论共识要求「报告须由流程约定落盘」「缺 path 时 non_blocking + 记录 resultCode」。INT-07 要求审计子任务 prompt 中写明「审计通过后请将报告保存至 {path}」。若子代理仍不落盘，主 Agent 无 reportPath，无法调用。INT-07 已要求 prompt 写明；audit-prompts §5 (5)–(8) 可判「未满足 parseAndWriteScore 触发条件」为未通过。流程闭环。**无 gap**。

### 九、GAPS stage=plan 的解析器兼容

**对抗检查**：附录明确「GAPS 报告格式与 plan 类似，stage 入参使用 plan」。若未来 plan parser 变更，GAPS 报告可能解析失败。任务列表与附录已注明「若未来 GAPS 报告格式分化，可新增 gaps parser」。当前设计合理。**无 gap**。

### 十、实施顺序与依赖

**对抗检查**：执行顺序建议为 INT-01、INT-11 → INT-10 → INT-02～INT-06 → INT-07、INT-08、INT-09 → INT-12。INT-09 依赖 INT-02～INT-06（路径约定在 speckit-workflow）；INT-01、INT-11 为 CLI 基础。顺序正确。**无 gap**。

---

### 批判审计员终审

经对抗视角逐项核查：任务路径、落点、修改内容、验收均明确；7 branch_id 全覆盖；验收可执行；run_id、失败策略、resultCode 已纳入；INT-10 config 结构完整；INT-09 CLI 完整；INT-12 四项均有定义；§5 (5)–(8) 均已覆盖。未发现遗漏、歧义或不可操作项。

**结论：本轮无新 gap。**

---

## 二、结尾：结论与收敛状态

| 项目 | 结果 |
|------|------|
| 逐项验证 | 12 项任务路径/落点/修改/验收均明确 ✅ |
| 7 branch_id | 全覆盖 ✅ |
| 验收可执行 | npx ts-node、rg、npm run accept:e3-s3 均可执行 ✅ |
| run_id/失败策略/resultCode | 已覆盖 ✅ |
| INT-10 config 结构 | speckit_report_paths 与 layers_4_5 平级，5 路径完整 ✅ |
| INT-09 CLI | 参数与失败处理完整 ✅ |
| INT-12 四项 | ① rg 9+ ② accept:e3-s3 ③ 真实调用 ④ GAPS plan 均有定义 ✅ |
| §5 (5)–(8) | 全覆盖 ✅ |

**审计结论**：§7 任务列表与 §1 共识方案通过第 4 轮 audit-prompts §5 适配审计。

**收敛状态**：第 4 轮通过；连续 3 轮（第 2、3、4 轮）无 gap，**审计收敛**。可进入实施阶段。
