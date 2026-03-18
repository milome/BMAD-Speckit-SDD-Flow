# plan-E9-S1 审计报告：五项修订落实与需求覆盖验证

**审计日期**：2026-03-06  
**待审计文件**：`specs/epic-9/story-1-scoring-full-pipeline/plan-E9-S1.md`（已修订版）  
**参考文档**：spec-E9-S1.md、Story 9.1、TASKS_评分全链路写入与仪表盘聚合.md、AUDIT_PLAN_E9_S1_逐条对照与集成测试专项_2026-03-06.md  
**审计要求**：逐条对照、批判审计员段落（占比 ≥50%）、结论须明确「完全覆盖、验证通过」或列出未通过项；报告结尾含可解析评分块  

---

## §1 上一轮 5 项修订逐条对照

### 1.1 修订项 1：T1 显式 --triggerStage bmad_story_stage4

| 审计项 | 上一轮要求 | plan 现状 | 判定 |
|--------|------------|----------|------|
| T1 CLI 示例 | Phase 1.1 T1 或 §4.1 中显式写出 bmad-story-assistant 场景使用 bmad_story_stage4 | Phase 1.1 第 43 行：「含完整 CLI 示例（**须显式写出 `--triggerStage bmad_story_stage4`**，与 implement 的 speckit_5_2 区分）」 | ✅ **通过** |

**批判审计员评述**：plan 在 Phase 1.1 T1 处已明确要求「须显式写出 `--triggerStage bmad_story_stage4`」，与 implement 的 speckit_5_2 区分清晰。实施时若 SKILL 文档中 CLI 示例未写入该参数，验收命令 `grep 步骤 4.2` 虽能通过，但无法自动校验参数完整性。建议：若 §6 验收命令能补充 `grep bmad_story_stage4 .cursor/skills/bmad-story-assistant/SKILL.md` 则更严谨；但当前 plan 已满足「显式写出」要求，**判定通过**。

---

### 1.2 修订项 2：T8 fixture 路径——使用 scoring/data 或 --dataPath

| 审计项 | 上一轮要求 | plan 现状 | 判定 |
|--------|------------|----------|------|
| T8 fixture 路径 | ① 新增 --dataPath 并在集成测试中使用；或 ② fixture 置于 scoring/data 的指定子目录并规定测试后清理 | Phase 3.2 第 80 行：「fixture 须置于 **`scoring/data/`** 下……可选用 `scoring/data/__fixtures-dashboard-epic-story/` 子目录，集成测试前复制 fixture 到该路径、**测试后清理**；或 dashboard-generate **新增 `--dataPath`** 以便单测指定 fixture 路径」；§5.1 第 131 行：等效「复制到 scoring/data 下，或 dashboard-generate --dataPath」 | ✅ **通过** |

**批判审计员评述**：plan 已覆盖两种方案——方案 ① 使用 scoring/data 下 `__fixtures-dashboard-epic-story/` 子目录，并明确「测试后清理」，消除污染风险；方案 ② dashboard-generate 新增 `--dataPath` 以指定 fixture 路径。与 TASKS T8「在 scoring/data 放置 3 条已知 fixture」、dashboard-generate 默认读取 getScoringDataPath() 的逻辑一致。**判定通过**。

---

### 1.3 修订项 3：T5 补跑参数显式写出

| 审计项 | 上一轮要求 | plan 现状 | 判定 |
|--------|------------|----------|------|
| T5 补跑参数 | 在 Phase 2 T5 或相关处补充「补跑时 stage=tasks、triggerStage=bmad_story_stage4」 | Phase 2 第 63 行：「**补跑参数显式**：`--stage tasks --event story_status_change --triggerStage bmad_story_stage4`（与步骤 4.2 一致）」 | ✅ **通过** |

**批判审计员评述**：T5 补跑参数已完整显式列出，与 TASKS T5「T4 延后时：补跑使用 stage=tasks、triggerStage=bmad_story_stage4」及 spec §3.3.1 一致。实施与验收时无歧义。**判定通过**。

