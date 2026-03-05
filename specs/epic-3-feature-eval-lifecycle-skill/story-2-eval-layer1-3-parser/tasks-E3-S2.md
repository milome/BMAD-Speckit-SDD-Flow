# tasks-E3-S2：eval-layer1-3-parser 任务列表

<!-- AUDIT: PASSED 2026-03-04 -->

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**来源**：plan-E3-S2.md、IMPLEMENTATION_GAPS-E3-S2.md、Story 3.2 §5

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
4. ✅ 实施前必须先检索并阅读 spec-E3-S2.md、plan-E3-S2.md 相关章节
5. ✅ 每完成涉及生产代码的任务，progress 中追加 [TDD-RED] 与 [TDD-GREEN] 记录

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | spec §3、plan §3、GAP-1.x | prd 解析 | Layer 1 prd 审计报告解析，A/B/C/D→100/80/60/40 |
| T2 | spec §4、plan §4、GAP-2.x | arch 解析 | Layer 1 arch 审计报告解析 |
| T3 | spec §5、plan §5、GAP-3.x | story 解析 | Layer 3 story 审计报告解析 |
| T4 | spec §6、§7、plan §6、§8、GAP-4.x | 输出与路径 | 统一输出结构、路径约定文档化 |
| T5 | spec §8、plan §7、§9、GAP-5.1 | 解析入口 | parseAuditReport 统一入口 |
| T6 | plan §9、GAP-6.x | 测试与验收 | 单元、集成、E2E、accept-e3-s2.ts |

---

## Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| spec §3 | GAP-1.1、GAP-1.2、GAP-AC1 | ✓ 有 | T1 |
| spec §4 | GAP-2.1、GAP-AC1 | ✓ 有 | T2 |
| spec §5 | GAP-3.1、GAP-3.2、GAP-AC2 | ✓ 有 | T3 |
| spec §6、§7 | GAP-4.1、GAP-4.2、GAP-AC3、GAP-AC4 | ✓ 有 | T4 |
| spec §8 | GAP-5.1 | ✓ 有 | T5 |
| plan §9 | GAP-6.1～GAP-6.4 | ✓ 有 | T6 |

---

## 任务列表

### T1：实现 Layer 1 prd 审计报告解析器（AC-1） ✅

**产出物**：scoring/parsers/audit-prd.ts

**验收标准**：
- 函数 parsePrdReport 或等效：输入报告路径/内容、run_id、scenario、stage='prd'，输出 RunScoreRecord
- 等级 A/B/C/D → 100/80/60/40；check_items 从问题清单提取，item_id 与 scoring/rules、code-reviewer-config 引用一致
- 报告不存在或格式异常 → 抛出 ReportFileNotFoundError 或 ParseError
- 输出符合 run-score-schema.json；iteration_count=0、iteration_records=[]、first_pass=true

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/parsers/__tests__/audit-prd.test.ts -v
```

---

- [x] **T1.1** 定义 prd 报告输入格式与解析规则（基于 audit-prompts-prd.md 结构）
- [x] **T1.2** 实现 parsePrdReport：等级→phase_score、问题清单→check_items
- [x] **T1.3** 边界处理：文件不存在、格式异常抛错
- [x] **T1.4** 单元测试：注入样本 prd 报告，断言输出 schema 兼容

---

### T2：实现 Layer 1 arch 审计报告解析器（AC-1） ✅

**产出物**：scoring/parsers/audit-arch.ts

**验收标准**：
- parseArchReport：输入、输出同 T1，stage='arch'
- 等级 A/B/C/D → 100/80/60/40；映射环节 1 补充、环节 2 设计侧
- 边界处理同 T1

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/parsers/__tests__/audit-arch.test.ts -v
```

---

- [x] **T2.1** 定义 arch 报告输入格式与解析规则（基于 audit-prompts-arch.md）
- [x] **T2.2** 实现 parseArchReport：等级→phase_score、Tradeoff/问题→check_items
- [x] **T2.3** 单元测试：注入样本 arch 报告，断言输出 schema 兼容

---

### T3：实现 Layer 3 story 审计报告解析器（AC-2） ✅

**产出物**：scoring/parsers/audit-story.ts

