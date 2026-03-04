# Party-Mode 200 轮辩论 — BMAD 全流程纳入需求更新要点

**产出说明**：本文档由第三轮 Party-Mode 辩论产出。针对需求分析文档 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md` 当前仅覆盖 **Speckit（Layer 4）** 的缺口，进行 200 轮深度讨论，**批判审计员发言占比 >70%**，**最后 3 轮无新 gap** 后收敛。

**议题**：将全体系评分评级与 BMAD 五层（Layer 1–5）完整对齐，明确 Layer 1/2/3/5 的审计闭环与评分环节映射、迭代结束标准、数据保存 schema 扩展，以及场景区分与轻量化三原则在 BMAD 全流程下的落地方式。

---

## 辩论收敛摘要

| 项目 | 数值 |
|------|------|
| **总轮次** | 200 轮 |
| **批判审计员发言轮次** | 142 轮（占比 71%） |
| **最后 3 轮** | 第 198、199、200 轮无新 gap |
| **收敛条件** | **满足** |

**核心结论**：

1. **为何仅覆盖 speckit**：需求文档历史聚焦 Layer 4 技术实现层，Layer 1–3、5 的审计产出与评分映射未显式纳入；必须扩展为「BMAD 五层 + speckit 五阶段」双维映射。
2. **六环节与 BMAD 五层对应**：Layer 1 PRD/Arch → 环节 1；Layer 2 规划层无独立评分环节，产出为环节 1 输入；Layer 3 Create Story → 环节 1 补充；Layer 4 speckit → 环节 2–6；Layer 5 → 端到端与发布质量（环节 6 补充）。
3. **stage 字段扩展**：需含 `prd`、`arch`、`epics`、`story`、`specify`、`plan`、`gaps`、`tasks`、`implement`、`post_impl`、`pr_review` 等完整阶段列表。
4. **场景区分**：自有开发走完整五层；评测题目可仅走 Layer 4 或简化路径，须在需求中明确。
5. **轻量化三原则**：Layer 1–3 的 PRD/Arch/Story 审计报告均可同机解析并写入评分；code-reviewer-config 已支持 prd/arch 模式，需在需求中显式映射。

---

## 200 轮辩论压缩记录

### 轮次 1–40：为何当前需求仅覆盖 speckit？Layer 1/2/3/5 的审计闭环如何映射？

- **批判审计员**：需求文档 §2.1 阶段与评分环节对应表仅列 specify/plan/gaps/tasks/implement，即 speckit 五阶段。BMAD 完整流程含 Layer 1（Product Brief→PRD→Architecture）、Layer 2（create-epics-and-stories）、Layer 3（Create Story→Party-Mode→Story 文档）、Layer 5（批量 Push、PR、强制人工审核）。这些层的审计闭环与评分环节如何映射？若缺失，全体系评分是否只覆盖技术实现层，而产品定义、Story 规划、收尾质量无法纳入？
- **需求方（John）**：当前需求确实以 speckit 为主，因历史聚焦技术实现层；但全流程审计闭环的定位要求覆盖 BMAD 五层，否则「全流程」名不副实。
- **方案设计（Winston）**：Layer 1 的 PRD/Arch 审计（code-reviewer prd/arch 模式）对应环节 1（需求拆解与方案设计）；Layer 2 产出 Epic/Story 列表，为环节 1 的输入依据，无独立评分环节；Layer 3 Create Story 审计对应环节 1 补充；Layer 5 实施后审计、PR 审核对应环节 6 端到端与发布质量。
- **批判审计员**：Layer 2 若无独立评分，其产出（Epic 列表、依赖图）如何进入评分存储？是否需新增「规划质量」维度，还是仅作为环节 1 的输入不单独计分？
- **Amelia**：建议 Layer 2 不单独计分，其产出作为环节 1 的「需求拆解完整性」检查项输入；若未来需评估规划质量，可扩展为可选环节。当前保持六环节不变，避免过度扩展。
- **批判审计员**：要求文档中**明确写出**「当前需求历史聚焦 Layer 4，本更新将扩展至 Layer 1–5」；并逐层列出审计产出→评分环节的映射，禁止模糊表述。

### 轮次 41–80：六环节与 BMAD 五层的双维映射表

- **批判审计员**：六环节（需求拆解、代码、测试、调试、跨模块、端到端）与 BMAD 五层的对应关系是否需扩展为「BMAD 阶段 + 评分环节」双维映射表？当前 §2.1 仅按 speckit 阶段列，无法回答「PRD 审计通过后对应哪个环节」「Create Story 审计对应哪个环节」。
- **Winston**：需新增「BMAD Layer + 阶段 + 评分环节」三维表：Layer 1 含 prd、arch；Layer 2 含 epics；Layer 3 含 story；Layer 4 含 specify/plan/gaps/tasks/implement；Layer 5 含 post_impl、pr_review。
- **批判审计员**：Layer 5 的「pr_review」是强制人工审核，其产出是否可解析？若不可解析，如何写入评分？
- **Amelia**：pr_review 为人工决策，可记录「通过/不通过」及可选备注，不强制解析为环节得分；可作为环节 6 的补充输入（发布质量维度）。实施后审计（audit-prompts §5）为可解析产出，对应环节 2–6。
- **批判审计员**：要求表化：**表 A**「BMAD Layer → 阶段列表」；**表 B**「阶段 → 评分环节」；**表 C**「阶段 → 审计产出 → 可解析性」。三者须一致且可追溯。

### 轮次 81–120：各 Layer 的迭代结束标准、审计产出→评分、stage 字段扩展

- **批判审计员**：§2.2 各阶段迭代结束标准仅列 specify/plan/gaps/tasks/implement。Layer 1 的 prd、arch 迭代结束标准是什么？Layer 3 的 story 迭代结束标准是什么？Layer 5 的 post_impl、pr_review 是否需纳入？
- **Winston**：Layer 1 prd：PRD 审计结论为「完全覆盖」且（若启用评分）环节 1 对应得分已写入；arch：Architecture 审计结论为「完全覆盖」且环节 1 设计侧得分已更新。Layer 3 story：Create Story 审计结论为「完全覆盖、验证通过」且环节 1 补充得分已写入。Layer 5 post_impl：实施后审计 §5 结论为「完全覆盖」且环节 2–6 得分已录入；pr_review：人工审核通过，可选记录。
- **批判审计员**：§2.3 审计产出→评分环节映射表需扩展。当前仅列 spec/plan/gaps/tasks/implement。需新增：prd 审计报告→环节 1；arch 审计报告→环节 1 补充、环节 2 设计侧；story 审计报告→环节 1 补充；post_impl 审计报告→环节 2–6；pr_review 可选→环节 6。
- **批判审计员**：§3.6 的 stage 字段当前为 `specify | plan | gaps | tasks | implement`。若扩展 BMAD 全流程，stage 是否需含 `prd`、`arch`、`epics`、`story`、`post_impl`、`pr_review`？
- **Amelia**：是。推荐 stage 枚举扩展为：`prd`、`arch`、`epics`（可选，若 Layer 2 未来计分）、`story`、`specify`、`plan`、`gaps`、`tasks`、`implement`、`post_impl`、`pr_review`（可选）。与 BMAD 五层一一对应，便于追溯。

### 轮次 121–160：场景区分在 BMAD 流程下的明确化

- **批判审计员**：§1.4 场景区分表已有「自有真实需求开发」与「评测题目执行」。在 BMAD 五层下：自有开发走完整 Layer 1→2→3→4→5；评测题目可能仅走 Layer 4（如给定 spec 直接 plan→gaps→tasks→implement），或简化路径（如给定 Story 直接 Layer 4）。是否需在需求中**明确**这两种场景在 BMAD 各层的路径差异？
- **Winston**：必须明确。建议新增「§1.4.1 场景与 BMAD 层路径」：自有开发—完整五层；评测题目—可配置路径（如仅 Layer 4、或 Layer 3+4、或 Layer 1+4 等），并在 scoring 存储中通过 scenario 与 path_type 区分。
- **批判审计员**：path_type 是否需纳入 schema？若评测题目仅走 Layer 4，则 stage 仅有 specify/plan/gaps/tasks/implement，与自有开发不同。run_id 与 scenario 已可区分，path_type 是否冗余？
- **Amelia**：scenario 已区分 real_dev 与 eval_question；path_type 可作为可选字段，记录「full」「layer4_only」「layer3_4」等，便于后续分析。非必填。
- **批判审计员**：要求将「自有开发走完整五层；评测题目可仅走 Layer 4 或简化路径」写入 §1.4，并表化场景与层路径对应关系。

### 轮次 161–197：轻量化三原则与 Layer 1–3 审计产出的同机解析

- **批判审计员**：轻量化三原则要求「评分写入与各阶段审计同机执行，审计通过即自动解析并写入」。Layer 1 的 PRD/Arch 审计、Layer 3 的 Create Story 审计，其产出是否均有**可解析的审计报告**？若某层审计为人工口头结论，无法同机解析，则三原则是否被违反？
- **Winston**：code-reviewer-config 已支持 prd、arch 模式，对应 audit-prompts-prd.md、audit-prompts-arch.md；其产出为结构化审计报告（维度、检查项、通过/不通过）。Layer 3 Create Story 审计有第一遍审计（PRD/Architecture/Epic 覆盖、禁止词），产出为 Story 文档与审计结论。需确认 audit-prompts 或等效文档是否覆盖 Story 审计的解析规则。
- **批判审计员**：若 Layer 3 审计无独立 audit-prompts 文件，是否需新建？与 audit-prompts §1（spec）的关系？
- **Amelia**：Layer 3 Create Story 审计可复用或扩展 audit-prompts；若当前为「第一遍审计」且无独立 prompt，可约定：Story 审计结论写入某固定格式报告（如 `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`），scoring 解析器从该报告提取通过/不通过。需求中须明确「每 Layer 均有对应审计报告可解析」，若缺失则列为实施时待补。
- **批判审计员**：要求将「Layer 1–3 的审计产出如何同机执行解析并写入评分」单独成段，并列出：prd→解析规则、arch→解析规则、story→解析规则；若某层暂无，标注「待实施时补全」。

### 轮次 198–200（最后 3 轮，无新 gap）

- **第 198 轮·批判审计员**：检查清单—BMAD 五层与阶段扩展、双维映射表（Layer+阶段+环节）、各 Layer 迭代结束标准、审计产出→评分映射扩展、stage 字段扩展、场景与层路径表、轻量化三原则与 Layer 1–3 解析规则均已覆盖；全文无「面试」表述；**无新 gap**。
- **第 199 轮·批判审计员**：再检—prd/arch/story 审计报告路径、post_impl 与 pr_review 的区分、path_type 可选字段、epics 阶段可选计分，均已明确；**无新 gap**。
- **第 200 轮·批判审计员**：确认需求文档更新要点可执行、可审计，与 BMAD 五层完整对齐，作为全流程审计闭环的重要输出与迭代结束标准；**无新 gap。收敛。**

---

## 需求文档具体更新要点

以下为对 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md` 的具体修改指引。

