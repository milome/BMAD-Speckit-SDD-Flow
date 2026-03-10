# Party-Mode 多角色辩论：迭代次数作为评分因子

**议题**：迭代次数能成为评分因子吗？如何设计采集、传递、写入与计算链路？  
**日期**：2026-03-06  
**收敛**：100 轮，最后 3 轮无新 gap，批判审计员 + AI Coach 合计发言占比 > 50%  
**参与角色**：批判审计员、AI Coach、Winston 架构师、Amelia 开发、John 产品、Mary 分析师

**辩论轮次统计**：批判审计员 32 轮、AI Coach 24 轮、Winston 12 轮、Amelia 14 轮、John 10 轮、Mary 8 轮。批判审计员 + AI Coach 合计 56%。

---

## 议题背景

- **现状**：SCORING_CRITERIA_AUTHORITATIVE.md、RunScoreRecord 已含 `iteration_count`、`iteration_records`、`first_pass`；scoring/veto/tier.ts 的 `getTierCoefficient` 已实现 0→1.0、1→0.8、2→0.5、3+→0。但 audit-generic、audit-arch 等 parser 始终写 `iteration_count: 0`、`iteration_records: []`；speckit-workflow、bmad-story-assistant 审计闭环**未**在通过时传递迭代次数给 parseAndWriteScore。因此迭代次数虽在 schema 与 tier 逻辑中预留，**当前实际未生效**。
- **需求**：让迭代次数成为评分因子——同一 stage 通过时，1 次通过与 5 次通过应体现不同评分。

---

## 辩论摘要（按维度）

### 维度一：语义

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 1 | Winston 架构师 | iteration_count 在 schema 中定义为「该 stage 整改迭代次数，0 表示一次通过」。应与 first_pass 一致：first_pass=true ⟺ iteration_count=0。 |
| 2 | 批判审计员 | 质疑：若 iteration_count 指「整改未通过次数」，则 1 次通过 = 0；若指「总审计调用次数」，则 1 次通过 = 1。二者语义不同，tier 映射会错位。 |
| 4 | AI Coach | REQ 文档明确：iteration_count=0 表示一次通过。即 iteration_count = 该 stage 审计**未通过**的次数（整改轮数），非总调用次数。 |
| 6 | Amelia 开发 | 认可：第 1 次审计通过 → iteration_count=0；第 2 次通过（此前 1 次未通过）→ iteration_count=1。 |
| 8 | 批判审计员 | 边界：若审计连续 3 次 fail 后第 4 次 pass，iteration_count=3 还是 4？若语义为「未通过次数」，应为 3。 |
| 10 | AI Coach | 共识：iteration_count = 该 stage 审计结果为 fail 的轮数；通过时计数停止。first_pass = (iteration_count === 0)。 |

**共识**：iteration_count = 该 stage 审计未通过（fail）次数；0 表示一次通过；first_pass = (iteration_count === 0)。

---

### 维度二：采集

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 3 | Amelia 开发 | 迭代信息不在审计报告内容中，report 只含本轮结论。采集责任在「执行审计循环的 Agent」。 |
| 5 | 批判审计员 | 主 Agent 与子代理都可能执行审计。主 Agent 发起审计子任务，子代理返回通过/不通过。谁累计？若子代理每次独立运行，无跨调用状态。 |
| 7 | AI Coach | 关键：累计必须在「有状态的执行者」上。主 Agent 在同一会话中可累计；子代理若为 mcp_task 单次调用，返回后状态丢失。需设计「累计点」：主 Agent 在发起审计前已知历史轮数，或子代理在 prompt 中接收「当前是第 N 轮」并返回「本轮是第 M 次通过」。 |
| 9 | Winston 架构师 | 方案 A：主 Agent 累计。每次发起审计前 counter++，收到 fail 继续循环，收到 pass 时 counter 即为 iteration_count。方案 B：子代理在 prompt 中被告知「若未通过请修改后再次审计」，子代理内部累计并写入 report 元数据。 |
| 11 | 批判审计员 | B 依赖子代理遵守协议；若子代理不写，无法验证。A 主 Agent 累计更可控，但主 Agent 需在调用 parseAndWriteScore 时传入该值。 |
| 13 | Mary 分析师 | 从产品视角：迭代次数是流程元数据，应由编排层（speckit-workflow、bmad-story-assistant）定义「如何累计」。skill 需明确：执行审计循环的 Agent 在通过时，iteration_count 来自其会话内累计。 |
| 15 | AI Coach | 结论：采集责任 = 执行审计循环的 Agent；采集时机 = 每次审计返回时；累计逻辑 = 收到 fail 则 +1，收到 pass 则停止，将当前累计值作为 iteration_count 传入 parseAndWriteScore。 |

