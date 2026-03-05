# tasks-E3-S3：eval-skill-scoring-write 任务列表

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3  
**来源**：plan-E3-S3.md、IMPLEMENTATION_GAPS-E3-S3.md、Story 3.3 §3

---

## Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现
5. ❌ 禁止模块内部实现完整但从未被生产代码关键路径导入和调用

**必须事项**:
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞
4. ✅ 实施前必须先检索并阅读 spec-E3-S3.md、plan-E3-S3.md 相关章节
5. ✅ 每完成涉及生产代码的任务，progress 中追加 [TDD-RED] 与 [TDD-GREEN] 记录

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | spec §2、plan §3、GAP-1.1、GAP-1.2 | 解析+写入编排 | parseAndWriteScore，调用 parseAuditReport、writeScoreRecordSync |
| T2 | spec §4、plan §4、GAP-2.1 | 触发模式表 | 事件→writeMode；real_dev、eval_question |
| T3 | spec §3、plan §5、GAP-3.1、GAP-3.2 | 协同点与入口 | 文档、CLI、验收 |
| T4 | spec §5、plan §6、GAP-4.1 | 全链路 Skill | SKILL.md 引用 parseAndWriteScore |
| T5 | plan §7、§8、GAP-5.1、GAP-5.2 | 测试与验收 | orchestrator 测试、accept-e3-s3 |

---

## Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §2 | GAP-1.1、GAP-1.2 | ✓ 有 | T1 |
| spec §4 | GAP-2.1 | ✓ 有 | T2 |
| spec §3 | GAP-3.1、GAP-3.2 | ✓ 有 | T3 |
| spec §5 | GAP-4.1 | ✓ 有 | T4 |
| plan §7、§8 | GAP-5.1、GAP-5.2 | ✓ 有 | T5 |

---

## 任务列表

### T1：实现 parseAndWriteScore 编排（AC-1、AC-3）

**产出物**：scoring/orchestrator/parse-and-write.ts、scoring/orchestrator/index.ts

**验收标准**：
- 函数 parseAndWriteScore(options)：入参 reportPath?、content?、stage、runId、scenario、writeMode、dataPath?；reportPath 与 content 二选一
- 内部调用 parseAuditReport、writeScoreRecordSync；不重复实现解析与写入逻辑
- 支持 reportPath 与 content 两种输入，与 Story 3.2 ParseAuditReportOptions 一致
- 该模块在生产代码关键路径中被 scripts 或验收脚本 import 并调用

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/orchestrator/__tests__/parse-and-write.test.ts -v
```

---

- [x] **T1.1** 创建 scoring/orchestrator/parse-and-write.ts，定义 parseAndWriteScore 函数
- [x] **T1.2** 实现 reportPath 输入：若 reportPath 则 fs.readFileSync 读 content，传入 parseAuditReport
- [x] **T1.3** 实现 content 输入：若 content 则直接传入 parseAuditReport
- [x] **T1.4** 调用 writeScoreRecordSync(record, writeMode, { dataPath })；writeMode 为 single_file | jsonl | both
- [x] **T1.5** 创建 scoring/orchestrator/index.ts 导出 parseAndWriteScore

---

### T2：触发模式表实现（AC-2）

**产出物**：config/scoring-trigger-modes.yaml

**验收标准**：
- 事件类型→触发方式→stage/环节→writeMode 默认值；与 Architecture §10.3、Story 3.1 一致
- 覆盖 real_dev、eval_question 两种 scenario；writeMode 与 Story 1.2 single_file/jsonl/both 对应

**验证命令**：
```bash
test -f d:\Dev\BMAD-Speckit-SDD-Flow\config\scoring-trigger-modes.yaml && echo PASS
```

---

- [x] **T2.1** 创建 config/scoring-trigger-modes.yaml：定义 event、trigger、scope、default_write_mode
- [x] **T2.2** 补充 scenario 覆盖：real_dev、eval_question 的 writeMode 映射（可与 stage 绑定或文档化）

---

### T3：协同点与可调用入口（AC-2）

**产出物**：INTEGRATION.md、scripts/parse-and-write-score.ts、scripts/accept-e3-s3.ts、package.json 注册

**验收标准**：
- 协同点文档：speckit-workflow clarify/checklist/analyze 阶段完成后调用时机与入参约定
- 至少一个可调用入口：CLI scripts/parse-and-write-score.ts 或 accept-e3-s3.ts；导出函数 parseAndWriteScore
- 验收脚本可被 package.json 调用；执行后校验 scoring/data 下记录存在

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npm run accept:e3-s3
```

