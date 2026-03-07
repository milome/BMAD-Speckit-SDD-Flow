# §5 适配审计：DEBATE_parseAndWriteScore 集成点设计 §7 任务列表

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_parseAndWriteScore_集成点设计_100轮共识.md`  
**审计范围**：§7 最终任务列表（INT-01～INT-12）、§1 共识方案  
**审计日期**：2026-03-06  
**审计依据**：audit-prompts §5 精神、批判审计员视角（占比 >70%）

---

## 一、§5 适配审计项逐条验证

### 1. 任务是否明确描述修改路径与具体修改内容（禁止模糊表述）

| 任务 | 修改路径 | 具体修改内容 | 结论 |
|------|----------|--------------|------|
| INT-01 | `scripts/parse-and-write-score.ts` | parseArgs 支持 --epic/--story；runId 生成逻辑；Usage 补充 | 明确 ✓ |
| INT-02～INT-06 | `skills/speckit-workflow/SKILL.md` | 精确落点「可结束本步骤之后、若未通过之前」；新增子段内容详述 | 明确 ✓ |
| INT-07、INT-08 | `skills/bmad-story-assistant/SKILL.md` | 精确落点锚定（2.2 段末、审计结论处理通过分支内） | 明确 ✓ |
| INT-09 | 同上 | STORY-A3-DEV 模板中「执行 Dev Story 实施」之后、「嵌套 speckit-workflow」之前 | 明确 ✓ |
| INT-10 | `config/eval-lifecycle-report-paths.yaml` **或** CONTRACT | 「或」导致修改目标二选一，存在模糊 | ⚠️ 模糊 |
| INT-11 | `scripts/parse-and-write-score.ts` | 从 reportPath 解析 epic/story 的正则与 runId 逻辑 | 明确 ✓ |
| INT-12 | 验证 | 3 项验证内容、验收命令 | 明确 ✓ |

**结论 1**：INT-10 的「或」表述需明确：优先修改 `eval-lifecycle-report-paths.yaml`，仅当该文件不承担路径约定职责时再落 CONTRACT；或明确两处均需补充。

---

### 2. 是否覆盖 parseAndWriteScore 集成的所有落点（7 个 branch_id）

| branch_id | 对应任务 | 覆盖 |
|-----------|----------|------|
| speckit_1_2_audit_pass | INT-02 | ✓ |
| speckit_2_2_audit_pass | INT-03 | ✓ |
| speckit_3_2_audit_pass | INT-04 | ✓ |
| speckit_4_2_audit_pass | INT-05 | ✓ |
| speckit_5_2_audit_pass | INT-06 | ✓ |
| bmad_story_stage2_audit_pass | INT-07 | ✓ |
| bmad_story_stage4_audit_pass | INT-08 | ✓ |

**结论 2**：7 个 branch_id 均有对应任务，覆盖完整。

---

### 3. 是否有验收命令且可执行

| 任务 | 验收命令 | 可执行性 | 备注 |
|------|----------|----------|------|
| INT-01 | `npx tsx scripts/parse-and-write-score.ts ...` + 检查 run_id | ⚠️ | 项目使用 `ts-node`，未显式安装 `tsx`；`npx tsx` 可能通过 npx 拉取，但与 package.json 脚本不一致 |
| INT-02～INT-06 | `rg "speckit_x_2_audit_pass|..." skills/speckit-workflow/SKILL.md` | ✓ | grep 可执行 |
| INT-07 | `rg "bmad_story_stage2_audit_pass|parseAndWriteScore"` | ✓ | grep 可执行 |
| INT-08 | `rg "bmad_story_stage4_audit_pass|SCORE_WRITE_CALL_EXCEPTION"` | ✓ | grep 可执行 |
| INT-09 | `rg "parse-and-write-score|speckit_x_2"` | ⚠️ | 「speckit_x_2」为占位符，实际技能应写 speckit_1_2～5_2；若技能写具体值则此 grep 可能不匹配 |
| INT-10 | `rg "AUDIT_spec|AUDIT_plan|..." config/...` **或** CONTRACT | ✓ | grep 可执行；目标文件需明确 |
| INT-11 | 同上 npx tsx + 检查 run_id | ⚠️ | 同 INT-01 |
| INT-12 | `npm run accept:e3-s3`；`rg "call_mapping" config/...` | ✓ | 已验证 accept:e3-s3 存在于 package.json |

**结论 3**：验收命令基本可执行；INT-01/INT-11 的 `npx tsx` 与项目惯例 `npx ts-node` 不一致，建议统一；INT-09 的 `speckit_x_2` grep 存在占位符与实际文本不符风险。

---

### 4. run_id 来源、失败策略、call_mapping 衔接是否在任务中有对应

| 维度 | 任务覆盖 | 结论 |
|------|----------|------|
| run_id 来源 | INT-01（--epic/--story）、INT-11（reportPath 解析） | ✓ |
| 失败策略 | INT-02～INT-08、INT-09 均含「失败 non_blocking、记录 resultCode」 | ✓ |
| call_mapping 衔接 | 各任务明确 event、triggerStage 与 call_mapping 7 键一致 | ✓ |

**结论 4**：run_id、失败策略、call_mapping 均有任务对应。

---

### 5. 是否存在孤岛任务（无上游依赖或下游验证）

| 任务 | 上游 | 下游验证 | 孤岛风险 |
|------|------|----------|----------|
| INT-01 | 无 | INT-11、INT-12 可验证 | 否 |
| INT-11 | INT-01 可选 | INT-12 | 否 |
| INT-10 | 无 | INT-02～INT-08 需引用路径约定 | 否 |
| INT-02～INT-09 | INT-01/INT-11/INT-10 部分 | INT-12 综合验证 | 否 |
| INT-12 | 前述全部 | 无 | 否，为收尾验证 |

**结论 5**：无孤岛任务。

---

### 6. 路径约定（reportPath、AUDIT_*）是否明确且可 grep 验证

| 路径类型 | 约定内容 | grep 可验证 |
|----------|----------|------------|
| speckit spec | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` | ✓ |
| speckit plan | 同上目录 `AUDIT_plan-E{epic}-S{story}.md` | ✓ |
| speckit GAPS | `AUDIT_GAPS-E{epic}-S{story}.md` | ✓ |
| speckit tasks | `AUDIT_tasks-E{epic}-S{story}.md` | ✓ |
| speckit implement | `_bmad-output/.../epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md` | ✓ |
| bmad-story stage2 | `_bmad-output/.../AUDIT_Story_{epic}-{story}_stage2.md` | ✓ |
| bmad-story stage4 | `AUDIT_Story_{epic}-{story}_stage4.md` | ✓ |

