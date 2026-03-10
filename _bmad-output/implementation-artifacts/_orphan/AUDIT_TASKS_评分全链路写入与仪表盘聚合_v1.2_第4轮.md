# TASKS 审计报告：评分全链路写入与仪表盘聚合 v1.2.1（第 4 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`（v1.2.1）  
**审计依据**：audit-prompts §5 执行阶段审计、完全覆盖与验证通过精神；第 2、3 轮报告（参考、独立复验）  
**审计日期**：2026-03-06  
**审计类型**：第 4 轮——最终收敛验证 + 批判审计员对抗性终查（满足「连续 3 轮无 gap」收敛条件）

---

## 一、与前轮交叉验证及复验摘要

### 1.1 第 2、3 轮结论回顾

| 轮次 | 结论 | 批判审计员核心判定 |
|------|------|-------------------|
| 第 2 轮 | 完全覆盖、验证通过；本轮无新 gap | GAP-T12-1 已消除；唯一锚点 + grep -c 可独立验证 |
| 第 3 轮 | 完全覆盖、验证通过；本轮无新 gap | T1～T12 独立复验通过；T12 四条 grep -c 可执行 |

### 1.2 第 4 轮独立复验（扼要）

- **路径存在性**：`skills/bmad-story-assistant/SKILL.md`、`skills/speckit-workflow/SKILL.md`、`skills/speckit-workflow/references/audit-prompts.md`、`scripts/parse-and-write-score.ts`、`scoring/dashboard/compute.ts`、`docs/BMAD/审计报告格式与解析约定.md` 均存在于项目中。
- **audit-prompts 结构**：`## 1. spec`、`## 2. plan`、`## 3. IMPLEMENTATION_GAPS`、`## 4. tasks`、`## 5. 执行`，与 T12 的 §1/§2/§3/§5 映射一致；§4 已有 §4.1 可解析块强制要求。
- **CLI 支持**：`scripts/parse-and-write-score.ts` 已支持 `--triggerStage`、`--iteration-count`（line 66-68）。
- **Phase 1 顺序**：文档正确写为 `T1 → T2 → T3 → T4 → T12 → T10 → T11`，T12 在 T10 前，符合「各阶段报告若无可解析块，parse-and-write-score 解析失败」的逻辑依赖。

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 对抗视角一：T12 是否被遗漏或验收不可执行？

**质疑**：第 4 轮作为收敛轮，必须对 T12 做终验。T12 是 v1.2/v1.2.1 的核心修订对象，若未充分验证则收敛无效。

**逐项核对**：
- **修改路径**：`skills/speckit-workflow/references/audit-prompts.md`（项目内）或 `~/.cursor/skills/speckit-workflow/references/audit-prompts.md`（fallback）。路径明确，与项目内已存在的 `skills/speckit-workflow/references/audit-prompts.md` 一致。
- **验收标准 1-4**：`grep -c '【§1 可解析块要求】' audit-prompts.md` 为 1；同理 §2、§3、§5。四条命令均可独立执行，输出与 1 比较即判定通过/不通过。grep -c 匹配 0 次时 exit 1、输出 0；匹配 1 次时 exit 0、输出 1；文件不存在时 exit 2。**可执行、可量化**。
- **验收标准 5**：「五阶段 prompt 均要求报告结尾含可解析块（§4 已有，§1/§2/§3/§5 通过上述锚点落实）」为说明性条款，与 1-4 无冗余或矛盾；1-4 已覆盖 §1/§2/§3/§5 四处新增。
- **锚点唯一性**：`【§1 可解析块要求】`、`【§2 可解析块要求】`、`【§3 可解析块要求】`、`【§5 可解析块要求】` 格式唯一，与 audit-prompts 现有内容（含 §4.1）无冲突；当前文件中无此类文本，实施后由 T12 新增。
- **路径显式性**：验收命令使用 `audit-prompts.md`，未写完整路径。与修改路径同处 T12 表格，实施者可推断操作对象。第 2、3 轮均判为非阻塞改进建议。**不构成本轮 gap**。

**判定**：T12 验收**可独立执行**，无遗漏、无伪可验证。**无 gap**。

---

### 2.2 对抗视角二：Phase 1 顺序与 T12 依赖是否正确？

**质疑**：若 Phase 1 顺序写错，实施者可能先做 T10 再做 T12，导致各阶段调用 parse-and-write-score 时报告无块、解析失败。

**验证**：§3 实施顺序明确为 `T1 → T2 → T3 → T4 → T12 → T10 → T11`；§3 说明「T12 须在 T10 前完成」；T12 实施阶段注「须在 T10 前完成；否则各阶段调用 parse-and-write-score 时报告无块，解析失败」。三者一致。依赖链无循环、无矛盾。

**判定**：**无 gap**。

---

### 2.3 对抗视角三：T1～T11 遗漏与歧义逐项终查