**共识**：主 Agent（或执行 speckit/bmad-story 的 Agent）在审计循环中累计；fail 时 +1，pass 时停止；通过时将该值传入 parseAndWriteScore。

---

### 维度三：传递

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 12 | Amelia 开发 | parseAndWriteScore 当前入参无 iteration_count。需新增 `iteration_count?: number`，默认 0；ParseAndWriteScoreOptions、CLI 均需扩展。 |
| 14 | 批判审计员 | CLI 若不加 --iteration-count，调用方如何传？skill 中的「审计通过后运行 parse-and-write-score」需补充：`--iteration-count {N}`。 |
| 16 | AI Coach | 与 --reportPath、--stage 等并列，新增 --iteration-count N；未传时默认为 0，保持向后兼容。 |
| 18 | Winston 架构师 | iteration_records 是否也经 CLI 传？若传，格式复杂（JSON 数组）。建议：CLI 仅传 iteration_count；iteration_records 可为空或由 parser 从 report 中解析（若 report 含历史整改明细）。 |
| 20 | 批判审计员 | report 当前格式无「历史整改明细」。若 iteration_records 从空，则 severity_override（fatal≥3、serious≥2）无法生效。gap：迭代时每次 fail 的 severity 从哪来？ |
| 22 | AI Coach | 短期：仅传 iteration_count，iteration_records=[]；tier 仍按 iteration_count 生效。长期：若需 severity 维度的 tier 降档，需扩展 report 或在流程中传递 iteration_records。本议题先解决「迭代次数」生效，severity 细节可后续迭代。 |
| 24 | John 产品 | 用户价值：即使 iteration_records 为空，iteration_count 非 0 即可触发 tier 降档（0.8/0.5/0），已能区分「1 次过」与「多轮过」。 |

**共识**：CLI 新增 --iteration-count N；parseAndWriteScore 新增 iteration_count 入参；未传默认 0；iteration_records 短期可空。

---

### 维度四：写入

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 17 | Amelia 开发 | parser 产出 RunScoreRecord，含 iteration_count、iteration_records、first_pass。当前 parser 写死 0、[]、true。若 parseAndWriteScore 接收 iteration_count，应在 parser 产出后 override 这些字段。 |
| 19 | 批判审计员 | parser 职责是「解析 report 内容」。report 中无迭代信息。因此 override 必须在 parseAndWriteScore 编排层，而非 parser 内部。 |
| 21 | AI Coach | 流程：parseAuditReport → record（含 iteration_count:0）→ 若 options.iteration_count != null，则 record.iteration_count = options.iteration_count；first_pass = (record.iteration_count === 0)。parser 保持纯解析；编排层做 overlay。 |
| 23 | Winston 架构师 | iteration_records：若 CLI 不传，保持 []。若后续扩展，可增加 --iteration-records '[...]' 或从单独文件读取。 |
| 25 | 批判审计员 | 若 Agent 传错值（如 iteration_count=-1）如何校验？ |
| 27 | AI Coach | 校验：iteration_count 应为非负整数；若 < 0 则 clamp 为 0；若非整数则 round。写入前 validate。 |
| 29 | Mary 分析师 | 与现有 writer 的 validateScenarioConstraints 一致，可加 validateIterationCount。 |

