# plan-E3-S2：eval-layer1-3-parser 实现方案

<!-- AUDIT: PASSED 2026-03-04 复审 -->

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**输入**：spec-E3-S2.md、Story 3.2、Architecture §2/§5/§6/§8

---

## 1. 目标与约束

- 实现 Layer 1（prd、arch）、Layer 3（story）审计产出的同机解析。
- 解析产出符合 Story 1.1 存储 schema（run-score-schema.json），可直接供 Story 3.3 调用并写入 scoring 存储。
- 技术栈与项目 scripts 一致（TypeScript/Node）；解析器置于 scoring/ 或 scripts/。
- phase_weight 从 scoring/constants/weights.ts 与 config/stage-mapping.yaml 表 B 推导：prd→环节 1（0.2）、arch→环节 1+2、story→环节 1（0.2）。

---

## 2. 需求映射清单（plan ↔ 需求文档 + spec）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1.1 Layer 1 prd 解析 | spec §3 | plan §3 | ✅ |
| Story §1.1 Layer 1 arch 解析 | spec §4 | plan §4 | ✅ |
| Story §1.1 Layer 3 story 解析 | spec §5 | plan §5 | ✅ |
| Story §1.1 同机解析、schema 产出 | spec §6 | plan §6、§7 | ✅ |
| Story §1.1 路径约定落地 | spec §7 | plan §8 | ✅ |
| Story §2 AC-1~AC-4 | spec §3~§8 | plan §3~§10 | ✅ |
| spec §3 prd 解析规则、等级→数值 | spec §3.1~3.2 | plan §3 | ✅ |
| spec §4 arch 解析规则 | spec §4 | plan §4 | ✅ |
| spec §5 story 解析、格式判定 | spec §5 | plan §5 | ✅ |
| spec §6 输出 schema、可选字段、iteration_records | spec §6 | plan §6、§7 | ✅ |
| spec §7 报告路径、§3.4/4.3/5.3 边界条件 | spec §7、§3.4 | plan §8 | ✅ |
| spec §8 解析入口、与 3.3 契约 | spec §8 | plan §9 | ✅ |
| Story §3 PRD 追溯 REQ-2.1~2.5、3.12、3.13、3.15、3.16、3.17 | spec §2 | plan §3~§10 | ✅ |

---

## 3. Phase 1：prd 审计报告解析器（T1）

### 3.1 模块设计

| 组件 | 职责 | 路径 |
|------|------|------|
| parsePrdReport | 解析 prd 审计报告，产出 RunScore 结构 | scoring/parsers/audit-prd.ts 或 scripts/parse-audit-prd.ts |
| 等级映射 | A/B/C/D → 100/80/60/40 | 内置于解析逻辑或 scoring/constants/ 常量 |
| 路径读取 | 从 config/eval-lifecycle-report-paths.yaml 读取 prd.report_path | 与 config 模块集成 |

### 3.2 输入输出

- **输入**：报告文件路径（或文件内容）、run_id、scenario、stage='prd'
- **输出**：RunScore（phase_score、phase_weight、check_items、timestamp 等，符合 run-score-schema.json）
- **边界**：文件不存在或格式异常 → 抛出 ReportFileNotFoundError 或 ParseError

### 3.3 集成点

- 解析器被 Story 3.3 或 scripts 调用；生产代码关键路径为「给定报告路径 → 解析 → 返回 RunScore」

---

## 4. Phase 2：arch 审计报告解析器（T2）

### 4.1 模块设计

| 组件 | 职责 | 路径 |
|------|------|------|
| parseArchReport | 解析 arch 审计报告，产出 RunScore 结构 | scoring/parsers/audit-arch.ts 或 scripts/parse-audit-arch.ts |
| 等级映射 | 同 prd | 共用或复用 |
| 路径读取 | arch.report_path | 同上 |

### 4.2 输入输出

- 同 §3.2，stage='arch'
- arch 映射环节 1 补充、环节 2 设计侧；phase_weight 取环节 1 权重 0.2（或按 Architecture 双环节处理）

### 4.3 集成点

- 与 prd 解析器同属解析层，可被统一入口 `parseAuditReport(reportPath, stage, runId, scenario)` 调度

---

## 5. Phase 3：story 审计报告解析器（T3）

### 5.1 模块设计

