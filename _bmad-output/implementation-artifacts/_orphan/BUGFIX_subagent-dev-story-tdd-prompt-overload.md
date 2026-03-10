# BUGFIX：子代理 Dev Story 执行 TDD 违规与 prompt 过密

- **创建日期**：2026-03-09
- **关联**：bmad-story-assistant STORY-A3-DEV、speckit-workflow §5
- **路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_subagent-dev-story-tdd-prompt-overload.md`

---

## §1 现象 / 问题描述

1. **TDD 红绿灯违规**：子代理执行 tasks 时，不按红灯→绿灯→重构顺序执行，而是先写生产代码，再补测试，事后在 progress 中追加 TDD 记录。违反「必须先写/补测试并运行验收得失败（红灯），再实现（绿灯）」的强制约束。

2. **任务密度过高**：子代理单次调用需覆盖 specify → plan → GAPS → tasks → 执行 五阶段及审计落盘，当 spec 目录不存在时还需创建目录并跑全流程。单次承载过多职责，导致关键约束被弱化。

3. **信息过密导致疏漏**：STORY-A3-DEV prompt 中 parseAndWriteScore 约束为 600+ 字单段、TDD 要求分散于多处（记录格式、验收自检、强制要求、implement 约束）、优先级不清晰，子代理在长上下文中易忽略 TDD 执行顺序等核心约束。

---

## §2 根因分析

### 根因 A：TDD 执行顺序未显式写入子代理 prompt

当前 STORY-A3-DEV 中「【必做】TDD 红绿灯记录」仅描述**记录格式**与**交付前自检**，未写明**执行顺序**。§3.1 强制约束第 2 条「须先写/补测试并运行验收得失败（红灯），再实现…」位于主 Agent 段，未注入子代理 prompt。子代理收到的指令可被理解为「完成后追加两行」，而非「必须按顺序执行」。

### 根因 B：TDD 依赖外部技能但子代理未加载

prompt 要求「请读取 ralph-method 技能与 speckit-workflow 技能」。mcp_task generalPurpose 子代理不会自动加载 Cursor 全局 skill，仅依据 prompt 正文执行。task-execution-tdd.md 中的伪代码（WRITE test → RUN → ASSERT FAIL → WRITE code）未纳入 prompt。

### 根因 C：parseAndWriteScore 段落信息密度过高

「各 stage 审计通过后落盘与 parseAndWriteScore 约束」为单段 600+ 字，含路径、参数、条件、失败处理。子代理易在解析时遗漏前置的 TDD 执行顺序要求。

### 根因 D：TDD 表述分散且无唯一权威段落

TDD 相关要求出现在：记录格式、验收自检、强制要求、implement 约束、读取技能指示。缺少一处「执行顺序 + 记录格式」的完整、唯一、置顶的 TDD 段落。

---

## §3 依据 / 参考

| 文档 | 关键内容 |
|------|----------|
| `skills/bmad-story-assistant/SKILL.md` 行 864–867、881–890 | TDD 记录格式与验收自检；§3.1 行 801 含执行顺序但不在子代理 prompt 内 |
| `skills/speckit-workflow/SKILL.md` §5.1、§5.1.1 | TDD 红灯-绿灯-重构流程、禁止跳过红灯 |
| `skills/speckit-workflow/references/task-execution-tdd.md` 行 114–155 | 单任务伪代码：WRITE test → RUN → ASSERT FAIL → WRITE code |
| `skills/bmad-bug-assistant/SKILL.md` 行 435–440 | BUGFIX 实施 prompt 中 TDD 红灯→绿灯执行顺序表述 |

---

## §4 修复方案

### 4.1 在 STORY-A3-DEV 中新增 TDD 执行顺序段（置顶于执行规范）

在「你是一位非常资深的开发专家…」之后、「【必做】TDD 红绿灯记录」之前，插入一段不可跳过的 TDD 执行顺序说明，明确：每个涉及生产代码的任务，必须先红灯、后绿灯、再重构；禁止先写生产代码再补测试。

### 4.2 将 parseAndWriteScore 约束拆分为条目

将 600+ 字单段拆为 3–5 条，每条一个职责（落盘路径、parseAndWriteScore 调用、失败不阻断）。保留概要，具体参数以引用或子段落形式呈现。

### 4.3 TDD 要求合并为单一权威段落

在 prompt 中保留一处完整的「TDD 执行顺序 + 记录格式 + 验收自检」段落，删除或简化其他分散的 TDD 表述，避免重复与冲突。

---

## §7 最终任务列表

| # | 任务 | 修改路径 | 具体修改内容 | 验收 |
|---|------|----------|--------------|------|
| T1 | 在 STORY-A3-DEV 中新增 TDD 执行顺序段 | `skills/bmad-story-assistant/SKILL.md` | 在「你是一位非常资深的开发专家 Amelia 开发…请按以下规范执行。」与「【必做】TDD 红绿灯记录」之间插入以下段落（含前后空行）：<br><br>**【TDD 执行顺序（不可跳过）】**<br>每个涉及生产代码的任务，必须严格按以下顺序执行：<br>1. 红灯：先写或补充覆盖该任务验收标准的测试，运行验收命令，确认失败。<br>2. 绿灯：再写最少量的生产代码使测试通过。<br>3. 重构：在测试保护下优化代码，并在 progress 中记录 [TDD-REFACTOR]。<br>禁止：先写生产代码再补测试；禁止在未看到红灯（测试失败）前进入绿灯阶段。<br><br> | grep 该文件，匹配「**【TDD 执行顺序（不可跳过）】**」且该段位于「【必做】TDD 红绿灯记录」之前 |
| T2 | 将 parseAndWriteScore 约束拆分为条目 | `skills/bmad-story-assistant/SKILL.md` | 将当前「**各 stage 审计通过后落盘与 parseAndWriteScore 约束（强制）**」后的整段替换为以下 5 条（**禁止遗漏** speckit-workflow §1.0.3、§1.2 的下列要点）：<br><br>（1）各 stage 审计通过时，将报告保存至 speckit-workflow §x.2 约定路径；spec/plan/GAPS/tasks 阶段路径分别为 specs/epic-{epic_num}-{epic_slug}/story-{story_num}-{slug}/ 下的 AUDIT_spec-、AUDIT_plan-、AUDIT_GAPS-、AUDIT_tasks-E{epic_num}-S{story_num}.md；结论中注明保存路径及 iteration_count。<br>（2）fail 轮报告保存至 AUDIT_{stage}-E{epic}-S{story}_round{N}.md。**验证轮**（连续 3 轮无 gap 的确认轮）报告**不列入 iterationReportPaths**，仅 fail 轮及最终 pass 轮参与收集。pass 时主 Agent 收集本 stage 所有 fail 轮报告路径，传入 `--iterationReportPaths path1,path2,...`；**一次通过或无 fail 轮时不传**。<br>（3）运行 parse-and-write-score；必须含 --iteration-count。**iteration_count 传递（强制）**：本 stage 审计未通过/fail 的轮数；**一次通过传 0**；**连续 3 轮无 gap 的验证轮不计入 iteration_count**；禁止省略。<br>（4）implement 阶段 artifactDocPath 可为 story 子目录实现主文档路径或留空。<br>（5）调用失败时记录 resultCode 进审计证据，不阻断流程。<br><br> | 5 条须含：验证轮不列入、一次通过不传、一次通过传0、验证轮不计入；语义与 speckit-workflow §1.0.3、§1.2 一致 |
| T3 | 合并 TDD 记录与验收自检为单一段落 | `skills/bmad-story-assistant/SKILL.md` | 将「【必做】TDD 红绿灯记录」至「**implement 执行约束**」之间所有 TDD 相关段落合并为一段，结构如下：<br><br>**【TDD 红绿灯记录与验收】**<br>每完成一个涉及生产代码的任务的绿灯后，立即在 progress 追加三行：<br>`[TDD-RED] <任务ID> <验收命令> => N failed`<br>`[TDD-GREEN] <任务ID> <验收命令> => N passed`<br>`[TDD-REFACTOR] <任务ID> <内容> \| 无需重构 ✓`<br>集成任务 REFACTOR 可写「无新增生产代码，各模块独立性已验证，无跨模块重构 ✓」。<br>交付前自检：每个涉及生产代码的 US，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各一行；缺任一项则补充后再交付。禁止所有 US 完成后才集中补写。<br><br>删除原先分散的「TDD progress 验收自检」「TDD progress 强制要求」两个独立段落，其内容已并入上文。 | grep 该文件，仅存一处「**【TDD 红绿灯记录与验收】**」；原「TDD progress 验收自检」「TDD progress 强制要求」标题不再出现 |
| T4 | 在 speckit-workflow §5.1 开头补充 TDD 执行顺序 | `skills/speckit-workflow/SKILL.md` | 在「当用户要求执行 tasks.md…」段之后、「1. **读取 tasks.md**」之前，插入以下段落：<br><br>**【执行顺序】** 每个涉及生产代码的任务：先写/补测试并运行验收得失败（红灯）；再写生产代码使通过（绿灯）；最后重构并记录。禁止先写生产代码再补测试。<br><br> | grep 该文件，匹配「**【执行顺序】**」且该段位于「1. **读取 tasks.md**」之前 |
| T5 | 在 task-execution-tdd.md 顶部增加执行顺序摘要 | `skills/speckit-workflow/references/task-execution-tdd.md` | 在文件开头「# Tasks 执行规则…」与「## 1. TDD 红灯-绿灯-重构循环」之间插入：<br><br>**执行顺序**：WRITE test → RUN → ASSERT FAIL → WRITE code → RUN → ASSERT PASS → REFACTOR。禁止先写生产代码再补测试。<br><br> | 文件第 5–8 行包含上述摘要 |
| T6 | 在 speckit.implement 命令中强化 TDD 顺序 | `commands/speckit.implement.md`、`.cursor/commands/speckit.implement.md` | 两个文件均修改。第 5 行「**TDD 红绿灯**：progress 必须包含…」句末，在「详见 speckit-workflow §5.1.1。」之前插入：每个涉及生产代码的任务必须先写/补测试并运行得失败（红灯），再实现（绿灯）；禁止先写生产代码再补测试。修改后该句为：`**TDD 红绿灯**：每个涉及生产代码的任务必须先写/补测试并运行得失败（红灯），再实现（绿灯）；禁止先写生产代码再补测试。progress 必须包含每任务的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录，禁止省略；详见 speckit-workflow §5.1.1。` | 对两文件分别 grep，均匹配「禁止先写生产代码再补测试」 |

---

## §7 任务依赖与执行顺序

| 任务 | 依赖 | 说明 |
|------|------|------|
| T1 | 无 | 可独立执行 |
| T2 | 无 | 可独立执行；与 T1 可并行 |
| T3 | T1 | T3 合并的段落须包含 T1 新增的 TDD 执行顺序段；T1 完成后 T3 再执行 |
| T4 | 无 | 可独立执行 |
| T5 | 无 | 可独立执行 |
| T6 | 无 | 可独立执行 |

**推荐执行顺序**：T1 → T3 → T2；T4、T5、T6 可任意顺序执行。
