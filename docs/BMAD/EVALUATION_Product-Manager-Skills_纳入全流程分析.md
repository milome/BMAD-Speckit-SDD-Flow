# Product-Manager-Skills 纳入 BMAD-Speckit-SDD-Flow 全流程评估分析

**评估对象**：`D:\Dev\Product-Manager-Skills` 技能目录  
**评估基准**：BMAD-Speckit-SDD-Flow 五层架构与 speckit-workflow  
**产出日期**：2026-03-06  
**文档类型**：评估分析 + 最优方案

---

## 1. 评估范围与背景

### 1.1 评估对象清单

Product-Manager-Skills 目录下与 PRD/需求/Story 相关的技能（经扫描确认存在）：

| 技能路径 | 类型 | 用途 |
|----------|------|------|
| skills/prd-development | workflow | 8 阶段 PRD 创建（Executive Summary → Out of Scope） |
| skills/problem-statement | component | I am/Trying to/But/Because 结构化问题叙述 |
| skills/problem-framing-canvas | interactive | MITRE Look Inward/Outward/Reframe 问题重框 |
| skills/proto-persona | component | 假设驱动 persona（Goals、Pains、Quotes） |
| skills/user-story | component | As a/I want/so that + Gherkin Given/When/Then |
| skills/user-story-splitting | component | 大 Story 拆分 |
| skills/user-story-mapping | component | 用户旅程 Story 映射 |
| skills/prioritization-advisor | interactive | RICE/ICE/MoSCoW 等框架选择 |
| skills/roadmap-planning | workflow | Now/Next/Later 路线规划 |
| skills/press-release | component | Working Backwards 愿景描述 |

### 1.2 BMAD-Speckit-SDD-Flow 五层定位

| Layer | 名称 | 现有能力 | 产出物 |
|-------|------|----------|--------|
| 1 | 产品定义与规划 | PRD、Architecture、Epic 规划 | prd.*.md、epics.md |
| 2 | Epic/Story 规划 | Create Story、party-mode | Story_{epic}-{story}.md |
| 3 | Story 开发 | Dev Story、审计 | 实施后审计报告 |
| 4 | 技术实现 | speckit specify→plan→gaps→tasks→implement | tasks.md、代码 |
| 5 | 收尾 | 实施后审计、PR | AUDIT_*.md |

---

## 2. 逐项技能评估

### 2.1 prd-development

| 维度 | 内容 |
|------|------|
| **功能** | 8 阶段 PRD 创建：Executive Summary、Problem Statement、Target Users、Strategic Context、Solution Overview、Success Metrics、User Stories、Out of Scope |
| **与 BMAD 重叠** | Layer 1 已有 PRD、Epic 产出；BMAD 的 PRD 多为需求映射式，prd-development 强调问题—证据—方案链条 |
| **互补点** | 当前 PRD 缺 Executive Summary、Out of Scope 明确化、Success Metrics 的 Primary/Secondary/Guardrail 区分 |
| **纳入建议** | **部分纳入**：取 8 阶段结构作 PRD 模板 checklist，不替代 BMAD Create Story 流程 |

### 2.2 problem-statement

| 维度 | 内容 |
|------|------|
| **功能** | I am / Trying to / But / Because / Which makes me feel 结构化问题叙述，强调用户视角与根因 |
| **与 BMAD 重叠** | party-mode 偏方案辩论，problem-statement 偏问题定义；两者目标不同 |
| **互补点** | BMAD 需求分析多为「现象—矛盾—目标」，缺少 problem-statement 的 I am/But/Because 结构 |
| **纳入建议** | **纳入**：作为 Create Story / 需求分析的前置输入，在讨论方案前先产出结构化问题陈述 |

### 2.3 problem-framing-canvas

| 维度 | 内容 |
|------|------|
| **功能** | Look Inward（假设/偏见）、Look Outward（谁受影响、谁被忽略）、Reframe（HMW 问题） |
| **与 BMAD 重叠** | 批判审计员已承担质疑假设、发现 gap 的职责；Look Inward 与 party-mode 有功能重叠 |
| **互补点** | canvas 提供系统化问题重框流程；批判审计员偏方案审查，非问题定义 |
| **纳入建议** | **可选**：当需「重定义问题」时作为独立工作坊；日常 Create Story 可不强制使用 |