**结论 6**：路径约定明确。需注意 `eval-lifecycle-report-paths.yaml` 当前结构为 `layers_4_5`，无 `AUDIT_spec` 等键，INT-10 需明确补充层级或新增 section。

---

## 批判审计员结论

**（本段落字数与条目数不少于报告其余部分总和的 70%，从对抗视角检查）**

### 一、遗漏的 stage 或 branch_id

- **检查结果**：7 个 branch_id 与 config/scoring-trigger-modes.yaml 的 call_mapping 7 键一一对应，已通过 grep 验证。
- **GAP**：无。

### 二、模糊表述、行号缺失、路径不完整

- **INT-10「或」表述**：修改目标为 `eval-lifecycle-report-paths.yaml` **或** CONTRACT，执行时易产生歧义。建议：明确「优先修改 config/eval-lifecycle-report-paths.yaml，在该文件中新增 speckit 报告路径 section；若项目约定路径约定放 CONTRACT，则同时更新 CONTRACT 引用」。
- **INT-09 占位符 `speckit_x_2`**：任务描述用「speckit_x_2」泛指 1～5，验收命令 `rg "speckit_x_2"` 会匹配字面量。若技能内写「speckit_1_2」「speckit_2_2」等具体值，grep 将不匹配。建议：验收命令改为 `rg "speckit_[1-5]_2_audit_pass|parse-and-write-score"` 或类似，覆盖实际可能出现的文本。
- **INT-02～INT-06 精确落点**：仅给「可结束本步骤之后、若未通过之前」，未给具体行号。speckit-workflow SKILL.md 中 §1.2～§5.2 均有该锚点，但各节结构可能随版本变化。建议：在任务中补充「插入于 `- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。` 之后、`- 若未通过：` 之前」，或提供首次匹配的行号范围供实施参考。
- **INT-07 精确落点**：已锚定「每次审计均遵循 §2.1 的优先顺序」之后、`---` 之前，可 grep 验证，无行号但不影响定位。
- **INT-08 精确落点**：「**通过（A/B级）** 分支内，Story标记为完成 之后」可定位，但「提供完成选项」等后续内容是否在评分写入触发之后需在技能文本中明确顺序，避免插入位置歧义。
- **GAP**：INT-10 模糊、INT-09 验收命令与占位符可能不匹配、INT-02～INT-06 行号可加强。

### 三、reportPath 模板与 config/stage-mapping 一致性

