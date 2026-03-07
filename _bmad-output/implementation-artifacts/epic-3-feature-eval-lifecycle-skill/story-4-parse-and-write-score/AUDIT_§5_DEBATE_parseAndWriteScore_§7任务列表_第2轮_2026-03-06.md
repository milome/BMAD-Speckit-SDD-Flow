# §5 适配审计：DEBATE_parseAndWriteScore 集成点设计 §7 任务列表（第 2 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/DEBATE_parseAndWriteScore_集成点设计_100轮共识.md`  
**审计范围**：§7 最终任务列表（INT-01～INT-12）、§1 共识方案、执行顺序建议  
**审计日期**：2026-03-06  
**审计轮次**：第 2 轮（第一轮 8 项 gap 已修正）  
**审计依据**：audit-prompts §5 精神、批判审计员视角（占比 >70%）

---

## 一、§5 适配审计项逐条验证

### 1. 任务是否明确描述修改路径与具体修改内容（禁止模糊表述）

| 任务 | 修改路径 | 具体修改内容 | 结论 |
|------|----------|--------------|------|
| INT-01 | `scripts/parse-and-write-score.ts` | parseArgs 支持 --epic/--story；runId 生成逻辑；Usage 补充 | 明确 ✓ |
| INT-02～INT-06 | `skills/speckit-workflow/SKILL.md` | 精确落点「可结束本步骤之后、若未通过之前」+ 锚点文本；新增子段内容详述 | 明确 ✓ |
| INT-02 | 同上 | 锚点文本已补充：`- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。` 之后、`- 若未通过：` 之前 | 明确 ✓ |
| INT-07、INT-08 | `skills/bmad-story-assistant/SKILL.md` | 精确落点锚定（2.2 段末「每次审计均遵循 §2.1 的优先顺序」之后、`---` 之前；审计结论处理通过分支内） | 明确 ✓ |
| INT-09 | 同上 | STORY-A3-DEV 模板中「执行 Dev Story 实施」之后、「嵌套 speckit-workflow」之前 | 明确 ✓ |
| INT-10 | `config/eval-lifecycle-report-paths.yaml` | **必须**优先修改；若不存在则创建；CONTRACT 仅作说明性补充，不可替代 config | 明确 ✓（第一轮 gap 已修正） |
| INT-11 | `scripts/parse-and-write-score.ts` | 从 reportPath 解析 epic/story 的正则与 runId 逻辑 | 明确 ✓ |
| INT-12 | 验证 | 4 项验证内容、可执行验收命令 | 明确 ✓ |

**结论 1**：所有任务修改路径与内容明确，无模糊表述。INT-10 已修正为「优先 config，若不存在则创建；CONTRACT 仅作说明性补充」。

---

### 2. 是否覆盖 parseAndWriteScore 集成的所有落点（7 个 branch_id）

| branch_id | 对应任务 | call_mapping 验证 |
|-----------|----------|------------------|
| speckit_1_2_audit_pass | INT-02 | ✓ config 含此键 |
| speckit_2_2_audit_pass | INT-03 | ✓ |
| speckit_3_2_audit_pass | INT-04 | ✓ |
| speckit_4_2_audit_pass | INT-05 | ✓ |
| speckit_5_2_audit_pass | INT-06 | ✓ |
| bmad_story_stage2_audit_pass | INT-07 | ✓ |
| bmad_story_stage4_audit_pass | INT-08 | ✓ |

**结论 2**：7 个 branch_id 均有对应任务，与 `config/scoring-trigger-modes.yaml` 的 call_mapping 7 键一致。

---

### 3. 验收命令是否可执行