| 组件 | 职责 | 路径 |
|------|------|------|
| parseStoryReport | 解析 Create Story 审计报告 | scoring/parsers/audit-story.ts 或 scripts/parse-audit-story.ts |
| 格式判定 | 若含 A/B/C/D 与检查项 → 复用 prd/arch 映射；否则单独实现 | 内置于解析逻辑 |
| 路径 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` | config/eval-lifecycle-report-paths.yaml |

### 5.2 输入输出

- 同 §3.2，stage='story'
- 路径由 config 或调用方传入，支持 {epic}、{story}、{slug} 占位替换

### 5.3 集成点

- 与 prd、arch 解析器统一入口调度；生产代码关键路径验证：scripts 或 3.3 调用 parseStoryReport → 返回 RunScore

---

## 6. Phase 4：统一输出结构与 schema 校验（T4）

### 6.1 输出结构

- 必填：run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass
- 可选：path_type、model_version、question_version
- check_items：item_id、passed、score_delta、note
- iteration_records：首轮审计 iteration_count=0、iteration_records=[]、first_pass=true

### 6.2 schema 校验

- 解析产出通过 scoring/schema/run-score-schema.json 校验（可用 ajv 或项目既有校验逻辑）
- 与 Story 1.2 写入接口兼容，无需二次转换

### 6.3 phase_weight 来源

- 从 scoring/constants/weights.ts 的 PHASE_WEIGHTS 与 config/stage-mapping.yaml 表 B（或 scoring/constants/table-b.ts）推导
- prd、story → 环节 1 → 0.2；arch → 环节 1 为主 → 0.2

---

## 7. Phase 5：统一解析入口与 3.3 接口（T5）

### 7.1 解析入口

```
parseAuditReport(options: {
  reportPath: string;
  stage: 'prd' | 'arch' | 'story';
  runId: string;
  scenario: 'real_dev' | 'eval_question';
}): Promise<RunScore>
```

- 根据 stage 调度 parsePrdReport、parseArchReport、parseStoryReport
- 输出可直接传入 Story 1.2 写入接口

### 7.2 路径约定文档

- 在代码常量或 scoring/parsers/README.md 中明确支持的报告路径列表（prd、arch、story 三类）
- 与 config/eval-lifecycle-report-paths.yaml、Story 3.1 一致

---

## 8. 目录与文件布局

| 路径 | 说明 |
|------|------|
| scoring/parsers/audit-prd.ts | prd 解析器 |
| scoring/parsers/audit-arch.ts | arch 解析器 |
| scoring/parsers/audit-story.ts | story 解析器 |
| scoring/parsers/audit-index.ts | 统一入口 parseAuditReport |
| scoring/parsers/__tests__/audit-prd.test.ts | prd 单元测试 |
| scoring/parsers/__tests__/audit-arch.test.ts | arch 单元测试 |
| scoring/parsers/__tests__/audit-story.test.ts | story 单元测试 |
| scoring/parsers/__tests__/fixtures/ | 样本 prd/arch/story 审计报告 |
| scripts/accept-e3-s2.ts | 验收脚本（可选，验证路径约定与解析） |
| config/eval-lifecycle-report-paths.yaml | 已有，解析器读取 |
| config/stage-mapping.yaml | 已有，phase_weight 推导 |

---

## 9. 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖 | 验证方式 |
|----------|------|----------|
| 单元测试 | prd 解析：注入样本 prd 报告，断言 output 含 phase_score、check_items、schema 兼容 | scoring/parsers/__tests__/audit-prd.test.ts |
| 单元测试 | arch 解析：同上 | scoring/parsers/__tests__/audit-arch.test.ts |
| 单元测试 | story 解析：注入样本 story 报告或路径，断言输出 | scoring/parsers/__tests__/audit-story.test.ts |
| 单元测试 | 边界：报告不存在、格式异常 → 抛错 | 同上，expect throws |
| 集成测试 | parseAuditReport 统一入口：给定 reportPath+stage，返回 RunScore | scoring/parsers/__tests__/audit-index.test.ts |
| 集成测试 | 解析产出→Story 1.2 写入：parseAuditReport 产出传入 writeScoreRecordSync，断言写入成功 | scoring/parsers/__tests__/integration/parse-and-write.test.ts；导入 scoring/writer、parseAuditReport，执行 writeScoreRecordSync(record, 'single_file', { dataPath: tempDir })，断言文件存在且内容合法 |
| 端到端测试 | 报告→解析→写入→验证存储：给定样本报告路径 → parseAuditReport → writeScoreRecordSync → 读回 JSON 断言 phase_score、check_items 等 | scoring/parsers/__tests__/integration/parse-write-verify.e2e.test.ts 或 scripts/accept-e3-s2.ts 内实现 |
| 生产代码关键路径 | 解析器被 scripts 或 3.3 调用 | 验收脚本 import parseAuditReport、writeScoreRecordSync，实际调用并验证；tasks 中规定脚本在 package.json 或 CI 注册 |
| 验收脚本 | AC-3：路径约定与 config、3.1 一致 | scripts/accept-e3-s2.ts 检查常量或文档含 prd/arch/story 路径 |

**严禁**：仅单元测试、模块内部实现完整但从未被生产代码关键路径导入和调用。

---

## 10. 与 Story 3.1、3.3 的衔接

| 从 3.1 接收 | 本 plan 使用 |
|-------------|--------------|
| 报告路径约定 | config 读取；story 路径 `AUDIT_Story_{epic}-{story}.md` |
| stage→环节映射 | scoring/constants、config/stage-mapping |

| 向 3.3 提供 | 本 plan 产出 |
|-------------|--------------|
| parseAuditReport(reportPath, stage, runId, scenario) | scoring/parsers/audit-index.ts |
| RunScore 结构，可直接写入 | 符合 run-score-schema.json |

---

## 11. 禁止词表合规

本 plan 及后续 GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。
