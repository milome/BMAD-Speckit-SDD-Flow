---
name: bmad-standalone-tasks-doc-review
description: |
  Claude Code CLI / OMC 版 BMAD Standalone Tasks 文档审计适配入口。
  以 Cursor bmad-standalone-tasks-doc-review 为语义基线，按「TASKS 文档严格审计」执行质量门控。
  批判审计员 >70%，连续 3 轮无 gap 收敛，审计子代理在发现 gap 时直接修改被审文档。
  主 Agent 发起审计子任务时**必须**将本 skill 内的「完整 prompt 模板」整段复制并填入占位符后传入，禁止省略、概括或自行改写提示词。
  审计优先 `.claude/agents/auditors/auditor-tasks-doc`，按 Fallback 链降级。
  适用场景：用户请求 TASKS 文档审计、"对 {文档路径} 发起审计子任务"、TASKS 文档实施前质量门控。全程中文。
when_to_use: |
  Use when: (1) 用户请求对 TASKS 文档发起严格审计, (2) "对 {文档路径} 发起审计子任务" or "TASKS 文档审计", (3) TASKS 文档实施前质量门控。
references:
  - auditor-tasks-doc: TASKS 文档审计执行体；`.claude/agents/auditors/auditor-tasks-doc.md`
  - auditor-document: 文档审计执行体；`.claude/agents/auditors/auditor-document.md`
  - audit-document-iteration-rules: 文档审计迭代规则；`.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - audit-prompts: 主审计提示词体系；`.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-critical-auditor-appendix: 批判审计员附录；`.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
  - audit-post-impl-rules: 实施后审计规则；`.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`
  - prompt-template-tasks-doc: `.claude/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-tasks-doc.md`
  - prompt-template-impl: `.claude/skills/bmad-standalone-tasks-doc-review/references/audit-prompt-impl.md`
---

# Claude Adapter: bmad-standalone-tasks-doc-review

## Purpose

本 skill 是 Cursor `bmad-standalone-tasks-doc-review` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的 TASKS 文档审计语义**（解析文档路径 → 确定需求依据 → 子代理审计 → 收敛检查 → 迭代至通过）
2. **在 Claude/OMC 运行时中将执行体映射到 `.claude/agents/` 系列**（审计 → `auditor-tasks-doc`、`auditor-document`）
3. **接入仓库中已开发完成的 handoff、scoring、commit gate 机制**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行 TASKS 文档审计流程**

---

## 核心验收标准

Claude 版 `bmad-standalone-tasks-doc-review` 必须满足：

- 能作为 Claude Code CLI 的 **TASKS 文档审计入口**，统一管理解析→审计→收敛闭环
- 各阶段的执行器选择、fallback、评分写入均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - auditor-tasks-doc 执行体
  - 统一 auditor host runner（`runAuditorHost`）
  - handoff 协议
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt

---

## 三层架构

### Layer 1: Cursor Canonical Base

> 继承 Cursor `bmad-standalone-tasks-doc-review` 全部已验证语义

#### 适用场景

- 用户指定文档路径并要求发起审计子任务
- TASKS 文档实施前的质量门控
- 需「完全覆盖、验证通过」且 3 轮无 gap 收敛的文档审计

#### 强制约束

| 约束 | 说明 |
|------|------|
| 批判审计员 | 必须出场，发言占比 **>70%** |
| 收敛条件 | **连续 3 轮无 gap**（针对被审文档） |
| 发现 gap 时 | **审计子代理须在本轮内直接修改被审文档**，禁止仅输出建议 |
| 最大轮次 | **10 轮**，超过则强制结束并输出「已达最大轮次，请人工检查」 |

#### 工作流

1. **解析文档路径**：从用户输入获取 `{文档路径}`（如 `_bmad-output/implementation-artifacts/_orphan/TASKS_xxx.md`）
2. **确定需求依据**：若 TASKS 文档头部有「参考」字段，读取该文档作为需求依据；否则以 TASKS 自身为自洽依据（此时 `{需求依据路径}` 填被审文档路径）
3. **发起审计**：将 [references/audit-prompt-tasks-doc.md](references/audit-prompt-tasks-doc.md) 完整 prompt 复制，替换 `{文档路径}`、`{需求依据路径}`、`{项目根}`、`{报告路径}`、`{轮次}`；**报告保存部分须为「每轮报告（无论通过与否）均须保存至 {报告路径}」**
4. **子代理选择**：按 Fallback Strategy 执行（见 Layer 2）
5. **收敛检查**：收到报告后，若结论「通过」且批判审计员注明「本轮无新 gap」→ `consecutive_pass_count + 1`；若「未通过」或存在 gap → 置 0。**通过判定**：报告结论含「完全覆盖、验证通过」或「通过」；批判审计员段落含「本轮无新 gap」「无新 gap」或「无 gap」。
6. **迭代**：未达 3 轮无 gap 时，发起下一轮审计。**禁止死循环**：`consecutive_pass_count >= 3` 时**立即结束**，不再发起审计。
7. **报告落盘**：每轮报告（无论通过与否）均须保存至 `_bmad-output/implementation-artifacts/_orphan/AUDIT_TASKS_{slug}_§4_round{N}.md`；主 Agent 发起审计时须在 prompt 中明确此要求。

#### 可解析评分块（强制）

主流程（TASKS 文档审计）报告结尾须含：

```markdown
## 可解析评分块（供 parseAndWriteScore）
总体评级: [A|B|C|D]
维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