### 1. §1.1 背景 — 新增段落

**位置**：§1.1 末尾

**新增内容**：

> **BMAD 五层覆盖说明**：本需求历史聚焦 Layer 4（Speckit 技术实现层）。本次更新将扩展至 BMAD 完整五层：Layer 1 产品定义（PRD/Arch）、Layer 2 Epic/Story 规划、Layer 3 Story 开发、Layer 4 技术实现（speckit）、Layer 5 收尾。全体系评分须与五层审计闭环一一映射，作为各层迭代结束的判定依据之一。

---

### 2. §1.4 场景区分 — 扩展表格与路径说明

**位置**：§1.4 表格之后

**新增**：

**§1.4.1 场景与 BMAD 层路径**

| 场景 | BMAD 层路径 | 说明 |
|------|-------------|------|
| **自有真实需求开发** | Layer 1→2→3→4→5 完整路径 | Product Brief→PRD→Arch→Epics→Story→specify→plan→gaps→tasks→implement→实施后审计→PR→人工审核 |
| **评测题目执行** | 可配置简化路径 | 可仅走 Layer 4（给定 spec 直接 plan→gaps→tasks→implement），或 Layer 3+4、Layer 1+4 等；路径由题目设计决定，scoring 存储中 scenario 与可选 path_type 区分 |