---

- [x] **T3.1** 创建 _bmad-output/implementation-artifacts/epic-3-feature-eval-lifecycle-skill/story-3-eval-skill-scoring-write/INTEGRATION.md：文档化协同点、入参约定
- [x] **T3.2** 创建 scripts/parse-and-write-score.ts：解析 --reportPath、--stage、--runId、--scenario、--writeMode、--dataPath，调用 parseAndWriteScore
- [x] **T3.3** 创建 scripts/accept-e3-s3.ts：对 prd/arch/story 各调用 parseAndWriteScore 一次，校验 scoring/data 产出
- [x] **T3.4** package.json 增加 `"accept:e3-s3": "npx ts-node scripts/accept-e3-s3.ts"`

---

### T4：全链路 Skill 衔接（AC-1、AC-2）

**产出物**：bmad-code-reviewer-lifecycle SKILL.md（全局 `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\`）更新

**验收标准**：
- SKILL.md 中声明对本 Story parseAndWriteScore 的调用关系；引用路径 scoring/orchestrator/parse-and-write.ts
- 路径约定与 config/eval-lifecycle-report-paths.yaml 一致

**验证命令**：
```bash
grep -E "parseAndWriteScore|scoring/orchestrator|Story 3.3" "%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md"
```

---

- [x] **T4.1** 更新 bmad-code-reviewer-lifecycle/SKILL.md（全局 skill）：在 references 或正文补充「调用 Story 3.3 的 parseAndWriteScore」及路径
- [x] **T4.2** 确保路径约定与 config/eval-lifecycle-report-paths.yaml 一致（文档引用或代码常量）

---

### T5：集成测试与验收（AC-1、AC-2、AC-3）

**产出物**：scoring/orchestrator/__tests__/parse-and-write.test.ts、验收脚本通过

**验收标准**：
- parseAndWriteScore 集成测试：给定 content + stage + runId + scenario + writeMode，调用后校验 scoring/data 下文件存在且 schema 符合
- 覆盖 prd、arch、story 三类报告各至少一例
- reportPath 与 content 两种输入均测
- 生产代码关键路径：accept-e3-s3 或 parse-and-write-score  import 并调用 parseAndWriteScore

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/orchestrator -v && npm run accept:e3-s3
```

---

- [x] **T5.1** 创建 scoring/orchestrator/__tests__/parse-and-write.test.ts：测试 parseAndWriteScore(content, stage, ...)，prd/arch/story 各一例
- [x] **T5.2** 扩展测试：reportPath 输入（使用 fixtures 路径）
- [x] **T5.3** 断言写入文件存在、内容符合 run-score-schema
- [x] **T5.4** 验收脚本 accept-e3-s3 对 prd/arch/story 各调用 parseAndWriteScore，断言 3/3 通过

---

## 验收汇总

| 任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 |
|------|------------------|--------------|----------|
| T1 | scoring/orchestrator/parse-and-write.ts、index.ts；parseAndWriteScore 调用 parseAuditReport、writeScoreRecordSync | parse-and-write.test.ts；accept-e3-s3 import 并调用 | [x] 通过 |
| T2 | config/scoring-trigger-modes.yaml | 配置文件存在即可 | [x] 通过 |
| T3 | INTEGRATION.md、parse-and-write-score.ts、accept-e3-s3.ts、package.json | npm run accept:e3-s3 通过 | [x] 通过 |
| T4 | SKILL.md 引用 parseAndWriteScore | grep 验证 | [x] 通过 |
| T5 | orchestrator __tests__、accept-e3-s3 验收 | vitest run scoring/orchestrator；accept:e3-s3 | [x] 通过 |
