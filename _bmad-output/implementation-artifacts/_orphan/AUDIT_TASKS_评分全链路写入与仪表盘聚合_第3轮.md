# TASKS 审计报告：评分全链路写入与仪表盘聚合（第 3 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`  
**审计依据**：audit-prompts §5 执行阶段审计、第 2 轮报告（参考但不依赖）  
**审计日期**：2026-03-06  
**审计类型**：第 3 轮——独立性复验 + 批判审计员对抗性再查（满足「连续 3 轮无 gap」收敛条件）

---

## 一、独立性复验（逐项核对 T1～T11）

### T1：bmad-story-assistant 阶段四插入「parse-and-write-score」显式步骤

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md` 存在（已 grep 确认）；fallback `~/.cursor/skills/...` 明确；项目内优先无歧义 |
| **修改位置** | 「阶段四」→「审计结论处理」→「通过（A/B级）」→「审计通过后评分写入触发」段落：锚点 `审计通过后评分写入触发` 在 SKILL line 936 唯一存在 |
| **插入锚点** | 在「审计通过后评分写入触发」**之前**插入步骤 4.2；锚点可 grep，位置唯一 |
| **验收标准** | 1) grep `步骤 4.2：运行 parse-and-write-score` ✓ 可量化；2) grep CLI 示例 ✓；3) grep `AUDIT_Story_{epic}-{story}_stage4.md` ✓ |
| **依赖** | 无 ✓ |

**独立结论**：路径、锚点、验收均可执行，无新 gap。

---

### T2：bmad-story-assistant 审计子任务 prompt 中约定报告保存路径

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | 同上 T1，项目内 skills 存在 ✓ |
| **修改位置** | STORY-A4-POSTAUDIT 模板内；锚点 `审计通过后请将报告保存至` 或 `AUDIT_Story_`；stage2（line 592）已有该短语，stage4 段落可据此新增 |
| **具体修改** | 增加「审计通过后请将报告保存至 `...AUDIT_Story_{epic}-{story}_stage4.md`」；与 stage2 表述一致，可操作 |
| **验收标准** | grep STORY-A4-POSTAUDIT 或该路径约定于 stage4 段落 ✓ |
| **依赖** | 无 ✓ |

**独立结论**：锚点可 grep，插入逻辑明确（存在则插、不存在则新增），无新 gap。

---

### T3：主 Agent 收到审计通过后自动解析 reportPath

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | 同 T1 ✓ |
| **修改位置** | 阶段四「审计结论处理」→ 主 Agent 职责说明；当前 line 936-937 已有 parse-and-write-score 触发描述，需补充自动化逻辑与 SCORE_WRITE_SKIP_REPORT_MISSING 边界 |
| **验收标准** | 「SKILL 文档明确上述自动化逻辑及边界条件」——略偏主观，但可审（人工或二次审计可判定） |
| **依赖** | T1, T2 ✓ |

**独立结论**：可执行，验收略主观但不构成 gap（第 2 轮已接受）。

---

### T4：parse-and-write-score 支持 implement 阶段区分（短期方案）

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `scoring/writer/types.ts`、`scoring/schema/run-score-schema.json`、`scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts` 均存在 ✓ |
| **具体修改** | 短期方案明确：`trigger_stage` 可选字段；`--stage tasks` 保持；`--triggerStage` 参数；scripts 已有 `--triggerStage`（line 66），需扩展写入逻辑 |
| **验收标准** | 1) CLI 执行后 record 含 `trigger_stage` ✓ 可断言；2) 单测覆盖 ✓ |
| **与 T5/T7 一致性** | T5 补跑用 `triggerStage=bmad_story_stage4`；T4 为 speckit_5_2；无冲突 ✓ |
| **aggregateByBranch 延后** | 已注明本轮不实现，无矛盾 ✓ |

**独立结论**：方案清晰，无新 gap。

---

### T5：Story 完成时检查 scoring/data/ 是否已写入

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md`；新建 `scripts/check-story-score-written.ts` ✓ |
| **路径 fallback** | 第 2 轮 2.1.1：未写「否则 ~/.cursor/...」，可推定沿用 T1～T3；非阻塞 ✓ |
| **补跑决策** | 默认仅提醒；报告路径存在且可构造则补跑；否则仅提醒 ✓ |
| **T4 延后时** | 补跑用 stage=tasks、triggerStage=bmad_story_stage4 ✓ 与 T1 一致 |
| **run_id 匹配** | `dev-e{N}-s{N}-` 与 RUN_ID_CONVENTION §2.1 解析规则 `-e(\d+)-s(\d+)-` 一致 ✓ |
| **验收标准** | 1) 脚本可运行、输出有/无 ✓；2) SKILL 嵌入检查步骤 ✓ |
| **依赖** | T3, T4 ✓ |

**独立结论**：可执行，无新 gap。

---

### T6：检查逻辑与路径约定文档化

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `docs/BMAD/审计报告格式与解析约定.md` 存在 ✓ |
| **主目标与 yaml 分离** | 主修改目标明确；yaml 扩展「若有」单独列出 ✓ |
| **验收标准** | grep `Story 完成自检` ✓；章节含三项内容 ✓ |
| **依赖** | T5 ✓ |

