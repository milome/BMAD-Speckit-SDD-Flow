# plan-E3-S2 审计报告：需求覆盖与集成/端到端测试计划

**审计对象**：`specs/epic-3/story-2-eval-layer1-3-parser/plan-E3-S2.md`  
**原始需求文档**：spec-E3-S2.md、Story 3.2、Architecture §2/§5/§6/§8  
**审计日期**：2026-03-04  
**审计依据**：逐条验证需求覆盖；专项审查 §9 集成测试与端到端测试计划；解析器生产代码关键路径导入验证

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐条需求覆盖验证

### 1.1 plan ↔ spec-E3-S2.md

| spec 章节 | 对应需求要点 | plan 对应 | 验证方式 | 结果 |
|-----------|--------------|-----------|----------|------|
| §1 范围与目标 | Layer 1 prd/arch、Layer 3 story 同机解析、Story 1.1 schema | plan §1 目标、§3~§5 | 文本对照 | ✅ |
| §1.2 功能边界 | 包含解析、不包含持久化/编排/一票否决 | plan §1 未展开边界，隐含在 §3~§8 | 隐含覆盖 | ✅ |
| §2 需求映射 | spec ↔ 原始文档 | plan §2 需求映射清单 | 映射表完整 | ✅ |
| §3 prd 解析 | 输入格式、等级→数值、check_items、边界 3.4 | plan §3.1~3.3 | 逐条对照 | ✅ |
| §3.4 边界条件 | 报告不存在/格式异常 → 抛错 | plan §3.2 边界、§9 单元测试 expect throws | 明确覆盖 | ✅ |
| §4 arch 解析 | 同 prd、环节 1 补充与环节 2 设计侧 | plan §4 | 逐条对照 | ✅ |
| §4.3 边界条件 | 同 §3.4 | plan §4.2、§9 | 隐含于统一边界 | ✅ |
| §5 story 解析 | 路径、格式判定、边界 5.3 | plan §5.1~5.3 | 逐条对照 | ✅ |
| §6 输出结构 | 必填/可选字段、check_items、iteration_records、与 1.2 兼容 | plan §6.1~6.3 | 字段逐项 | ✅ |
| §6.1 可选字段 | path_type、model_version、question_version | plan §6.1 可选行 | 已列出 | ✅ |
| §6.1 iteration_records | 首轮 iteration_count=0、iteration_records=[]、first_pass | plan §6.1 明确写出 | 对照 spec | ✅ |
| §7 报告路径 | prd/arch/story 三类、config | plan §7.2、§8 | 路径表 | ✅ |
| §8 接口契约 | 输入输出、可被 3.3 调用 | plan §7.1、§9、§10 | 入口签名 | ✅ |
| §9 技术栈 | TypeScript/Node、scoring/ 或 scripts/ | plan §1、§8 | 技术选型 | ✅ |
| §10 验收标准 | AC-1~4 验证方式 | plan §2 映射、§9 | 映射完整 | ✅ |

**结论**：plan 对 spec-E3-S2.md 各章节均有对应，无遗漏。

---

### 1.2 plan ↔ Story 3.2

| Story 3.2 章节 | 需求要点 | plan 对应 | 验证结果 |
|----------------|----------|-----------|----------|
| §1.1 第 1 项 | Layer 1 prd/arch 解析 | plan §3、§4 | ✅ |
| §1.1 第 2 项 | Layer 3 story 解析 | plan §5 | ✅ |
| §1.1 第 3 项 | 同机解析、Story 1.1 schema | plan §1、§6 | ✅ |
| §1.1 第 4 项 | 解析器实现、路径约定落地 | plan §7、§8 | ✅ |
| §2 AC-1 | prd/arch → 环节 1 评分结构 | plan §3、§4、§9 | ✅ |
| §2 AC-2 | story 报告 → 环节 1 | plan §5、§9 | ✅ |
| §2 AC-3 | 路径约定文档化、与 3.1 一致 | plan §7.2、§8、§9 验收脚本 | ✅ |
| §2 AC-4 | phase_score、phase_weight、check_items | plan §6.1、§9 | ✅ |
| §3 PRD 追溯 | REQ-2.1~2.5、3.12、3.13、3.15~3.17 | plan §2 映射表未显式列 PRD ID | ⚠️ 建议在 plan §2 映射表补充 PRD 追溯行 |
| §4 Architecture 约束 | §2.1、§5、§6、§8.1/8.2、config | plan §2、§4~§6 | ✅ |
| §5 T1~T5 | 任务分解 | plan §3~§7 与 T1~T5 一一对应 | ✅ |
| §6 接口约定 | 从 3.1 接收、向 3.3 提供 | plan §10 | ✅ |

**结论**：Story 3.2 核心 scope、AC、Tasks、接口约定均被 plan 覆盖；PRD 追溯建议在 plan §2 补充一行，非阻塞。

