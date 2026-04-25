---
name: bmad-rca-helper
description: |
  Claude Code CLI / OMC 版 BMAD RCA 助手适配入口。
  以 Cursor bmad-rca-helper 为语义基线，按「Party-Mode 根因分析 → 最终方案 + 任务列表 → 审计收敛」执行深度分析。
  Party-Mode 的 gate、recovery、snapshot、evidence 与 exit 语义以 `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md` 为准；当前 designated challenger 硬门禁为 `>60%`，不再由本 skill 自定义第二套阈值。对“最终方案 + 任务列表”场景至少 100 轮，连续 3 轮无 gap 收敛；审计子代理在发现 gap 时直接修改被审文档。
  审计优先 `.claude/agents/auditors/auditor-document`，按 Fallback 链降级。
  适用场景：用户请求 RCA、"根因分析"、"议题/问题深度分析"、"最优方案+任务列表"、或 "RCA 后审计任务文档"。全程中文。
when_to_use: |
  Use when: (1) 用户请求深度根因分析 (RCA), (2) "根因分析"、"议题/问题深度分析", (3) "最优方案+任务列表", (4) "RCA 后审计任务文档"。
references:
  - auditor-document: RCA 文档审计执行体；`.claude/agents/auditors/auditor-document.md`
  - auditor-bugfix: Bugfix 审计执行体；`.claude/agents/auditors/auditor-bugfix.md`
  - audit-document-iteration-rules: 文档审计迭代规则；`.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: 主审计提示词体系；`.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: 批判审计员附录；`.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - prompt-template-rca-tasks: `.claude/skills/bmad-rca-helper/references/audit-prompt-rca-tasks.md`
  - rca-iteration-rules: `.claude/skills/bmad-rca-helper/references/audit-document-iteration-rules.md`
  - party-mode: `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 术语收紧：本文件中“完成 / 通过 / 可进入下一阶段”一律指 `runAuditorHost` 返回 `closeout approved`。审计报告 `PASS` 仅表示可以进入 host close-out，单独的 `PASS` 不得视为完成、准入或放行。

# Claude Adapter: bmad-rca-helper

> **Party-mode source of truth**：`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`。所有 party-mode 的 rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 语义都以该文件为准；本 skill 不得定义第二套 gate 语义。

## Purpose

本 skill 是 Cursor `bmad-rca-helper` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的 RCA 深度分析语义**（Party-Mode 100 轮讨论 → 最终方案 + 任务列表 → 审计收敛）
2. **在 Claude/OMC 运行时中将审计执行体映射到 `.claude/agents/` 系列**（审计 → `auditor-document`）
3. **接入仓库中已开发完成的 handoff、scoring、commit gate 机制**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行 RCA 全流程**

---

## 核心验收标准

Claude 版 `bmad-rca-helper` 必须满足：

- 能作为 Claude Code CLI 的 **RCA 分析入口**，统一管理 party-mode → 方案产出 → 审计收敛闭环
- 各阶段的执行器选择、fallback、评分写入均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - auditor-document 执行体
  - 统一 auditor host runner（`runAuditorHost`）
  - handoff 协议
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt

## 主 Agent 编排面（强制）

交互模式下，本 skill 的全局推进必须由 repo-native `main-agent-orchestration` 决定。`runAuditorHost` 只负责审计后的 host close-out，不能替代主 Agent 的下一步分支决策。

在发起 RCA 审计子任务、实施子任务或任何 bounded execution 前，主 Agent 必须：

1. 执行 `npm run main-agent-orchestration -- --cwd {project-root} --action inspect`
2. 读取 `orchestrationState`、`pendingPacketStatus`、`pendingPacket`、`continueDecision`、`mainAgentNextAction`、`mainAgentReady`
3. 若下一分支可派发但尚无可用 packet，执行 `npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan`
4. 仅依据返回的 packet / instruction 派发子代理，不得只凭 party-mode 结论、RCA prose 或 handoff 摘要直接续跑
5. 每次子代理返回后，以及每次 `runAuditorHost` 收口后，都再次 `inspect`，再决定下一全局分支

`mainAgentNextAction / mainAgentReady` 仅为 compatibility summary；真正权威状态始终是 `orchestrationState + pendingPacket + continueDecision`。

---

## 三层架构

### Layer 1: Cursor Canonical Base

> 继承 Cursor `bmad-rca-helper` 全部已验证语义

#### 适用场景

- 用户提供议题、问题描述、截图或具体问题，要求深度根因分析
- 需要多角色辩论挖掘最优方案并生成可执行任务列表
- 产出文档需经严格审计（审计阶段可要求批判审计员 >70%、连续 3 轮无 gap）后交付

#### 强制约束

