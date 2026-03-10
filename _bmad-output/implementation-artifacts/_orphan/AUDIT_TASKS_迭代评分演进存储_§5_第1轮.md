# TASKS 文档审计：迭代评分演进存储（§5 精神，第 1 轮）

**被审对象**：`TASKS_迭代评分演进存储.md`  
**审计日期**：2026-03-06  
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

## §5 适配审计项逐项验证

### 1. 任务列表是否真正可实施（无预留、占位、假完成、模糊表述）

| 任务 | 可实施性 | 说明 |
|------|----------|------|
| T1 | ✓ | 路径、字段、验收命令明确；`scoring/writer/types.ts`、`run-score-schema.json` 存在 |
| T2 | ✓ | `parse-and-write.ts`、`ParseAndWriteScoreOptions` 存在；逻辑描述清晰 |
| T3 | ✓ | `scripts/parse-and-write-score.ts` 存在；CLI 扩展点明确 |
| T4 | ✓ | `skills/speckit-workflow/SKILL.md` 存在；当前 §1.2/§2.2 等有报告路径约定，需补充 round 后缀 |
| T5 | ✓ | `skills/bmad-story-assistant/SKILL.md` 存在；与 T4 类似 |
| T6 | ✓ | `scoring/coach/diagnose.ts`、`format.ts` 存在 |
| T7 | ✓ | `scoring/dashboard/format.ts`、`compute.ts`、`scripts/dashboard-generate.ts` 存在 |
| T8 | ✓ | `docs/BMAD/仪表盘健康度说明与数据分析指南.md` 存在 |
| T9 | ⚠ | 无独立修改路径；依赖 T2、T3、T6、T7 的测试覆盖，属汇总型任务 |

**结论**：T1–T8 均可实施；T9 为测试汇总，与 T2/T3/T6/T7 存在职责重叠，但不构成阻断。

---

### 2. 每条任务的验收方式是否可执行、可验证

| 任务 | 验收方式 | 可执行性 | 备注 |
|------|----------|----------|------|
| T1 | `npm run test:scoring -- scoring/__tests__/schema` 通过；类型与 schema 一致 | ✓ | 已验证 `npm run test:scoring` 可运行； Vitest 支持路径过滤 |
| T2 | 单测：2 fail + 1 pass → 3 条 iteration_records；未传时为 [] | ✓ | 断言可写 |
| T3 | `--help` 含 `--iterationReportPaths`；执行含 3 条 iteration_records | ✓ | 命令可执行 |
| T4 | grep `_round` 或 `round{N}` 在 speckit-workflow 中有路径约定 | ✓ | 客观可查 |
| T5 | grep 审计 prompt 或「审计通过后评分写入触发」含 round 与 iterationReportPaths | ✓ | 客观可查 |
| T6 | 对含 iteration_records 的 fixture 运行 coach-diagnose，输出含轨迹 | ✓ | `npx ts-node scripts/coach-diagnose.ts` 存在 |
| T7 | 使用含 iteration_records 的 fixture 运行 dashboard-generate，输出含轨迹 | ✓ | `scripts/dashboard-generate.ts` 存在 |
| T8 | 文档含 iteration_records 扩展说明及演进轨迹约定 | ✓ | grep 可验证 |
| T9 | `npm run test:scoring` 全通过；E2E 可执行并断言 | ✓ | 与 package.json 一致 |

**结论**：所有验收方式均可执行、可验证；无「手工或 E2E」之外的模糊表述（AC-4 为「手工或 E2E」，可接受）。

---

### 3. 依赖关系是否正确、无循环依赖

```
T1 (无依赖)
T2 ← T1
T3 ← T2
T4 (无依赖)
T5 (无依赖)
T6 ← T1, T2
T7 ← T1, T2
T8 ← T6, T7
T9 ← T2, T3, T6, T7
```

**结论**：依赖关系正确，无循环；Phase 1/2/3 顺序合理。

---

### 4. 与 §2 需求、§4 验收标准是否一致、完全覆盖