#### 模式 B：实施后审计（§5）

当用户要求对**实施完成后的结果**（代码、prd、progress）审计时，使用 audit-prompts §5。此时：
- 被审对象为代码/实现，非文档
- 发现 gap 时由**实施子代理**修改代码，非审计子代理
- 收敛规则见 `.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`

详见 [references/audit-prompt-impl.md](references/audit-prompt-impl.md)。

---

### Layer 2: Claude/OMC Runtime Adapter

> 将 Cursor 执行体映射到 Claude Code CLI 原生执行体

#### Primary Executor

| 阶段 | 源平台审计器 | Claude 执行体 | Agent 定义 |
|------|-------------|--------------|-----------|
| TASKS 文档审计 | code-reviewer（原平台 Task 调度） | `auditor-tasks-doc` | `.claude/agents/auditors/auditor-tasks-doc.md` |
| 文档审计（Stage 4） | code-reviewer（原平台 Task 调度） | `auditor-document` | `.claude/agents/auditors/auditor-document.md` |

调用方式：通过 Agent tool（`subagent_type: general-purpose`）调用对应执行体。

#### Fallback Strategy（4 层降级）

当 Primary Executor 不可用时，按以下顺序逐级降级：

| 层级 | 执行方式 | 条件 |
|------|---------|------|
| L1 (Primary) | `.claude/agents/auditors/auditor-tasks-doc` 执行体 | 默认首选 |
| L2 | `code-reviewer` Agent | auditor-tasks-doc 不可用时 |
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
target_agent: auditor-tasks-doc
phase: tasks_doc_audit
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
  - action: revise_tasks_doc|execute_standalone_tasks
    agent: auditor-tasks-doc|bmad-standalone-tasks
    ready: true|false
handoff:
  next_action: revise_tasks_doc|execute_standalone_tasks
  next_agent: auditor-tasks-doc|bmad-standalone-tasks
  ready: true|false
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

- PASS 仅表示文档审计通过，允许进入 `bmad-standalone-tasks` 实施阶段
- 不允许直接 commit
- 最终 commit 由 `bmad-master` 门控

#### 禁止词检查

审计报告中不得出现以下延迟表述：「可选」「后续」「待定」「视情况」「后续迭代」「暂不」「先实现」。

---

## 引用

- **audit-document-iteration-rules**：`.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
- **audit-prompts §4**：`.claude/skills/speckit-workflow/references/audit-prompts.md` §4（主流程 TASKS 文档审计）
- **audit-prompts §5**：`.claude/skills/speckit-workflow/references/audit-prompts.md` §5（模式 B 实施后审计）
- **audit-prompts-critical-auditor-appendix**：`.claude/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`
- **audit-post-impl-rules**：`.claude/skills/speckit-workflow/references/audit-post-impl-rules.md`

---

## 提示词模板完整性（铁律）

主 Agent 发起 TASKS 文档审计子任务时，**必须**将 `references/audit-prompt-tasks-doc.md` 中的完整 prompt 模板整段复制到子代理 prompt 中，替换全部占位符。**禁止**：
- 省略模板中的任何段落
- 概括或自行改写提示词
- 遗漏「【必读】」防护行
- 删除「逐字输出」格式要求

实施后审计模板见 `references/audit-prompt-impl.md`。

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->