| 约束 | 说明 |
|------|------|
| Party-Mode 轮次 | **至少 100 轮**（产出最终方案 + 任务列表场景） |
| 批判审计员 | 必须引入；party-mode 发言占比以 core step-02 为准（当前 designated challenger 硬门禁：`challenger_ratio > 0.60`） |
| 收敛条件 | **最后 3 轮无新 gap** 才能结束辩论（FR23a：审计收敛条件须可验证） |
| 方案与任务描述 | **禁止**模糊表述；**禁止**「可选、可考虑、后续、酌情」等不确定用语；**禁止**遗漏 |
| 审计子任务 | 辩论收敛并产出文档后**必须**发起审计子任务 |
| 审计收敛 | 审计须**连续 3 轮无 gap**；未通过时**审计子代理直接修改被审文档**，禁止仅输出建议 |

#### 工作流

##### 阶段一：Party-Mode 根因分析与方案讨论

1. **输入**：用户提供的议题/问题描述/截图/问题（主 Agent 归纳为统一议题描述）。
2. **执行**：**必须读取** `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md` 及 `steps/step-02-discussion-orchestration.md`，并**严格遵循** step-02 中的 Response Structure 与 gate/recovery/evidence 规则编排多角色讨论。
3. **角色**：**必须**引入 ⚔️ **批判性审计员**；可包含 🏗️ Winston 架构师、💻 Amelia 开发、📋 John 产品经理等（展示名与 `_bmad/_config/agent-manifest.csv` 一致）；批判审计员发言占比以 core step-02 为准，不在本技能中另立阈值。
3b. **发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`、`⚔️ **批判性审计员**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略。
4. **轮次与收敛**：
   - 讨论 **至少 100 轮**；
   - **收敛条件**：**最后 3 轮无新 gap** 才能结束（如第 98、99、100 轮均无新 gap）；
   - 禁止凑轮次：每轮须有实质角色发言。
5. **产出**：
   - 最终方案描述：高质量、准确、无模糊表述、无「可选/可考虑/后续/酌情」、无遗漏；
   - 最终任务列表：可执行、可验收、与方案一一对应。

产出文档命名与路径：若与 Story 关联则置于 `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/`，否则置于 `_bmad-output/implementation-artifacts/_orphan/`；如 `RCA_{议题slug}.md` 或 `TASKS_RCA_{议题slug}.md`（含 §1 问题简述、§2 约束、§3 根因与方案、§4 任务列表、§5 验收等）。

##### 阶段二：审计子任务（必做）

1. **触发**：阶段一收敛并生成最终方案 + 任务列表文档后，主 Agent **必须**发起审计子任务。
2. **子代理选择**：按 Fallback Strategy 执行（见 Layer 2）。
3. **审计依据**：使用 [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) 中的完整 prompt 模板（audit-prompts §4 精神 + TASKS 文档适配）。
4. **审计要求**：
   - **批判审计员必须出场**，发言占比 **>70%**；
   - **收敛条件**：**连续 3 轮无 gap**（针对被审文档）；
   - **未通过时**：**审计子代理须在本轮内直接修改被审文档**以消除 gap，修改完成后输出报告并注明已修改内容；主 Agent 收到报告后发起下一轮审计；**禁止**仅输出修改建议而不修改文档。详见 [references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) 或 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
5. **迭代**：重复审计直至报告结论为「**完全覆盖、验证通过**」且连续 3 轮无 gap。**最大轮次：10 轮**，超过则强制结束并输出「已达最大轮次，请人工检查」。
6. **报告落盘**：每轮审计报告（无论通过与否）均须保存至约定路径，如 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_RCA_{slug}_§4_round{N}.md`。
7. **收敛检查**：收到报告后，若结论「通过」且批判审计员注明「本轮无新 gap」→ `consecutive_pass_count + 1`；若「未通过」或存在 gap → 置 0。**通过判定**：报告结论含「完全覆盖、验证通过」或「通过」；批判审计员段落含「本轮无新 gap」「无新 gap」或「无 gap」。
8. **禁止死循环**：`consecutive_pass_count >= 3` 时**立即结束**，不再发起审计。

#### 可解析评分块（强制）

审计报告结尾须含：

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

#### § 禁止词表（方案与任务描述）

以下词不得出现在最终方案描述与任务列表中。审计时若发现任一词，结论为未通过。

| 禁止词/短语 | 替代方向 |
|-------------|----------|
| 可选、可考虑、可以考虑 | 明确写「采用方案 A」并简述理由 |
| 后续、后续迭代、待后续 | 若本阶段不做则不在文档中写；若做则写清本阶段完成范围 |
| 待定、酌情、视情况 | 改为明确条件与对应动作（如「若 X 则 Y」） |
| 技术债、先这样后续再改 | 单独开 Story 或不在本次范围；不在 RCA 产出中留技术债 |

---

### Layer 2: Claude/OMC Runtime Adapter

> 将 Cursor 执行体映射到 Claude Code CLI 原生执行体

#### Primary Executor

| 阶段 | 源平台审计器 | Claude 执行体 | Agent 定义 |
|------|-------------|--------------|-----------|
| RCA 文档审计 | code-reviewer（原平台 Task 调度） | `auditor-document` | `.claude/agents/auditors/auditor-document.md` |

调用方式：通过 Agent tool（`subagent_type: general-purpose`）调用对应执行体。

#### Fallback Strategy（4 层降级）

当 Primary Executor 不可用时，按以下顺序逐级降级：

| 层级 | 执行方式 | 条件 |
|------|---------|------|
| L1 (Primary) | `.claude/agents/auditors/auditor-document` 执行体 | 默认首选 |
| L2 | `code-reviewer` Agent | auditor-document 不可用时 |
| L3 | `code-review` skill 直接调用 | Agent 机制不可用时 |
| L4 | 主 Agent 直接执行同一份三层结构 prompt | 所有子代理均不可用时 |

**Fallback 降级通知（FR26）**：每次触发 Fallback 时，必须在控制台输出降级通知：

```
⚠️ 执行体层级降级: L{原层级} → L{目标层级}
  原因: {不可用原因}
  当前执行体: {实际使用的执行体名称}