| REQ/AC | 对应任务 | 覆盖状态 |
|--------|----------|----------|
| REQ-1 IterationRecord 扩展 | T1 | ✓ |
| REQ-2 失败轮路径约定 | T4, T5 | ✓ |
| REQ-3 parseAndWriteScore iterationReportPaths | T2, T3 | ✓ |
| REQ-4 Coach/仪表盘演进轨迹 | T6, T7 | ✓ |
| REQ-5 边界（eval_question、单轮、历史、验证轮） | T2 描述、T9 | ✓ |
| AC-1 | T1 | ✓ |
| AC-2 | T2, T3, T9 | ✓ |
| AC-3 | T4, T5 | ✓ |
| AC-4 | T6, T7 | ✓ |
| AC-5 | T2 单测、T9 | ✓ |

**结论**：需求与验收标准均有任务对应，覆盖完整。

---

### 5. 路径、模块引用是否与项目结构一致

| 引用路径 | 存在性 | 验证方式 |
|----------|--------|----------|
| `scoring/writer/types.ts` | ✓ | 已读 |
| `scoring/schema/run-score-schema.json` | ✓ | 已读 |
| `scoring/orchestrator/parse-and-write.ts` | ✓ | 已读 |
| `scripts/parse-and-write-score.ts` | ✓ | 已读 |
| `skills/speckit-workflow/SKILL.md` | ✓ | 项目内 `skills/speckit-workflow/SKILL.md` |
| `skills/bmad-story-assistant/SKILL.md` | ✓ | 项目内 `skills/bmad-story-assistant/SKILL.md` |
| `scoring/coach/diagnose.ts`、`format.ts` | ✓ | 已确认 |
| `scoring/dashboard/format.ts`、`compute.ts` | ✓ | 已确认 |
| `scripts/dashboard-generate.ts` | ✓ | 已确认 |
| `docs/BMAD/仪表盘健康度说明与数据分析指南.md` | ✓ | 已读 |

**结论**：所有路径与项目结构一致，无失效引用。

---

### 6. 是否无「将在后续迭代」等延迟表述；是否无标记可完成但实际无法验证的项

- **延迟表述**：未发现「后续迭代」「待定」「可考虑」等延迟表述。
- **假完成**：所有任务均标注为待实施，无假完成。
- **可验证性**：见 §2，均具备可执行验收。

**结论**：无延迟表述，无可完成但无法验证的项。

---

## 批判审计员结论

以下从对抗视角逐项质疑，检查遗漏、路径/schema 失效、验收命令未定义、§5/验收误伤或漏网、与现有 scoring 的兼容性、边界条件未覆盖。**本段落字数与条目数不少于报告其余部分，占比 >50%。**

### 一、遗漏任务与隐含依赖

1. **IterationRecord 的 severity 来源未定义**  
   T2 要求「构造 result='fail' 的 IterationRecord」，当前 schema 要求 `timestamp`、`result`、`severity` 必填。失败轮报告中 severity 可能存在于「问题清单」的最高 severity，或需默认值。TASKS 未明确：从失败报告解析 severity 的规则，或默认 `severity: 'normal'`。**建议**：在 T2 描述中补充「severity 从问题清单解析最高严重等级，缺失时用 `normal`」，否则实施时存在歧义。

2. **失败轮 IterationRecord 的 timestamp 来源未定义**  
   失败报告文件无标准 timestamp 字段。TASKS 未说明：用文件 mtime、报告内时间戳，或占位值。**建议**：在 T2 中明确「timestamp 使用文件 mtime（ISO 8601）或报告内可解析时间，否则用当前写入时间」。

3. **eval_question 场景的显式排除逻辑未在任务中体现**  
   REQ-5 要求 eval_question 场景 iteration_records 为空。当前 `parseAndWriteScore` 的 scenario 分支未在 TASKS 中显式列出。**建议**：在 T2 验收中增加「scenario=eval_question 时，即使传入 iterationReportPaths，iteration_records 仍为 []」，或在 T2 描述中写明「eval_question 时忽略 iterationReportPaths」。

4. **「连续 3 轮无 gap 验证轮」不纳入的逻辑未在任务中体现**  
   DEBATE 裁定验证轮不纳入 iteration_records，但 TASKS 无对应任务。该逻辑应由**主 Agent 收集路径时**排除验证轮报告，而非 parse-and-write 内部。**结论**：属主 Agent / SKILL 约定职责，T4、T5 可补充「验证轮报告不列入 iterationReportPaths」。建议在 T4/T5 描述中增加一句。

### 二、路径、Schema 与解析器兼容性

