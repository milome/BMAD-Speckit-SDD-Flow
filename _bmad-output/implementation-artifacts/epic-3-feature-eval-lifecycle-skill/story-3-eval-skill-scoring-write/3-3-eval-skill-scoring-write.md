# Story 3.3：eval-skill-scoring-write

Status: ready-for-dev

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3  
**Slug**：eval-skill-scoring-write

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a 全链路 Code Reviewer Skill 编排者，  
I want 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同并实现触发模式表，  
so that 审计→解析→写入的闭环得以完成，各阶段迭代结束可判定。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **从审计报告解析出评分记录并写入 scoring 存储**
   - 在 stage 审计通过后，调用 Story 3.2 的 `parseAuditReport` 能力，将审计报告解析为符合 Story 1.1 schema 的评分记录
   - 调用 Story 1.2 的 `writeScoreRecordSync` 接口，将解析结果持久化到 `scoring/data/`（单文件或 scores.jsonl，由 mode 决定）
   - 保证解析→写入的数据流闭环：同一 stage 的审计报告经解析后写入一条记录，run_id、scenario、stage、check_items 等与 schema 一致

2. **与 speckit-workflow、bmad-story-assistant 的协同**
   - 文档化或实现可调用入口：在哪些步骤后触发「解析并写入」、入参（run_id、scenario、stage、报告路径、writeMode）如何从工作流传入
   - 至少一个协同入口可被脚本或工作流调用并验证

3. **触发模式表实现**
   - 覆盖 real_dev 与 eval_question 两种场景，各 stage 的触发条件与写入模式（single_file / jsonl / both）配置化或文档化
   - 与 Architecture §10.3 及 Story 3.1 的触发模式表一致；mode 由配置或入参传入，与 Story 1.2 AC-3 衔接

4. **全链路 Skill 的衔接**
   - 全链路 Skill（Story 3.1 定义）在编排中调用本 Story 的「解析+写入」能力；本 Story 实现可被 Skill 或 Cursor Task 调用的函数或脚本入口

### 1.2 本 Story 不包含

- 评分规则 YAML 的配置与解析：由 Story 2.1 实现
- 全链路 Skill 的编排与触发定义：由 Story 3.1 实现；本 Story 调用 3.1 的 stage 与报告路径约定
- 审计报告解析逻辑的详细实现：由 Story 3.2 实现；本 Story 调用 3.2 的 `parseAuditReport`
- 一票否决、多次迭代阶梯式扣分：由 Story 4.1 实现
- AI 代码教练：由 Story 4.2 实现；场景与 BMAD 集成细节：由 Story 4.3 负责（4.3 待 Create Story 后 scope 将含该描述；Epic 4 规划中已列 4.3）

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 给定某 stage 的审计报告路径与 run_id/scenario/stage，调用解析+写入流程后，scoring/data 下出现符合 Story 1.1 schema 的记录（单文件或 scores.jsonl 中一行） | 集成测试或验收脚本：准备报告与参数，执行后校验文件内容与 schema |
| AC-2 | 与 speckit-workflow 或 bmad-story-assistant 的协同点文档化或实现为可调用入口；触发模式表明确 real_dev 与 eval_question 场景下各 stage 的触发条件与写入模式 | 文档或配置表；至少一个协同入口可被脚本或工作流调用并验证 |
| AC-3 | 解析使用 Story 3.2 的 `parseAuditReport`，写入使用 Story 1.2 的 `writeScoreRecordSync`；不重复实现解析与写入逻辑 | 代码或集成测试证明调用 3.2 与 1.2，无重复实现 |

---

## 3. Tasks / Subtasks

- [ ] **T1** 实现解析+写入编排（AC: #1, #3）
  - [ ] T1.1 定义 `parseAndWriteScore` 或等效入口：入参为 reportPath、stage、runId、scenario、writeMode；内部调用 `parseAuditReport` 与 `writeScoreRecordSync`
  - [ ] T1.2 集成测试：给定 prd/arch/story 样本报告，执行后校验 scoring/data 下记录符合 schema
  - [ ] T1.3 支持 reportPath 与 content 两种输入，与 Story 3.2 的 ParseAuditReportOptions 一致

- [ ] **T2** 触发模式表实现（AC: #2）
  - [ ] T2.1 产出触发模式表配置或文档：事件类型→触发方式→stage/环节→writeMode；至少覆盖 real_dev 与 eval_question 两种 scenario
  - [ ] T2.2 与 Architecture §10.3、Story 3.1 的触发模式表一致；writeMode 与 Story 1.2 的 single_file/jsonl/both 对应

- [ ] **T3** 与 speckit-workflow、bmad-story-assistant 协同（AC: #2）
  - [ ] T3.1 文档化协同点：在 speckit-workflow 的 clarify/checklist/analyze 嵌入审计闭环中，stage 完成后的调用入口与入参约定
  - [ ] T3.2 实现至少一个可调用入口（CLI 脚本或导出函数），供 bmad-story-assistant、全链路 Skill 或 Cursor Task 调用
  - [ ] T3.3 验收：通过脚本或工作流步骤调用入口，验证解析+写入成功

