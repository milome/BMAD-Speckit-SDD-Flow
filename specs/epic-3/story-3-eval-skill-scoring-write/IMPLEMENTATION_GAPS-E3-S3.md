# IMPLEMENTATION_GAPS-E3-S3：eval-skill-scoring-write

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3  
**输入**：plan-E3-S3.md、Story 3.3、当前代码库

---

## 1. 现状摘要

- **已有**：scoring/parsers/parseAuditReport、scoring/writer/writeScoreRecordSync；config/stage-mapping.yaml 含 trigger_modes；config/eval-lifecycle-report-paths.yaml；bmad-code-reviewer-lifecycle SKILL.md（全局 skill）；scripts/accept-e3-s2.ts。
- **缺失**：parseAndWriteScore 编排函数；scoring/orchestrator/ 模块；config/scoring-trigger-modes.yaml（事件→writeMode 映射）；scripts/parse-and-write-score.ts 或 accept-e3-s3.ts；协同点文档 INTEGRATION.md；bmad-code-reviewer-lifecycle 对 parseAndWriteScore 的引用；package.json accept-e3-s3 脚本；scoring/orchestrator/__tests__/parse-and-write.test.ts。

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §2 / plan §3 / T1 | GAP-1.1 | parseAndWriteScore 编排：入参 reportPath/content、stage、runId、scenario、writeMode；内部调用 parseAuditReport、writeScoreRecordSync | 未实现 | 无 scoring/orchestrator/parse-and-write.ts；现有 parse-and-write.test.ts 直接调用解析+写入，无编排层 |
| spec §2 / T1.3 | GAP-1.2 | 支持 reportPath 与 content 两种输入 | 未实现 | 需 parseAndWriteScore 实现时支持 |
| spec §4 / plan §4 / T2 | GAP-2.1 | 触发模式表：事件→writeMode；覆盖 real_dev、eval_question | 未实现 | config/stage-mapping.yaml 有 trigger_modes 但无 writeMode；无 config/scoring-trigger-modes.yaml |
| spec §3 / plan §5 / T3 | GAP-3.1 | 协同点文档：speckit-workflow stage 完成后调用时机与入参约定 | 未实现 | 无 docs/speckit-eval-integration.md 或 3-3/INTEGRATION.md |
| spec §3 / T3.2 | GAP-3.2 | 至少一个可调用入口：CLI 或导出函数 | 未实现 | 无 parseAndWriteScore 导出；无 scripts/parse-and-write-score.ts |
| spec §5 / plan §6 / T4 | GAP-4.1 | bmad-code-reviewer-lifecycle 声明对 parseAndWriteScore 的调用 | 未实现 | SKILL.md 未引用 scoring/orchestrator 或 parseAndWriteScore |
| plan §7 / §8 | GAP-5.1 | 验收脚本 accept-e3-s3、package.json 注册 | 未实现 | 无 accept-e3-s3.ts；package.json 无 accept:e3-s3 |
| plan §8 | GAP-5.2 | scoring/orchestrator/__tests__/parse-and-write.test.ts 集成测试 | 未实现 | 有 parsers/__tests__/integration/parse-and-write.test.ts 但不测 parseAndWriteScore |

---

## 3. 实现建议

### 3.1 GAP-1.x

- 创建 scoring/orchestrator/parse-and-write.ts，导出 `parseAndWriteScore(options)`。
- 入参：reportPath?、content?、stage、runId、scenario、writeMode、dataPath?；reportPath 与 content 二选一。
- 实现：若 reportPath 则 fs.readFileSync；调用 parseAuditReport；调用 writeScoreRecordSync。
- scoring/orchestrator/index.ts 导出 parseAndWriteScore。

### 3.2 GAP-2.1

- 创建 config/scoring-trigger-modes.yaml：event → default_write_mode、scenario 覆盖（real_dev、eval_question）。
- 或扩展 config/stage-mapping.yaml 的 trigger_modes 增加 write_mode 字段。

### 3.3 GAP-3.x

- 创建 _bmad-output/implementation-artifacts/3-3-eval-skill-scoring-write/INTEGRATION.md：文档化 speckit-workflow clarify/checklist/analyze 阶段完成后的调用时机、入参约定。
- 创建 scripts/parse-and-write-score.ts：解析 --reportPath、--stage 等，调用 parseAndWriteScore。

### 3.4 GAP-4.1

- 更新 bmad-code-reviewer-lifecycle/SKILL.md（全局 skill）：在 references 或正文中补充「调用 Story 3.3 的 parseAndWriteScore」及路径 scoring/orchestrator/parse-and-write.ts。

### 3.5 GAP-5.x

- 创建 scripts/accept-e3-s3.ts：调用 parseAndWriteScore，对 prd/arch/story 各测一次，校验 scoring/data 产出。
- package.json 增加 `"accept:e3-s3": "npx ts-node scripts/accept-e3-s3.ts"`。
- 创建 scoring/orchestrator/__tests__/parse-and-write.test.ts：测试 parseAndWriteScore，覆盖 content 与 reportPath 输入、prd/arch/story 三 stage。

---

## 4. 闭合条件

- parseAndWriteScore 存在且可被 scripts、Skill 引用；集成测试、验收脚本通过；config/scoring-trigger-modes.yaml 存在；INTEGRATION.md 存在；SKILL.md 已更新；package.json 已注册 accept:e3-s3。