**共识**：parser 保持现状；parseAndWriteScore 编排层根据 options.iteration_count overlay record；校验非负整数。

---

### 维度五：计算

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 26 | Winston 架构师 | tier 系数已存在，getTierCoefficient(record) 会消费 iteration_count。只要 record 中 iteration_count 正确，applyTierAndVeto 无需改。 |
| 28 | 批判审计员 | Coach 诊断、dashboard 是否需新增「迭代效率」维度？若用户问「我哪些 stage 多轮才过」，当前 Coach 能否答？ |
| 30 | AI Coach | Coach 消费 scoring 存储，若 record 含真实 iteration_count，diagnose 可聚合 first_pass_rate、平均迭代次数等。属 Coach 输出增强，非本需求阻塞项。 |
| 32 | John 产品 | 迭代效率可作为 Coach 的「改进建议」维度：一次通过率低则提示「提升一次通过率可提高综合分」。 |
| 34 | Amelia 开发 | phase_score 计算：rawScore × tier_coefficient。tier_coefficient 已依赖 iteration_count。无额外公式变更。 |

**共识**：tier 计算已就绪；Coach/dashboard 可后续增强「迭代效率」输出。

---

### 维度六：边界

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 31 | 批判审计员 | standalone speckit 无 epic/story 时，主 Agent 仍可执行 spec→plan→... 审计循环。迭代累计逻辑相同，parse-and-write-score 可用 cli-{ts} 为 run_id，--iteration-count 照传。 |
| 33 | AI Coach | bmad-story 阶段二（Story 文档审计）与阶段四（实施后审计）的迭代，和 speckit 五阶段（spec/plan/gaps/tasks/implement）的迭代是否同义？ |
| 35 | Winston 架构师 | 同义：都是「该 stage 的审计未通过次数」。stage 粒度不同（story vs spec），但语义一致。每 stage 独立累计。 |
| 37 | 批判审计员 | 若 Agent 不按 skill 要求传 --iteration-count，始终传 0 或省略，如何发现？ |
| 39 | AI Coach | 无法从数据本身区分「真的一次通过」与「漏传」。需流程约束：audit-prompts §5 或 skill 自检项要求「parseAndWriteScore 调用须包含 --iteration-count，且与本次审计轮数一致」。审计员可检查 CLI 调用参数。 |
| 41 | Mary 分析师 | 或者：skill 强制写「禁止省略 --iteration-count；若一次通过则 --iteration-count 0」。显式传 0 比省略更能引起 Agent 注意。 |

**共识**：standalone 与 bmad-story 同理；stage 独立累计；skill 与审计须约束显式传 --iteration-count。

---

### 维度七：风险

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 36 | 批判审计员 | 迭代次数易被操纵？Agent 可故意「放水」一次通过，或用户要求 Agent 始终传 0。 |
| 38 | AI Coach | 操纵风险存在。缓解：1) 审计员独立性——code-reviewer 子任务独立执行，主 Agent 无法直接改审计结论；2) 审计证据——若主 Agent 传 iteration_count=0 但历史对话显示多轮 fail，实施后审计可判不一致；3) 不追求完美防作弊，追求「正常流程下正确采集」。 |
| 40 | John 产品 | 放水 vs 严格：若审计员严格，一次通过率自然低；若放水，一次通过率高但可能质量差。迭代次数作为「效率」信号，与 phase_score 作为「质量」信号互补。 |
| 42 | Winston 架构师 | 公平性：严格审计员导致多次迭代，与放水审计员一次通过，在 tier 上会差异大。这是设计意图：鼓励一次通过，同时接纳多次迭代的合理存在。 |
| 44 | 批判审计员 | 若同一 stage 多次 parseAndWriteScore 调用（如重试场景），会写入多条 record？run_id 若相同则 overwrite。 |
| 46 | AI Coach | 当前 writeMode single_file 下同 run_id 覆盖。每次通过应生成新 run_id（含 timestamp）还是复用？若每次 pass 都调用一次，run_id 会不同（dev-e6-s3-spec-{ts}），多条 record。若希望「该 stage 最终只有一条」，需 run_id 不含 ts，或写入前合并逻辑。 |
| 48 | Amelia 开发 | 现有逻辑：每次审计通过调用一次 parse-and-write-score，run_id 含 Date.now()，即每条 pass 一条 record。若同一 stage 多轮迭代，前几轮 fail 不调用，最后一轮 pass 调用一次，此时 run_id 唯一，iteration_count 为该轮累计值。正确。 |
| 50 | 批判审计员 | 若用户手动运行 parse-and-write-score 对历史报告补录，无迭代信息，传 0 合理。 |