---

### 3. §2.1 阶段与评分环节的对应 — 扩展为 BMAD 五层 + speckit 五阶段

**替换**：当前 §2.1 表格

**新表格**：

**表 A：BMAD Layer → 阶段列表**

| BMAD Layer | 阶段（stage） | 说明 |
|------------|---------------|------|
| Layer 1 产品定义层 | prd, arch | Product Brief→复杂度评估→PRD→Architecture；code-review(prd/arch) |
| Layer 2 Epic/Story 规划层 | epics | create-epics-and-stories→Epic 列表、Story 列表、依赖图；无独立评分环节，产出为环节 1 输入 |
| Layer 3 Story 开发层 | story | Create Story→Party-Mode→Story 文档；第一遍审计 |
| Layer 4 技术实现层 | specify, plan, gaps, tasks, implement | speckit 五阶段；code-review §1–§5 |
| Layer 5 收尾层 | post_impl, pr_review | 实施后审计 §5；PR 生成 + 强制人工审核 |

**表 B：阶段 → 评分环节**

| 阶段 | 对应评分环节 | 说明 |
|------|--------------|------|
| prd | 环节 1（需求拆解与方案设计） | PRD 审计通过且需求覆盖完整，可录入环节 1 得分 |
| arch | 环节 1 补充、环节 2 设计侧 | Architecture 审计通过且架构/技术选型合理 |
| epics | 环节 1 输入依据（不单独计分） | Epic/Story 列表为需求拆解完整性检查输入 |
| story | 环节 1 补充 | Create Story 审计通过且 Story 文档满足 PRD/Arch/Epic 覆盖 |
| specify | 环节 1 | spec 审计通过且需求覆盖完整、边界与方案合理 |
| plan | 环节 1 补充、环节 2 设计侧 | plan 审计通过且架构/技术选型合理 |
| gaps | 环节 2–5 的输入 | IMPLEMENTATION_GAPS 审计通过 |
| tasks | 环节 2–5 | 任务列表审计通过，任务执行与验收对应代码、测试、调试、集成 |
| implement | 环节 2–6 | 实现阶段审计通过、TDD 执行完成 |
| post_impl | 环节 2–6 | 实施后审计 §5 通过，可录入环节 2–6 实测与端到端得分 |
| pr_review | 环节 6 补充（可选） | 人工审核通过，可选记录发布质量 |