### 2.4 proto-persona

| 维度 | 内容 |
|------|------|
| **功能** | 假设驱动 persona：Name、Bio、Quotes、Pains、Goals、Attitudes |
| **与 BMAD 重叠** | Layer 1 有目标用户表，多为「类型—场景—期望」三列，无 persona 深度 |
| **互补点** | persona 的 Quotes、Pains 可提升需求分析的用户导向，支撑 As a 的「谁」 |
| **纳入建议** | **纳入**：作为需求分析 / PRD 的输入，在目标用户表基础上补充 proto-persona |

### 2.5 user-story

| 维度 | 内容 |
|------|------|
| **功能** | As a [persona] / I want to [action] / so that [outcome] + 单 When/单 Then 的 Gherkin AC |
| **与 BMAD 重叠** | BMAD Story 有 US、AC，但格式不一；部分为功能列表式 |
| **互补点** | 统一 Story 书写规范，As a/I want/so that 强制用户视角，Gherkin 便于 speckit 验收 |
| **纳入建议** | **纳入**：将 user-story 格式写入 Story 模板与 bmad-story-assistant 约定 |

### 2.6 user-story-splitting

| 维度 | 内容 |
|------|------|
| **功能** | 大 Story 拆分，多 When/多 Then 识别 |
| **与 BMAD 重叠** | ralph-method 已有原子任务分解；Create Story 产出粒度由 party-mode 控制 |
| **互补点** | 拆分模式（workflow、CRUD、业务规则等）可补充 ralph 的分解启发 |
| **纳入建议** | **可选**：当 Story 过大时作为辅助；非必纳入主流程 |

### 2.7 user-story-mapping

| 维度 | 内容 |
|------|------|
| **功能** | 用户旅程维度的 Story 映射 |
| **与 BMAD 重叠** | Epic/Story 已有层级；mapping 偏可视化与旅程顺序 |
| **互补点** | 可补足 Solution Overview 的用户流描述 |
| **纳入建议** | **可选**：用于复杂 Epic 的 Story 排序与依赖梳理 |

### 2.8 prioritization-advisor

| 维度 | 内容 |
|------|------|
| **功能** | 按产品阶段、团队、数据可得性选择 RICE/ICE/MoSCoW 等框架 |
| **与 BMAD 重叠** | BMAD 已有 P0/P1/P2、Epic 拆分；优先级由 party-mode 与业务判断决定 |
| **互补点** | 可为 P0/P1/P2 提供可解释的评分依据 |
| **纳入建议** | **可选**：Epic 规划或路线讨论时使用；非必纳入 |

### 2.9 roadmap-planning

| 维度 | 内容 |
|------|------|
| **功能** | Now/Next/Later、Theme-Based、Timeline 路线规划 |
| **与 BMAD 重叠** | Epic 列表已有；roadmap 偏时间与主题编排 |
| **互补点** | 可将 E6/E7/E8 等 Epic 纳入 Now/Next/Later 视图 |
| **纳入建议** | **可选**：用于对外路线沟通；非主流程必需 |

### 2.10 press-release

| 维度 | 内容 |
|------|------|
| **功能** | Working Backwards 式愿景描述，用户视角 |
| **与 BMAD 重叠** | 无直接对应 |
| **互补点** | 可产出 Executive Summary 或产品愿景段落 |
| **纳入建议** | **可选**：PRD 或对外材料需一页式概述时使用 |

---

## 2.5 各技能可带来的改进与建议动作

以下针对 prd.eval-ux-last-mile 等 PRD 文档，列明各技能可带来的改进及具体建议动作。

### 2.5.1 prd-development（整体编排）

**用途**：按 8 阶段规范 PRD 结构，补全缺失章节。

**建议动作**：
- 新增 **Phase 1 Executive Summary**：一页式概要，例如  
  「为开发者 / 技术负责人 / AI 研发效能工程师提供零门槛的 Coach 诊断、评分查询和 SFT 提取入口，将评分能力从 CLI 暴露为 Command/Skill，以提升评分体系的使用率和迭代效率。」
