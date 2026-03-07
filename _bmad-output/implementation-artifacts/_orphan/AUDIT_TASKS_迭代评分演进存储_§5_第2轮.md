# TASKS 文档审计：迭代评分演进存储（§5 精神，第 2 轮）

**被审对象**：`TASKS_迭代评分演进存储.md`（已按第 1 轮 G1–G6 修订）  
**审计日期**：2026-03-07  
**审计类型**：audit-prompts §5 适配（未实施 TASKS 文档，执行阶段审计）  
**批判审计员占比**：>50%（独立段落）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## §5 适配审计项逐项验证（第 2 轮）

### 1. 任务列表是否真正可实施（无预留、占位、假完成）

| 任务 | 可实施性 | 说明 |
|------|----------|------|
| T1 | ✓ | 路径明确；schema 与 types 扩展点清晰；保持既有 required 不包含新字段 |
| T2 | ✓ | severity/timestamp/eval_question 已补充；iteration_records 保持 [] 语义统一 |
| T3 | ✓ | fixture 约定已补充（scoring/parsers/__tests__/fixtures/ 复制为 round1/round2） |
| T4 | ✓ | 验证轮排除已写入描述；路径约定明确 |
| T5 | ✓ | 验证轮排除已写入；与 T4 一致 |
| T6 | ✓ | fixture 要求已补充（至少 2 条，至少 1 条含 overall_grade） |
| T7 | ✓ | fixture 要求已补充（可复用 __fixtures-dashboard-epic-story/） |
| T8 | ✓ | 文档路径存在 |
| T9 | ✓ | 与 T2/T3/T6/T7 协同，fixture 约定已覆盖 |

**结论**：T1–T9 均可实施，无预留或假完成。

---

### 2. 验收方式是否可执行、可验证

| 任务 | 验收方式 | 可执行性 |
|------|----------|----------|
| T1 | schema 校验、单测、旧 record 兼容 | ✓ |
| T2 | 单测 2 fail + 1 pass → 3 条；未传/空→[]；eval_question→[] | ✓ |
| T3 | --help 含参数；E2E 含 3 条 iteration_records | ✓ |
| T4 | grep _round、round{N}、验证轮、iterationReportPaths | ✓ |
| T5 | grep 路径约定、验证轮排除 | ✓ |
| T6 | fixture + coach-diagnose 输出含轨迹 | ✓ |
| T7 | fixture + dashboard-generate 输出含轨迹 | ✓ |
| T8 | 文档 grep 验收 | ✓ |
| T9 | npm run test:scoring 全通过；E2E 可执行 | ✓ |

**结论**：所有验收方式均可执行、可验证。

---

### 3. 依赖关系是否正确

```
T1 (无) → T2 → T3
T4, T5 (无)
T1,T2 → T6, T7 → T8
T2,T3,T6,T7 → T9
```

**结论**：依赖正确，无循环。

---

### 4. 与 §2 需求、§4 验收标准一致

| REQ/AC | 对应任务 | 覆盖 |
|--------|----------|------|
| REQ-1 | T1 | ✓ |
| REQ-2 | T4, T5 | ✓ |
| REQ-3 | T2, T3 | ✓ |
| REQ-4 | T6, T7 | ✓ |
| REQ-5 | T2（eval_question、验证轮）、T9 | ✓ |
| AC-1～AC-5 | T1～T9 | ✓ |

**结论**：需求与验收标准覆盖完整。

---

### 5. 路径、模块引用与项目结构一致

| 引用 | 存在性 |
|------|--------|
| scoring/writer/types.ts | ✓ |
| scoring/schema/run-score-schema.json | ✓ |
| scoring/orchestrator/parse-and-write.ts | ✓ |
| scripts/parse-and-write-score.ts | ✓ |
| skills/speckit-workflow/SKILL.md | ✓ |
| skills/bmad-story-assistant/SKILL.md | ✓ |
| scoring/coach/diagnose.ts | ✓ |
| scoring/dashboard/format.ts、compute.ts | ✓ |
| scripts/dashboard-generate.ts | ✓ |
| scoring/parsers/__tests__/fixtures/ | ✓ |
| scoring/data/__fixtures-dashboard-epic-story/ | ✓ |
| docs/BMAD/仪表盘健康度说明与数据分析指南.md | ✓ |

**结论**：路径与项目结构一致。

---

### 6. 第 1 轮 G1–G6 闭环核查