---

### 1.3 plan ↔ Architecture §2/§5/§6/§8

| Architecture 章节 | 要点 | plan 对应 | 验证结果 |
|-------------------|------|-----------|----------|
| **§2** scoring/rules 与 audit-prompts 引用 | 解析规则从 audit-prompts 对应报告提取 | plan §3.1、§4.1、§5.1 报告来源；§3 解析规则 | ✅ |
| **§5** 审计产出→评分环节 | prd→环节 1、arch→环节 1+2、story→环节 1 | plan §1 phase_weight、§4.2 环节映射 | ✅ |
| **§6** Layer 1–3 同机解析 | prd/arch/story 路径、audit-prompts 对应 | plan §3~§5、§8 story 路径 | ✅ |
| **§8.1** 必存字段 | run_id、scenario、stage、phase_score、phase_weight、check_items、timestamp、iteration_count、iteration_records、first_pass 等 | plan §6.1 必填行 | ✅ |
| **§8.2** check_items | item_id、passed、score_delta、note | plan §6.1 check_items 行 | ✅ |
| **§8.3** 文件命名与格式 | 本 Story 不负责写入 | plan 正确排除 | ✅ |

**结论**：Architecture §2、§5、§6、§8 相关要点在 plan 中均有对应。

---

## 2. §9 集成测试与端到端测试计划专项审查

### 2.1 plan §9 内容概览

| 测试类型 | plan 描述 | 验证方式 |
|----------|-----------|----------|
| 单元测试 | prd/arch/story 解析、边界抛错 | `__tests__/audit-*.test.ts`、expect throws |
| 集成测试 | parseAuditReport 统一入口 | `audit-index.test.ts` |
| 集成测试 | 解析产出可被 Story 1.2 写入接口接受 | 「若有 write-score 模块，传入解析产出，断言写入成功」 |
| 生产代码关键路径 | 解析器被 scripts 或 3.3 调用 | grep 生产代码 import/调用；验收脚本执行 parseAuditReport |
| 验收脚本 | AC-3 路径约定 | `scripts/accept-e3-s2.ts` |

### 2.2 专项检查项

#### 2.2.1 单元测试覆盖

| 检查项 | plan §9 | 验证 | 结果 |
|--------|---------|------|------|
| prd 解析 | ✅ 注入样本、断言 phase_score、check_items、schema | 明确 | ✅ |
| arch 解析 | ✅ 同上 | 明确 | ✅ |
| story 解析 | ✅ 同上 | 明确 | ✅ |
| 边界条件 | ✅ 报告不存在、格式异常 → expect throws | 明确 | ✅ |

#### 2.2.2 集成测试覆盖

| 检查项 | plan §9 | 验证 | 结果 |
|--------|---------|------|------|
| parseAuditReport 统一入口 | ✅ audit-index.test.ts | 明确 | ✅ |
| 解析产出 → Story 1.2 写入 | 「若有 write-score 模块」 | **问题** | ❌ |

**问题说明**：Story 1.2 已实现 `scoring/writer/write-score.ts` 及 `writeScoreRecordSync`。plan 将「解析产出可被 Story 1.2 写入接口接受」写成「若有 write-score 模块」会使该集成测试可被理解为「可选」。应改为**强制**：解析产出必须传入 `writeScoreRecordSync` 或 `writeScoreRecord` 并断言写入成功，不得以「若有」为由跳过。

#### 2.2.3 端到端测试覆盖

| 检查项 | plan §9 | 验证 | 结果 |
|--------|---------|------|------|
| 模块间协作 | 解析→写入 | 仅集成测试项，未明确 E2E 脚本 | ⚠️ |
| 用户可见功能流程 | 给定报告路径 → 解析 → 写入 → 验证存储 | plan 未单独列出 E2E 条目 | ⚠️ |

**问题说明**：plan §9 有「生产代码关键路径：解析器被 scripts 或 3.3 调用」及「验收脚本执行 parseAuditReport」，但未显式列出「端到端：报告路径 → 解析 → 写入 → 验证 scoring 存储中记录存在且字段正确」。与 Story 1.2 的 `accept-e1-s2.ts` 类似，应有一份 `accept-e3-s2.ts` 覆盖「解析 + 写入」的完整链路。

#### 2.2.4 生产代码关键路径与模块孤岛风险

| 检查项 | plan §9 | 验证 | 结果 |
|--------|---------|------|------|
| 严禁仅单元测试 | plan §9 末尾明确禁止 | 文本 | ✅ |
| 严禁模块未被生产路径调用 | 同上 | 文本 | ✅ |
| 验证方式 | grep + 验收脚本执行 parseAuditReport | 明确 | ✅ |
| 验收脚本路径 | scripts/accept-e3-s2.ts | 明确 | ✅ |