| 任务 | 验收命令 | 可执行性 | 备注 |
|------|----------|----------|------|
| INT-01 | `npx ts-node scripts/parse-and-write-score.ts ...` + 检查 run_id | ✓ | 已统一为 npx ts-node；fixture sample-spec-report.md 存在 |
| INT-02～INT-06 | `rg "speckit_x_2_audit_pass|..."` | ✓ | grep 可执行 |
| INT-07 | `rg "bmad_story_stage2_audit_pass|parseAndWriteScore"` | ✓ | grep 可执行 |
| INT-08 | `rg "bmad_story_stage4_audit_pass|SCORE_WRITE_CALL_EXCEPTION"` | ✓ | grep 可执行 |
| INT-09 | `rg "parse-and-write-score|speckit_[1-5]_2"` | ✓ | 已改为 speckit_[1-5]_2，可匹配 speckit_1_2～speckit_5_2 |
| INT-10 | `rg "AUDIT_spec|AUDIT_plan|...|speckit_report_paths" config/...` | ✓ | grep 可执行；目标文件明确 |
| INT-11 | `npx ts-node scripts/parse-and-write-score.ts ...` | ✓ | 已统一为 npx ts-node；验收注明「若路径不存在可创建或使用已有路径」 |
| INT-12 | `npm run accept:e3-s3`；rg 9 处以上；parse-and-write-score 调用；GAPS plan 验证 | ✓ | 四项均有可执行命令 |

**结论 3**：所有验收命令可执行。INT-01/INT-11 已统一为 `npx ts-node`；INT-09 验收已改为 `speckit_[1-5]_2`。

---

### 4. run_id 来源、失败策略、call_mapping 衔接

| 维度 | 任务覆盖 | 结论 |
|------|----------|------|
| run_id 来源 | INT-01（--epic/--story）、INT-11（reportPath 解析） | ✓ |
| 失败策略 | INT-02～INT-09 均含「失败 non_blocking、记录 resultCode」；INT-08 含「异常记 SCORE_WRITE_CALL_EXCEPTION」 | ✓ |
| call_mapping 衔接 | 各任务明确 event、triggerStage 与 call_mapping 7 键一致 | ✓ |
| resultCode 进审计证据 | INT-02～INT-06、INT-07、INT-09 明确「记录 resultCode 进审计证据」；INT-08 为「异常记 SCORE_WRITE_CALL_EXCEPTION」 | ✓ |

**结论 4**：run_id、失败策略、call_mapping、resultCode 审计证据均有任务对应。

---

### 5. 路径约定与 config 结构

| 检查项 | 验证结果 |
|--------|----------|
| INT-10 speckit_report_paths | 与 layers_4_5 平级；路径模板含 spec/plan/gaps/tasks/implement | ✓ |
| config/eval-lifecycle-report-paths.yaml | 存在；含 layers_4_5 | ✓ |
| 路径模板完整性 | spec→AUDIT_spec；plan→AUDIT_plan；gaps→AUDIT_GAPS；tasks→AUDIT_tasks；implement→AUDIT_implement | ✓ |

**结论 5**：路径约定与 config 结构明确，speckit_report_paths 与 layers_4_5 平级。

---

### 6. INT-09 CLI 命令格式

| 检查项 | 验证结果 |
|--------|----------|
| 反引号 | 命令用单层反引号包裹，无多余反引号导致断裂 | ✓ |
| --epic、--story | 在命令内 | ✓ |
| --artifactDocPath | 在命令内；implement 阶段明确「可为 story 子目录下实现主文档路径或留空由解析器推导」 | ✓ |
| npx ts-node | 已统一 | ✓ |

**结论 6**：INT-09 CLI 格式正确，implement 阶段 artifactDocPath 约定明确。

---

### 7. INT-12 验证与回归（4 项）

| 项 | 内容 | 可执行性 |
|---|------|----------|
| 1 | `rg "speckit_1_2_audit_pass|parseAndWriteScore|审计通过后评分写入" ...` 有 9 处以上匹配 | ✓ |
| 2 | `npm run accept:e3-s3` 通过 | ✓（package.json 已含） |
| 3 | 至少执行一次 parse-and-write-score，检查 scoring/data 新增记录且 run_id 含 dev-e6-s3- | ✓ |
| 4 | 使用 AUDIT_GAPS 调用 `--stage plan`，确认解析成功，验证 GAPS 与 plan 解析器兼容性 | ✓ |

**结论 7**：INT-12 包含 4 项验证，均有可执行命令或明确检查方式。

---

