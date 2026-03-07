# Spec E9-S2：stage=implement 扩展

*Story 9.2 技术规格*  
*Epic 9 feature-scoring-full-pipeline*

---

## 1. 概述

本 spec 将 Story 9.2 的实施范围固化为可执行技术规格，覆盖：

1. **parse-and-write-score 扩展**：新增 `--stage implement`，配套 implement 专用解析与 scoring 规则
2. **scoring 存储与 schema**：确保 stage=implement 与既有 trigger_stage 兼容
3. **audit-item-mapping**：implement 段扩展
4. **仪表盘完整 run**：将 `stage=implement` 与 `trigger_stage=speckit_5_2` 均计为 implement 阶段
5. **speckit-workflow §5.2**：审计通过后改用 `--stage implement` 调用
6. **trigger 衔接**：`--stage implement` 调用可通过 shouldWriteScore 校验

**范围排除**：Epic 级仪表盘聚合（仅传 `--epic N` 时展示多 Story 聚合视图）由 Story 9.3 负责，本 Story 不涉及。

**输入来源**：
- Story 9.2（9-2-stage-implement-extension.md）
- scoring/parsers、scoring/constants、scoring/dashboard、scripts/parse-and-write-score.ts
- scoring/rules/default/implement-scoring.yaml（已存在）

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story | parse-and-write-score 原生支持 stage=implement | spec §3.1 | ✅ |
| Story | 仪表盘区分 tasks 审计与 implement 审计 | spec §3.4 | ✅ |
| AC-1 | parse-and-write-score 支持 --stage implement | spec §3.1.1, §3.1.2 | ✅ |
| AC-2 | run-score-schema stage 支持 "implement" | spec §3.2 | ✅ |
| AC-3 | implement 专用解析规则：implement-scoring.yaml、PHASE_WEIGHT_IMPLEMENT=0.25 | spec §3.1.3 | ✅ |
| AC-4 | audit-item-mapping 支持 implement | spec §3.3 | ✅ |
| AC-5 | 仪表盘完整 run 含 stage=implement 或 trigger_stage=speckit_5_2 | spec §3.4 | ✅ |
| AC-6 | speckit-workflow §5.2 改用 --stage implement | spec §3.5 | ✅ |
| AC-7 | config/scoring-trigger-modes 触发时 --stage implement 可通过校验 | spec §3.6 | ✅ |
| Task 6.2 | trigger 不依赖 stage 时文档化「triggerStage 与 stage 一致可省略」约定 | spec §3.6 文档化约定 | ✅ |
| Dev Notes 架构 | 复用 parseGenericReport、implement-scoring.yaml | spec §3.1.3 | ✅ |
| Dev Notes 兼容 | stage=implement 与 trigger_stage=speckit_5_2 双识别 | spec §3.4.1 | ✅ |

---

## 3. 功能规格

### 3.1 parse-and-write-score 扩展（AC-1, AC-3）

#### 3.1.1 AuditStage 与 CLI（T1.1–T1.2, T1.6, AC-1）