#### T1
- **插入位置**：在「审计通过后评分写入触发」**之前**插入步骤 4.2。两种理解均可：段落内首句或独立小节。**无阻塞歧义**。
- **CLI 示例**：含 `--reportPath`、`--stage tasks`、`--event story_status_change`、`--triggerStage bmad_story_stage4`、`--epic`、`--story`、`--artifactDocPath`、`--iteration-count`。**完整**。
- **artifactDocPath**：`<story 文档路径>` 未给模板；前轮判可由 reportPath 推断或留空。**不构成 gap**。

#### T2
- **STORY-A4-POSTAUDIT 分散**：修改 bmad-story-assistant，若 prompt 引用自他处，可能需同步。前轮判在 stage4 段落增加要求即可。**不阻塞**。
- **锚点**：`审计通过后请将报告保存至`、`AUDIT_Story_` 可 grep 定位。**无歧义**。

#### T3
- **验收主观性**：「SKILL 文档明确上述自动化逻辑及边界条件」略主观；实施后可由二次审计判定。前两轮均已接受。**不构成新 gap**。
- **SCORE_WRITE_SKIP_REPORT_MISSING**：边界已定义，可操作。**无遗漏**。

#### T4
- **短期方案**：trigger_stage 字段；中期 stage=implement 延后。与 T5、T10 的 bmad_story_stage4、speckit_5_2 无冲突。**一致**。
- **写入链**：types.ts、run-score-schema.json、parse-and-write.ts、parse-and-write-score.ts。scripts 已支持 `--triggerStage`。**可执行**。

#### T5
- **路径 fallback**：未写 `~/.cursor/...`，可推定沿用 T1～T3 规则。**非阻塞**。
- **补跑与 T1 顺序**：T1 先写 → T5 再查 → 若无则补跑。**顺序正确**。

#### T6
- **主目标与 yaml**：主修改为 `docs/BMAD/审计报告格式与解析约定.md`；yaml「若有」单独列出。**无歧义**。

#### T7
- **aggregateByBranch 延后**：已明确「本轮不实现」，原因充分。**无遗漏**。
- **windowHours**：默认 24h，与 Party-Mode 共识一致。**可操作**。

#### T8
- **至少 3 个 stage**：与 5 阶段有语义差，实施时文档化即可。**非新 gap**。
- **phase_weight 总和**：验收用例 3×0.2=0.6；可能为简化 fixture。第 3 轮判为实施细节。**不构成文档 gap**。

#### T9
- **getWeakTop3**：按 epic/story 聚合、取最低分、Top 3 升序。描述清晰，单测可覆盖。**可执行**。

#### T10
- **implement 路径**：与 config/eval-lifecycle-report-paths.yaml 对齐。**无歧义**。
- **验收 fallback**：若修改 ~/.cursor/skills，grep 项目内路径会失败。前轮建议「在实际修改路径执行 grep」。**改进建议，非阻塞**。

#### T11
- **--runGroupId 与 runId 约定**：两种方案并列，验收「或等效机制」可满足。**可执行**。
- **与 T7 衔接**：run_group_id 可选；T11 可独立实现。**无矛盾**。

**判定**：T1～T11 无阻塞性遗漏、歧义或不可执行项。**无 gap**。

---

### 2.4 对抗视角四：实施后可验证性终验

| 任务 | 验证方式 | 可断言？ |
|------|----------|----------|
| T1 | grep 步骤 4.2、CLI、路径模板 | ✓ |
| T2 | grep 保存路径约定 | ✓ |
| T3 | 人工或二次审计判定 | 略主观，可审 |
| T4 | CLI + record 含 trigger_stage + 单测 | ✓ |
| T5 | 脚本执行 + 输出有/无 + SKILL 嵌入 | ✓ |
| T6 | grep Story 完成自检 + 三项内容 | ✓ |
| T7 | 单测 + getLatestRunRecordsV2 | ✓ |
| T8 | fixture + 总分/四维断言（±1） | ✓ |
| T9 | 单测 getWeakTop3 + 仪表盘 grep | ✓ |
| T10 | grep AUDIT_implement、speckit_5_2、parse-and-write-score | ✓ |
| T11 | 文档更新 + --runGroupId 或等效 | ✓ |
| **T12** | **4×grep -c 各为 1** | **✓** |

除 T3 外均具备可量化或可 grep 验收。T3 可由实施后审计判定。**无阻塞**。

---

### 2.5 对抗视角五：依赖链与 Phase 顺序完整性

```
Phase 1: T1 → T2 → T3 → T4 → T12 → T10 → T11
Phase 2: T5(T3,T4) → T6(T5)
Phase 3: T7 → T8(T7) → T9(T8)
```

- T12 在 T10 前：**正确**。
- T4 延后时 T5 补跑：已说明 stage=tasks、triggerStage=bmad_story_stage4。**自洽**。
- T7 与 T11：run_group_id 可选，T11 可独立于 T7 聚合逻辑实现。**无循环**。
- Phase 3 验收依赖 Phase 1 数据：T8、T9 需 scoring/data 有记录。**顺序正确**。

**判定**：**无 gap**。

---

### 2.6 对抗视角六：边界与模型易忽略风险