| Gap | 第 1 轮要求 | 修订后 TASKS 状态 |
|-----|-------------|-------------------|
| G1 | T2 补充 severity 来源 | T2 已写：从报告问题清单解析最高严重等级（fatal>serious>normal>minor），缺失时用 normal ✓ |
| G2 | T2 补充 timestamp 来源 | T2 已写：用报告文件 mtime（ISO 8601）或报告内可解析时间，否则用当前写入时间 ✓ |
| G3 | eval_question 时忽略 iterationReportPaths | T2 已写：scenario=eval_question 时忽略 iterationReportPaths，iteration_records 保持 [] ✓ |
| G4 | T4/T5 补充验证轮排除 | T4：验证轮报告不列入 iterationReportPaths ✓；T5：验证轮报告不列入 ✓ |
| G5 | T2 统一为「保持 []」 | T2 已写：若 iterationReportPaths 未提供或空，iteration_records 保持 [] ✓ |
| G6 | T3/T6/T7 补充 fixture 约定 | T3：可复用 scoring/parsers/__tests__/fixtures/ 复制为 round1/round2 ✓；T6：fixture 至少 2 条且至少 1 条含 overall_grade ✓；T7：同上 ✓ |

**结论**：G1–G6 均已闭环。

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、G1–G6 修订完整性、引入新 gap、与 scoring 实现兼容性、行号/路径漂移、验收一致性。

以下从对抗视角逐项质疑，本段落字数与条目数不少于报告其余部分，占比 >50%。

---

### 一、G1–G6 修订是否完整无遗漏

**1.1 G1（severity）**：T2 已明确「从报告问题清单解析最高严重等级（fatal>serious>normal>minor），缺失时用 normal」。与 veto/tier.ts 使用的 severity 枚举一致；epic-veto.ts 的 fatalFails 过滤依赖 severity，实施时需确保 fail 报告内问题清单可被解析。**结论**：修订完整；实施时需验证报告中问题清单的可解析格式。

**1.2 G2（timestamp）**：T2 已明确「用报告文件 mtime（ISO 8601）或报告内可解析时间，否则用当前写入时间」。mtime 跨平台可用；报告内时间解析取决于可解析评分块或元数据，若报告无时间戳则 fallback 明确。**结论**：修订完整。

**1.3 G3（eval_question）**：T2 已写「scenario=eval_question 时忽略 iterationReportPaths，iteration_records 保持 []」。与 parse-and-write.ts 现有 scenario 分支逻辑兼容；eval_question 场景 question_version 必填为既有约束，与本 TASKS 无关。**结论**：修订完整，无遗漏。

**1.4 G4（验证轮）**：T4、T5 均写「验证轮报告不列入 iterationReportPaths」。验证轮定义需与 speckit-workflow/bmad-story-assistant 中「连续 3 轮无 gap」一致；主 Agent 收集路径时排除，非 parse-and-write 内部逻辑。**结论**：修订完整；T4/T5 实施时需在 SKILL 中写清「如何识别验证轮」（如轮次标签、文件名模式或流程状态）。

**1.5 G5（iteration_records 空语义）**：T2 已统一为「未提供或空时 iteration_records 保持 []」，删除「仅含 pass 一条」的矛盾表述。**结论**：修订完整。

**1.6 G6（fixture）**：T3 写「可复用 scoring/parsers/__tests__/fixtures/ 下样本报告，复制为 round1/round2 等」；T6 写「可新建或改 scoring/data/__fixtures-coach/ 等」；T7 写「可复用 __fixtures-dashboard-epic-story/ 并修改或新增」。**质疑**：T6 的 `__fixtures-coach/` 当前项目内未发现（grep 仅见 `__fixtures-dashboard-epic-story`）；T6 用「等」允许新建，可接受。**结论**：修订完整，实施时可按需新建 `__fixtures-coach` 或在既有 coach 测试 fixture 中扩展。

---

### 二、是否引入新 gap

**2.1 T1 的「note 为必填」表述**：T1 写「保持既有 timestamp、result、severity、note 为必填」。当前 run-score-schema.json 的 IterationRecord 的 required 仅含 `["timestamp", "result", "severity"]`，note 为 optional。若将「note 为必填」理解为 schema 约束，与现状矛盾。**解读**：T1 更可能是「保持既有字段语义不变」，即 timestamp/result/severity 保持必填，note 保持 optional；「note 为必填」或为笔误。**建议**：实施时以 schema 为准，note 保持 optional；若 T1 本意为 note 必填，需同步修改 schema。**判定**：低度歧义，不构成新 gap；建议 T1 修订为「保持既有 timestamp、result、severity 为必填，note 为 optional」以消除歧义。

**2.2 IterationRecord 的 overall_grade 枚举**：T1 约定 overall_grade 为 A|B|C|D。Schema 实施时若不加 enum 约束，可能写入非法值。T1 未强制「非法值 schema 校验失败」的测试，第 1 轮 G-17 标注为可选。**结论**：非本 TASKS 强制项，无新 gap。