**验收标准**：
- parseStoryReport：路径 `AUDIT_Story_{epic}-{story}.md`；格式判定：含 A/B/C/D 则复用 prd/arch 映射
- 输出符合 RunScoreRecord

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/parsers/__tests__/audit-story.test.ts -v
```

---

- [x] **T3.1** 约定 Create Story 审计报告路径（与 config/eval-lifecycle-report-paths.yaml 一致）
- [x] **T3.2** 实现 parseStoryReport：格式判定、提取 phase_score、check_items
- [x] **T3.3** 单元测试：给定样本 story 报告，校验解析结果

---

### T4：统一解析输出与路径约定文档化（AC-3、AC-4） ✅

**产出物**：scoring/parsers/README.md 或常量表；scoring/parsers/index.ts 更新

**验收标准**：
- 解析输出含 phase_score、phase_weight、check_items（item_id、passed、score_delta、note）
- 代码或文档中明确支持的报告路径列表（prd、arch、story 三类）
- phase_weight 从 config/stage-mapping 或 scoring/constants 获取

**验证命令**：
```bash
grep -E "prd|arch|story|AUDIT_Story" scoring/parsers/*.ts scoring/parsers/README.md 2>/dev/null | head -10
```

---

- [x] **T4.1** 确保解析输出符合 run-score-schema；phase_weight 从 weights/table-b 推导
- [x] **T4.2** 在 scoring/parsers/README.md 或常量中列出 prd/arch/story 报告路径
- [x] **T4.3** 验证与 config/eval-lifecycle-report-paths.yaml、Story 3.1 一致

---

### T5：parseAuditReport 统一入口与 Story 3.3 接口（AC-4） ✅

**产出物**：scoring/parsers/audit-index.ts

**验收标准**：
- parseAuditReport(options: { reportPath, stage, runId, scenario }) → Promise<RunScoreRecord>
- 根据 stage 调度 parsePrdReport、parseArchReport、parseStoryReport
- 输出可直接供 writeScoreRecordSync 使用

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/parsers/__tests__/audit-index.test.ts -v
```

---

- [x] **T5.1** 实现 parseAuditReport 统一入口
- [x] **T5.2** 导出 parseAuditReport；scoring/parsers/index.ts 或 scoring/parsers/audit.ts 导出

---

### T6：单元测试、集成测试、E2E、验收脚本（plan §9） ✅

**产出物**：scoring/parsers/__tests__/*.test.ts、scripts/accept-e3-s2.ts；package.json scripts 注册

**验收标准**：
- 单元测试：audit-prd、audit-arch、audit-story、audit-index 全部通过
- 集成测试：parseAuditReport 产出传入 writeScoreRecordSync，断言写入成功
- 端到端：报告→解析→写入→验证存储
- accept-e3-s2.ts：import parseAuditReport、writeScoreRecordSync，实际调用并验证；package.json 或 CI 注册

**验证命令**：
```bash
cd d:\Dev\BMAD-Speckit-SDD-Flow && npx vitest run scoring/parsers/__tests__/ -v
npm run accept-e3-s2
```

---

- [x] **T6.1** 单元测试：audit-prd、audit-arch、audit-story、audit-index
- [x] **T6.2** 集成测试：parse-and-write.test.ts（parseAuditReport → writeScoreRecordSync）
- [x] **T6.3** 端到端测试或 accept-e3-s2.ts 内实现：报告→解析→写入→读回验证
- [x] **T6.4** 验收脚本 accept-e3-s2.ts：import 并调用 parseAuditReport、writeScoreRecordSync；至少对 stage=prd、arch、story 各调用一次，保证 T1、T2、T3 均被关键路径覆盖
- [x] **T6.5** package.json 注册 `"accept:e3-s2": "npx ts-node scripts/accept-e3-s2.ts"`

---

## 集成测试要求（按 plan §9）

| 测试文件 | 用例 | 执行命令 | 预期 |
|----------|------|----------|------|
| audit-index.test.ts | parseAuditReport 统一入口 | npx vitest run scoring/parsers/__tests__/audit-index.test.ts -v | PASSED |
| parse-and-write.test.ts | 解析产出→writeScoreRecordSync | npx vitest run scoring/parsers/__tests__/integration/parse-and-write.test.ts -v | PASSED |
| accept-e3-s2.ts | 报告→解析→写入→验证 | npm run accept-e3-s2 | 通过 |

---

## 检查点

- **T1–T3 完成后**：prd/arch/story 三类解析器单元测试全部通过
- **T5 完成后**：parseAuditReport 可被调用并返回 RunScore
- **T6 完成后**：集成测试、E2E、验收脚本全部通过；生产代码关键路径验证（grep 或验收脚本 import 并调用）