---

### 1.4 修订项 4：§4.4 getLatestRunRecordsV2 调用验证

| 审计项 | 上一轮要求 | plan 现状 | 判定 |
|--------|------------|----------|------|
| getLatestRunRecordsV2 接入验证 | 在 §4.4 或 §6 补充：grep 或单测断言 dashboard-generate 在 strategy=epic_story_window 时调用 getLatestRunRecordsV2 | §4.4 第 121–122 行新增独立 bullet：「**getLatestRunRecordsV2 / aggregateByEpicStoryTimeWindow 调用验证**：grep 或单测断言：当 `strategy=epic_story_window` 时，dashboard-generate 内部调用 `getLatestRunRecordsV2`（或等价函数），而非仅使用 `getLatestRunRecords`；验收时需验证 dashboard-generate 的 strategy 分支确实调用新聚合逻辑」 | ✅ **通过** |

**批判审计员评述**：§4.4 已明确要求验证 dashboard-generate 在 strategy=epic_story_window 时调用 getLatestRunRecordsV2，与上一轮审计指出的「孤岛风险」一致。验收方式（grep 或单测断言）可执行。建议 §6 验收命令汇总中增加一行：「T7/T8 验收：grep `getLatestRunRecordsV2\|aggregateByEpicStoryTimeWindow` scripts/dashboard-generate.ts 有匹配」，使验收命令与 §4.4 一一对应；但当前 §4.4 已足够明确，**判定通过**。

---

### 1.5 修订项 5：E2E 验证设计（check-story-score-written、SKILL→CLI）

| 审计项 | 上一轮要求 | plan 现状 | 判定 |
|--------|------------|----------|------|
| E2E 验证设计 | 若 plan 声称「完整 E2E」，须补充最低可行的 E2E 设计（如人工验收清单或脚本化流程模拟）；check-story-score-written、SKILL→CLI | §4.4 第 119–120 行：「check-story-score-written：bmad-story-assistant 阶段四嵌入；验证方式：SKILL 流程描述中含检查步骤；**最低可行 E2E**：模拟一次完整 Dev Story 流程，在阶段四通过后人工或脚本确认检查步骤被执行（可选自动化）」 | ✅ **通过** |

**批判审计员评述**：plan 已补充「最低可行 E2E」设计，覆盖 check-story-score-written 的流程嵌入验证。parse-and-write-score 的 E2E 仍依赖「执行上述 CLI 命令，确认 scoring/data 写入」——本质为集成测试；但 plan §2 目标为「验证 parse-and-write-score、check-story-score-written、dashboard-generate 在生产入口可执行且行为符合 spec」，未承诺全自动化 E2E。最低可行 E2E（人工或脚本确认）已满足上一轮「可接受为超出 plan 范围的增强项」的底线。**判定通过**。

---

## §2 批判审计员段落（占比 ≥50%）

### 2.1 五项修订落实度

上一轮审计提出的 5 项修订要求，**均已落实**：

1. **T1**：plan 第 43 行显式写出 `--triggerStage bmad_story_stage4`，与 speckit_5_2 区分。
2. **T8**：plan 第 80 行、§5.1 第 131 行明确 scoring/data 或 --dataPath 两种 fixture 方案，并规定「测试后清理」。
3. **T5**：plan 第 63 行补跑参数完整显式：`--stage tasks --event story_status_change --triggerStage bmad_story_stage4`。
4. **§4.4**：plan 第 121–122 行新增 getLatestRunRecordsV2 / aggregateByEpicStoryTimeWindow 调用验证要求。
5. **E2E**：plan 第 119–120 行补充 check-story-score-written 的最低可行 E2E 设计。

**批判审计员保留意见**：§6 验收命令汇总未将 §4.4 的 getLatestRunRecordsV2 验证转化为可复制执行的 grep 命令，实施时验收人需自行从 §4.4 提炼。属轻度不完善，**不影响本轮通过**。