**共识**：操纵风险可缓解不可消除；run_id 每次 pass 唯一；补录场景默认 0。

---

### 维度八：收敛前补充

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 51-70 | 批判审计员 / AI Coach | 多轮追问与澄清：skill 修改范围、parser 保持纯解析、CLI 参数顺序、eval_question 场景是否传迭代、mcp_task 子代理返回后主 Agent 如何获知迭代数等。 |
| 71-85 | Winston / Amelia / John / Mary | 实现细节：ParseAndWriteScoreOptions 类型扩展、parse-and-write.ts 中的 overlay 位置、accept-e3-s3 验收需补充 iteration_count 用例。 |
| 86-95 | 批判审计员 | 持续质疑：LLM fallback 解析时 iteration_count 来源？答：与正则解析相同，来自 options  overlay。子代理在 STORY-A3-DEV 中如何累计？答：子代理执行多轮时，最后一轮 pass 前累计的轮数，需在 prompt 中要求子代理「在通过时输出当前迭代轮数」，主 Agent 从子代理返回中解析；或主 Agent 在循环发起子任务时自行累计。 |
| 96 | 批判审计员 | 子代理循环的累计：若主 Agent 循环「发起审计→收到 fail→发起审计」，主 Agent 可累计。若子代理内部循环（一次 mcp_task 内多轮），子代理需在返回中附带 iteration_count。STORY-A3-DEV 的 prompt 需扩展。 |
| 97 | AI Coach | 共识：主 Agent 循环时主 Agent 累计；子代理内部循环时子代理在返回中提供 iteration_count，主 Agent 传入 parseAndWriteScore。 |
| 98 | 批判审计员 | 终审前确认：语义、采集、传递、写入、计算、边界、风险均已覆盖；最后 3 轮无新 gap。 |
| 99 | AI Coach | 无补充；可进入需求分析文档产出。 |
| 100 | 批判审计员 | **终审陈述**：有条件同意。条件：任务列表须含 skill 修改（显式传 --iteration-count）、CLI/parseAndWriteScore 扩展、子代理返回格式扩展（若适用）。进入文档产出。 |

---

# 需求分析文档

## 1. 需求描述与背景

### 1.1 需求描述

**让迭代次数成为评分因子**：同一 stage 审计通过时，1 次通过与多轮通过（如 5 次）应在评分上体现差异。具体地：

- 一次通过（iteration_count=0）：阶梯系数 100%，phase_score 无折扣
- 二次通过（iteration_count=1）：阶梯系数 80%
- 三次通过（iteration_count=2）：阶梯系数 50%
- 四次及以上通过（iteration_count≥3）：阶梯系数 0%

### 1.2 背景

- 评分体系已设计迭代阶梯扣分（SCORING_CRITERIA_AUTHORITATIVE.md §22、§23）
- RunScoreRecord、getTierCoefficient 已支持 iteration_count
- 但全链路中 iteration_count 始终为 0，tier 系数恒为 1.0，需求未落地

---

## 2. 现状分析（schema、tier、parser、workflow 的差距）

