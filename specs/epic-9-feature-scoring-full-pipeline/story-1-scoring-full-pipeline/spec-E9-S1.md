# Spec E9-S1：评分全链路写入与仪表盘聚合

*Story 9.1 技术规格*  
*Epic 9 feature-scoring-full-pipeline*

<!-- AUDIT: PASSED by code-reviewer -->

---

## 1. 概述

本 spec 将 Story 9.1 的实施范围固化为可执行技术规格，覆盖：

1. **写入链路**：bmad-story-assistant 阶段四与 speckit-workflow 各 stage 审计通过后自动执行 parse-and-write-score
2. **收尾自检**：Story 完成时检查 scoring/data 是否已写入
3. **聚合与仪表盘**：按 epic/story 聚合计算总分与短板

**实施范围**：TASKS 文档中的 **T1、T2、T3、T4、T5、T6、T7、T8、T9、T11**（T10、T12 已在 Phase 0 完成）。

**输入来源**：
- Story 9.1（9-1-scoring-full-pipeline.md）
- TASKS_评分全链路写入与仪表盘聚合.md
- scoring/writer、scoring/query、scoring/dashboard、scripts/parse-and-write-score.ts

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story | bmad-story-assistant 阶段四、speckit-workflow 各 stage 审计通过后自动 parse-and-write-score | spec §3.1, §3.2, §3.3 | ✅ |
| Story | Story 完成时自检 scoring/data 是否已写入 | spec §3.4 | ✅ |
| Story | 仪表盘按 epic/story 聚合计算总分与短板 | spec §3.5, §3.6 | ✅ |
| AC-1 | 阶段四插入 parse-and-write-score 显式步骤 | spec §3.1.1 | ✅ |
| AC-2 | 审计子任务 prompt 约定报告保存路径 | spec §3.1.2 | ✅ |
| AC-3 | 主 Agent 收到审计通过后自动解析 reportPath | spec §3.2.1 | ✅ |
| AC-4 | parse-and-write-score 支持 trigger_stage 区分 | spec §3.2.2 | ✅ |
| AC-5 | Story 完成时检查 scoring/data 是否已写入 | spec §3.4 | ✅ |
| AC-6 | 检查逻辑与路径约定文档化 | spec §3.4.2 | ✅ |
| AC-7 | 聚合逻辑按时间窗口与 epic/story | spec §3.5.1 | ✅ |
| AC-8 | 仪表盘按 epic/story 聚合计算总分与四维 | spec §3.5.2 | ✅ |
| AC-9 | 跨 run 聚合与短板计算 | spec §3.5.3 | ✅ |
| AC-10 | run_id 共享策略 | spec §3.2.3 | ✅ |
| 实施范围说明 | T1–T9、T11（不含 T10、T12） | spec §1 | ✅ |
| Dev Notes 架构 | 写入链路、聚合键、trigger_stage 短期方案 | spec §3 各节 | ✅ |

---

## 3. 功能规格

### 3.1 Phase 1：bmad-story-assistant 写入链路（AC-1, AC-2）

#### 3.1.1 步骤 4.2 显式插入（T1, AC-1）

| 项 | 规格 |
|------|------|
| 修改路径 | `skills/bmad-story-assistant/SKILL.md` 或 `~/.cursor/skills/bmad-story-assistant/SKILL.md`（项目内优先） |
| 修改位置 | 阶段四「审计结论处理」→「通过（A/B 级）」→「审计通过后评分写入触发」段落之前 |
| 插入内容 | 步骤 4.2：运行 parse-and-write-score（强制） |
| 验收 | 含「步骤 4.2」、完整 CLI 示例、报告路径模板 `AUDIT_Story_{epic}-{story}_stage4.md` |

**CLI 示例**（含 --iteration-count）：
```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --event story_status_change --triggerStage bmad_story_stage4 --epic {epic} --story {story} --artifactDocPath <story路径> --iteration-count {累计值}
```

#### 3.1.2 审计子任务报告路径约定（T2, AC-2）

| 项 | 规格 |
|------|------|
| 修改位置 | STORY-A4-POSTAUDIT 模板 |
| 约定内容 | 「审计通过后请将报告保存至 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`」 |
| 验收 | grep `审计通过后请将报告保存至` 或 `AUDIT_Story_` 有匹配 |

### 3.2 Phase 1（续）：主 Agent 自动化与 trigger_stage（AC-3, AC-4, T11）

#### 3.2.1 主 Agent 解析 reportPath（T3, AC-3）

| 项 | 规格 |
|------|------|
| 逻辑 | 收到审计子任务返回且结论含「通过」时：从约定路径或子任务输出解析 reportPath → 若存在则执行 parse-and-write-score |
| 边界 | reportPath 不存在时记录 `SCORE_WRITE_SKIP_REPORT_MISSING`，不阻断流程 |
| 验收 | SKILL 文档明确上述自动化逻辑及边界条件 |

#### 3.2.2 parse-and-write-score 支持 trigger_stage（T4, AC-4）

| 项 | 规格 |
|------|------|
| 类型扩展 | RunScoreRecord 新增 `trigger_stage?: string`（scoring/writer/types.ts） |
| Schema | run-score-schema.json 扩展 |
| CLI | 新增 `--triggerStage` 参数；implement 时传入 `speckit_5_2` |
| 验收 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --triggerStage speckit_5_2 ...` 执行后，record 含 `trigger_stage: "speckit_5_2"`；单测覆盖 |

#### 3.2.3 run_id 共享策略（T11, AC-10）