- 按 Phase 2–8 补齐对应段落，保持与现有 BMAD 术语和 Epic 结构一致。

---

### 2.5.2 problem-statement + problem-framing-canvas

**用途**：强化问题定义，从现象到根因和证据。

**建议动作**：
- 在 §1 使用结构化问题陈述，例如：

  ```
  I am: 已完成 Dev Story 的开发者 / 想了解项目健康度的技术负责人
  Trying to: 快速知道短板、查看评分、生成微调数据
  But: 必须懂 run-id、会读 scores.jsonl、会用 CLI
  Because: 底层引擎已就绪，但没有用户友好入口
  Which makes me feel: 能力存在却难以使用、体验割裂
  ```

- 用 problem-framing-canvas 的 Look Inward / Look Outward / Reframe 检查假设：
  - **Look Inward**：是否把「开发者偏好 CLI」当成前提？是否存在「只做 MVP 就够」的偏见？
  - **Look Outward**：多 worktree 用户、非 Cursor 用户是否被忽略？
  - **Reframe**：可产出 HMW 句式，例如  
    「如何在 Cursor 中让用户无需了解 run-id 即可获取 Coach 诊断？」

---

### 2.5.3 proto-persona

**用途**：把 §2 从简单表格提升为可设计的 persona。

**建议动作**：
- 为 4 类用户各建立 proto-persona，例如「日常开发者 Dev」：

  ```markdown
  ### Dev（日常开发者）
  - **Role:** 在 Cursor 中做 Dev Story
  - **Goals:** 快速了解本轮短板，改进下次实现
  - **Pains:** 不知道 run-id、scores.jsonl 路径，不想写 CLI
  - **Quotes:** 「我只是想知道哪里扣了分，不想查文档找命令」
  - **Behaviors:** 习惯用 Command 和自然语言，而非终端
  ```

- 用 persona 驱动后续 User Story 的「As a…」主语和场景选择。

---

### 2.5.4 user-story

**用途**：将 §5 需求改写为 As a / I want / so that + Gherkin AC。

**建议动作**：
- 将 REQ-UX-1.1 改写为：

  ```markdown
  ### Story E6-US1
  **Summary:** 零参数 Coach 诊断，让开发者无需 run-id 即可获得短板报告

  **As a** 日常开发者  
  **I want to** 运行 /bmad-coach 而不提供任何参数  
  **so that** 我能立刻看到最近一轮的 Coach 诊断报告

  **Acceptance Criteria:**
  - **Scenario:** 无参数运行 Coach
  - **Given:** scoring/data/ 下有至少一条评分记录
  - **When:** 用户运行 /bmad-coach
  - **Then:** 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 诊断报告
  ```

- 对其他核心 REQ 同样拆成 User Story + Given/When/Then，并保持与现有 Epic/Story 映射。

---

### 2.5.5 press-release（Working Backwards）

**用途**：以用户视角检验产品价值，形成 Executive Summary 与对外表述。

**建议动作**：
- 写一份面向开发者的「未来版 press release」：
  - **标题**：例如「BMAD 评测体系：在 Cursor 中一键查看短板与健康度」
  - **问题**：当前需懂 run-id、CLI、scores.jsonl
  - **方案**：/bmad-coach、/bmad-scores、/bmad-dashboard 等
  - **结果**：零门槛使用评分与诊断
- 将 press release 提炼为一两段，放入 PRD 的 Executive Summary。

---

### 2.5.6 prioritization-advisor

**用途**：为 P0/P1/P2 提供可解释的优先级依据。

**建议动作**：
- 选择适合的框架（如 ICE、RICE、Value vs. Effort）对 E6/E7/E8 打分，例如：
  - **E6 Coach+Query**：高 Impact、高 Confidence、低 Effort → P0
  - **E7 Dashboard+SFT**：中等 Impact、中等 Effort → P1
  - **E8 题库**：长期价值、较高 Effort → P2
- 在 PRD 中增加 **§4.1 优先级依据**：用 1–2 段说明为何是 P0/P1/P2，以及使用的方法。