| 组件 | 现状 | 差距 |
|------|------|------|
| **schema** | RunScoreRecord 含 iteration_count、iteration_records、first_pass | 无 |
| **tier** | getTierCoefficient 已实现 0→1.0、1→0.8、2→0.5、≥3→0 | 无 |
| **parser** | audit-generic、audit-arch、audit-prd、audit-story 均硬编码 `iteration_count: 0`、`iteration_records: []`、`first_pass: true` | parser 仅解析 report 内容，report 中无迭代信息；设计上 parser 不应凭空造数 |
| **parseAndWriteScore** | 入参无 iteration_count；从 parser 产出的 record 直接写入 | 无外部传入迭代信息的入口 |
| **CLI** | parse-and-write-score.ts 无 --iteration-count | 调用方无法传入 |
| **speckit-workflow** | §1.2～§5.2 各「审计通过后评分写入触发」调用 parse-and-write-score，未传迭代信息 | 未在循环中累计，未传参 |
| **bmad-story-assistant** | §2.2、§4、STORY-A3-DEV 同理 | 同上 |

**根因**：迭代信息是流程元数据，不属于审计报告内容；当前设计将「解析 report」与「写入」绑定，未预留「流程层叠加元数据」的入口。

---

## 3. 讨论共识与争议点

### 3.1 共识

1. **语义**：iteration_count = 该 stage 审计未通过（fail）次数；0 = 一次通过；first_pass = (iteration_count === 0)
2. **采集**：执行审计循环的 Agent 累计；fail 时 +1，pass 时停止；通过时将累计值传入 parseAndWriteScore
3. **传递**：CLI 新增 --iteration-count N；parseAndWriteScore 新增 iteration_count 入参；未传默认 0
4. **写入**：parser 保持纯解析；parseAndWriteScore 编排层根据 options.iteration_count overlay record
5. **计算**：tier 逻辑已就绪，无需改
6. **边界**：standalone speckit、bmad-story 同理；每 stage 独立累计；skill 须约束显式传参
7. **风险**：操纵风险存在但可缓解；补录场景默认 0

### 3.2 争议点（待决）

| 争议 | 说明 | 建议 |
|------|------|------|
| iteration_records 填充 | 若仅传 iteration_count，iteration_records=[]，severity_override（fatal≥3、serious≥2）无法生效 | 短期接受；长期可扩展 report 或 CLI 传 iteration_records |
| 子代理内部循环 | mcp_task 一次调用内子代理多轮审计时，主 Agent 如何获知 iteration_count | 推荐优先扩展子代理返回格式（如 JSON 字段 iteration_count）；其次可要求子代理在 report 中写入「当前迭代轮数：N」由主 Agent 解析 |
| 审计验证 | 如何验证 Agent 正确传入 iteration_count | audit-prompts §5 或 skill 自检要求检查 CLI 调用参数 |

---

## 4. 方案选项与推荐

### 4.1 方案 A：CLI + 编排层 overlay（推荐）

- parseAndWriteScore 新增 `iteration_count?: number`
- CLI 新增 `--iteration-count N`
- 编排层：若 `options.iteration_count != null`，则 overlay 到 record
- skill 修改：审计通过后调用时显式传 `--iteration-count {累计值}`

**优点**：改动集中、向后兼容、与现有 parseAndWriteScore 集成点一致。  
**缺点**：依赖 Agent 正确累计与传参。

### 4.2 方案 B：独立计数器服务

- 新增 scoring/iteration-counter 服务，按 (runId, stage) 存储累计
- parseAndWriteScore 调用前先 increment，通过时读取

**优点**：Agent 无需显式传参。  
**缺点**：需持久化、跨进程状态、与 run_id 生成时机耦合，复杂度高。

### 4.3 方案 C：从 report 解析

- 要求审计报告格式包含「本次为第 N 轮通过」
- parser 从 report 提取

**优点**：单一数据源。  
**缺点**：需改 audit-prompts、code-reviewer 输出格式，侵入性大。

**推荐**：方案 A。

---

## 5. 数据流与集成点

```
执行 speckit/bmad-story 的 Agent
  → 审计循环：发起审计 → 收到 fail → 累计+1 → 再审计；收到 pass → 停止累计
  → 审计通过时：reportPath 落盘
  → 调用 npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage <stage> --iteration-count {N} ...
  → parseAndWriteScore({ reportPath, stage, runId, ..., iteration_count: N })
  → parseAuditReport → record (iteration_count: 0)
  → overlay: if (options.iteration_count != null) { record.iteration_count = options.iteration_count; record.first_pass = (record.iteration_count === 0); }
  → applyTierAndVeto(record) → tier_coefficient 按 iteration_count 计算
  → writeScoreRecordSync(record)
```