**结论**：plan 已明确禁止「仅单元测试」和「模块未被生产路径调用」，并给出 grep + 验收脚本的验证方式。**补充建议**：在 tasks 或 GAPS 中明确「验收脚本必须实际 import parseAuditReport 并调用，且脚本被 package.json scripts 或 CI 注册」，否则「验收脚本执行」可能流于形式。

---

## 3. 验证命令执行

### 3.1 配置文件存在性

```powershell
Test-Path "d:\Dev\BMAD-Speckit-SDD-Flow\config\stage-mapping.yaml"
Test-Path "d:\Dev\BMAD-Speckit-SDD-Flow\config\eval-lifecycle-report-paths.yaml"
Test-Path "d:\Dev\BMAD-Speckit-SDD-Flow\scoring\schema\run-score-schema.json"
```

**结果**：三者均存在，与 plan 引用一致。

### 3.2 Story 1.2 写入模块存在性

```powershell
# scoring/writer 已实现，writeScoreRecordSync 可被调用
```

**结果**：`scoring/writer/write-score.ts` 存在，`writeScoreRecordSync` 已导出。plan §9 的「解析产出可被 Story 1.2 写入接口接受」集成测试**应强制执行**，不应使用「若有」的表述。

### 3.3 解析器当前实现状态

```powershell
# grep parseAuditReport、audit-prd、audit-arch、audit-story
```

**结果**：项目中尚无 `parseAuditReport`、`audit-prd` 等解析器实现（符合 Story 3.2 未实施状态）。plan §9 的验证方式在实施后应能检出「未被导入」的情况。

---

## 4. 遗漏与改进建议汇总

| 序号 | 类型 | 内容 | 建议 |
|------|------|------|------|
| 1 | §9 表述 | 「若有 write-score 模块」 | 改为「解析产出传入 writeScoreRecordSync（Story 1.2），断言写入成功」。Story 1.2 已实现，该集成测试为**必选**。 |
| 2 | §9 端到端 | 用户可见流程「报告→解析→写入→验证存储」 | 在 §9 表中新增一行：端到端测试 \| 给定报告路径，解析→写入→验证 scoring 存储中记录存在且 schema 通过 \| scripts/accept-e3-s2.ts 或等效 E2E 脚本 |
| 3 | plan §2 | PRD 追溯 | 在需求映射表中补充一行：Story §3 PRD 追溯（REQ-2.1~2.5、3.12、3.13、3.15~3.17） \| spec §2、§3~§8 \| plan §3~§10 \| ✅ |
| 4 | 验收脚本 | 防止「验收脚本仅文档检查」 | 在 tasks/GAPS 中明确：accept-e3-s2.ts 必须 import parseAuditReport，调用至少一种 stage（prd/arch/story），并将解析产出传入 writeScoreRecordSync，断言写入成功；且该脚本被 package.json scripts 或 CI 注册。 |

---

## 5. 结论

根据逐条验证与 §9 专项审查：

### 5.1 需求覆盖结论

- **spec-E3-S2.md**：✅ 完全覆盖，无遗漏章节。
- **Story 3.2**：✅ 完全覆盖（PRD 追溯建议补充，非阻塞）。
- **Architecture §2/§5/§6/§8**：✅ 完全覆盖。

### 5.2 集成/端到端测试计划结论

- **单元测试**：✅ 覆盖充分。
- **集成测试**：❌ 「若有 write-score 模块」表述不当，应改为强制集成测试；否则存在「仅单元测试」风险。
- **端到端测试**：⚠️ 未显式列出「报告→解析→写入→验证存储」的完整 E2E 计划；建议补充。
- **生产代码关键路径**：✅ 有验证方式（grep + 验收脚本）；建议在 tasks 中强化验收脚本必须实际调用解析器并写入。

### 5.3 最终结论

**本次审计结论为：未完全通过**。

**未通过项**：
1. plan §9 中「若有 write-score 模块」表述使「解析→写入」集成测试可被跳过；Story 1.2 已实现，应改为强制。
2. 缺少显式的端到端测试计划条目（报告→解析→写入→验证存储）。

**建议的后续动作**：
1. 修改 plan §9：将「若有 write-score 模块」改为「解析产出传入 writeScoreRecordSync，断言写入成功」。
2. 在 plan §9 中新增端到端测试行，明确覆盖「给定报告路径→解析→写入→验证 scoring 存储」的完整流程。
3. 在 tasks 或 IMPLEMENTATION_GAPS 中明确验收脚本必须实际调用 parseAuditReport 和 writeScoreRecordSync，且被 CI/scripts 注册。
4. （可选）在 plan §2 映射表补充 PRD 追溯行。

完成上述修改后，可再次调用 code-review，直至报告结论为「完全覆盖、验证通过」。

---

*本报告由 code-reviewer 子代理生成。*