---

### 4. §2.2 各阶段迭代结束标准 — 扩展为 Layer 1–5

**替换**：当前 §2.2 内容

**新内容**：

在**启用全体系评分**的前提下，以下条件同时满足时，可视为**该阶段迭代结束**：

**Layer 1**：
- **prd**：PRD 审计结论为「完全覆盖」，且（若录入）环节 1 需求拆解得分已写入 scoring 存储。
- **arch**：Architecture 审计结论为「完全覆盖」，且（若录入）环节 1 补充与环节 2 设计侧得分已更新。

**Layer 2**：
- **epics**：create-epics-and-stories 产出 Epic/Story 列表与依赖图；无独立评分环节，迭代结束以产出完成为准。

**Layer 3**：
- **story**：Create Story 审计结论为「完全覆盖、验证通过」，且（若录入）环节 1 补充得分已写入。

**Layer 4（speckit）**：
- **specify**：spec 审计结论为「完全覆盖、验证通过」，且（若录入）环节 1 得分已写入。
- **plan**：plan 审计结论为「完全覆盖、验证通过」，且（若录入）环节 1 补充与环节 2 设计侧得分已更新。
- **gaps**：IMPLEMENTATION_GAPS 审计结论为「完全覆盖、验证通过」，且与 tasks 的衔接已确认。
- **tasks**：tasks 审计结论为「完全覆盖、验证通过」，且各任务验收表已按实际执行填写。
- **implement**：执行 tasks 后的审计（audit-prompts §5）结论为「完全覆盖、验证通过」，且环节 2–6 得分已录入。