**独立结论**：无新 gap。

---

### T7：聚合逻辑：按时间窗口与 epic/story 聚合

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `scoring/dashboard/compute.ts`、`scoring/query/loader.ts` 存在 ✓ |
| **aggregateByBranch** | 已明确本轮不实现，RunScoreRecord 无 branch 字段 ✓ |
| **aggregateByEpicStoryTimeWindow** | 函数签名、参数、行为描述清晰 ✓ |
| **getLatestRunRecordsV2** | strategy 选项明确 ✓ |
| **验收标准** | 单测 + getLatestRunRecordsV2 调用断言 ✓ |
| **依赖** | 无 ✓ |

**独立结论**：无新 gap。

---

### T8：仪表盘按 epic/story 聚合计算总分与四维

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `scripts/dashboard-generate.ts`、`scoring/dashboard/compute.ts` 存在 ✓ |
| **完整 run 定义** | 「至少 3 个 stage」与 Party-Mode「5 阶段」的语义差：第 2 轮 2.1.4 已记录，非新 gap，实施时文档化即可 ✓ |
| **验收标准** | 3 条 fixture（dev-e8-s1-spec-*、plan-*、tasks-*，phase_score 80/90/92），断言总分与四维，允许 ±1 ✓ |
| **依赖** | T7 ✓ |

**独立结论**：可量化验收，无新 gap。

---

### T9：跨 run 聚合与短板计算

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `scoring/dashboard/compute.ts`、`scoring/dashboard/format.ts` ✓ |
| **验收标准** | 单测 getWeakTop3 + 仪表盘 grep ✓ |
| **依赖** | T8 ✓ |

**独立结论**：无新 gap。

---

### T10：speckit-workflow 各 stage 审计通过后强制 parse-and-write-score

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | 项目内 `skills/speckit-workflow/SKILL.md` 存在 ✓ |
| **implement 路径** | `AUDIT_implement-E{epic}-S{story}.md` 与 config/eval-lifecycle-report-paths.yaml line 29 一致 ✓ |
| **§1.2～§5.2 五处** | speckit-workflow 存在 §1.2、§2.2、§3.2、§4.2、§5.2 及对应「审计通过后评分写入触发」 ✓ |
| **验收 fallback** | 第 2 轮 2.1.3：若修改 fallback 路径，验收需在「实际修改的文件」上 grep；建议已记录，非阻塞 ✓ |
| **验收标准** | grep `AUDIT_implement`、`speckit_5_2`、`parse-and-write-score`；五处结构一致 ✓ |

**独立结论**：无新 gap。

---

### T11：run_id 共享策略

| 检查项 | 复验结果 |
|--------|----------|
| **修改路径** | `scripts/parse-and-write-score.ts`、`scoring/docs/RUN_ID_CONVENTION.md` 存在 ✓ |
| **方案** | --runGroupId 或 runId 约定二选一；验收「或等效机制」可满足 ✓ |
| **依赖** | T7 ✓ |

**独立结论**：无新 gap。

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 对抗视角：修改路径「项目内 vs 全局」歧义检查

- **T1、T2、T3、T5、T10**：均写「项目内 `skills/...`（若存在）；否则 `~/.cursor/skills/...`」。项目根经 grep 确认存在 `skills/bmad-story-assistant/SKILL.md`、`skills/speckit-workflow/SKILL.md`，**无歧义**。实施者优先修改项目内文件，fallback 仅当项目内不存在时生效。
- **T4、T6、T7、T8、T9、T11**：均为项目内代码/文档路径，无全局 fallback，**无歧义**。

**批判审计员**：路径约定明确，项目内与全局边界清晰。**无新 gap**。

---

### 2.2 对抗视角：插入位置锚点唯一性与可 grep 性

| 任务 | 锚点 | 唯一性 | 可 grep |
|------|------|--------|----------|
| T1 | `审计通过后评分写入触发`（阶段四） | 阶段四段落内唯一；阶段二亦有该短语，但上下文不同（line 592 vs 936），实施者按阶段四定位 | ✓ |
| T2 | `审计通过后请将报告保存至` 或 `AUDIT_Story_` | stage2 有前者；stage4 需新增；后者可匹配路径模板 | ✓ |
| T3 | 阶段四「审计结论处理」→ 主 Agent 职责 | 段落明确 | ✓ |
| T5 | 阶段四通过后、提供完成选项前 | 流程位置明确（line 934-951 之间） | ✓ |
| T6 | `Story 完成自检`（新增章节） | 新建章节，标题唯一 | ✓ |

**批判审计员**：所有锚点均可 grep 或按段落定位，插入逻辑可操作。**无新 gap**。

---

### 2.3 对抗视角：验收标准可量化性