### 8. audit-prompts §5 检查项 (5)–(8) 覆盖

| 检查项 | 任务列表覆盖 |
|--------|--------------|
| (5) branch_id 在 call_mapping 中且 enabled | INT-02～INT-08 各任务明确 branch_id；config 已含 scoring_write_control.enabled=true |
| (6) parseAndWriteScore 参数证据齐全 | 各任务含 reportPath、stage、event、triggerStage、runId；INT-01/11 支持 --epic/--story |
| (7) eval_question 时 question_version 必填 | INT-02、INT-07 明确「eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」 |
| (8) 评分写入失败 non_blocking 且记录 resultCode 进审计证据 | INT-02～INT-09 均含 |

**结论 8**：audit-prompts §5 (5)–(8) 均有对应任务覆盖。

---

## 批判审计员结论

**（本段落字数与条目数不少于报告其余部分总和的 70%，从对抗视角检查）**

---

### 一、第一轮 8 项 gap 修正验证（逐项对抗核查）

| # | 第一轮 gap | 修正后状态 | 对抗核查 |
|---|------------|------------|----------|
| GAP-1 | INT-10「或」表述模糊 | 已改为「**必须**优先修改 config；若不存在则创建；CONTRACT 仅作说明性补充，不可替代 config」 | ✓ **通过**：无歧义，执行者不会误改 CONTRACT 替代 config |
| GAP-2 | INT-09 验收 `speckit_x_2` 与技能可能不匹配 | 已改为 `rg "parse-and-write-score\|speckit_[1-5]_2"` | ✓ **通过**：speckit_[1-5]_2 可匹配 speckit_1_2～5_2；实施后技能将写入这些字符串 |
| GAP-3 | INT-01/INT-11 使用 npx tsx | 已统一为 `npx ts-node` | ✓ **通过**：package.json 含 ts-node，无 tsx 依赖 |
| GAP-4 | INT-10 与 eval-lifecycle-report-paths 既有 schema 整合方式未明确 | 已明确「新增 speckit_report_paths 顶层 key（与 layers_4_5 平级）」 | ✓ **通过**：config 当前有 layers_4_5，新增平级 key 可执行 |
| GAP-5 | INT-09 implement 阶段 artifactDocPath 未明确 | 已补充「implement 阶段 artifactDocPath 可为 story 子目录下实现主文档路径或留空由解析器从 reportPath 推导」 | ✓ **通过** |
| GAP-6 | GAPS 报告与 plan 解析器兼容性未验证 | INT-12 第 4 项已增加「使用 AUDIT_GAPS-E6-S3.md（或 mock）调用 --stage plan，确认解析成功且写入 scoring/data」 | ✓ **通过** |
| GAP-7 | INT-12 第 3 项「模拟 Dev Story」无具体命令 | 已改为「至少执行一次 npx ts-node scripts/parse-and-write-score.ts ... 检查 scoring/data 下新增记录且 run_id 含 dev-e6-s3-」 | ✓ **通过** |
| GAP-8 | INT-02～INT-06 精确落点缺锚点 | INT-02 已补充完整锚点文本「`- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。` 之后、`- 若未通过：` 之前」；INT-03～06 引用「**仅在** ... **可结束本步骤**」之后、「若未通过」之前 | ✓ **通过**：speckit-workflow SKILL.md 经 grep 验证，§1.2～§5.2 均含该锚点 |

**对抗结论**：第一轮 8 项 gap 均已修正，无遗漏。

---

### 二、遗漏任务与边界检查（对抗视角）

| 检查项 | 结果 |
|--------|------|
| 7 个 branch_id 是否均有任务 | 是。INT-02～06 对应 speckit_1_2～5_2；INT-07、08 对应 bmad_story_stage2/4 |
| call_mapping 7 键与任务一一对应 | 是。config/scoring-trigger-modes.yaml 含 7 键，与任务一致 |
| 是否遗漏 standalone speckit（无 epic/story）场景 | 共识已覆盖：runId 兜底 `cli-${Date.now()}`；INT-11 明确「均失败则 cli-${Date.now()}」 |
| 是否遗漏 eval_question scenario | INT-02、INT-07 明确「eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用」 |
| 实施后审计（§5）是否需单独任务 | 否。INT-08 为 bmad_story_stage4_audit_pass，即实施后审计通过时触发；INT-12 为综合验证 |