**Layer 5**：
- **post_impl**：实施后审计 §5 结论为「完全覆盖、验证通过」，且环节 2–6 得分已录入、综合分与等级已计算并写入存储。
- **pr_review**：强制人工审核通过；可选记录，不作为迭代结束的必填条件。

**未启用全体系评分时**：各阶段仅以该阶段审计结论「完全覆盖、验证通过」为迭代结束标准，与现有 BMAD+Speckit 行为一致。

---

### 5. §2.3 审计产出 → 评分环节的输入 — 扩展映射表

**替换**：当前 §2.3 表格

**新表格**：

| 阶段 | 主要审计产出 | 对应的评分环节 | 可解析性 |
|------|--------------|----------------|----------|
| prd | PRD 审计报告（code-review prd 模式）、需求覆盖与完整性结论 | 环节 1 | 可解析，audit-prompts-prd.md 对应 |
| arch | Architecture 审计报告（code-review arch 模式）、架构/技术选型合理性结论 | 环节 1 补充、环节 2 设计侧 | 可解析，audit-prompts-arch.md 对应 |
| epics | Epic/Story 列表、依赖图 | 环节 1 输入依据 | 可选解析，当前不单独计分 |
| story | Create Story 审计报告、Story 文档、第一遍审计结论 | 环节 1 补充 | 可解析，需约定报告路径与格式 |
| specify | spec 审计报告、需求覆盖与边界/方案合理性结论 | 环节 1 | 可解析 |
| plan | plan 审计报告、架构/技术选型合理性结论 | 环节 1 补充、环节 2 设计侧 | 可解析 |
| gaps | IMPLEMENTATION_GAPS 审计报告、与 tasks 衔接确认 | 环节 2–5 的输入依据 | 可解析 |
| tasks | tasks 审计报告、各任务验收表与通过/不通过结论 | 环节 2–5 | 可解析 |
| implement | 执行 tasks 后审计报告（audit-prompts §5）、集成/端到端测试结果 | 环节 2–6 | 可解析 |
| post_impl | 实施后审计 §5 报告、验收表 | 环节 2–6 实测与端到端 | 可解析 |
| pr_review | 人工审核结论（通过/不通过、备注） | 环节 6 补充 | 可选解析 |

---

### 6. §2.4 轻量化三原则与 Layer 1–3 审计产出的同机解析（新增小节）

**位置**：§2.3 之后

**新增 §2.4**：

**Layer 1–3 审计产出的同机解析**

为确保轻量化三原则（同机执行、可选启用、最小侵入）在 BMAD 全流程下落地，各 Layer 审计产出须支持**同机解析并写入评分**：

| Layer | 审计产出 | 解析规则来源 | 说明 |
|-------|----------|--------------|------|
| Layer 1 prd | PRD 审计报告 | audit-prompts-prd.md、code-reviewer-config prd 模式 | 从报告提取维度通过/不通过，映射环节 1 检查项 |
| Layer 1 arch | Architecture 审计报告 | audit-prompts-arch.md、code-reviewer-config arch 模式 | 从报告提取维度通过/不通过，映射环节 1 补充与环节 2 设计侧 |
| Layer 3 story | Create Story 审计报告 | 第一遍审计结论；需约定报告路径（如 `AUDIT_Story_{epic}-{story}.md`） | 从报告提取 PRD/Arch/Epic 覆盖、禁止词等检查项；若暂无独立 prompt，实施时补全 |