| 风险 | 覆盖情况 |
|------|----------|
| 迭代次数传递 | T1 CLI 含 `--iteration-count`；Party-Mode 共识「一次通过传 0」 |
| reportPath 不存在 | T3 边界 SCORE_WRITE_SKIP_REPORT_MISSING、不阻断 |
| 子任务输出非结构化 | T3 约定优先约定路径推断，次从子任务输出提取 |
| epic/story 解析 | T5、T7 使用 parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-` |

**判定**：**已覆盖**。

---

### 2.7 对抗视角七：需求追溯完整性

| 需求 | 对应任务 | 覆盖 |
|------|----------|------|
| REQ-1 | T1, T2 | ✓ |
| REQ-2 | T3, T4 | ✓ |
| REQ-3 | T5, T6 | ✓ |
| REQ-4 | T7, T8, T9 | ✓ |
| REQ-5 | T10, T11 | ✓ |
| REQ-6 | T8, T9 | ✓ |
| REQ-7 | T12 | ✓ |

6 议题、REQ-1～REQ-7 均有对应任务。**无遗漏**。

---

### 2.8 对抗视角八：第 4 轮独有新 gap 排查

1. **T12 锚点与 §4.1 关系**：§4 已有可解析块要求，T12 不修改 §4。锚点仅加在 §1、§2、§3、§5。**无冲突**。
2. **锚点泄漏至报告**：锚点在 prompt 模板内，非报告正文要求。若误泄漏，parseAndWriteScore 解析 §4.1 格式，不受影响。**低风险，不阻塞**。
3. **T1 路径模板与目录**：`epic-{epic}-*/story-{epic}-{story}-*/` 可匹配 `epic-8-eval-question-bank` 等。**无歧义**。
4. **T4 schema 扩展**：trigger_stage 为可选字段，常规 JSON Schema 支持。**实施细节，非文档 gap**。
5. **T11 runId 与默认生成**：当前含 stage；T11 约定「或」扩展 --runGroupId。任务未强制改默认逻辑。**可执行**。

**判定**：**未发现必须计入的新 gap**。

---

### 2.9 批判审计员结论汇总（第 4 轮）

| 序号 | 结论项 | 判定 |
|------|--------|------|
| 1 | T12 验收是否可独立执行？ | ✓ 是；4×grep -c 可量化 |
| 2 | Phase 1 顺序是否包含 T12 且在 T10 前？ | ✓ 是 |
| 3 | T1～T11 有无阻塞性遗漏、歧义？ | ✓ 无 |
| 4 | 实施后可验证性是否满足？ | ✓ 是；T3 略主观可审 |
| 5 | 依赖链与 Phase 顺序是否自洽？ | ✓ 是 |
| 6 | 边界与模型易忽略风险是否已覆盖？ | ✓ 是 |
| 7 | 需求追溯 REQ-1～REQ-7 是否完整？ | ✓ 是 |
| 8 | 第 4 轮独有排查是否有新 gap？ | ✓ 无 |
| 9 | 与前轮（第 2、3 轮）结论是否一致？ | ✓ 一致；独立复验支持通过 |
| 10 | 本轮是否发现阻塞性 gap？ | ✓ **否** |
| 11 | 最终：完全覆盖、验证通过？ | ✓ **是** |

---

### 2.10 批判审计员最终判定

经对抗性终查（2.1～2.9）：

1. **T1～T12**：修改路径、具体修改、验收标准、依赖关系均明确、可执行、可验收。
2. **T12**：4 条 grep -c 可独立执行；锚点设计合理；在 Phase 1 中位置正确（T10 前）。
3. **遗漏**：无。需求追溯表与 6 议题均有对应任务覆盖。
4. **歧义**：无阻塞性歧义。
5. **不可执行项**：无。
6. **新 gap**：**未发现**。

**结论**：**本轮无新 gap**，第 4 轮。**连续 3 轮（第 2、3、4 轮）无 gap，审计收敛**。

---

## 三、审计结论

### 结论：**完全覆盖、验证通过**

- 第 4 轮独立性复验：T1～T12 从批判审计员视角逐项终查，路径、锚点、验收、依赖均满足可执行与可验收要求。
- 批判审计员对抗性检查：T12 专项终验、T1～T11 遗漏歧义、实施后可验证性、依赖链、边界风险、需求追溯、第 4 轮独有排查均无阻塞发现。
- **本轮无新 gap**，第 4 轮。
- **连续 3 轮（第 2、3、4 轮）无 gap，审计收敛。**

### 非阻塞改进建议（可选，与前轮一致）

| 项 | 描述 |
|----|------|
| T5 | 修改路径补充「否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」，与 T1～T3 表述统一 |
| T10 | 验收标准补充「若修改路径为 fallback（~/.cursor/...），则在对应路径执行 grep」 |
| T12 | 验收标准 1-4 可补全为对 `skills/speckit-workflow/references/audit-prompts.md` 的完整路径；或说明「对修改路径所述文件执行」 |

### 收敛声明

满足「连续 3 轮无 gap」条件（第 2、3、4 轮），本 TASKS 文档（v1.2.1）**审计收敛**，可进入实施阶段。

---

*本报告由 audit-prompts §5 精神执行，批判审计员结论占比 >70%，第 4 轮。*