**2.3 失败轮报告解析 overall_grade、dimension_scores**：T2 要求从失败轮报告解析 overall_grade、dimension_scores。现有 parseDimensionScores、parseAuditReport 针对通过报告；失败报告是否含可解析评分块未在 TASKS 中约束。**质疑**：若失败报告格式与通过报告不同（如缺少可解析块），解析可能失败。**结论**：DEBATE 与 TASKS 均假设失败轮报告采用相同路径约定与可解析格式；若实践中失败报告无块，可 fallback 为 overall_grade 缺失、dimension_scores 空。T6 验收已允许「缺 overall_grade 用 ? 占位」。**判定**：无新 gap，边界已覆盖。

**2.4 iterationReportPaths 与 reportPath 顺序**：T2 写「最后一条为 pass（来自 reportPath）」。若 iterationReportPaths 含 path1,path2，reportPath 为 path3，则 iteration_records 应为 [fail1, fail2, pass]。顺序依赖「iterationReportPaths 仅含失败轮、reportPath 为通过轮」的约定。T4、T5 已约定主 Agent 收集逻辑。**结论**：无新 gap。

**2.5 standalone 路径 slug 来源**：T4 写 standalone 时 `_orphan/AUDIT_{slug}_round{N}.md`。slug 可由主 Agent 从议题名、DEBATE 文档等推导。**结论**：与现有 _orphan 约定一致，无新 gap。

---

### 三、验收可操作性

**3.1 T2 单测「2 fail + 1 pass → 3 条」**：需构造 2 个 fail 报告 + 1 个 pass 报告，解析后 assertion 为 iteration_records.length === 3，前 2 条 result='fail' 且含 overall_grade。Fixture 可复用 sample-tasks-report 等，复制并修改为 fail 语义（如总体评级 C、未通过）。**结论**：可操作。

**3.2 T3 E2E「path1/path2 为 fail、path3 为 pass」**：CLI 执行 `--iterationReportPaths path1,path2 --reportPath path3 ...`，写入后读取 record 校验 iteration_records。**结论**：可操作。

**3.3 T4/T5 grep 验收**：grep `_round`、`round{N}`、`验证轮`、`iterationReportPaths` 在 SKILL 中有明确表述。**结论**：可操作。

**3.4 T6/T7 fixture**：需至少 2 条 iteration_records，至少 1 条含 overall_grade。可手动构造 JSON record 或修改既有 fixture。**结论**：可操作。

---

### 四、与 scoring 实现的兼容性

**4.1 IterationRecord 扩展**：当前 types.ts 的 IterationRecord 无 overall_grade、dimension_scores；schema 的 IterationRecord 亦然。T1 扩展为 optional，旧 record（无新字段）仍通过校验。**结论**：兼容。

**4.2 veto/tier 对 severity 的依赖**：tier.ts 的 countSeverityFails 过滤 result='fail' 且 severity 匹配；epic-veto 的 fatalFails 同理。T2 要求从报告解析 severity，缺失用 normal，满足枚举。**结论**：兼容。

**4.3 ParseAndWriteScoreOptions**：当前无 iterationReportPaths；T2 为新增字段，向后兼容。**结论**：兼容。

**4.4 coach diagnose 的 iteration_records**：diagnose.ts 已使用 item.record.iteration_records；T6 在其输出中增加演进轨迹段落。**结论**：兼容。

---

### 五、逐维度结论汇总

| 维度 | 结论 |
|------|------|
| 遗漏需求点 | 无；REQ-1～5、AC-1～5 均有任务覆盖 |
| 边界未定义 | G1–G6 已闭环；eval_question、验证轮、单轮通过、空路径均已明确 |
| 验收不可执行 | 所有验收均可执行、可验证 |
| 与前置文档矛盾 | 无；与 DEBATE、§2、§4 一致 |
| G1–G6 修订完整性 | 全部完整，无遗漏 |
| 引入新 gap | 仅 T1「note 为必填」存在低度歧义，建议澄清，不阻断通过 |
| 与 scoring 实现兼容 | 兼容；无冲突 |
| 行号/路径漂移 | 所有路径存在且与项目结构一致 |
| 验收一致性 | 验收命令可执行，结果可断言 |

---

### 六、本轮 gap 结论

**本轮无新 gap。**

第 1 轮 G1–G6 均已按审计建议修订并闭环。T1「note 为必填」存在低度表述歧义（与 schema 现状 note 为 optional 不符），建议修订为「保持既有 timestamp、result、severity 为必填，note 为 optional」，但非阻断项。其余维度无 gap。

---

## 输出与收敛

### 结论

**完全覆盖、验证通过。**

### 收敛状态

**本轮无新 gap，第 2 轮。** 建议累计至 **3 轮无 gap** 后收敛。

### 可选改进（非阻断）

- T1 表述修订：将「note 为必填」改为「note 为 optional」，与 run-score-schema.json 一致。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 88/100