```

#### CLI Calling Summary（Architecture D2）

每次调用审计子代理前，主 Agent 必须输出：

```yaml
--- CLI Calling Summary ---
subagent_type: general-purpose
target_agent: auditor-document
phase: rca_doc_audit
round: {N}
artifact_doc_path: {文档路径}
baseline_path: {需求依据路径}
report_path: {报告路径}
fallback_level: L{N}
---
```

#### YAML Handoff（Architecture D2/D4）

审计完成后输出结构化交接：

```yaml
--- YAML Handoff ---
execution_summary:
  status: passed|failed
  round: {N}
  critic_ratio: "{X}%"
  gap_count: {N}
  new_gap_count: {N}
  convergence_status: in_progress|converged
artifacts:
  artifact_doc_path: "{文档路径}"
  report_path: "{报告路径}"
next_steps:
  - action: revise_rca_doc|execute_rca_tasks
    agent: auditor-document|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_rca_doc|execute_rca_tasks
  next_agent: auditor-document|bmad-standalone-tasks
  ready: true|false
  mainAgentNextAction: dispatch_remediation|dispatch_implement
  mainAgentReady: true|false
---
```

---

### Layer 3: Repo Add-ons

> 仓库级扩展：状态机、hooks、handoff、scoring、commit gate

#### 状态管理

- `.claude/state/bmad-progress.yaml`：BMAD 全局进度跟踪
- handoff 协议：每阶段结束输出结构化 YAML

#### 审计后自动化收口

审计通过时，不再由主 Agent 或审计子代理手工调用 `bmad-speckit score`。执行体只需保证 `projectRoot`、`reportPath`、`artifactDocPath` 三个结果字段完整可用，后续评分写入、auditIndex 更新与其它 post-audit automation 统一由 invoking host/runner 承接。

#### Commit Gate

- PASS 仅表示 RCA 文档审计通过，允许进入 `bmad-standalone-tasks` 实施阶段
- 不允许直接 commit
- 最终 commit 由 `bmad-master` 门控

---

## 引用与依赖

| 资源 | 路径/说明 |
|------|-----------|
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/workflow.md`；所有 rounds / challenger ratio / recovery / evidence / exit gate 规则以 core step-02 为准 |
| **批判审计员** | `{project-root}/_bmad/core/agents/critical-auditor-guide.md`（若存在）；step-02 中批判性审计员为必选挑战者 |
| **audit-prompts §4** | `.claude/skills/speckit-workflow/references/audit-prompts.md` §4（tasks 审计）；本技能审计 prompt 与之精神一致 |
| **audit-document-iteration-rules** | `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`；发现 gap 时审计子代理直接修改文档、3 轮无 gap 收敛 |
| **本技能审计模板** | [references/audit-prompt-rca-tasks.md](references/audit-prompt-rca-tasks.md) |
| **本技能迭代规则** | [references/audit-document-iteration-rules.md](references/audit-document-iteration-rules.md) |

---

## 提示词模板完整性（铁律）

主 Agent 发起 RCA 文档审计子任务时，**必须**将 `references/audit-prompt-rca-tasks.md` 中的完整 prompt 模板整段复制到子代理 prompt 中，替换全部占位符。**禁止**：
- 省略模板中的任何段落
- 概括或自行改写提示词
- 遗漏「【必读】」防护行
- 删除「逐字输出」格式要求

RCA 辩论产出模板中的「最终方案描述」「最终任务列表」格式要求不得省略。

---

## 主 Agent 发起审计时的必守规则

- 将 **references/audit-prompt-rca-tasks.md** 中的完整 prompt **整段复制**到审计子任务，替换 `{文档路径}`、`{需求依据路径}`、`{项目根}`、`{报告路径}`、`{轮次}`。
- **报告保存**：模板中须为「每轮报告（无论通过与否）均须保存至 {报告路径}」。
- 确保审计子代理可访问项目内 `audit-document-iteration-rules.md` 及 audit-prompts §4 精神说明（可在 prompt 中粘贴关键段落或路径）。

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->