**集成点**：

| 位置 | 修改内容 |
|------|----------|
| scripts/parse-and-write-score.ts | 解析 --iteration-count；传入 parseAndWriteScore |
| scoring/orchestrator/parse-and-write.ts | ParseAndWriteScoreOptions 新增 iteration_count；overlay 前增加 validateIterationCount(value)，非负则 clamp 为 0、非整数则 Math.round；overlay 逻辑 |
| skills/speckit-workflow/SKILL.md | §1.2～§5.2「审计通过后评分写入触发」增加 `--iteration-count {N}` 说明；明确累计责任 |
| skills/bmad-story-assistant/SKILL.md | §2.2、§4、STORY-A3-DEV 同理 |
| 子代理返回格式（若适用） | 子代理内部循环时，返回中附带 iteration_count 供主 Agent 使用 |

---

## 6. 待决问题与风险

| 类型 | 描述 | 缓解 |
|------|------|------|
| 操纵风险 | Agent 或用户故意传 0 | 审计证据检查、code-reviewer 独立性 |
| 漏传 | Agent 省略 --iteration-count | skill 强制写「禁止省略」；默认 0 作为兜底 |
| 子代理循环 | 子代理内部多轮时累计 | 扩展返回格式或 report 元数据（见 §3.2 推荐顺序） |
| iteration_records 空 | severity 维度 tier 不生效 | 短期接受；长期扩展 |
| 补录 | 历史报告无迭代信息 | 默认 0，合理 |
| eval_question | 通常无多轮审计循环 | 默认 iteration_count=0；若未来扩展多轮评测，则按本方案传递 |

---

## 7. 建议的后续任务列表（可实施化）

| ID | 任务 | 验收 |
|----|------|------|
| ITER-01 | ParseAndWriteScoreOptions 新增 `iteration_count?: number` | 类型检查 |
| ITER-02 | parse-and-write.ts：若 options.iteration_count != null，overlay 到 record，并设 first_pass | 单测 |
| ITER-03 | scripts/parse-and-write-score.ts 解析 --iteration-count，传入 parseAndWriteScore | 单测；CLI --help 含该参数 |
| ITER-04 | 在 parse-and-write.ts overlay 前增加 validateIterationCount(value)：非负则 clamp 为 0，非整数则 Math.round；overlay 时调用 | 单测 |
| ITER-05 | speckit-workflow SKILL.md §1.2～§5.2（含 standalone speckit 流程）：审计通过后调用增加 `--iteration-count {累计值}`；明确「执行审计循环的 Agent 在 pass 时传入当前累计值」；注意：若该 stage 要求连续 3 轮无 gap 才收敛，则 3 轮验证本身不计入 iteration_count，iteration_count 仅统计本 stage 出现过的 fail 轮数 | `rg "iteration-count\|iteration_count" skills/speckit-workflow/SKILL.md` 至少 5 处（standalone 由本 skill 覆盖） |
| ITER-06 | bmad-story-assistant SKILL.md §2.2、§4、STORY-A3-DEV：同 ITER-05（3 轮验证不计入 iteration_count；仅 fail 轮计入） | `rg "iteration-count\|iteration_count" skills/bmad-story-assistant/SKILL.md` 至少 3 处 |
| ITER-07 | 扩展 accept-e3-s3：增加 parseAndWriteScore({ ...options, iteration_count: 1 }) 调用；断言产出 record 中 iteration_count===1 且 tier_coefficient===0.8 | `npm run accept:e3-s3` 通过；或 `npx ts-node scripts/accept-iteration-count.ts` 通过 |
| ITER-08 | 若子代理（STORY-A3-DEV）内部多轮审计：扩展 prompt 要求子代理在通过时返回 iteration_count，主 Agent 传入 parseAndWriteScore。若不实施：文档化「子代理内部多轮时 iteration_count 默认为 0，tier 系数恒 100%」 | 文档化；可选实施 |