5. **run-score-schema.json 的 IterationRecord 定义需同步扩展**  
   T1 要求扩展 `run-score-schema.json`。当前 schema 的 `IterationRecord` 仅有 `timestamp`、`result`、`severity`、`note`，无 `overall_grade`、`dimension_scores`。T1 已覆盖，但需确认：新增字段为 optional，且 `required` 数组不包含二者，否则旧数据会校验失败。**结论**：T1 描述已明确「optional」，与 DEBATE 一致；需实施时验证 schema 的 `required` 不包含新字段。

6. **skills 路径的「或项目内等价路径」可能造成实施歧义**  
   T4、T5 写「`skills/speckit-workflow/SKILL.md`（或项目内等价路径）」。项目内确实存在 `skills/speckit-workflow/SKILL.md`，无歧义。若未来 skill 迁移至 `.cursor/skills` 等，需有等效约定。**结论**：当前可接受；建议删除「或项目内等价路径」以减少歧义，或明确「项目内 `skills/` 目录」。

7. **parseAndWriteScore 与 writeScoreRecordSync 的 record 结构**  
   当前 `parse-and-write.ts` 未设置 `iteration_records`，由 `parseAuditReport` 返回的 record 提供（audit-generic 等固定为 `[]`）。T2 实施后需在写入前组装 `iteration_records`，并确保 `recordToWrite` 包含该字段。**结论**：与现有实现兼容，实施时在 `recordToWrite` 构造处插入组装逻辑即可。

### 三、验收命令与断言完整性

8. **T2 验收「未传 iterationReportPaths 时 iteration_records 为 []」与当前行为一致**  
   当前 `parseAuditReport` 返回的 record 的 `iteration_records` 恒为 `[]`，parse-and-write 透传。T2 实施后，未传 `iterationReportPaths` 时应保持 `[]`。**结论**：无回归风险，验收合理。

9. **T3 E2E 的 fixture 准备未在 TASKS 中明确**  
   T3 验收要求「执行 `--iterationReportPaths path1,path2 --reportPath path3 ...` 成功写入含 3 条 iteration_records 的 record」。path1、path2 需为真实 fail 报告路径，path3 为 pass 报告。TASKS 未说明是否复用现有 fixtures（如 `sample-tasks-report.md` 改副本）或新增。**建议**：在 T3 或 T9 中补充「可复用 `scoring/parsers/__tests__/fixtures/` 下样本报告，复制为 round1/round2 等」，或明确 fixture 目录约定。

10. **Coach / dashboard 的 fixture 含 iteration_records 的格式**  
    T6、T7 验收依赖「含 iteration_records 的 fixture」。现有 `scoring/data/` 与 `__fixtures-dashboard-epic-story/` 中 record 的 `iteration_records` 均为 `[]`。实施后需新增或修改 fixture，使 `iteration_records` 含 `overall_grade`。**建议**：在 T6、T7 或 T9 中补充「fixture 中 iteration_records 至少含 2 条，其中至少 1 条含 overall_grade」。

### 四、§5 / 验收误伤与漏网

11. **T2 描述与验收的不一致**  
    T2 描述：「若 iterationReportPaths 未提供或空，则 iteration_records 仅含 pass 一条（来自 reportPath）或保持 []」。DEBATE 与 T2 验收均采用「保持 []」。描述中「仅含 pass 一条」与「保持 []」为互斥语义。**建议**：统一为「未提供或空时，iteration_records 保持 []」（与单轮通过行为一致），删除「仅含 pass 一条」表述。

12. **单轮通过时的 iteration_records**  
    AC-5 要求「单轮通过、eval_question 场景 iteration_records 为空」。单轮通过时，主 Agent 不传 `iterationReportPaths`，故 `iteration_records=[]`。**结论**：与 T2 行为一致，无漏网。

13. **仪表盘「短板 Top 3 或高迭代 Top 3」的展示范围**  
    T7 描述「对 high_iteration Top 3 或短板 Top 3 的 record」展示演进轨迹。若某 record 同时属于二者，只展示一次即可。若都不属于，不展示轨迹。**结论**：语义清晰，无歧义。

### 五、边界条件与现有逻辑兼容性

14. **veto 与 tier 逻辑对 iteration_records 的依赖**  
    `scoring/veto/tier.ts`、`epic-veto.ts` 使用 `iteration_records` 的 `result`、`severity`。T2 构造的 fail 记录需具备合法 `severity`，否则 tier 计算可能异常。**结论**：与「一、1」的 severity 来源问题一致，需在 T2 中明确。