---

### 2.5.7 roadmap-planning

**用途**：将 Epic 纳入路线图，说明时间与依赖。

**建议动作**：
- 采用 **Now/Next/Later** 或季度时间线：
  - **Now:** E6（Coach + Query）
  - **Next:** E7（Dashboard + SFT）
  - **Later:** E8（题库）+ Deferred Gaps
- 在 PRD 中增加 **§9.1 Roadmap 视图**：文字或表格，说明各 Epic 的先后顺序和依赖关系，便于与 roadmap-planning 产出一致。

---

### 2.5.8 user-story-splitting + user-story-mapping

**用途**：拆分过大的 Story，并做用户旅程映射。

**建议动作**：
- 对 REQ-UX-5（题库）等复杂需求，用 **splitting** 检查是否存在「多 When/多 Then」、需拆分的 Story。
- 用 **user-story-mapping** 画出「开发者 / 技术负责人」从打开 Cursor → 运行 Command → 查看报告的旅程，补到 Solution Overview 或用户流部分。

---

## 3. BMAD 五层与 PM Skills 的映射

| BMAD Layer | 适用 PM Skills | 纳入方式 |
|------------|----------------|----------|
| Layer 1 产品定义 | problem-statement、proto-persona、prd-development（结构） | 前置输入 + 模板 checklist |
| Layer 2 Epic/Story | user-story、user-story-splitting（可选） | Story 格式约定 |
| Layer 3 Story 开发 | — | 无 |
| Layer 4 技术实现 | — | 无 |
| Layer 5 收尾 | — | 无 |
| 跨层/沟通 | roadmap-planning、press-release、prioritization-advisor | 可选，按需 |

---

## 4. 纳入代价与收益

### 4.1 纳入代价

| 代价类型 | 具体内容 |
|----------|----------|
| **技能数量** | 全纳入约 10+ 技能，会稀释 BMAD 主流程焦点 |
| **认知负担** | 用户需理解 PM 框架（problem-statement、Gherkin 等）与 BMAD 的衔接 |
| **维护成本** | PM Skills 位于 `D:\Dev\Product-Manager-Skills`，与 BMAD 为独立 repo；需约定引用路径与版本 |
| **流程复杂度** | 若强制串入所有 PM 阶段，Create Story 前会增加多步，拉长周期 |

### 4.2 纳入收益

| 收益类型 | 具体内容 |
|----------|----------|
| **需求质量** | problem-statement、proto-persona 提升问题与用户定义的清晰度 |
| **Story 规范** | user-story 统一 As a/I want/so that + Gherkin，便于验收与 speckit |
| **PRD 完整** | prd-development 结构补足 Executive Summary、Out of Scope、Success Metrics 区分 |
| **可解释性** | prioritization、roadmap 为 Epic 优先级与路线提供依据 |

---

## 5. 最优方案

### 5.1 总体结论

**采用「选择性纳入 + 前置可选」策略**：不将 PM Skills 全量纳入 BMAD 主流程，仅选取 3–4 个与 Layer 1–2 明确互补的技能，作为**可选前置输入**与**格式约定**，保持 BMAD 主流程简洁可执行。

### 5.2 纳入清单（明确）

| 序号 | 技能 | 纳入方式 | 触发时机 | 产出物/约定 |
|------|------|----------|----------|-------------|
| 1 | **problem-statement** | 可选前置 | 需求分析或 Create Story 前，当问题表述模糊时 | 结构化问题陈述（I am/Trying to/But/Because）；可写入 REQUIREMENTS 或 PRD §1 |
| 2 | **proto-persona** | 可选前置 | 需求分析或 PRD 编写时，当目标用户仅以表格描述时 | proto-persona 段落；补充 PRD §2 目标用户 |
| 3 | **user-story** | 强制格式约定 | 所有 Create Story 产出的 User Story 书写 | Story 模板：As a [persona] / I want to [action] / so that [outcome]；AC 采用 Given/When/Then（单 When、单 Then） |
| 4 | **prd-development** | 结构 checklist | PRD 编写或评审时 | PRD 模板须含：Executive Summary、Problem Statement（含证据）、Target Users、Success Metrics（Primary/Secondary/Guardrail）、Out of Scope；可作为 `_bmad/templates/prd-checklist.md` |