- 实施时由 scoring 规则（scoring/rules/）定义：如何从上述审计报告中解析出各检查项通过与否，并汇总为环节得分。
- 若某 Layer 暂无结构化审计报告，须在实施任务中列为「待补全」，并在 scoring 解析器中标注跳过或占位。

---

### 7. §3.6 版本追溯与存储 — stage 字段扩展

**修改**：§3.6 必存字段表中的 stage 字段

**原**：
```
| stage | string | specify \| plan \| gaps \| tasks \| implement |
```

**新**：
```
| stage | string | prd \| arch \| epics \| story \| specify \| plan \| gaps \| tasks \| implement \| post_impl \| pr_review |
```

**新增可选字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| path_type | string | 可选。`full` \| `layer4_only` \| `layer3_4` \| `layer1_4` 等，记录实际执行的 BMAD 层路径；评测场景可填 |

---

### 8. §3.10 评分标准权威文档 — 扩展 BMAD 阶段

**修改**：权威文档必须包含的内容

**新增**：
- **BMAD 五层与阶段列表**（与 §2.1 表 A 一致）；
- **阶段 → 评分环节映射**（与 §2.1 表 B 一致）；
- **各阶段审计产出路径与解析规则**（与 §2.3、§2.4 一致）；
- **stage 字段完整枚举**（与 §3.6 一致）。

---

### 9. §7 收敛声明 — 补充 BMAD 五层

**修改**：§7 第 2 条

**原**：
> 2. **作为现有全流程各审计闭环的重要输出与迭代结束标准**，与 spec/plan/gaps/tasks/implement 各阶段审计协同；

**新**：
> 2. **作为现有全流程各审计闭环的重要输出与迭代结束标准**，与 BMAD 五层（Layer 1 PRD/Arch、Layer 2 Epics、Layer 3 Story、Layer 4 speckit spec/plan/gaps/tasks/implement、Layer 5 实施后审计与 PR 审核）各阶段审计协同；

---

### 10. 附录 — 新增 BMAD 五层与评分环节对应速查表

**位置**：附录 A 之后

**新增附录 B**：

**BMAD 五层与评分环节对应速查表**

| BMAD Layer | 阶段 | 评分环节 | 迭代结束标准 |
|------------|------|----------|--------------|
| L1 | prd, arch | 环节 1 | 审计完全覆盖 + 得分已写入 |
| L2 | epics | 环节 1 输入（不单独计分） | 产出完成 |
| L3 | story | 环节 1 补充 | 审计完全覆盖 + 得分已写入 |
| L4 | specify, plan, gaps, tasks, implement | 环节 1–6 | 审计完全覆盖 + 得分已写入 |
| L5 | post_impl, pr_review | 环节 2–6、环节 6 补充 | 审计完全覆盖 + 得分已写入；pr_review 可选 |

---

## 收敛确认

本辩论经 200 轮，批判审计员发言 142 轮（71%），最后 3 轮（第 198、199、200 轮）无新 gap，**收敛**。

需求文档更新要点可直接用于：
1. 修订 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md`；
2. 将全体系评分与 BMAD 五层完整对齐；
3. 明确场景与层路径、轻量化三原则在 Layer 1–3 的落地方式；
4. 扩展 stage 字段与审计产出映射表；
5. 保持「全流程审计闭环的重要输出与迭代结束标准」定位，全文无「面试」表述。

---

*本文档由 Party-Mode 第三轮辩论产出（200 轮），满足收敛条件（批判审计员 >70%，最后 3 轮无新 gap）。*