15. **loadAndDedupeRecords 与 iteration_records**  
    去重按 `(run_id, stage)` 取 timestamp 最新。单条 record 内的 `iteration_records` 为有序数组，无需跨 record 合并。**结论**：与 DEBATE 一致，无遗漏。

16. **standalone 路径 `_orphan/AUDIT_{slug}_round{N}.md` 的 slug 定义**  
    T4 约定 standalone 时 `_orphan/AUDIT_{slug}_round{N}.md`。slug 来源（如从 stage、功能名推导）未在 TASKS 中细化。**结论**：与现有 `_orphan` 约定一致，可接受；若项目有 `eval-lifecycle-report-paths` 等配置，可引用。

17. **overall_grade 的枚举约束**  
    T1 约定 `overall_grade?: string`（A|B|C|D）。Schema 实施时建议用 `enum: ['A','B','C','D']` 或 pattern 约束，避免非法值。**建议**：T1 验收中增加「传入非法 overall_grade 时 schema 校验失败」的测试用例（可选）。

18. **parseDimensionScores 的 mode 参数**  
    失败轮报告可能对应 spec/plan/tasks 等 stage，`parseDimensionScores(content, stageToMode(stage))` 的 stage 从何处来？T2 场景下，每个 fail 报告路径可能对应不同 stage，但同一 run 的 iteration_records 属于同一 stage。**结论**：stage 由主流程的 reportPath 决定，iterationReportPaths 的各 fail 报告应与 reportPath 同 stage，故 mode 一致。无冲突。

### 六、Gap 汇总（批判审计员）

| 编号 | Gap 描述 | 严重程度 | 修改建议 |
|------|----------|----------|----------|
| G1 | T2 未定义 fail 轮 IterationRecord 的 severity 来源 | 中 | T2 描述补充：从问题清单解析最高 severity，缺失时用 `normal` |
| G2 | T2 未定义 fail 轮 timestamp 来源 | 低 | T2 描述补充：用文件 mtime 或报告内时间，否则用当前时间 |
| G3 | eval_question 时 iterationReportPaths 的忽略逻辑未显式写入 T2 | 低 | T2 描述或验收中补充 |
| G4 | 验证轮报告不列入 iterationReportPaths 的约定未在 T4/T5 体现 | 低 | T4、T5 描述中增加一句 |
| G5 | T2 描述「仅含 pass 一条」与验收「保持 []」矛盾 | 低 | 统一为「保持 []」 |
| G6 | T3/T6/T7 fixture 准备步骤未在 TASKS 中明确 | 低 | T3 或 T9 补充 fixture 约定或目录 |

**本轮判定**：存在 **6 个 gap**，其中 1 个中度（G1）、5 个低度。中度 gap 不阻断实施，但建议在实施前澄清；低度 gap 可在实施中顺带处理。

**本轮结论**：**存在 gap**。建议修订 TASKS 以闭环 G1–G6 后再进入下一轮审计，或采纳为实施时 checklist 项。

---

## 输出与收敛

### 结论

**未通过**（因批判审计员识别出 6 个 gap，其中 G1 为中度）。

### Gap 与修改建议（摘要）

1. **G1（中）**：T2 补充 fail 轮 IterationRecord 的 severity 解析规则（问题清单最高严重等级，缺失用 `normal`）。
2. **G2（低）**：T2 补充 fail 轮 timestamp 来源（文件 mtime 或报告内时间）。
3. **G3（低）**：T2 显式约定 eval_question 时忽略 iterationReportPaths。
4. **G4（低）**：T4、T5 描述中补充「验证轮报告不列入 iterationReportPaths」。
5. **G5（低）**：T2 描述统一为「未提供或空时 iteration_records 保持 []」。
6. **G6（低）**：T3 或 T9 补充 fixture 准备约定。

### 收敛状态

**本轮存在 gap，第 1 轮。** 建议修订 TASKS 后执行第 2 轮审计，累计至 **3 轮无 gap** 后收敛。

---

## 附录：验证命令执行结果

| 命令 | 结果 |
|------|------|
| `npm run test:scoring` | 54 文件、362 测试通过 |
| `npx ts-node scripts/parse-and-write-score.ts`（无参数） | 输出 Usage，当前无 `--iterationReportPaths` |
| `skills/speckit-workflow/SKILL.md` | 存在，含 §1.2/§2.2 报告路径与 parse-and-write-score 调用 |