---

### 2.2 与原始需求的覆盖完整性

| 需求来源 | 覆盖检查 | 批判审计员判定 |
|----------|----------|----------------|
| Story 9.1 | 写入链路、自检、聚合均对应 Phase 1–3 | ✅ |
| spec §3.1–§3.4 | T1–T9、T11 逐一映射，AC-1–AC-10 全覆盖 | ✅ |
| TASKS T1–T9、T11 | Phase 1–3 实施分期与 TASKS 顺序一致；T10、T12 已在 Phase 0 排除 | ✅ |
| spec §4 成功标准 | 「写入链路闭环」「自检可用」「聚合正确」「trigger_stage 区分」「run_id 共享」均有 Phase 1–3 验收对应 | ✅ |

**批判审计员额外核查**：spec §3.1.1 要求 CLI 示例含 `--iteration-count`；plan Phase 1.1 T1 描述「含完整 CLI 示例」但未在 plan 正文写出 `--iteration-count`。TASKS T1 代码块中明确含 `--iteration-count {本 stage 累计 fail 轮数，一次通过传 0}`。plan 通过「与步骤 4.2 一致」「与 TASKS 一致」的引用，间接覆盖该要求。若实施时 SKILL 文档严格按 TASKS 插入，则可满足；若仅按 plan 字面执行，存在遗漏 `--iteration-count` 风险。**建议**：Phase 1.1 T1 可补充「CLI 示例须含 --iteration-count（与 TASKS T1 代码块一致）」；当前判定为**可接受**，因 TASKS 为 plan 输入且 plan §1 明确输入含 TASKS。

---

### 2.3 集成测试与 E2E 充分性

| 测试对象 | plan 覆盖 | 批判审计员结论 |
|----------|----------|----------------|
| parse-and-write-score | 单元（trigger_stage）、集成（CLI --triggerStage、--runGroupId） | ✅ |
| check-story-score-written | 集成（有/无数据）、§4.4 最低可行 E2E | ✅ |
| dashboard-generate | 单元（aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、getWeakTop3）、集成（对 fixture 断言）、§4.4 getLatestRunRecordsV2 调用验证 | ✅ |
| 生产路径 | §4.4 四段验证（parse-and-write-score、check-story-score-written、dashboard-generate、getLatestRunRecordsV2） | ✅ |

**批判审计员结论**：相较上一轮，plan 已补齐 E2E 设计（最低可行）与 getLatestRunRecordsV2 调用验证。集成测试框架完整，fixture 路径与数据源一致性问题已解决。**满足**「完全覆盖、验证通过」标准。

---

## §3 结论

### 3.1 五项修订落实结论

| 序号 | 修订项 | 落实状态 |
|------|--------|----------|
| 1 | T1 显式 --triggerStage bmad_story_stage4 | ✅ 已落实 |
| 2 | T8 fixture 路径：scoring/data 或 --dataPath | ✅ 已落实 |
| 3 | T5 补跑参数显式写出 | ✅ 已落实 |
| 4 | §4.4 getLatestRunRecordsV2 调用验证 | ✅ 已落实 |
| 5 | E2E 验证设计（check-story-score-written、SKILL→CLI） | ✅ 已落实 |

### 3.2 需求覆盖结论

plan-E9-S1.md 对 spec-E9-S1.md、Story 9.1、TASKS_评分全链路写入与仪表盘聚合 的原始需求**完全覆盖**；集成测试与端到端功能测试计划**完整且可执行**；生产代码关键路径验证（含 getLatestRunRecordsV2 接入）**已明确**。

### 3.3 最终判定

**完全覆盖、验证通过。**

---

## §4 可解析评分块

```markdown
总体评级: A-

维度评分:
- 五项修订落实度: 100/100
- 需求覆盖完整性: 95/100
- 集成/E2E 测试充分性: 92/100
- 孤岛风险防控: 95/100
- 可执行性（验收可复现）: 90/100
```