**对抗结论**：无遗漏任务。

---

### 三、行号漂移、路径失效、锚点可定位性（对抗核查）

| 检查项 | 结果 |
|--------|------|
| speckit-workflow 锚点存在性 | grep 验证：`- **仅在** code-review 审计报告结论为「完全覆盖、验证通过」时**可结束本步骤**。` 与 `- 若未通过：` 在 §1.2～§5.2 均存在（行 158-159、184-185、226-227、250-251、374-375） |
| bmad-story-assistant INT-07 锚点 | 「每次审计均遵循 §2.1 的优先顺序」存在于行 558；`---` 在行 559；插入点明确 |
| INT-08 锚点 | 「**通过（A/B级）**」分支内「Story标记为完成」之后；需实施时在技能中定位，无行号但不影响 |
| INT-10 目标文件存在性 | config/eval-lifecycle-report-paths.yaml 存在；layers_4_5 已存在 |
| INT-01/INT-11 fixture 存在性 | scoring/parsers/__tests__/fixtures/sample-spec-report.md 存在 |
| parse-and-write-score.ts 存在性 | scripts/parse-and-write-score.ts 存在 |

**对抗结论**：无路径失效；锚点可定位；行号可能随版本漂移，但锚点文本稳定。

---

### 四、验收命令与占位符一致性（对抗核查）

| 检查项 | 结果 |
|--------|------|
| INT-09 验收 `speckit_[1-5]_2` 与技能将写入的文本 | 技能将写入「speckit_1_2|speckit_2_2|...|speckit_5_2」或类似；`speckit_[1-5]_2` 可匹配其中任意一个 |
| INT-12 第 1 项「9 处以上」合理性 | 实施后：speckit-workflow 5 处（§1.2～5.2 各一处触发段落）+ bmad-story 4 处（INT-07、08、09 等）≥9，可达成 |
| npm run accept:e3-s3 存在性 | package.json 含 "accept:e3-s3": "npx ts-node scripts/accept-e3-s3.ts" |
| rg "call_mapping" config/scoring-trigger-modes.yaml 含 7 键 | 已验证：call_mapping 下含 7 个 branch_id |

**对抗结论**：验收命令与实施后文本一致；占位符无冲突。

---

### 五、config 结构冲突与既有 schema 兼容性（对抗核查）

| 检查项 | 结果 |
|--------|------|
| eval-lifecycle-report-paths.yaml 既有结构 | version、prd、arch、story、layers_4_5；layers_4_5 为 specify/plan/gaps/tasks/implement/post_impl |
| speckit_report_paths 与 layers_4_5 平级 | 新增顶层 key，不修改 layers_4_5；无结构冲突 |
| bmad-code-reviewer-lifecycle 等是否依赖 layers_4_5 | 任务未要求修改 layers_4_5，仅新增 speckit_report_paths；既有逻辑不受影响 |

**对抗结论**：无 config 结构冲突。

---

### 六、§1 共识方案与 §7 任务列表一致性（对抗核查）

| 检查项 | 结果 |
|--------|------|
| §1.2 调用链仍写 `npx tsx` | **不一致**：§1.2 第 134 行仍为 npx tsx；§7 任务已统一 npx ts-node。建议后续同步 §1.2 为 npx ts-node，避免实施时混淆。**非阻断**：任务列表本身正确，§1 为共识摘要 |
| §1.2 triggerStage 写 `speckit_x_2` | 为占位符泛指，任务中已明确各阶段具体值；可接受 |
| 执行顺序建议 | INT-01/11 → INT-10 → INT-02～06 → INT-07/08/09 → INT-12；依赖顺序正确 |

**对抗结论**：§1.2 调用链与 §7 存在 tsx/ts-node 表述不一致，建议修正 §1.2；不作为本轮阻断 gap。

---