| 项 | 规格 |
|------|------|
| 机制 | 二选一实现：① CLI 新增 `--runGroupId` 参数，调用时传入；② 约定格式 `dev-e{epic}-s{story}-{ts}`，同一 Story 多 stage 写入时复用该前缀（ts 取自首次写入） |
| 文档 | scoring/docs/RUN_ID_CONVENTION.md 补充同一 Story 多 stage 共享 run_id 约定 |

### 3.3 Phase 2：Story 完成自检（AC-5, AC-6）

#### 3.3.1 检查脚本（T5, AC-5）

| 项 | 规格 |
|------|------|
| 脚本 | `scripts/check-story-score-written.ts --epic N --story N [--dataPath path]` |
| 检查逻辑 | parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-` |
| 嵌入位置 | bmad-story-assistant 阶段四通过后、提供完成选项前 |
| 补跑决策 | 默认仅提醒；若报告路径存在则执行 parse-and-write-score 补跑；补跑参数：`--stage tasks --event story_status_change --triggerStage bmad_story_stage4`（与步骤 4.2 一致） |
| 验收 | 可运行，输出有/无记录；SKILL 流程中嵌入检查步骤 |

#### 3.3.2 文档化（T6, AC-6）

| 项 | 规格 |
|------|------|
| 文档 | docs/BMAD/审计报告格式与解析约定.md 新增「Story 完成自检」章节 |
| 内容 | 检查逻辑、scoring/data 路径、run_id 与 epic/story 对应关系 |
| 验收 | grep `Story 完成自检` 有匹配 |

### 3.4 Phase 3：聚合与仪表盘（AC-7, AC-8, AC-9）

#### 3.4.1 聚合逻辑（T7, AC-7）

| 项 | 规格 |
|------|------|
| 函数 | `aggregateByEpicStoryTimeWindow(records, epic, story, windowHours)` |
| 函数 | `getLatestRunRecordsV2(options: { strategy, epic?, story?, windowHours? })` |
| 本轮排除 | `aggregateByBranch` 或按 branch 聚合策略本轮不实现，仅实现 `epic_story_window` |
| 验收 | 单测覆盖；`getLatestRunRecordsV2(strategy: 'epic_story_window', epic, story, windowHours)` 返回预期 record 子集 |

#### 3.4.2 仪表盘生成（T8, AC-8）

| 项 | 规格 |
|------|------|
| 脚本 | `scripts/dashboard-generate.ts --strategy epic_story_window` |
| 默认策略 | 按 epic/story 分组，时间窗口内取最新「完整 run」 |
| 完整 run 定义 | 同一 Story 下至少含 spec、plan、gaps、tasks、implement 五阶段中 **至少 3 个 stage 的 record**；implement 以 trigger_stage=speckit_5_2 计入 |
| 退化逻辑 | 若无完整 run：该 epic/story 不参与总分与四维计算，仪表盘该 Story 行显示「数据不足」或等同文案 |
| 验收 fixture | plan/tasks 中指定：scoring/data 下预置 `__tests__/fixtures/` 或等价目录中至少 1 个已知 run；包含 phase_score、dimension_scores；预期总分与四维在单测中硬编码断言（±1 舍入） |
| 验收 | 可执行；对上述 fixture 断言总分与四维与预期一致（±1 舍入误差） |

#### 3.4.3 短板计算（T9, AC-9）

| 项 | 规格 |
|------|------|
| 函数 | `getWeakTop3` 扩展支持按 epic/story 聚合后计算 |
| 规则 | 同一 Story 下各 stage 取最低分作为短板得分，Top 3 升序 |
| 验收 | 单测覆盖；仪表盘输出含跨 run 短板信息 |

---

## 4. 成功标准

| 标准 | 可验证方式 |
|------|------------|
| 写入链路闭环 | bmad-story-assistant 阶段四、speckit 各 stage 审计通过后，scoring/data 下确有对应 record |
| 自检可用 | check-story-score-written 可运行且输出正确 |
| 聚合正确 | dashboard-generate --strategy epic_story_window 对已知 fixture 总分、四维、短板与预期一致 |
| trigger_stage 区分 | record 含 trigger_stage 字段，implement 阶段为 speckit_5_2 |
| run_id 共享 | 同一 Story 多 stage 写入共享 run_id，RUN_ID_CONVENTION 文档已更新 |

---

## 5. 涉及源文件（参考）

| 模块 | 路径 | 修改内容 |
|------|------|----------|
| bmad-story-assistant | skills/bmad-story-assistant/SKILL.md | T1–T3、T5 流程修改 |
| scoring/writer | scoring/writer/types.ts | T4 trigger_stage 类型 |
| scoring/schema | scoring/schema/run-score-schema.json | T4 schema 扩展 |
| scoring/orchestrator | scoring/orchestrator/parse-and-write.ts | T4 triggerStage 透传 |
| scripts | scripts/parse-and-write-score.ts | T4 --triggerStage、T11 --runGroupId |
| scripts | scripts/check-story-score-written.ts | T5 新建 |
| scoring/dashboard | scoring/dashboard/compute.ts | T7、T8、T9 |
| scoring/query | scoring/query/loader.ts | T7 |
| scripts | scripts/dashboard-generate.ts | T8 |
| docs | docs/BMAD/审计报告格式与解析约定.md | T6 |
| scoring/docs | scoring/docs/RUN_ID_CONVENTION.md | T11 |

---

## 6. 参考文档

- [Story 9.1](../../_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-1-scoring-full-pipeline/9-1-scoring-full-pipeline.md) - 完整 Story 定义与 AC
- [TASKS_评分全链路写入与仪表盘聚合](../../_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md) - 任务列表与验收标准
- [parseEpicStoryFromRecord](../../scoring/query/parse-epic-story.ts) - run_id 解析
- [RUN_ID_CONVENTION](../../scoring/docs/RUN_ID_CONVENTION.md) - run_id 约定