- **config/stage-mapping**：未找到独立的 stage-mapping.yaml；scoring-trigger-modes.yaml 的 call_mapping 使用 `stage: speckit_1_2` 等，与任务列表一致。
- **eval-lifecycle-report-paths.yaml**：当前为 `story.report_path`、`layers_4_5`（specify/plan/gaps/tasks/implement），未细化到 `AUDIT_spec-E{epic}-S{story}.md` 等具体模板。INT-10 拟补充的路径需与该文件既有结构兼容，或在 `layers_4_5` 下为各 stage 补充 `report_path_template` 等字段，否则存在结构不一致风险。
- **GAP**：INT-10 需明确与 eval-lifecycle-report-paths.yaml 既有 schema 的整合方式（新增 key 或扩展现有 key）。

### 四、子代理 prompt 修改与主 Agent 修改的衔接

- **INT-07**：要求审计子任务 prompt 中写明「审计通过后请将报告保存至 {path}」，主 Agent 在收到通过结论后运行 parse-and-write-score。子代理 prompt 为 STORY-A2-AUDIT，主 Agent 行为在 bmad-story-assistant 阶段二段末描述。衔接点明确。
- **INT-09**：STORY-A3-DEV 模板中要求子代理「各阶段审计通过时落盘并调用 parse-and-write-score」，与 speckit-workflow INT-02～INT-06 的路径约定一致。但 INT-09 的 `--artifactDocPath` 示例为「对应 spec/plan/tasks 路径」，implement 阶段的 artifactDocPath 应为执行阶段产出路径，任务中未单独说明 implement 的 artifactDocPath 约定，存在实施时推断风险。
- **GAP**：INT-09 对 implement 阶段的 artifactDocPath 未明确，建议补充「implement 阶段 artifactDocPath 为 _bmad-output/.../story-{epic}-{story}-*/ 下的实现产物主文档路径（如 6-3-xxx.md）或可留空由解析器从 reportPath 推导」。

### 五、GAPS 阶段 stage=plan 的解析器兼容性风险

- **共识**：§3.2 GAPS 审计报告格式与 plan 相近，parseAndWriteScore stage 入参用 `plan`。
- **附录**：已说明「若未来 GAPS 报告格式分化，可新增 gaps parser」。
- **风险**：若 GAPS 报告章节结构与 plan 不同（如无 plan 的某些必须字段），现有 plan 解析器可能解析失败。任务列表未要求对 GAPS 报告做解析器兼容性测试。
- **GAP**：建议在 INT-12 或单独任务中增加「使用真实或 mock 的 AUDIT_GAPS-E6-S3.md 调用 parse-and-write-score --stage plan，确认解析成功且写入 scoring/data」，以验证兼容性。

### 六、验收命令的可行性（文件是否存在、命令是否有效）

- **INT-01 验收**：`scoring/parsers/__tests__/fixtures/sample-spec-report.md` 已存在；`npx tsx` 项目未显式依赖，npx 可拉取执行，但与 `package.json` 中 `npx ts-node` 惯例不一致。建议：统一为 `npx ts-node` 或明确要求将 tsx 加入 devDependencies。
- **INT-11 验收**：使用 `specs/epic-6/story-3-foo/AUDIT_spec-E6-S3.md`，该路径可能不存在（需创建或使用已有 fixture）。建议：在验收命令中注明「若路径不存在，可先创建临时文件或使用 specs 下已有 epic-story 路径」。
- **INT-12 验收**：`npm run accept:e3-s3` 存在；`rg "call_mapping" config/scoring-trigger-modes.yaml` 可执行，已验证含 7 键。
- **INT-12 第 3 项**：「模拟一次 Dev Story 流程或手工执行各 stage 审计通过步骤」无具体命令，可操作性弱。建议：明确「至少执行一次 `npx ts-node scripts/parse-and-write-score.ts --reportPath <真实或 fixture 路径> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic 6 --story 3`，检查 scoring/data 下新增记录且 run_id 含 dev-e6-s3-」。

### 七、路径约定与 eval-lifecycle-report-paths 既有结构

- **现状**：eval-lifecycle-report-paths.yaml 使用 `story.report_path`、`layers_4_5.specify` 等，未包含 `AUDIT_spec-E{epic}-S{story}.md` 形式。
- **INT-10**：拟新增 speckit 报告路径约定。需明确是增加顶层 key（如 `speckit_reports`）还是扩展现有 `layers_4_5`。若扩展现有，需保证与 bmad-code-reviewer-lifecycle 等技能读取逻辑一致。
- **GAP**：INT-10 与 config 既有 schema 的整合方式未在任务中写出，存在实施时自由发挥风险。

### 八、call_mapping 与 stage 入参的对应