- [ ] **T4** 与全链路 Skill 衔接（AC: #1, #2）
  - [ ] T4.1 在 bmad-code-reviewer-lifecycle Skill 或等价编排中，声明对本 Story 入口的调用关系
  - [ ] T4.2 路径约定与 config/eval-lifecycle-report-paths.yaml 一致；报告路径可由 epic、story、slug 解析得出

---

## 4. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-1.2 | 各阶段审计通过且得分写入后视为该阶段迭代结束——本 Story 实现「审计通过后解析并写入」的闭环 |
| REQ-3.10 | 版本追溯与存储：run_id、stage、check_items 等经解析后写入 scoring 存储 |
| REQ-3.12~3.17 | 全链路 Skill 调用解析与写入、与 speckit-workflow/bmad-story-assistant 协同、触发模式 |

---

## 5. Architecture 约束

| 组件 | 约束 |
|------|------|
| 数据流 | Architecture §7.1、§7.3：stage 审计→解析→写入 scoring/data；与 BMAD workflows 集成点一致 |
| 存储 schema | Story 1.1、Architecture §8.1、§8.2；check_items 含 item_id、passed、score_delta、note |
| 写入接口 | Story 1.2 的 writeScoreRecordSync；mode 为 single_file / jsonl / both |
| 解析接口 | Story 3.2 的 parseAuditReport；stage 为 prd / arch / story；与 config/eval-lifecycle-report-paths.yaml 路径一致 |
| 触发模式表 | Architecture §10.3：stage 审计产出完成→自动；Story 状态变更/MR 创建→自动（可配置）；Epic 待验收→手动或自动；用户显式请求→手动 |

---

## 6. Dev Notes

### 6.1 技术栈与源树组件

- **语言**：TypeScript/Node，与 scoring 模块一致
- **解析**：`scoring/parsers` 的 `parseAuditReport`（audit-index.ts）；支持 prd、arch、story 三种 stage
- **写入**：`scoring/writer/write-score.ts` 的 `writeScoreRecordSync(record, mode, options)`
- **路径约定**：`config/eval-lifecycle-report-paths.yaml`；story 报告路径 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`

### 6.2 建议实现位置

- **解析+写入编排**：`scoring/` 下新增模块（如 `scoring/orchestrator/` 或 `scoring/parse-and-write.ts`），或扩展现有 `scoring/parsers/__tests__/integration/parse-and-write.test.ts` 对应实现
- **CLI 入口**：`scripts/` 或 `scoring/` 下可执行脚本，接收 reportPath、stage、runId、scenario、writeMode 等参数
- **配置**：触发模式表可置于 `config/` 或 `scoring/config/`，与 eval-lifecycle-report-paths.yaml 同目录

### 6.3 测试标准

- 集成测试覆盖：prd、arch、story 三类报告 → parseAuditReport → writeScoreRecordSync → 校验 scoring/data 产出
- 与 scoring/parsers/__tests__/integration/parse-and-write.test.ts 的现有用例衔接或扩展
- 验收脚本：给定报告路径与参数，执行后断言文件存在且 schema 校验通过

### 6.4 禁止词表合规

本 Story 文档及产出物禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

---

## 7. 与 Story 3.1、3.2、1.2 的接口约定

### 7.1 本 Story 从 3.1 接收

- 触发时机与 stage 映射；编排逻辑；与 speckit-workflow、bmad-story-assistant 协同点
- 报告路径约定：config/eval-lifecycle-report-paths.yaml；story 为 `AUDIT_Story_{epic}-{story}.md`

### 7.2 本 Story 从 3.2 接收

- `parseAuditReport(options: ParseAuditReportOptions): Promise<RunScoreRecord>`
- 入参：reportPath 或 content、stage、runId、scenario
- 产出：符合 Story 1.1 schema 的 RunScoreRecord

### 7.3 本 Story 从 1.2 接收

- `writeScoreRecordSync(record, mode, options?)`
- mode：single_file | jsonl | both
- 写入路径：scoring/data/ 或 options.dataPath

### 7.4 本 Story 产出

- 可被全链路 Skill、speckit-workflow、bmad-story-assistant 调用的入口（函数或脚本）
- 触发模式表配置或文档

---

## 8. 依赖

- **前置 Story**：Story 3.1（eval-lifecycle-skill-def）、Story 3.2（eval-layer1-3-parser）、Story 1.2（eval-system-storage-writer）。依赖 3.1 的编排与 stage 约定、3.2 的解析输出、1.2 的写入接口。
- 依赖 Story 1.1 的存储 schema；依赖 Architecture 中数据流与 BMAD 集成点的描述。

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

*本 Story 实现从审计报告解析出评分记录并写入 scoring 存储、与 speckit 协同，完成全链路「审计→解析→写入」闭环。*