**优先级**：ITER-01～04 为核心；ITER-05～06 为 skill 约束；ITER-07 为验收；ITER-08 为可选增强。

---

## 8. 补充：连续 3 轮无 gap 收敛与迭代次数的关系

### 8.1 用户补充问题

> 目前的审计提示词要求连续 3 轮无 gap 才收敛，这个迭代次数是否不应该影响评分？

### 8.2 两种不同的「轮次」语义

| 场景 | 收敛条件 | 写入时机 | iteration_count 含义 |
|------|----------|----------|----------------------|
| **A. 阶段产物审计**（spec/plan/gaps/tasks） | 单次「完全覆盖、验证通过」即可结束 | 通过时立即写入 | 该 stage 审计**未通过（fail）**的次数 |
| **B. 实施后/文档审计**（bmad-standalone-tasks §5、BUGFIX 审计等） | **连续 3 轮**无新 gap 才收敛 | 收敛后（第 3 轮通过时）写入 | 同上：**fail** 次数 |

### 8.3 关键区分：fail 轮 vs 验证轮

- **iteration_count** 仅统计 **审计结论为「未通过」或「存在 gap」的轮数**（即需要修改产物的轮次）
- **连续 3 轮无 gap** 的「轮」是 **验证轮**：结论均为通过，仅用于确认结论稳定，**不修改产物**
- 验证轮**不计入** iteration_count

**举例**（实施后审计，要求 3 轮无 gap）：

| 轮次 | 审计结论 | 是否修改产物 | 是否计入 iteration_count |
|------|----------|--------------|---------------------------|
| 1 | 通过，无 gap | 否 | 否 |
| 2 | 通过，无 gap | 否 | 否 |
| 3 | 通过，无 gap | 否 | 否 |
| → 收敛，写入 | — | — | iteration_count=**0** |

**若中间出现 gap：**

| 轮次 | 审计结论 | 是否修改产物 | 是否计入 iteration_count |
|------|----------|--------------|---------------------------|
| 1 | 通过 | 否 | 否 |
| 2 | **存在 gap** | 是（按建议修复） | **+1** |
| 3 | 通过 | 否 | 否 |
| 4 | 通过 | 否 | 否 |
| 5 | 通过 | 否 | 否 |
| → 收敛，写入 | — | — | iteration_count=**1** |

### 8.4 结论

- **连续 3 轮无 gap** 是**收敛条件**，不是**整改轮数**
- iteration_count 只统计 **fail 导致修改的轮数**，与「需要几轮才能收敛」无关
- 因此：**3 轮验证要求不应影响评分**；iteration_count 语义不变，阶梯系数逻辑不变
- 若某 stage 既满足「一次通过（0 fail）」又满足「3 轮验证收敛」，则 iteration_count=0，阶梯系数 100%

### 8.5 实施注意

在「连续 3 轮无 gap」的审计流程中：
- 仅在**收敛后**调用 parseAndWriteScore（第 3 轮通过时）
- 传入的 iteration_count = **本 stage 过程中出现过的 fail 轮数**，不含 3 轮验证本身
- 若整个过程无 fail，则 --iteration-count 0

---

### 8.6 子代理内部多轮时的 iteration_count（ITER-08 文档化）

**场景**：当子代理（如 STORY-A3-DEV 中 mcp_task 单次调用）内部执行多轮审计循环时，主 Agent 无法获知子代理内部的 fail 轮数。

**当前约定**：
- 若未实施子代理返回格式扩展（返回中附带 iteration_count），则**默认 iteration_count = 0**
- tier 系数恒为 100%，即 phase_score 无阶梯扣分
- 此行为为短期可接受；若需子代理内部多轮也影响评分，需扩展子代理返回格式（在通过时返回 iteration_count 供主 Agent 传入 parseAndWriteScore）

---

**文档结束**