| 项 | 规格 |
|------|------|
| 修改路径 | `scoring/parsers/audit-index.ts` |
| 类型扩展 | `AuditStage` 增加 `'implement'` |
| CLI | `scripts/parse-and-write-score.ts` 的 stage 类型包含 implement；usage 文本更新 |
| 验收 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --epic N --story N` 执行成功 |

#### 3.1.2 audit-index case implement（T1.4, AC-1）

| 项 | 规格 |
|------|------|
| 修改位置 | `scoring/parsers/audit-index.ts` 的 switch |
| 新增分支 | `case 'implement'`：调用 `parseGenericReport(..., stage: 'implement', phaseWeight: PHASE_WEIGHT_IMPLEMENT)` |
| 验收 | parseAuditReport({ stage: 'implement', ... }) 返回 record.stage === 'implement' |

#### 3.1.3 implement 专用解析规则（T1.3, T1.5, AC-3）

| 项 | 规格 |
|------|------|
| 常量 | `scoring/constants/weights.ts` 新增 `PHASE_WEIGHT_IMPLEMENT = 0.25`（环节 2） |
| 解析器 | `scoring/parsers/audit-generic.ts`：`GenericAuditStage` 扩展包含 `'implement'` |
| 规则来源 | 复用 `parseGenericReport`；implement 使用 `scoring/rules/default/implement-scoring.yaml` 的 items、veto_items（通过 audit-item-mapping 与 buildVetoItemIds 衔接） |
| 验收 | phase_weight === 0.25；单测覆盖 |

### 3.2 run-score-schema 与 RunScoreRecord（AC-2）

| 项 | 规格 |
|------|------|
| Schema | `scoring/schema/run-score-schema.json` 的 stage 字段为 enum，已含 "implement"，无需修改 |
| RunScoreRecord | `scoring/writer/types.ts` 的 stage 类型包含 `'implement'` |
| 验收 | 既有 record（含 trigger_stage）不受影响；新 record 可含 stage: "implement" |

### 3.3 audit-item-mapping implement 段（AC-4）

| 项 | 规格 |
|------|------|
| 修改路径 | `config/audit-item-mapping.yaml` |
| 结构 | 采用 prd/arch 的 dimensions+checks+empty_overall+empty_dimensions 结构；与 implement-scoring.yaml 的 items 对应（func_correct、code_standards、exception_handling、security、perf_maintain 等） |
| 示例 | `implement: empty_overall: "impl_overall", empty_dimensions: "impl_dimensions", dimensions: [{ name: "功能性", checks: [{ text: "功能正确性", item_id: "func_correct", patterns: [...] }] }, ...]` |
| 代码 | `scoring/parsers/audit-item-mapping.ts`：`AuditStage` 增加 `'implement'`；loadMapping 迭代列表增加 `'implement'` |
| 验收 | resolveItemId(stage='implement', ...)、resolveEmptyItemId(stage='implement', ...) 可用 |

### 3.4 仪表盘完整 run 定义（AC-5）

#### 3.4.1 完整 run 定义扩展（T4.1）

| 项 | 规格 |
|------|------|
| 修改路径 | `scoring/dashboard/compute.ts` |
| 完整 run 判定公式 | stages = Set(records.map(r => r.stage))；当 \|stages\| >= MIN_STAGES_COMPLETE_RUN (3) 时视为完整 run。stage=implement 与 stage=tasks 为两个独立 stage；spec+plan+implement 或 spec+plan+tasks 等组合均满足 |
| implement 阶段识别 | 展示 implement 得分时：stage=implement 的 record 直接计入；stage=tasks 且 trigger_stage=speckit_5_2 的 record 亦计入（向后兼容） |
| 验收 | 给定含 stage=implement 的 record，聚合与短板计算正确；仪表盘可区分 implement 与 tasks 的 phase_score |

#### 3.4.2 仪表盘展示（T4.2）

| 项 | 规格 |
|------|------|
| 展示逻辑 | 按 stage 或 trigger_stage 区分 implement 与 tasks 的 phase_score |
| 验收 | 仪表盘输出能区分 implement 与 tasks 得分 |

### 3.5 speckit-workflow §5.2 更新（AC-6）

| 项 | 规格 |
|------|------|
| 修改路径 | `skills/speckit-workflow/SKILL.md` 或 `~/.cursor/skills/speckit-workflow/SKILL.md`（项目内优先） |
| 修改位置 | §5.2 implement 阶段「审计通过后评分写入触发」段落 |
| 原内容 | `--stage tasks --triggerStage speckit_5_2` |
| 新内容 | `--stage implement`，移除 `--triggerStage speckit_5_2` |
| 报告路径 | 保持 `AUDIT_implement-E{epic}-S{story}.md` 约定 |
| 验收 | grep §5.2 含 `--stage implement`，不含 `--triggerStage speckit_5_2` |

### 3.6 trigger 与 implement 衔接（AC-7）

| 项 | 规格 |
|------|------|
| 修改路径 | `config/scoring-trigger-modes.yaml` |
| 方案（推荐） | 新增 `implement_audit_pass: event: stage_audit_complete, stage: implement`；CLI 传入 `--stage implement` 且未传 `--triggerStage` 时，triggerStage 默认为 stage（即 implement），可匹配该条目 |
| 文档化约定（Task 6.2） | 在 scoring 或 config 相关文档中补充：当 triggerStage 与 stage 一致时，可省略 `--triggerStage`；当 `--stage implement` 时，默认 triggerStage=implement，由 implement_audit_pass 匹配 |
| 验收 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage implement --event stage_audit_complete --epic N --story N` 不因 trigger 校验失败而退出 |

---

## 4. 非功能需求

- **向后兼容**：既有 `trigger_stage=speckit_5_2` 记录继续有效；仪表盘完整 run 同时识别 stage=implement 与 trigger_stage=speckit_5_2
- **单测覆盖**：Task 1、Task 4 有单测；E2E 可执行 parse-and-write-score --stage implement

---

## 5. Reference Documents

- [Story 9.2](../../_bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/story-9-2-stage-implement-extension/9-2-stage-implement-extension.md) - 原始需求
- [scoring/rules/default/implement-scoring.yaml](../../scoring/rules/default/implement-scoring.yaml) - 环节 2 规则
- [scoring/parsers/audit-index.ts](../../scoring/parsers/audit-index.ts) - parseAuditReport 入口
- [scoring/parsers/audit-generic.ts](../../scoring/parsers/audit-generic.ts) - parseGenericReport
- [docs/BMAD/审计报告格式与解析约定.md](../../docs/BMAD/审计报告格式与解析约定.md) - 可解析块格式
