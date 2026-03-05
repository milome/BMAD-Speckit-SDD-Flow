# plan-E3-S3：eval-skill-scoring-write 实现方案

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3  
**输入**：spec-E3-S3.md、Story 3.3、Architecture §7、§8、§10.3

---

## 1. 目标与约束

- 在 stage 审计通过后，编排「解析→写入」闭环：调用 Story 3.2 的 `parseAuditReport`、Story 1.2 的 `writeScoreRecordSync`，不重复实现解析与写入逻辑。
- 实现可被 speckit-workflow、bmad-story-assistant、全链路 Skill 调用的入口（函数或 CLI）。
- 产出触发模式表配置或文档，覆盖 real_dev、eval_question 两种 scenario，与 Architecture §10.3、Story 3.1 一致。
- 技术栈与 scoring 模块一致（TypeScript/Node）。

---

## 2. 需求映射清单（plan ↔ 需求文档 + spec）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1.1 第 1 点 解析+写入 | spec §2 | plan §3 | ✅ |
| Story §1.1 第 2 点 协同 | spec §3 | plan §5 | ✅ |
| Story §1.1 第 3 点 触发模式表 | spec §4 | plan §4 | ✅ |
| Story §1.1 第 4 点 全链路 Skill | spec §5 | plan §6 | ✅ |
| Story §2 AC-1 | spec §2、§7 | plan §3、§9 | ✅ |
| Story §2 AC-2 | spec §3、§4、§7 | plan §4、§5、§9 | ✅ |
| Story §2 AC-3 | spec §2.2、§7 | plan §3 | ✅ |
| spec §2 编排入口 | spec §2.3 | plan §3 | ✅ |
| spec §3 协同点、入参 | spec §3 | plan §5 | ✅ |
| spec §4 触发模式表 | spec §4 | plan §4 | ✅ |
| spec §5 全链路 Skill 衔接 | spec §5 | plan §6 | ✅ |
| Story §5 Architecture | spec §6 | plan §3、§4、§8 | ✅ |

---

## 3. Phase 1：parseAndWriteScore 编排（T1）

### 3.1 模块设计

| 组件 | 职责 | 路径 |
|------|------|------|
| parseAndWriteScore | 编排入口：parseAuditReport → writeScoreRecordSync | scoring/orchestrator/parse-and-write.ts 或 scoring/parse-and-write.ts |
| 入参 | reportPath 或 content、stage、runId、scenario、writeMode、可选 dataPath | 与 ParseAuditReportOptions 一致；writeMode 为 single_file \| jsonl \| both |
| 输出 | void（副作用：scoring/data 下写入记录） | 无返回值，或返回写入路径 |

### 3.2 输入输出

- **输入**：reportPath（或 content）、stage（prd/arch/story）、runId、scenario（real_dev/eval_question）、writeMode；可选 dataPath 覆盖默认 scoring/data。
- **流程**：若 reportPath 提供则 fs 读取 content；调用 parseAuditReport({ reportPath, content?, stage, runId, scenario })；调用 writeScoreRecordSync(record, writeMode, { dataPath })。
- **边界**：reportPath 与 content 二选一；文件不存在或解析异常 → 抛出或向上传播。

### 3.3 集成点

- 本函数被 scripts/、bmad-story-assistant、全链路 Skill 调用；生产代码关键路径为「给定报告与参数 → 解析 → 写入 → 校验文件存在」。

---

## 4. Phase 2：触发模式表实现（T2）

### 4.1 配置落地

- **已有**：config/stage-mapping.yaml 含 trigger_modes（Architecture §10.3）。
- **扩展**：新增 config/scoring-trigger-modes.yaml（或扩展 stage-mapping.yaml）补充：
  - 事件类型 → 触发方式 → stage/环节 → writeMode 默认值
  - 覆盖 real_dev、eval_question 两种 scenario；writeMode 与 Story 1.2 的 single_file/jsonl/both 对应。
- **写入模式**：stage_audit_complete 默认 single_file；批量写入场景可用 jsonl；由入参或配置覆盖。

### 4.2 与 Architecture §10.3 一致性

- 事件类型：stage_audit_complete、story_status_change、mr_created、epic_pending_acceptance、user_explicit_request。
- 触发方式：auto、manual、manual_or_auto、configurable。
- 本 plan 产出 writeMode 与 stage 的映射表（文档或 YAML），供调用方或 parseAndWriteScore 入参使用。

---

## 5. Phase 3：协同点与可调用入口（T3）

### 5.1 协同点文档

- 产出 docs/speckit-eval-integration.md 或 _bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-3-eval-skill-scoring-write/INTEGRATION.md：
  - 在 speckit-workflow clarify/checklist/analyze 嵌入审计闭环中，stage 完成后的调用时机（例如 §1.2 spec 审计通过后、§2.2 plan 审计通过后等）。
  - 入参约定：run_id、scenario、stage、报告路径、writeMode 如何从工作流传入；报告路径由 epic、story、slug 解析的公式。