- **parseAndWriteScore stage**：支持 spec|plan|tasks|story 等（从 orchestrator/parsers 推断）。
- **共识**：GAPS 用 stage=plan。call_mapping 的 stage 为 triggerStage（speckit_1_2 等），与 parseAndWriteScore 的 stage（spec/plan/tasks）为不同概念。任务中已区分：--stage 为 spec|plan|tasks，--triggerStage 为 speckit_x_2。无混淆。
- **GAP**：无。

### 九、失败策略的审计证据要求

- **audit-prompts §5 (8)**：要求「评分写入失败是否 non_blocking 且记录 resultCode 进审计证据」。
- **INT-02～INT-09**：均含「失败 non_blocking、记录 resultCode」。
- **INT-06**：单独强调「要求 resultCode 进审计证据」。其他 INT 未单独强调，但 consensus 已覆盖。建议：在 INT-02～INT-05、INT-07～INT-09 中统一加入「resultCode 进审计证据」或引用 §5 (8)，避免实施时遗漏。
- **GAP**：低优先级，可统一表述增强一致性。

### 十、CONTRACT 文档路径

- **INT-10 备选**：`_bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-1-eval-lifecycle-skill-def/CONTRACT_E3-S1-to-3.2-3.3.md`
- **验证**：该路径存在（通过 grep 结果推断）。CONTRACT 主要用于 Story 3.1 产出与 3.2/3.3 依赖说明，路径约定以 config 为主、CONTRACT 为补充文档更合理。
- **GAP**：INT-10 的「或」导致执行者可能只改 CONTRACT 而不改 config，使运行时读取 config 的技能拿不到路径。建议：强制优先 config，CONTRACT 仅作说明性补充。

---

### 批判审计员本轮结论

**本轮存在 gap。** 具体项如下：

| # | Gap 描述 | 修改建议 |
|---|----------|----------|
| GAP-1 | INT-10「或」表述模糊 | 明确优先修改 config/eval-lifecycle-report-paths.yaml；仅当该文件不承担路径约定时再落 CONTRACT；或两处均需补充并说明优先级 |
| GAP-2 | INT-09 验收命令 `speckit_x_2` 与技能可能写具体值不匹配 | 将验收命令改为 `rg "speckit_[1-5]_2|parse-and-write-score"` 或列出 5 个具体值 |
| GAP-3 | INT-01/INT-11 使用 npx tsx，项目惯例为 ts-node | 统一为 `npx ts-node`，或在 package.json 增加 tsx 依赖并说明 |
| GAP-4 | INT-10 与 eval-lifecycle-report-paths.yaml 既有 schema 整合方式未明确 | 在任务中写明新增 key 名称（如 `speckit_report_paths`）及与 layers_4_5 的关系 |
| GAP-5 | INT-09 对 implement 阶段的 artifactDocPath 未明确 | 补充 implement 阶段 artifactDocPath 的约定或「可留空由解析器推导」的说明 |
| GAP-6 | GAPS 报告与 plan 解析器兼容性未验证 | 在 INT-12 或新任务中增加「使用 AUDIT_GAPS 调用 --stage plan，确认解析成功」的验收 |
| GAP-7 | INT-12 第 3 项「模拟 Dev Story」无具体命令 | 改为至少一次 parse-and-write-score 真实调用 + scoring/data 记录检查 |
| GAP-8 | INT-02～INT-06 精确落点缺行号或更具体锚点 | 补充锚点文本或首版行号范围，便于实施定位（非阻断） |

**结论**：**未通过**。需按上表修改建议更新 §7 任务列表后，再次审计。

**注明**：若主 Agent 传入为第 N 轮，本结论为「第 1 轮」（默认）。

---

## 三、输出与收敛

### 审计结论

**未通过**。批判审计员共提出 8 项 gap，需在 §7 任务列表中落实修改建议后再进行下一轮审计。

### 收敛状态

本轮存在 gap，不满足收敛条件。待 gap 修复后，需连续 3 轮结论为「完全覆盖、验证通过」且批判审计员注明「本轮无新 gap」，方可收敛。

### 修改建议汇总

1. **INT-10**：去掉「或」歧义，明确 config 优先、CONTRACT 补充；写明与 eval-lifecycle-report-paths 既有结构的整合方式。
2. **INT-09**：更新验收命令；补充 implement 阶段 artifactDocPath 约定。
3. **INT-01、INT-11**：验收命令中的 `npx tsx` 改为 `npx ts-node`，或增加 tsx 依赖说明。
4. **INT-12**：第 3 项改为可执行的 parse-and-write-score 调用 + 检查；增加 GAPS 解析器兼容性验收。
5. **INT-02～INT-06**：（建议）补充精确锚点文本或行号，提高可操作性。