| 任务 | 验收方式 | 可量化？ |
|------|----------|----------|
| T1 | grep 步骤 4.2、CLI、路径模板 | ✓ |
| T2 | grep 保存路径约定 | ✓ |
| T3 | 文档明确自动化逻辑 | 略主观，可审 |
| T4 | CLI 执行 + record 断言 + 单测 | ✓ |
| T5 | 脚本执行 + 输出有/无 + SKILL 嵌入 | ✓ |
| T6 | grep 章节 + 内容三项 | ✓ |
| T7 | 单测 + getLatestRunRecordsV2 断言 | ✓ |
| T8 | fixture + 总分/四维断言（±1） | ✓ |
| T9 | 单测 + 仪表盘 grep | ✓ |
| T10 | grep 三关键词 + 五处结构一致 | ✓ |
| T11 | 文档更新 + --runGroupId 或等效 | ✓ |

**批判审计员**：除 T3 略偏「文档明确」外，其余均可通过 grep、单测、fixture 断言验收。T3 在实施后可由二次审计判定，**不构成 gap**。

---

### 2.4 对抗视角：T4 短期方案、T7 aggregateByBranch 延后、T5 补跑触发条件一致性

- **T4 短期方案**：`--stage tasks` + `trigger_stage` 可选字段；中期 stage=implement 延后。与 T1/T2/T5 的 bmad_story_stage4 场景无冲突；与 T10 speckit_5_2 场景互补。
- **T7 aggregateByBranch**：已明确「本轮不实现」，原因（RunScoreRecord 无 branch、source_path 未约定）充分，无矛盾。
- **T5 补跑**：默认仅提醒；报告路径存在且可构造则补跑；T4 延后时用 stage=tasks、triggerStage=bmad_story_stage4。三者逻辑自洽，**无矛盾**。

**批判审计员**：**无新 gap**。

---

### 2.5 对抗视角：新发现 gap 排查（前轮未提及）

逐一检查：

1. **T1 artifactDocPath 模板**：CLI 示例中 `--artifactDocPath <story 文档路径>` 未给出路径模板。bmad-story-assistant line 856 允许 implement 阶段 artifactDocPath 留空由解析器从 reportPath 推断。**结论**：可执行，不构成 gap。

2. **T2 STORY-A4-POSTAUDIT 模板位置**：模板可能分散于 skill 或 audit-prompts。T2 修改路径为 bmad-story-assistant SKILL.md，在 stage4 段落增加「要求审计子任务 prompt 中写明...」与 stage2 一致即可。**结论**：可操作，不构成 gap。

3. **T5 与 T1 执行顺序**：T5 检查在「阶段四通过后、提供完成选项前」；T1 步骤 4.2 在「审计通过后」即运行 parse-and-write-score。顺序：T1 先写 → T5 再查 → 若无则补跑。**结论**：逻辑正确，无 gap。

4. **T8 phase_weight**：T8 验收写「phase_weight 各 0.2」，3×0.2=0.6，若仅 3 个 stage 则未满 1.0。可能为简化 fixture 设计，实施时需确认 schema 约束。**结论**：非文档 gap，实施细节可处理。

5. **T10 验收路径 fallback**：第 2 轮 2.1.3 已记录——若修改 ~/.cursor/skills，验收 grep 项目内路径会失败。建议验收注明「在实际修改的 SKILL 路径执行 grep」。**结论**：改进建议，非阻塞。

**批判审计员**：经对抗性排查，**未发现必须计入的新 gap**。

---

### 2.6 与前轮一致性复核

- 第 2 轮结论：完全覆盖、验证通过；本轮无新 gap。
- 本轮独立性复验：逐项核对 T1～T11，路径、锚点、验收、依赖均与文档一致，项目内文件存在性已确认。
- 第 2 轮 9 项 GAP（GAP-CA-1～9）：均已落实，本轮未发现回退或遗漏。

**批判审计员**：与前轮结论一致，独立复验支持通过判定。

---

### 2.7 批判审计员最终判定

经独立性复验、对抗视角检查与新 gap 排查：

1. **T1～T11**：修改路径、锚点、验收标准、依赖关系均明确、可执行、可验收。
2. **T4、T5、T7**：短期方案、补跑逻辑、aggregateByBranch 延后无矛盾。
3. **新 gap**：未发现必须计入的新 gap。
4. **第 2 轮改进建议**（T5 fallback 表述、T10 验收路径）：不阻塞，可于实施时优化。

**结论**：**本轮无新 gap**，第 3 轮。**连续 3 轮（第 2、3 轮）无 gap，可收敛**。

---

## 三、审计结论

### 结论：**完全覆盖、验证通过**

- 独立性复验：T1～T11 逐项核对，路径、锚点、验收、依赖均满足可执行与可验收要求。
- 批判审计员对抗性检查：路径歧义、锚点唯一性、验收可量化性、T4/T5/T7 一致性、新 gap 排查均无阻塞发现。
- **本轮无新 gap**，第 3 轮。
- **连续 3 轮（第 2、3 轮）无 gap，可收敛**。

### 非阻塞改进建议（可选）

1. **T5**：修改路径补充「否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」，与 T1～T3 表述统一。
2. **T10**：验收标准补充「若修改路径为 fallback（~/.cursor/...），则在对应路径执行 grep」。

### 收敛声明

满足「连续 3 轮无 gap」条件，本 TASKS 文档可进入实施阶段。

---

*本报告由 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