### 5.3 不纳入清单（明确）

| 技能 | 不纳入理由 |
|------|------------|
| problem-framing-canvas | 与 party-mode 批判审计员的「挑战假设」功能重叠；需独立工作坊，成本高 |
| user-story-splitting | ralph-method 已有原子分解；仅当 Story 明显过大时可手动参考 |
| user-story-mapping | 非主流程必需；Epic/Story 结构已满足 |
| prioritization-advisor | P0/P1/P2 已由业务判断决定；非强制 |
| roadmap-planning | 用于对外沟通；非执行流程必需 |
| press-release | 用于 Executive Summary 或对外材料；可按需使用，不写入主流程 |

### 5.4 实施动作（可执行）

#### 动作 1：更新 Story 模板

**路径**：`_bmad` 下 Create Story 产出所用的 Story 模板（或 bmad-story-assistant 引用的模板）

**修改内容**：
- 增加 User Story 格式说明：必须包含「As a [persona] / I want to [action] / so that [outcome]」三行
- 增加 AC 格式说明：采用 Given/When/Then，每条 AC 仅允许一个 When 和一个 Then
- 引用来源：`D:\Dev\Product-Manager-Skills\skills\user-story\SKILL.md` 或 `template.md`

#### 动作 2：创建 PRD checklist

**路径**：`_bmad/templates/prd-checklist.md`（若目录不存在则创建）

**内容**：PRD 须包含的段落清单（来自 prd-development）：
- [ ] §1 Executive Summary（一段话：为谁、解决什么问题、带来什么结果）
- [ ] §2 Problem Statement（Who/What/Why/Evidence）
- [ ] §3 Target Users（表格或 proto-persona）
- [ ] §4 Success Metrics（Primary、Secondary、Guardrail）
- [ ] §5 详细需求
- [ ] §6 Out of Scope（明确不做的项及理由）
- [ ] §7 依赖与风险

#### 动作 3：文档引用 PM Skills

**路径**：`docs/BMAD/Cursor_BMAD_多Agent使用指南.md` 或新建 `docs/BMAD/PM_Skills_可选增强.md`

**内容**：
- 说明 problem-statement、proto-persona 为可选前置，在需求分析/Create Story 前可调用
- 注明技能路径：`D:\Dev\Product-Manager-Skills\skills\{skill-name}\SKILL.md`
- 说明 user-story 格式为 Create Story 产出强制约定

#### 动作 4：技能路径约定

**约定**：PM Skills 作为外部目录引用，不拷贝到 BMAD 项目内。

- 全局技能：若 Cursor 已配置 `D:\Dev\Product-Manager-Skills` 或其子目录为 skills 路径，则 problem-statement、proto-persona、user-story 可被 Agent 自动加载
- 文档引用：在 Story 模板、PRD checklist 中通过路径或技能名引用，不硬编码实现逻辑

### 5.5 验收标准

| 验收项 | 通过条件 |
|--------|----------|
| 新产出的 Story 文档 | 所有 US 符合 As a/I want/so that 格式；AC 符合 Given/When/Then |
| 新产出的 PRD | 包含 prd-checklist 中列出的全部段落 |
| 可选前置 | 文档中明确 problem-statement、proto-persona 的触发时机与产出位置 |
| 无强制依赖 | BMAD 主流程（Create Story、Dev Story、speckit）在不使用 PM Skills 时仍可完整执行 |

---

## 6. 附录：PM Skills 路径索引

| 技能 | 完整路径 |
|------|----------|
| problem-statement | `D:\Dev\Product-Manager-Skills\skills\problem-statement\SKILL.md` |
| proto-persona | `D:\Dev\Product-Manager-Skills\skills\proto-persona\SKILL.md` |
| user-story | `D:\Dev\Product-Manager-Skills\skills\user-story\SKILL.md` |
| prd-development | `D:\Dev\Product-Manager-Skills\skills\prd-development\SKILL.md` |