### 5.2 可调用入口

- **导出函数**：scoring/orchestrator/parse-and-write.ts 导出 parseAndWriteScore；scoring/orchestrator/index.ts 或 scoring/index.ts 再导出。
- **CLI 脚本**：scripts/parse-and-write-score.ts（或 accept-e3-s3.ts）接收 --reportPath、--stage、--runId、--scenario、--writeMode、--dataPath；内部调用 parseAndWriteScore。
- **package.json**：注册 `"accept-e3-s3": "npx ts-node scripts/parse-and-write-score.ts"` 或等效，供验收与 CI 调用。

### 5.3 验收

- 通过脚本或 npm run accept-e3-s3 传入样本报告与参数，执行后校验 scoring/data 下记录存在且符合 schema。

---

## 6. Phase 4：全链路 Skill 衔接（T4）

### 6.1 Skill 声明

- 在 bmad-code-reviewer-lifecycle/SKILL.md（全局 `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\`）中补充「本 Skill 调用 Story 3.3 的 parseAndWriteScore」或等效表述。
- 引用路径：`scoring/orchestrator/parse-and-write.ts` 或 `scoring/parse-and-write.ts`；scripts/parse-and-write-score.ts 作为 CLI 入口。

### 6.2 路径约定

- 与 config/eval-lifecycle-report-paths.yaml 一致；story 报告 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`。
- 可由 epic、story、slug 解析：`implementation-artifacts/${epic}-${story}-${slug}/AUDIT_Story_${epic}-${story}.md`。

---

## 7. 目录与文件布局

| 路径 | 说明 |
|------|------|
| scoring/orchestrator/parse-and-write.ts | parseAndWriteScore 编排函数 |
| scoring/orchestrator/index.ts | 导出 parseAndWriteScore |
| config/scoring-trigger-modes.yaml | 触发模式表扩展（事件→writeMode 默认） |
| scripts/parse-and-write-score.ts | CLI 入口，接收参数并调用 parseAndWriteScore |
| docs/speckit-eval-integration.md 或 3-3/INTEGRATION.md | 协同点文档 |
| bmad-code-reviewer-lifecycle/SKILL.md（全局 skill） | 补充对 3.3 入口的引用 |
| scoring/orchestrator/__tests__/parse-and-write.test.ts | parseAndWriteScore 单元/集成测试 |
| scripts/accept-e3-s3.ts | 验收脚本（或与 parse-and-write-score.ts 合并） |

---

## 8. 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖 | 验证方式 |
|----------|------|----------|
| 单元/集成测试 | parseAndWriteScore：给定 content + stage + runId + scenario + writeMode，调用后校验 scoring/data 下文件存在且 schema 符合 | scoring/orchestrator/__tests__/parse-and-write.test.ts；prd/arch/story 三类报告各测一次 |
| 集成测试 | reportPath 输入：给定报告路径，调用 parseAndWriteScore，校验写入 | 同上或扩展用例 |
| 集成测试 | content 输入：与 Story 3.2 ParseAuditReportOptions 一致 | 同上 |
| 端到端测试 | CLI 脚本：传入 --reportPath、--stage 等，执行后校验 scoring/data | scripts/accept-e3-s3.ts 或 npm run accept-e3-s3 |
| 生产代码关键路径 | parseAndWriteScore 被 scripts 或 Skill 引用并调用 | 验收脚本、package.json scripts 注册；grep 生产代码 import 路径 |
| 与 Story 3.2、1.2 无重复实现 | 仅调用 parseAuditReport、writeScoreRecordSync | 代码审查；无本地解析或写入逻辑 |

**严禁**：仅单元测试；模块内部实现完整但从未被生产代码关键路径导入和调用。

---

## 9. 与 Story 3.1、3.2、1.2 的衔接

| 从 3.1 接收 | 本 plan 使用 |
|-------------|-------------|
| 报告路径约定、触发模式表 | config/eval-lifecycle-report-paths.yaml、config/stage-mapping.yaml、config/scoring-trigger-modes.yaml |
| stage 映射 | parseAndWriteScore 入参 stage |

| 从 3.2 接收 | 本 plan 使用 |
|-------------|-------------|
| parseAuditReport(options) | parseAndWriteScore 内部调用 |
| ParseAuditReportOptions（reportPath/content、stage、runId、scenario） | 入参透传 |

| 从 1.2 接收 | 本 plan 使用 |
|-------------|-------------|
| writeScoreRecordSync(record, mode, options) | parseAndWriteScore 内部调用 |
| mode: single_file \| jsonl \| both | writeMode 入参透传 |

| 向 3.1/全链路 Skill 提供 | 本 plan 产出 |
|---------------------------|-------------|
| parseAndWriteScore 函数、CLI 脚本 | scoring/orchestrator/、scripts/ |
| 触发模式表 writeMode 映射 | config/scoring-trigger-modes.yaml |
| 协同点文档 | INTEGRATION.md |

---

## 10. 禁止词表合规

本 plan 及后续 GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。