### 七、audit-prompts §5 (5)–(8) 可验证性（对抗核查）

| 检查项 | 实施后审计能否验证 |
|--------|---------------------|
| (5) branch_id 在 call_mapping 且 enabled | 可：rg config 文件 + 任务要求读 enabled |
| (6) 参数证据齐全 | 可：任务明确各参数；INT-12 验证 parse-and-write-score 调用 |
| (7) question_version 必填 | 可：任务要求「缺则记 SCORE_WRITE_INPUT_INVALID 且不调用」 |
| (8) non_blocking + resultCode 进审计证据 | 可：任务明确「记录 resultCode 进审计证据」；INT-08 为「异常记 SCORE_WRITE_CALL_EXCEPTION」 |

**对抗结论**：§5 (5)–(8) 均可在实施后审计中验证。

---

### 八、INT-08 与 resultCode 进审计证据的表述完整性（对抗核查）

| 检查项 | 结果 |
|--------|------|
| INT-08 具体修改 | 「异常记 SCORE_WRITE_CALL_EXCEPTION；主流程继续到完成选项」 |
| 是否明确「进审计证据」 | 未显式写「进审计证据」；SCORE_WRITE_CALL_EXCEPTION 为 resultCode 的一种，记录即进证据。第一轮 GAP-9 为低优先级。 |

**对抗结论**：为表述完整可建议补充「记录 resultCode（SCORE_WRITE_CALL_EXCEPTION）进审计证据」；不作为阻断 gap。

---

### 九、实施时可能出现的自由发挥点（对抗核查）

| 检查项 | 风险 | 任务是否约束 |
|--------|------|--------------|
| INT-09 各阶段 artifactDocPath 具体路径 | 实施者可能对 implement 阶段路径理解不同 | 已明确「可为 story 子目录下实现主文档路径或留空由解析器推导」 ✓ |
| INT-10 speckit_report_paths 下各 stage 的 key 名 | 可能用 specify/plan/gaps/tasks/implement 或 spec/plan 等 | 任务已列出 spec/plan/gaps/tasks/implement 五类 ✓ |
| GAPS 报告格式与 plan 解析器兼容性 | 若 GAPS 格式与 plan 差异大，解析可能失败 | INT-12 第 4 项要求验证；附录已说明 stage=plan ✓ |

**对抗结论**：关键自由发挥点已有约束。

---

### 十、综合对抗结论

| 维度 | 结论 |
|------|------|
| 第一轮 8 项 gap | 全部修正 |
| 遗漏任务 | 无 |
| 路径/锚点失效 | 无 |
| 验收命令不可执行 | 无 |
| 占位符与实际文本不符 | 无（INT-09 已改为 speckit_[1-5]_2） |
| config 结构冲突 | 无 |
| §1 与 §7 表述不一致 | 存在（§1.2 仍写 tsx），建议修正，非阻断 |

---

### 批判审计员本轮结论

**本轮无新 gap。**

第一轮 8 项 gap 均已修正；逐项对抗核查未发现新增遗漏、路径失效、验收不可执行或 config 冲突。§1.2 调用链仍写 `npx tsx` 与 §7 的 `npx ts-node` 不一致，建议后续同步，不作为本轮阻断项。

**建议**：累计至连续 3 轮无 gap 后收敛；本轮为第 2 轮。

---

## 三、输出与结论

### 审计结论

**完全覆盖、验证通过。**

§7 任务列表（INT-01～INT-12）经逐项验证，满足 audit-prompts §5 适配要求；第一轮 8 项 gap 已修正；批判审计员对抗核查未发现新 gap。

### 收敛状态

本轮无新 gap。建议累计至连续 3 轮结论为「完全覆盖、验证通过」且批判审计员注明「本轮无新 gap」后，正式收敛。

### 可选改进（非阻断）

1. **§1.2 调用链**：将 `npx tsx` 同步为 `npx ts-node`，与 §7 一致。
2. **INT-08**：可补充「记录 resultCode（SCORE_WRITE_CALL_EXCEPTION）进审计证据」，与 INT-02～07、09 表述统一。
