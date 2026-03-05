# Spec E3-S3：eval-skill-scoring-write

*Epic 3 Story 3：审计报告解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同*

**原始需求文档**：`_bmad-output/implementation-artifacts/3-3-eval-skill-scoring-write/3-3-eval-skill-scoring-write.md`

---

## 1. 概述

本 Spec 将 Story 3.3 的需求规格化，定义「解析+写入」编排、触发模式表、协同点与全链路 Skill 衔接的技术规格。

---

## 2. 解析+写入编排（对应 Story §1.1 第 1 点、AC-1、AC-3）

### 2.1 功能定义

- 在 stage 审计通过后，调用 Story 3.2 的 `parseAuditReport` 将审计报告解析为符合 Story 1.1 schema 的评分记录。
- 调用 Story 1.2 的 `writeScoreRecordSync` 将解析结果持久化到 `scoring/data/`（单文件或 scores.jsonl，由 mode 决定）。
- 保证同一 stage 的审计报告经解析后写入一条记录，run_id、scenario、stage、check_items 等与 schema 一致。

### 2.2 接口约定（调用 Story 3.2、1.2）

| 来源 | 接口 | 用途 |
|------|------|------|
| Story 3.2 | `parseAuditReport(options: ParseAuditReportOptions): Promise<RunScoreRecord>` | 解析审计报告 |
| Story 3.2 | 入参：reportPath 或 content、stage、runId、scenario | 与 ParseAuditReportOptions 一致 |
| Story 1.2 | `writeScoreRecordSync(record, mode, options?)` | 写入评分记录 |
| Story 1.2 | mode：single_file \| jsonl \| both | 写入模式 |

### 2.3 编排入口

- 定义 `parseAndWriteScore` 或等效函数：入参为 reportPath（或 content）、stage、runId、scenario、writeMode。
- 内部调用 `parseAuditReport` 与 `writeScoreRecordSync`，不重复实现解析与写入逻辑。
- 支持 reportPath 与 content 两种输入，与 Story 3.2 的 ParseAuditReportOptions 一致。

---

## 3. 与 speckit-workflow、bmad-story-assistant 协同（对应 Story §1.1 第 2 点、AC-2）

### 3.1 协同点

- 文档化或实现：在 speckit-workflow 的 clarify/checklist/analyze 嵌入审计闭环中，stage 完成后的调用入口与入参约定。
- 至少一个协同入口可被脚本或工作流调用并验证。

### 3.2 入参约定

- run_id、scenario、stage、报告路径、writeMode 由工作流传入。
- 报告路径与 `config/eval-lifecycle-report-paths.yaml` 一致；story 报告为 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`。

---

## 4. 触发模式表（对应 Story §1.1 第 3 点、AC-2）

### 4.1 覆盖范围

- 覆盖 real_dev 与 eval_question 两种 scenario。
- 各 stage 的触发条件与写入模式（single_file / jsonl / both）配置化或文档化。
- 与 Architecture §10.3 及 Story 3.1 的触发模式表一致；mode 由配置或入参传入，与 Story 1.2 AC-3 衔接。

### 4.2 触发模式表结构（与 Architecture §10.3 对齐）

| 事件类型 | 触发方式 | 对应 stage/环节 | writeMode 来源 |
|----------|----------|-----------------|----------------|
| stage 审计产出完成 | 自动 | 该 stage 对应环节 | 配置或入参 |
| Story 状态变更 | 自动（可配置） | 环节 1–6 | 同上 |
| MR 创建 | 自动（可配置） | 环节 2–6 | 同上 |
| Epic 待验收 | 手动或自动 | 环节 6、Epic 综合 | 同上 |
| 用户显式请求 | 手动 | 全环节 | 同上 |

---

## 5. 全链路 Skill 衔接（对应 Story §1.1 第 4 点、AC-1、AC-2）

### 5.1 编排调用

- 全链路 Skill（Story 3.1 定义）在编排中调用本 Story 的「解析+写入」能力。
- 本 Story 实现可被 Skill 或 Cursor Task 调用的函数或脚本入口。

### 5.2 路径约定

- 与 `config/eval-lifecycle-report-paths.yaml` 一致。
- 报告路径可由 epic、story、slug 解析得出。

---

## 6. 技术栈与源树

| 组件 | 路径/说明 |
|------|-----------|
| 解析 | `scoring/parsers` 的 `parseAuditReport`（audit-index.ts）；stage 为 prd/arch/story |
| 写入 | `scoring/writer/write-score.ts` 的 `writeScoreRecordSync(record, mode, options)` |
| 路径约定 | `config/eval-lifecycle-report-paths.yaml`；story 报告 `AUDIT_Story_{epic}-{story}.md` |

---

## 7. 验收标准（与 Story AC 对齐）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 给定 reportPath、run_id/scenario/stage，调用解析+写入后，scoring/data 下出现符合 Story 1.1 schema 的记录 | 集成测试或验收脚本 |
| AC-2 | 协同点文档化或可调用入口；触发模式表明确 real_dev 与 eval_question 下的触发条件与 writeMode | 文档/配置；至少一个入口可被脚本调用 |
| AC-3 | 解析用 parseAuditReport，写入用 writeScoreRecordSync；无重复实现 | 代码或集成测试证明 |

---

## 8. 不包含范围（与 Story §1.2 对齐）

- 评分规则 YAML：Story 2.1
- 全链路 Skill 编排与触发：Story 3.1
- 审计报告解析逻辑细节：Story 3.2
- 一票否决、阶梯式扣分：Story 4.1
- AI 代码教练：Story 4.2

---

## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 Story | 全链路 Code Reviewer Skill 编排者，审计通过后解析并写入，与 speckit-workflow、bmad-story-assistant 协同，触发模式表 | spec §1、§2、§3、§4、§5 | ✅ |
| §1.1 第 1 点 | 审计通过后调用 parseAuditReport、writeScoreRecordSync，数据流闭环 | spec §2 | ✅ |
| §1.1 第 2 点 | 协同点文档化或实现，入参约定 | spec §3 | ✅ |
| §1.1 第 3 点 | 触发模式表：real_dev、eval_question，writeMode 配置化 | spec §4 | ✅ |
| §1.1 第 4 点 | 全链路 Skill 衔接，可调用入口 | spec §5 | ✅ |
| §1.2 不包含 | 评分 YAML、全链路编排、解析逻辑细节、4.1/4.2 | spec §8 | ✅ |
| §2 AC-1 | 给定报告+参数，scoring/data 出现符合 schema 记录 | spec §2、§7 | ✅ |
| §2 AC-2 | 协同点、触发模式表、至少一个可调用入口 | spec §3、§4、§7 | ✅ |
| §2 AC-3 | 仅用 parseAuditReport、writeScoreRecordSync，无重复实现 | spec §2.2、§2.3、§7 | ✅ |
| §5 Architecture | 数据流、schema、writeScoreRecordSync、parseAuditReport、触发模式表 | spec §2、§4、§6 | ✅ |
| §7 接口约定 | 从 3.1/3.2/1.2 接收、本 Story 产出 | spec §2.2、§3.2、§5 | ✅ |
