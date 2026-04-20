---
name: bmad-bug-assistant
description: |
  Claude Code CLI / OMC 版 BMAD Bug 助手适配入口。
  以 Cursor bmad-bug-assistant 为语义基线，按「根因分析 → BUGFIX 文档 → 审计 → 任务列表补充 → 实施 → 实施后审计」执行 BUG 修复全流程。
  主 Agent 发起任一子任务时**必须**将本 skill 内该阶段的「完整 prompt 模板」整段复制并填入占位符后传入，禁止省略、概括或自行改写提示词；
  主 Agent 禁止直接修改生产代码，实施须通过 Agent tool 子代理（subagent_type: general-purpose）。
  party-mode 主路径显式调用示例已统一为：`.claude/agents/party-mode-facilitator.md` / `@"party-mode-facilitator (agent)"`。
  主 Agent 进入 party-mode 前必须先展示 `20 / 50 / 100` 强度选项；普通 RCA / 方案分析推荐 `decision_root_cause_50`，BUGFIX 最终方案与 §7 推荐 `final_solution_task_list_100`；但必须等待用户明确回复后，才能发起 `@"party-mode-facilitator (agent)"`。
  `quick_probe_20` 仅用于 probe-only；若当前档位不足以产出高置信最终产物，主 Agent 必须拒绝当前档位并要求升级到 `final_solution_task_list_100`。
  每 20 轮必须展示一次 checkpoint，且 `S / F / C` 仅在 `checkpoint_window_ms = 15000` 的窗口内生效；heartbeat 由 facilitator 负责。
  审计优先 `.claude/agents/auditors/auditor-bugfix`，按 Fallback 链降级。
  遵循 ralph-method、TDD 红绿灯、speckit-workflow。
  适用场景：用户报告 BUG、要求根因分析、生成/更新 BUGFIX 文档、补充 §7 任务列表、实施 BUGFIX。全程中文。
when_to_use: |
  Use when: 用户报告 BUG、要求根因分析、生成/更新 BUGFIX 文档、补充 §7 任务列表、实施 BUGFIX。
references:
  - auditor-bugfix: bugfix 文档审计执行体；`.claude/agents/auditors/auditor-bugfix.md`
  - auditor-implement: 实施后审计执行体；`.claude/agents/auditors/auditor-implement.md`
  - audit-prompts-section5: §5 审计提示词参考；`.claude/skills/bmad-bug-assistant/references/audit-prompts-section5.md`
  - audit-document-iteration-rules: 文档审计迭代规则；`.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`
  - party-mode: `{project-root}/_bmad/core/skills/bmad-party-mode/`
  - party-mode-facilitator: Party-mode dedicated facilitator agent；`.claude/agents/party-mode-facilitator.md`
  - ralph-method: prd、progress 文件，按 US 顺序执行
  - speckit-workflow: 禁止伪实现、必须运行验收命令、架构忠实
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 术语收紧：本文件中“完成 / 通过 / 可进入下一阶段”一律指 `runAuditorHost` 返回 `closeout approved`。审计报告 `PASS` 仅表示可以进入 host close-out，单独的 `PASS` 不得视为完成、准入或放行。

> **Orphan bugfix closeout contract**：当 BUGFIX 文档位于 `_bmad-output/implementation-artifacts/_orphan/` 时，结构化审计报告必须显式提供 `stage=bugfix`、`artifactDocPath`、`reportPath`，且三者必须与真实 BUGFIX 文档路径 / 报告路径一致；缺失任一字段或仍停留在 prose-only PASS 时，主 Agent 不得宣称通过，host closeout 必须 fail-closed。

# Claude Adapter: bmad-bug-assistant

> **Party-mode source of truth**：`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`。所有 party-mode 的 rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 语义都以该文件为准；本 skill 不得定义第二套 gate 语义。

## Party-Mode 主 Agent 编排约束（Wave 4）

- 进入 party-mode 前，主 Agent 必须先向用户展示 `20 / 50 / 100` 三档强度，并按请求类型给出推荐档位。
- 普通 RCA / 方案分析推荐 `decision_root_cause_50`；需要 BUGFIX §7 / 最终方案 / 最终任务列表等高置信最终产物时推荐 `final_solution_task_list_100`。
- 主 Agent 必须等待用户明确回复 `20` / `50` / `100` 后，才能正式发起 `@"party-mode-facilitator (agent)"`；禁止把推荐档位表述成已替用户完成的选择。
- 用户一旦明确回复 `20` / `50` / `100`，主 Agent 必须将该回复自动编译进 facilitator prompt 的专用确认块：
  `## 用户选择`
  `强度: 50 (decision_root_cause_50)` / `强度: 20 (quick_probe_20)` / `强度: 100 (final_solution_task_list_100)`。
- 若运行时已携带结构化 `gateProfileId` / `gate_profile_id`，其值必须与上述确认块一致；若 Agent tool 无法透传该字段，则仍必须保留确认块作为授权证明。
- `quick_probe_20` 仅用于 probe-only；若用户当前选择 `quick_probe_20` 或 `decision_root_cause_50`，却又明确要求高置信最终产物，主 Agent 必须拒绝当前档位并要求升级到 `final_solution_task_list_100`。
- 每 20 轮必须向用户展示一次 checkpoint；checkpoint 展示后默认自动继续下一批，不要求逐批人工确认。
- `S / F / C` 只在 checkpoint 窗口内有效；`checkpoint_window_ms = 15000`。
- `C` 的语义固定为“立即继续下一批”，会立即关闭当前 checkpoint 窗口并跳过剩余等待时间。
- 若用户在 checkpoint 窗口内输入普通业务补充文本，而不是 `S / F / C`，主 Agent 必须立即停止自动继续，取消窗口计时，并按新补充进入下一批前的重新编排。
- checkpoint 窗口外的 `S / F / C` 必须显式拒绝，不缓存、不当作普通业务输入。
- heartbeat 由 facilitator 负责；主 Agent 只负责批次结束后的 checkpoint 展示，不负责单批执行中的实时 heartbeat 插入。

## Purpose

本 skill 是 Cursor `bmad-bug-assistant` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的 BUG 修复全流程语义**（根因分析 → BUGFIX 文档 → 审计 → 实施 → 实施后审计）
2. **在 Claude/OMC 运行时中将审计执行体映射到 `.claude/agents/auditors/auditor-bugfix` 等**
3. **接入仓库中已开发完成的 handoff、scoring、commit gate 机制**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行 BUG 修复全流程**

---

## 核心验收标准

Claude 版 `bmad-bug-assistant` 必须满足：

- 能作为 Claude Code CLI 的 **BUG 修复全流程入口**，统一管理根因分析→BUGFIX 文档→审计→实施→实施后审计闭环
- 各阶段的执行器选择、fallback、评分写入均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - auditor-bugfix、auditor-implement 执行体
  - 统一 auditor host runner（`runAuditorHost`）
  - handoff 协议
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt
- **主 Agent 禁止直接修改生产代码**（FR20a）

---

## Cursor Canonical Base

以下内容继承自 Cursor `bmad-bug-assistant`，属于业务语义基线，Claude 版不得擅自重写其意图。

本 skill 定义 **根因分析 → BUGFIX 文档 → 审计 →（可选）信息补充更新 → 任务列表补充 → 实施 → 实施后审计** 的完整工作流。**实施前的 `auditor-bugfix` 属于 BUGFIX 文档审计，且必须先于任何修复实现执行。** **实施后审计为必须步骤，非可选。**未通过时必须按修改建议修复后再次审计，直至通过。

### 强制约束（必须遵守）

1. **全程使用中文**：所有产出（BUGFIX 文档、任务列表、审计报告、子任务 prompt）及与用户的交互均使用中文。
2. **party-mode 子代理**：使用 party-mode 时**必须**使用合适的 BMAD 子代理（见下方「BMAD Agent 展示名与命令对照」及各阶段的「推荐 Agent」）；若当前环境无法调度对应子代理，则按 Fallback Strategy 降级（见 Runtime Adapter），不得跳过多角色辩论或改用单角色。
3. **主 Agent 禁止直接改生产代码**：实施修复必须通过子代理执行；主 Agent 仅发起子任务、传入文档路径、收集输出。
4. **主 Agent 禁止直接生成 BUGFIX 文档**：阶段一、二的 BUGFIX 文档（含 §1–§5）必须由 party-mode 或子代理产出；主 Agent 不得以「已有分析文档」「根因已共识」等为由跳过子代理并自行撰写 BUGFIX 文档。
5. **凡更新必审计**：凡产出或更新 BUGFIX 文档（含 §4、§7），完成后**必须**发起审计子任务并迭代至通过；**禁止**省略审计步骤。无论是否经过辩论，审计闭环为必做项。
6. **BUGFIX 文档审计是实施前硬门槛**：`auditor-bugfix` 的职责是 **BUGFIX 文档审计**，不是实施后代码审计。只要 `auditor-bugfix` 尚未通过，**禁止**进入任何修复实现、代码修改、测试实现或“先修后补审计”的路径。
7. **Implementation Entry Gate 是实施前第二硬门槛**：`auditor-bugfix` 通过后，主 Agent **仍必须**执行统一 `implementation-readiness` gate 断言。仅当结果为 `decision=pass` 时，方可进入阶段四实施；若结果为 `block` 或 `reroute`，必须先补齐 readiness 事实或按推荐 flow 调整，禁止直接发起实现。

### 主 Agent 传递提示词规则（必守）

每次发起子任务（party-mode 或 Agent tool）时，主 Agent **必须**遵守以下规则，否则子代理易因提示词不完整而偏离本 skill 要求：

1. **使用完整模板**：使用本 skill 中该阶段提供的「完整 prompt 模板」；**禁止**自行概括、缩写或改写。
2. **整段复制**：将模板**整段复制**到子任务的 `prompt` 参数中，**禁止**只传「要点」或「参考下方」。
3. **替换占位符**：将模板中的占位符（如 `{主 Agent 填入}`、`{project-root}`、`{用户提供的 BUG 现象...}`）**全部**替换为实际内容后再传入。
4. **自检后再发起**：若该阶段有「发起前自检清单」，主 Agent 在发起前**必须**逐项确认后再发起。
5. **禁止概括**：主 Agent 不得将模板概括为要点或「参考技能某节」；子任务 prompt 中必须包含该阶段模板的完整正文（占位符已替换）。若未整段复制导致子任务产出不符合技能要求，主 Agent 须重新发起并整段复制。
6. **错误示例**（均不符合整段复制要求）：prompt 中仅写「请按 bmad-bug-assistant 阶段一审计模板执行」；「请参考 bmad-bug-assistant 技能阶段一审计部分」；「审计要求见上文」；「按技能要求做 BUGFIX 文档审计」。
7. **正确示例**：prompt 中包含该阶段完整 prompt 模板全文（含模板 ID、边界内全部段落），且占位符已全部替换；发起前已按该阶段「发起前自检清单」逐项确认并输出自检结果。
8. **自检强制**：未完成该阶段「发起前自检清单」全部项且未在发起前输出自检结果时，不得发起子任务；禁止先发起后补自检。自检结果须按统一格式输出，例如：「【自检完成】阶段 X：已整段复制模板 [模板 ID]；占位符 [已替换/列出]；[该阶段其他必选项]。可以发起。」

**占位符清单**：

| 阶段 | 占位符 | 含义 | 示例值 | 未替换后果 |
|------|--------|------|--------|------------|
| 阶段一 | {用户提供的 BUG 现象、复现步骤、环境信息} | 用户描述或主 Agent 归纳 | 一段话 | 子代理无输入 |
| 阶段二 | {用户补充的现象、步骤、环境等} | 用户补充内容 | 一段话 | 子代理无补充信息 |
| 阶段二 | {主 Agent 填入路径} | BUGFIX 文档完整路径 | _bmad-output/BUGFIX_xxx_2026-02-27.md | 子代理无法定位文档 |
| 阶段三 | {主 Agent 填入 BUGFIX 文档路径} | BUGFIX 文档完整路径 | 同上 | 同上 |
| 阶段三 | {project-root} | 项目根目录绝对路径，不含末尾 / | d:\Dev\my-project | 子代理无法定位项目 |
| 阶段三审计 | {主 Agent 填入 BUGFIX 文档路径} | 同上 | 同上 | 子代理无法定位文档 |
| 阶段四 | {主 Agent 填入} | BUGFIX 文档完整路径 | 同上 | 同上 |
| 阶段四 | {project-root} | 同上 | 同上 | 同上 |

### 依赖与引用

| 资源 | 路径/说明 |
| ---- | --------- |
| **party-mode** | `{project-root}/_bmad/core/skills/bmad-party-mode/`；所有 rounds / challenger ratio / recovery / evidence / exit gate 规则以 core step-02 为准（BUGFIX 产出最终方案与 §7 任务列表：100 轮；其它：50 轮）。 |
| **auditor-bugfix 执行体** | `.claude/agents/auditors/auditor-bugfix.md`；找不到则按 Fallback Strategy 降级 |
| **auditor-bugfix 的门槛语义** | `auditor-bugfix` = BUGFIX 文档审计执行体，**必须先于修复实现通过** |
| **audit-prompts §5** | `references/audit-prompts-section5.md`（本 skill 内）或 `{project-root}/docs/speckit/skills/speckit-workflow/references/audit-prompts.md`；**仅作其他工作流参考，不用于本 skill 的 BUGFIX 文档审计**。 |
| **audit-document-iteration-rules** | `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`；阶段一、二、三的 BUGFIX **文档**审计须遵循：审计子代理在发现 gap 时须直接修改 BUGFIX 文档。阶段四为实施后审计（代码），不适用。 |
| **ralph-method** | 使用 ralph-method skill：prd、progress 文件，按 US 顺序执行 |
| **speckit-workflow** | 禁止伪实现、必须运行验收命令、架构忠实 |
| **改进说明（本技能）** | {project-root}/_bmad-output/BMAD_BUG_助手技能提示词与审计改进说明.md |
| **主 Agent 提示词偏差 20 轮优化** | {project-root}/_bmad-output/主Agent提示词偏差_20轮详细优化讨论.md |

### § 禁止词表（BUGFIX 文档）

以下词不得出现在 BUGFIX 文档的 §4、§7 等方案与任务描述中。审计时若发现任一词，结论为未通过。

| 禁止词/短语 | 替代方向 |
|-------------|----------|
| 可选、可考虑、可以考虑 | 明确写「采用方案 A」，并简述理由。 |
| 后续、后续迭代、待后续 | 若本阶段不做则不在文档中写；若做则写清本阶段完成范围。 |
| 待定、酌情、视情况 | 改为明确条件与对应动作（如「若 X 则 Y」）。 |
| 技术债、先这样后续再改 | 不在 BUGFIX 文档中留技术债；单独开 Story 或不在本次范围。 |
| 既有问题可排除、与本次无关、历史问题暂不处理、环境问题可忽略 | 在验收/审计结论、任务完成说明中出现且**无正式排除记录**时禁止；若有正式排除记录，可在记录中作客观描述但须带客观依据（如 issue 号、复现步骤）。 |

**使用说明**：阶段一、二、三中凡产出或更新 §4/§7 的 prompt 模板，须在产出要求中引用本表或贴出上表精简版；阶段一审计模板及阶段四实施后审计模板中须写「若 §4/§7 出现上表任一词，结论为未通过」。阶段四实施后审计模板中须写「若验收/审计结论中出现上表「失败排除」相关禁止词且无对应正式排除记录，结论为未通过」。

### 正式排除失败用例的规定

**原则**：任何在本次验收/回归中出现的失败用例，均须在本轮内**修复**或**列入正式排除清单**并接受审计；不得以任何未记录、未审计的理由忽略失败。

**禁止自动生成**：审计子代理、实施子代理**禁止**自动创建或更新 EXCLUDED_TESTS_*.md 或类似排除清单文件。

**须先询问用户**：当验收/回归存在失败用例且拟列入正式排除时，主 Agent 或子代理必须**先向用户询问**「是否批准将以下用例列入正式排除清单」，用户明确批准后，方可创建或更新排除清单；若用户拒绝，必须进入修复流程，不得创建排除清单。

**排除记录路径与命名**：`{BUGFIX 文档同目录}/EXCLUDED_TESTS_{stem}.md`，stem 为 BUGFIX 文件名无扩展名（如 BUGFIX_foo_2026-02-26）。

**必备字段**：用例 ID（或测试路径+名称）、排除理由（一句话）、客观依据（如复现步骤证明非本次引入或 issue 编号）、本 BUG 标识、审计结论（通过/未通过）。

**可接受排除**：记录存在、路径符合约定、每条含用例 ID、理由、客观依据、本 BUG 标识；本轮审计已检查该记录并结论为「排除可接受」。

**不可接受**：无排除记录、记录缺项、仅笼统写「既有问题」无依据、或审计未检查排除记录即判通过。

**最小示例**：

| 用例 ID / 测试路径 | 排除理由 | 客观依据 | 审计 |
|-------------------|----------|----------|------|
| test_foo::test_bar | 既有 preload 问题，见 issue #N | 未应用本补丁时复现 | 通过 |

### BMAD Agent 展示名与命令对照

在子任务调用、Party Mode 多轮对话、工作流指引等场景中，应使用以下**展示名**指代各 Agent，以保持上下文一致性与用户体验。

| Agent 展示名 | 命令名 | 模块 |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary 分析师 | `bmad-agent-bmm-analyst` | bmm |
| John 产品经理 | `bmad-agent-bmm-pm` | bmm |
| Winston 架构师 | `bmad-agent-bmm-architect` | bmm |
| Amelia 开发 | `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn 测试 | `bmad-agent-bmm-qa` | bmm |
| Paige 技术写作 | `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent 构建 | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module 构建 | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow 构建 | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor 创新策略 | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn 问题解决 | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya 设计思维 | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson 头脑风暴 | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia 故事讲述 | `bmad-agent-cis-storyteller` | cis |
| Caravaggio 演示 | `bmad-agent-cis-presentation-master` | cis |
| Murat 测试架构 | `bmad-agent-tea-tea` | tea |

**使用说明**：
- **子任务上下文**：在 prompt 中引用 BMAD 工作流或推荐下一步时，使用展示名（如「可交由 Winston 架构师 做架构检查」）。
- **Party Mode 多轮对话**：Facilitator 介绍与发言时，必须使用展示名标注角色（如「🏗️ **Winston 架构师**：…」「💻 **Amelia 开发**：…」），与 `_bmad/_config/agent-manifest.csv` 的 `displayName` 及上表保持一致。

### 前置检查：新 worktree 与 _bmad 定制迁移提示

**触发时机**：用户在本项目或 worktree 首次使用本 skill 时。

**检查逻辑**：若检测到当前为新 worktree（例如 cwd 为与项目根平级的 worktree 目录如 `my-project-{branch}`，或 `_bmad` 为全新安装），且 `_bmad-output/bmad-customization-backups/` 存在备份，则提示用户：

> 检测到当前为新 worktree。若需恢复 _bmad 定制，可运行：`python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{最新备份路径}" --project-root "{当前项目根}"`。最新备份路径为 `_bmad-output/bmad-customization-backups/` 下按时间戳排序的最新目录。

若无备份，不提示。本检查不阻塞后续阶段。

### 产出路径约定

**有 story 上下文的 BUGFIX**：
| 产出 | 路径 |
|------|------|
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_BUGFIX_{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.BUGFIX_{slug}.json`、`progress.BUGFIX_{slug}.txt` |

**无 story 上下文的 BUGFIX**：
| 产出 | 路径 |
|------|------|
| BUGFIX 文档 | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/_orphan/TASKS_BUGFIX_{slug}.md` |

**禁止**：将 BMAD 产出放在 spec 子目录。spec 子目录仅存放 speckit-workflow 产出。

---

## Claude/OMC Runtime Adapter

### Primary Executor

各阶段子任务根据执行体类型调度：

| 阶段 | 执行体 | Agent 文件 |
|------|--------|-----------|
| 阶段一/二 根因辩论 | party-mode-facilitator | `.claude/agents/party-mode-facilitator.md` / 显式调用 `@"party-mode-facilitator (agent)"` |
| 阶段一/二/三 审计 | auditor-bugfix | `.claude/agents/auditors/auditor-bugfix.md` |
| 阶段四 实施 | general-purpose dev | Agent tool `subagent_type: general-purpose` |
| 阶段四 实施后审计 | auditor-implement | `.claude/agents/auditors/auditor-implement.md` |

主 Agent 将对应 agent 的完整 markdown 内容整段传入作为 prompt。

### Fallback Strategy

4 层 Fallback 链（按优先级降序）：

1. **`.claude/agents/auditors/auditor-bugfix`**（或 `auditor-implement`）：对应阶段的专用审计执行体（Primary）
2. **OMC reviewer**（`oh-my-claudecode` code-reviewer subagent_type）
3. **code-review skill**（通用 code-review 技能，按 audit-prompts 对应章节执行）
4. **主 Agent 直接执行**：主 Agent 读取本 skill 内对应阶段的审计模板，按审计清单逐项检查并输出审计报告

**Fallback 降级通知（FR26）**：当 Fallback 触发时，须向用户显示当前使用的执行体层级。格式：

```
⚠️ Fallback 降级通知：当前审计使用执行体层级 {N}（{执行体名称}），原因：{层级 N-1 不可用原因}
```

示例：
- `⚠️ Fallback 降级通知：当前审计使用执行体层级 2（OMC reviewer），原因：auditor-bugfix 不存在或不可用`
- `⚠️ Fallback 降级通知：当前审计使用执行体层级 4（主 Agent 直接执行），原因：前三层执行体均不可用`

### Runtime Contracts

- 必读：`.claude/protocols/audit-result-schema.md`
- 必读：`.claude/state/bmad-progress.yaml`
- 显式引用：`.claude/agents/auditors/auditor-bugfix.md`
- 显式引用：`.claude/agents/auditors/auditor-implement.md`
- 返回必须包含：`execution_summary`、`artifacts`、`handoff`
- 审计子任务类型按 `code-reviewer` 语义执行
- PASS 后才允许进入下一阶段
- `auditor-bugfix` 的 PASS 是进入修复实现前的硬门槛，不得被解释为建议项或实施后补审计
- 修复完成后仍需实施后审计与 `bmad-master` commit gate

### CLI Calling Summary（Architecture Pattern 2）

每次调用子代理前，主 Agent **必须**输出如下结构化摘要：

```yaml
# CLI Calling Summary
Input: phase={当前阶段}, bugfixDocPath={BUGFIX 文档路径}
Template: {使用的 prompt 模板 ID，如 BUG-A1-ROOT}
Agent: {使用的执行体，如 auditor-bugfix / general-purpose}
Output: {预期产出——BUGFIX 文档或审计报告路径}
Fallback: {当前使用的执行体层级及降级方案}
Acceptance: {验收标准——报告结论为"完全覆盖、验证通过"}
```

### YAML Handoff（Architecture Pattern 4）

每个阶段结束后，主 Agent **必须**输出如下 handoff 结构：

```yaml
execution_summary:
  status: passed|failed
  phase: {当前阶段，如 phase_1_rca / phase_2_update / phase_3_tasks / phase_4_impl}
  iteration_count: {累计轮次}
artifacts:
  bugfixDocPath: {BUGFIX 文档路径}
  reportPath: {审计报告路径}
next_steps:
  - {下一步操作描述}
handoff:
  next_action: phase_2_update|phase_3_tasks|phase_4_impl|post_audit|commit_gate|iterate_audit
  next_agent: auditor-bugfix|auditor-implement|bmad-master|general-purpose
  ready: true|false
```

---

## Repo Add-ons

### 评分写入

审计通过后评分写入与 audit index 更新（必须执行）：实施后审计结论为「完全覆盖、验证通过」后，主 Agent **不得**再手工分别编排 `parseAndWriteScore` 或 auditIndex CLI；应统一通过 `runAuditorHost` / 统一 auditor host runner 承接 post-audit automation。host runner 负责基于 `reportPath`、`artifactDocPath`、`stage` 自动触发评分写入与 registry auditIndex 更新。

### State Updates

```yaml
layer: bugfix
stage: fix_passed
bug_id: string
root_cause_status: identified | fixed
artifacts:
  rca: rca/.../rca.md
  fix: fix/.../fix.md
```

### Constraints

- **禁止自行 commit**
- 必须通过 bugfix 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
- 必须先写复现测试，再写修复实现
- 必须经过实施后审计
- 必须经过 Master 门控

---

## 阶段一：根因分析与 BUGFIX 文档生成（架构师模式）

**推荐 BMAD Agent（展示名）**：**Winston 架构师**（主导根因与方案）、**Mary 分析师**（现象与数据）、**Amelia 开发**（实现与代码路径）、**Quinn 测试**（复现与验收）、**John 产品经理**（影响与优先级）。Party Mode 中须用上述展示名标注发言角色。

**流程**：

1. 根据用户提供的 BUG 问题信息，使用 **party-mode** 引入上述多角色，进行**至少 100 轮**互相质疑和辩论（BUGFIX 属「生成最终方案和最终任务列表」场景），满足收敛条件（根因共识 + 近 2–3 轮无新 gap）再结束；主路径必须显式调用 `.claude/agents/party-mode-facilitator.md`，提示词示例统一写为 `@"party-mode-facilitator (agent)"`。若无法调度 facilitator，才按 Fallback Strategy 降级，使用 Agent tool（`subagent_type: general-purpose`），在 prompt 中明确要求模拟多角色（Winston 架构师、Mary 分析师、Amelia 开发、Quinn 测试、John 产品经理）辩论并达成根因共识。
2. 对根因做深入分析，直至达成根因共识。
3. 生成 **BUGFIX 文档**，完成 BUG 上报（保存至 `_bmad-output/` 或 `bugfix/`）。
4. 发起**审计子任务**：
   - 子代理：通过 Agent tool（`subagent_type: general-purpose`）调度 `.claude/agents/auditors/auditor-bugfix.md`，找不到则按 Fallback Strategy 降级
   - 提示词：**必须**将本 skill 内「阶段一审计完整 prompt 模板」整段复制到审计子任务的 prompt 中（见下方）
   - 迭代至审计结论为 **「完全覆盖、验证通过」**

### 阶段一：主 Agent 必须执行的步骤

1. 将模板 **BUG-A1-ROOT**（阶段一根因辩论完整 prompt 模板）**整段复制**到 Agent tool 的 `prompt` 参数中。
2. 将占位符 `{用户提供的 BUG 现象、复现步骤、环境信息}` 替换为用户实际描述（若用户未写清，可归纳为一段话），**禁止**留空或写「见上文」。
3. 若用户已明确回复 `20` / `50` / `100`，必须将其自动编译进占位符 `{主 Agent 填入用户选择确认块}`，格式固定为：
   `## 用户选择`
   `强度: 20 (quick_probe_20)` / `强度: 50 (decision_root_cause_50)` / `强度: 100 (final_solution_task_list_100)`。
4. 发起子任务；子任务返回后，若生成了 BUGFIX 文档，再发起审计子任务（使用模板 **BUG-A1-AUDIT**（阶段一审计完整 prompt 模板）整段复制）。

### 阶段一根因辩论完整 prompt 模板（主 Agent 必须完整复制并替换占位符后传入）

**模板 ID**：BUG-A1-ROOT。**模板边界**：自代码块内「请使用 BMAD 多角色辩论」起，至「全程使用中文。」止。

```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一根因辩论完整 prompt 模板（ID BUG-A1-ROOT）整段复制并替换占位符后重新发起。

{主 Agent 填入用户选择确认块；若用户已回复 20/50/100，则必须替换为：
## 用户选择
强度: 50 (decision_root_cause_50)
}

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足根因共识且近 2–3 轮无新 gap 再结束）。请对以下 BUG 进行根因分析并达成共识。

**BUG 描述**（由主 Agent 填入用户反馈）：
{用户提供的 BUG 现象、复现步骤、环境信息}

**角色与展示名**：请以以下展示名标注每次发言——🏗️ Winston 架构师（主导根因与方案）、📊 Mary 分析师（现象与数据）、💻 Amelia 开发（实现与代码路径）、🧪 Quinn 测试（复现与验收）、📋 John 产品经理（影响与优先级）。每人从自身视角质疑现象、提出根因假设、反驳或补充，直至达成根因共识。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**产出要求**：
1. 根因结论（一段话，无歧义）。
2. 生成 BUGFIX 文档，包含：§1 问题描述、§2 根因分析、§3 影响范围、§4 修复方案（须为明确描述，禁止使用本 skill「§ 禁止词表」中的词：可选、可考虑、后续、待定、酌情、视情况、后续迭代）、§5 验收标准。必须写入明确的 canonical BUGFIX 文档路径。
3. 全程使用中文。
```

### 阶段一审计完整 prompt 模板（主 Agent 必须完整复制到审计子任务的 prompt 中）

**模板 ID**：BUG-A1-AUDIT。**模板边界**：自代码块内首行「你是一位非常严苛…」起，至任务 1.3 修改 2 所规定的报告结尾格式段最后一句（含「本报告结论格式符合本段要求」）止；主 Agent 复制时须包含本段全部内容。

审计子任务：通过 Agent tool（`subagent_type: general-purpose`）调度 `.claude/agents/auditors/auditor-bugfix.md`，找不到则按 Fallback Strategy 降级。**必须**将下方整段复制到审计子任务的 prompt 中，不得省略。

```
【必读】本 prompt 须为完整审计模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一审计完整 prompt 模板（ID BUG-A1-AUDIT）整段复制并替换占位符后重新发起。

你是一位非常严苛的代码/文档审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已生成的 BUGFIX 文档」进行审计。

审计依据：用户 BUG 描述、根因辩论共识、实际代码/行为（若可查）。

审计内容（逐项验证）：
1. §1 问题描述是否完整、可复现。
2. §2 根因分析是否与共识一致、是否有证据或代码引用。
3. §4 修复方案必须为明确描述。若存在本 skill「§ 禁止词表」中任一词（如可选、可考虑、后续、待定、酌情、视情况、后续迭代），一律判为未通过，并在修改建议中注明：删除该词及所在句，改为明确描述。
4. §5 验收标准是否可执行、可验证。
5. 全文是否使用中文、无技术债占位。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项：① §1 完整可复现；② §2 与共识一致且有证据；③ §4 明确无禁止词；④ §5 可执行可验证；⑤ 全文中文无技术债；⑥ 本报告结论格式符合本段要求。若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议（含「删除可选项」或「将某段改为明确描述」）。

**审计未通过时**：你（审计子代理）须在本轮内**直接修改 BUGFIX 文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。详见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
```

---

## 阶段二：信息补充后更新 BUGFIX 文档

**推荐 BMAD Agent（展示名）**：同阶段一（Winston 架构师、Mary 分析师、Amelia 开发、Quinn 测试、John 产品经理）。Party Mode 须用展示名标注。

**触发**：用户补充了更多信息或问题。

**流程**：

1. 再次使用 **party-mode**（或按 Fallback Strategy 降级），引入上述多角色进行**至少 100 轮**辩论（BUGFIX 属「生成最终方案和最终任务列表」场景，满足收敛条件再结束）。
2. 达成根因分析更新的共识。
3. 更新 BUGFIX 文档。
4. 发起审计子任务（同阶段一）：
   - 子代理：`.claude/agents/auditors/auditor-bugfix.md` 或按 Fallback Strategy 降级
   - 提示词：**必须**使用本 skill 内「阶段一审计完整 prompt 模板」（模板 ID BUG-A1-AUDIT）整段复制到审计子任务 prompt 中，**不得**使用 audit-prompts §5 或其他通用审计提示词。
   - 迭代至「完全覆盖、验证通过」

### 阶段二：主 Agent 必须执行的步骤

1. 将模板 **BUG-A2-UPDATE**（阶段二信息补充辩论完整 prompt 模板）**整段复制**到 Agent tool 的 `prompt` 参数中。
2. 替换占位符：`{用户补充的现象、步骤、环境等}` → 用户实际补充内容；`{主 Agent 填入路径}` → BUGFIX 文档的完整路径（如 `_bmad-output/BUGFIX_xxx_2026-02-27.md`）。
3. 若用户已明确回复 `20` / `50` / `100`，必须将其自动编译进 `{主 Agent 填入用户选择确认块}`；若有结构化 `gateProfileId`，须与确认块一致。
4. 发起辩论子任务；子任务返回后，根据产出更新 BUGFIX 文档（若主 Agent 直接按分析更新文档，则本步可合并到步骤 2 的产出）。
4. **【必做】** 发起审计子任务：使用模板 ID **BUG-A1-AUDIT**（阶段一审计完整 prompt 模板）整段复制，子代理为 `.claude/agents/auditors/auditor-bugfix.md` 或按 Fallback Strategy 降级。
5. **【必做】** 若审计结论为未通过，**审计子代理须在本轮内直接修改 BUGFIX 文档**以消除 gap；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。文档审计迭代规则见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。重复直至结论为「完全覆盖、验证通过」。**禁止**在未通过时仅做一轮审计即结束。

**简化路径**：若用户提供的补充信息已充分（如已有根因分析文档），主 Agent 可直接按分析更新 BUGFIX 文档，**但必须**在更新后发起审计子任务（BUG-A1-AUDIT）并迭代至通过。辩论可省略，审计不可省略。

**模板 ID**：BUG-A2-UPDATE。阶段二信息补充辩论完整 prompt 模板（主 Agent 必须完整复制并替换占位符后传入）

```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段二信息补充辩论完整 prompt 模板（ID BUG-A2-UPDATE）整段复制并替换占位符后重新发起。

{主 Agent 填入用户选择确认块；若用户已回复 20/50/100，则必须替换为：
## 用户选择
强度: 50 (decision_root_cause_50)
}

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足共识且近 2–3 轮无新 gap 再结束）。

用户对 BUG 补充了以下信息，请基于原 BUGFIX 文档再次进行多角色辩论（至少 100 轮），更新根因与文档。

**补充信息**（由主 Agent 填入）：
{用户补充的现象、步骤、环境等}

**原 BUGFIX 文档路径**：{主 Agent 填入路径}

**角色与展示名**：🏗️ Winston 架构师、📊 Mary 分析师、💻 Amelia 开发、🧪 Quinn 测试、📋 John 产品经理。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**产出**：更新后的 BUGFIX 文档（覆盖 §1–§5）。§4 修复方案须为明确描述，禁止使用本 skill「§ 禁止词表」中的词。保存至原路径。全程中文。
```

---

## 阶段三：补充最终任务列表

**推荐 BMAD Agent（展示名）**：**Winston 架构师**（方案选择与架构一致性）、**Dr. Quinn 问题解决**（方案对比与 tradeoff）、**Amelia 开发**（任务可实施性）、**Quinn 测试**（验收与用例）。Party Mode 须用展示名标注。

**触发**：用户要求为 BUGFIX 文档补充最终任务列表。

**流程**：

1. 使用 **party-mode**（或按 Fallback Strategy 降级），引入上述多角色进行**至少 100 轮**辩论（BUGFIX 属「生成最终方案和最终任务列表」场景，满足收敛条件再结束）。
2. 从多个解决方案中进行对比分析、tradeoff，直至所有问题都选定**最终及最优解决方案**。
3. 文档必须：
   - 明确描述**最终方案的选择理由**
   - 明确描述**每一项任务**（建议放在 BUGFIX §7）：修改路径、修改行号及内容、验收标准
   - **禁止**「可选」「可考虑」「后续」等模糊描述
   - **禁止**技术债
4. 发起**审计子任务**（同阶段一、二）：
   - 子代理：`.claude/agents/auditors/auditor-bugfix.md` 或按 Fallback Strategy 降级
   - 提示词：**必须**使用本 skill 内「阶段三 §7 审计完整 prompt 模板」（模板 ID BUG-A3-AUDIT）整段复制到审计子任务 prompt 中
   - 迭代至审计结论为 **「通过」**

### 阶段三：主 Agent 必须执行的步骤

1. 将模板 **BUG-A3-TASKS**（阶段三任务列表补充完整 prompt 模板）**整段复制**到 Agent tool 的 `prompt` 参数中，并替换占位符：`{主 Agent 填入 BUGFIX 文档路径}` → 实际 BUGFIX 文档完整路径；`{project-root}` → 项目根目录绝对路径；若 BUGFIX 涉及具体代码位置，在「关键代码位置参考」中填入文件路径与行号或可定位片段。
2. 执行发起前自检清单（见下方），逐项确认。
3. 输出自检结果（格式见「主 Agent 传递提示词规则」中的自检结果示例）。
4. 若用户已明确回复 `20` / `50` / `100`，必须将其自动编译进 `{主 Agent 填入用户选择确认块}`；若有结构化 `gateProfileId`，须与确认块一致。
5. 发起子任务；子代理应产出更新后的 BUGFIX 文档（含 §7），并写入原文件路径。
6. **【必做】** 子任务返回后，发起审计子任务：使用模板 **BUG-A3-AUDIT**（阶段三 §7 审计完整 prompt 模板）整段复制，子代理为 `.claude/agents/auditors/auditor-bugfix.md` 或按 Fallback Strategy 降级。
7. **【必做】** 若审计结论为未通过，**审计子代理须在本轮内直接修改 BUGFIX 文档**；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。文档审计迭代规则见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。重复直至结论为「通过」。**禁止**在未通过时仅做一轮审计即结束。

**禁止**：不得在未完成步骤 2、3 的情况下执行步骤 4。不得在步骤 4 产出 §7 后省略步骤 5、6。

**发起前自检**：确认 prompt 中已包含 BUGFIX 文档路径、项目根目录；确认未省略「至少 100 轮」「完整复制」等要求。
**发起前自检**：若用户已回复 `20` / `50` / `100`，确认 prompt 中已包含 `## 用户选择` 确认块，且内容与用户回复一致。

### 阶段三任务列表补充完整 prompt 模板（主 Agent 必须完整复制并替换占位符后传入）

**模板 ID**：BUG-A3-TASKS。**模板边界**：自代码块内首行「请为以下 BUGFIX…」起，至「…全程使用中文。」止。

```
【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段三任务列表补充完整 prompt 模板（ID BUG-A3-TASKS）整段复制并替换占位符后重新发起。

{主 Agent 填入用户选择确认块；若用户已回复 20/50/100，则必须替换为：
## 用户选择
强度: 50 (decision_root_cause_50)
}

本任务以以下 BMAD 角色进行多角色辩论（**至少 100 轮**，BUGFIX 产出最终方案与 §7 任务列表；满足单一方案共识且近 2–3 轮无新 gap 再结束）。

请为以下 BUGFIX 文档补充「最终任务列表」（建议作为 §7）。

**BUGFIX 文档路径**：{主 Agent 填入 BUGFIX 文档路径}
**项目根目录**：{project-root}

**角色与展示名**：🏗️ Winston 架构师（方案选择与架构一致性）、🔬 Dr. Quinn 问题解决（方案对比与 tradeoff）、💻 Amelia 开发（任务可实施性）、🧪 Quinn 测试（验收与用例）。

**发言格式（强制）**：每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv`，禁止省略 Icon 或展示名。

**要求**：
1. 先读取上述 BUGFIX 文档全文，理解 §1–§5 及 §4 中的修复方案。
2. 进行至少 100 轮多角色辩论（BUGFIX 产出最终方案与 §7 任务列表），对多种实现方案做对比与 tradeoff，选定最终方案并写明选择理由；满足共识且近 2–3 轮无新 gap 再结束。
3. §7 中每一项任务须包含：修改路径、修改行号及内容、验收标准；禁止「可选」「可考虑」「后续」及技术债。**若任务包含运行全量或回归测试，验收标准须写明「失败数为 0，或所有失败已列入正式排除清单并符合正式排除规定」**。
4. §7 中涉及生产代码的任务，须拆为两子步并在验收标准中写明：（1）子步骤一：新增或修改测试/验收，验收命令运行结果应为失败（红灯）；（2）子步骤二：实现生产代码，验收命令运行结果应为通过（绿灯）。不涉及生产代码的任务可仅写出该任务的验收标准。
5. 产出更新后的 BUGFIX 文档（含 §7），直接写入原文件路径。
6. 全程使用中文。

**关键代码位置参考**（若 BUGFIX 涉及具体代码位置，主 Agent 可在此填入文件路径与行号或可定位片段，便于子代理写出含行号的任务）：
{主 Agent 按需填入：如 engine.py L5814 附近、indicator_worker.py L1432–1449 等}
```

### 阶段三 §7 审计完整 prompt 模板（主 Agent 必须完整复制到审计子任务的 prompt 中）

**模板 ID**：BUG-A3-AUDIT。**模板边界**：自代码块内首行「你是一位非常严苛…」起，至报告结尾格式段最后一句止。

审计子任务：通过 Agent tool（`subagent_type: general-purpose`）调度 `.claude/agents/auditors/auditor-bugfix.md`，找不到则按 Fallback Strategy 降级。**必须**将下方整段复制到审计子任务的 prompt 中，不得省略。占位符 `{主 Agent 填入 BUGFIX 文档路径}` 须替换为实际 BUGFIX 文档完整路径。

```
【必读】本 prompt 须为完整审计模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段三审计完整 prompt 模板（ID BUG-A3-AUDIT）整段复制并替换占位符后重新发起。

你是一位非常严苛的代码/文档审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已补充 §7 任务列表的 BUGFIX 文档」进行阶段三审计。

**待审计 BUGFIX 文档路径**：{主 Agent 填入 BUGFIX 文档路径}

审计依据：§4 修复方案、bmad-bug-assistant 技能 §7 要求（修改路径、行号、内容、验收标准；禁止词；TDD 子步骤）、§4 与 §7 一致性。

审计内容（逐项验证，任一项不满足则结论为未通过）：
1. §7 中每一项任务是否包含：修改路径、修改行号及内容、验收标准。
2. §7 中涉及生产代码的任务是否拆为两子步：子步骤一（红灯）、子步骤二（绿灯）。
3. §7 与 §4 是否一致：方案 A/B/E/C 的 §7 任务是否完整覆盖 §4 描述；若 §4 对某实现方式有明确规定（如「preloadComplete 信号 + QueuedConnection」），§7 须与之一致，否则判为未通过。
4. §7 是否无禁止词（可选、可考虑、后续、待定、酌情、视情况、技术债）。
5. **§7 中涉及全量/回归测试的任务**，其验收标准是否包含「失败数为 0 或所有失败已列入正式排除清单」；若实际执行了回归，实施后审计须按同一标准检查失败与排除清单。**禁止自动生成 exclude**：审计员**禁止**在审计过程中创建或更新 EXCLUDED_TESTS_*.md；可输出「建议排除清单」作为修改建议，但不得创建文件。若审计员产出了排除清单文件，结论为未通过。
6. §6 辩论纪要是否与 §7 一致；若有冲突以 §4 为准。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项 1–6 如上；若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议。

**审计未通过时**：你（审计子代理）须在本轮内**直接修改 BUGFIX 文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后再次发起审计。禁止仅输出修改建议而不修改文档。详见 `.claude/skills/speckit-workflow/references/audit-document-iteration-rules.md`。
```

---

## 阶段四：实施修复（开发模式）

**推荐 BMAD Agent（展示名）**：**Amelia 开发**（实施）；审计阶段使用 `.claude/agents/auditors/auditor-implement.md`（或按 Fallback Strategy 降级）。

**强制约束**：
- 实施必须通过**子代理**（Agent tool `subagent_type: general-purpose`）
- 主 Agent **禁止直接修改生产代码**
- 严格遵守 **ralph-method**、**TDD 红绿灯**、**speckit-workflow**
- **全程中文**

### 4.1 发起实施子任务

**实施前双重硬门槛**：进入本节前，必须同时满足：
1. `auditor-bugfix` 已对 BUGFIX 文档完成审计并给出通过结论；
2. 统一 `implementation-readiness` gate 断言结果为 `decision=pass`。

若 BUGFIX 文档审计未通过、未执行、结论不明，或 gate 结果为 `block` / `reroute`，**禁止**发起实施子任务。

| 项 | 内容 |
| -- | ---- |
| 子代理 | Agent tool（`subagent_type: general-purpose`） |
| prompt | **必须完整复制**模板 **BUG-A4-IMPL**（阶段四实施详细提示词），填入 BUGFIX 路径与项目根目录；**禁止省略**任何一条强制遵守项 |
| 主 Agent 职责 | 发起子任务、传入完整 prompt、收集子代理输出 |

#### 主 Agent 发起前自检清单

在发起子任务前，**必须**确认 prompt 中包含以下全部内容，否则子代理无法遵守 ralph-method 与 TDD 红绿灯：

- [ ] `auditor-bugfix` 已完成 **BUGFIX 文档审计**，且结论为通过；若未通过，已先返回文档审计迭代流程
- [ ] ralph-method：prd/progress 创建与更新规则（含命名规则、每 US 完成后更新）
- [ ] TDD 红绿灯：先改测试（红灯）→ 实现（绿灯）→ 重构；每步运行验收；progress 须含 [TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR] 格式记录（见 bmad-story-assistant §3.2）
- [ ] 「请读取 ralph-method 与 speckit-workflow 技能」或等效的**内联约束**（见下方模板）
- [ ] BUGFIX 文档路径、任务列表所在章节（§7 或 §8.1 等）、项目根目录
- [ ] 任务列表所在章节已明确写出（§7 或 §8.1）。
- [ ] 若 BUGFIX §7 含回归任务，且已知存在失败且用户拒绝排除，确认 prompt 中已告知子代理须在 progress 中记录 [TDD-RED] 及用户决策。

#### 阶段四实施详细提示词（主 Agent 必须整段复制到子任务的 prompt 中，不得省略）

**模板 ID**：BUG-A4-IMPL。

**主 Agent 操作**：将下方从「请对以下 BUGFIX 文档」到「内联约束执行。」**整段复制**到 Agent tool 的 `prompt` 参数中；仅将 `{主 Agent 填入}` 替换为 BUGFIX 文档路径，将 `{project-root}` 替换为项目根目录绝对路径；**不得**删减任何一条强制遵守项。

```
你是一位非常资深的开发专家 Amelia 开发（对应 BMAD 开发职责），负责按 BUGFIX 文档与任务列表执行实施。请按以下规范执行。

【必做】TDD 红绿灯记录：每完成一个涉及生产代码的任务的绿灯后，**立即**在 progress 追加三行：
`[TDD-RED] <任务ID> <验收命令> => N failed`
`[TDD-GREEN] <任务ID> <验收命令> => N passed`
`[TDD-REFACTOR] <任务ID> <内容> | 无需重构 ✓`
交付前自检：对照 §7 逐项检查——若该任务涉及生产代码，progress 中是否有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 在 [TDD-GREEN] 之前？若否，补充后再交付。

**BUGFIX 文档路径**：{主 Agent 填入}
**任务列表**：见上述文档的 §7（任务列表）或 §8.1（实施步骤），请根据文档实际结构确定章节。
**项目根目录**：{project-root}

**Amelia 开发规范（可执行定义，须与下方 ralph-method/TDD/speckit 同时满足）**：
① 按 §7（或 §8.1）任务顺序执行，不跳过。
② 每项完成须运行对应验收并通过后再进行下一项。
③ 不得标记完成但未实现或未运行验收。
④ 禁止在任务描述或代码注释中添加「将在后续迭代」。
⑤ 注释与提交使用中文。

**上述 Amelia 规范与下方 ralph-method、TDD 红绿灯、speckit-workflow 两类约束均须满足，不可只遵守其中一类。**

**强制遵守（必须逐条执行，不得跳过）**：

1. **ralph-method**：
   - 实施开始前，在 BUGFIX 文档同目录创建 `prd.{stem}.json` 与 `progress.{stem}.txt`（stem 为 BUGFIX 文件名无扩展名，如 BUGFIX_foo_2026-02-26）。
   - 将任务列表中的每项映射为 prd 中的 user story，初始 passes=false。**prd 须符合 ralph-method schema**：涉及生产代码的 US 含 `involvesProductionCode: true` 与 `tddSteps`（RED/GREEN/REFACTOR 三阶段）；仅文档/配置的含 `tddSteps`（DONE 单阶段）。
   - **progress 预填 TDD 槽位**：生成 progress 时，对每个 US 预填 `[TDD-RED] _pending_`、`[TDD-GREEN] _pending_`、`[TDD-REFACTOR] _pending_` 或 `[DONE] _pending_`，涉及生产代码的 US 含三者，仅文档/配置的含 [DONE]；执行时将 `_pending_` 替换为实际结果。
   - 每完成一项任务（US），必须：① 将对应 story 的 passes 设为 true；② 在 progress 中追加时间戳与完成说明。
   - 按 US 顺序执行，不得跳过。

2. **TDD 红绿灯**（必须严格按顺序执行，不可跳过）：**每个 US 须独立执行 RED→GREEN→REFACTOR**；禁止仅对首个 US 执行 TDD 后对后续 US 跳过红灯直接实现。
   - **红灯**：对当前 US 涉及的生产行为，先新增或修改测试/验收（如 pytest、验收命令），使验收**失败**（红灯），并记录或输出失败结果。
   - **绿灯**：再实现或修改生产代码，使上述验收**通过**（绿灯），并运行验收命令确认。
   - **重构**：若实现后代码可读性或结构可改进，在验收仍通过的前提下进行重构，并再次运行验收确认。
   - 若当前 US 不涉及生产代码（仅文档、配置等），仅运行该 US 规定的验收命令并通过即可。
   - **progress 必须包含**每子步骤的验收命令与结果，格式：`[TDD-RED] <任务ID> <验收命令> => N failed`、`[TDD-GREEN] <任务ID> <验收命令> => N passed`、`[TDD-REFACTOR] <任务ID> <内容> | 无需重构 ✓`。手动验收可用 `[TDD-RED] 手动：…`、`[TDD-GREEN] 手动：…`。完成红灯子步骤后**立即**在 progress 追加 `[TDD-RED] ...`；完成绿灯子步骤后**立即**追加 `[TDD-GREEN] ...`；**无论是否有重构**，须追加 `[TDD-REFACTOR]`（无具体重构时写「无需重构 ✓」）。禁止用「最终回归全部通过」替代逐任务的 TDD 记录。实施时须在 progress 中按 bmad-story-assistant §3.2 要求记录 TDD 红灯→绿灯→重构。**回归失败且用户拒绝排除时**：当回归/验收命令执行后存在失败用例，且用户**拒绝**批准排除时，须在 progress 中**立即**追加 [TDD-RED] 记录，格式：`[TDD-RED] <任务ID> <验收命令> => N failed, M passed（用户拒绝批准排除，N 个失败用例须修复）`。该记录须在进入修复流程**之前**写入。必备字段：任务 ID、验收命令、失败数、通过数、用户决策。

3. **speckit-workflow**：禁止伪实现与占位；必须运行验收命令；架构忠实于 BUGFIX 文档。

4. 禁止在任务描述中添加「将在后续迭代」；禁止标记完成但功能未实际调用。

5. **失败用例必须修或记**：执行验收/回归命令后，若存在失败用例，必须① 输出完整失败列表；② **询问用户**「是否批准将上述用例列入正式排除清单」；③ 仅当用户**明确批准**时，方可创建或更新正式排除清单（路径与格式见本技能「正式排除失败用例的规定」）；④ 若用户**拒绝**，必须进入修复流程，不得创建排除清单，并在 progress 中记录 [TDD-RED] 及用户决策（见上方 TDD 强化要求）。不得以「既有问题」「与本次无关」等未记录理由跳过；未完成此项不得将相关任务标为完成。

6. **pytest 执行约束**：执行 pytest 时必须在项目根目录运行，使用 `pytest <path> -v`，不得在子目录或隔离环境中运行导致 conftest 未加载；若验收命令包含 `-n auto` 等，需确认 conftest 的 session 钩子在 worker 中生效。

7. 全程使用中文撰写注释、提交与进度说明。

**交付前自检**：对照 BUGFIX §7，逐项检查：若该任务涉及生产代码，progress 中是否有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行，且 [TDD-RED] 在 [TDD-GREEN] 之前？若否，补充后再交付。

请读取 ralph-method 与 speckit-workflow 技能（若可访问），严格按其中规则执行；若无法访问技能，则按上述内联约束执行。

Amelia 开发 的规范已在上方 5 条中列出，子代理按内联执行即可，无需再加载 dev 技能。
```

#### 4.1.5 子任务返回后兜底 cleanup（主 Agent 强制步骤）

子任务返回或超时后，**必须**检查 `_bmad-output/current_pytest_session_pid.txt`；若文件存在，**必须**执行以下命令并删除该文件；**禁止**跳过此步骤。

- **Windows (PowerShell)**：`python tools/cleanup_test_processes.py --only-from-file --session-pid (Get-Content _bmad-output/current_pytest_session_pid.txt)`
- **Linux/macOS**：`python tools/cleanup_test_processes.py --only-from-file --session-pid $(cat _bmad-output/current_pytest_session_pid.txt)`

执行完成后删除 `_bmad-output/current_pytest_session_pid.txt`。

### 4.2 发起审计子任务（实施后审计）

| 项 | 内容 |
| -- | ---- |
| 子代理 | 通过 Agent tool（`subagent_type: general-purpose`）调度 `.claude/agents/auditors/auditor-implement.md`，找不到则按 Fallback Strategy 降级 |
| 提示词 | **必须**将模板 **BUG-A4-POSTAUDIT**（阶段四实施后审计完整 prompt 模板）整段复制到审计子任务的 prompt 中，并填入 BUGFIX 文档路径与 §7 任务列表路径 |
| 目标 | 迭代至「完全覆盖、验证通过」 |

**未通过时必做（禁止只跑一轮即结束）**：若审计结论为「**未通过**」或审计报告中列出未通过项及修改建议，主 Agent **必须**按修改建议执行（委托子代理修改代码或更新 BUGFIX/文档），然后**再次发起**实施后审计（使用同一模板 BUG-A4-POSTAUDIT）；重复「审计 → 若未通过则按建议修改 → 再审计」直至结论为「**完全覆盖、验证通过**」。禁止在结论为未通过时仅做一轮审计即结束或向用户报告完成。

**审计通过后统一 Host 收口（必须执行）**：实施后审计结论为「完全覆盖、验证通过」后，主 Agent **不得**再手工调用 `parseAndWriteScore` 或其它 auditIndex CLI；必须统一调用 `runAuditorHost`。当存在 BUGFIX 文档时，必须确保 host/runner 收到 `artifactDocPath=<BUGFIX 文档路径>`，以保证评分记录与 registry auditIndex 都绑定到 BUGFIX 文档而非审计报告路径。

**路径约定**：`artifactDocPath` 取值与「产出路径约定」一致——有 story 时：`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/BUGFIX_{slug}.md`；无 story 时：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_{slug}.md`。

**模板 ID**：BUG-A4-POSTAUDIT。**阶段四实施后审计完整 prompt 模板**（主 Agent 必须完整复制到审计子任务的 prompt 中）：

```
你是一位非常严苛的代码审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已执行完成的 BUGFIX §7 任务列表」进行执行阶段审计。

审计依据：
1. BUGFIX 文档（§1–§5、§7）
2. 实际产出的生产代码与测试代码

审计内容（必须逐项验证，任一项不满足则结论为未通过）：
1. 任务列表（§7 或 §8.1）中每一项是否已真正实现（无预留、占位、假完成）。
2. 生产代码是否在关键路径中被使用。
3. 验收标准是否已按实际运行结果验证通过（若 §7 中写了验收命令，审计员必须执行该命令并报告通过/失败）。
4. **Amelia 开发规范**：① 是否按任务顺序执行；② 每项是否均有运行验收并通过；③ 是否无标记完成但未实现；④ 是否无「将在后续迭代」表述；⑤ 注释与提交是否中文。
5. **ralph-method**：是否存在 prd.{stem}.json 与 progress.{stem}.txt，progress 中是否按 US 有完成时间戳与说明。
6. 项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须作为未通过项；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
7. **TDD 红绿灯**：对 §7（或 §8.1）中涉及生产代码的每一项，是否先有失败验收（红灯）再实现并通过验收（绿灯）；**progress 是否包含**每任务的 `[TDD-RED]`、`[TDD-GREEN]`、`[TDD-REFACTOR]` 记录（含验收命令与结果）；若无则判不通过。**TDD 三项验证**：涉及生产代码的每个 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行（[TDD-REFACTOR] 允许写「无需重构 ✓」，禁止省略）。**TDD 顺序验证**：对每个任务的 progress 记录，[TDD-RED] 须在 [TDD-GREEN] 之前出现；若同一任务下 [TDD-GREEN] 在 [TDD-RED] 之前或缺少 [TDD-RED]，判为「事后补写」，结论未通过。验证方式：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt` 或目视检查；禁止用「最终回归通过」替代逐任务记录。不满足项⑦的修改建议：在 progress 中按 bmad-story-assistant §3.2 格式补充 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录；**须针对每个缺失任务写出可复制的具体示例**，如「Task 3 应补充：[TDD-RED] T3 pytest tests/xxx -v => 1 failed；[TDD-GREEN] T3 pytest tests/xxx -v => 1 passed；[TDD-REFACTOR] T3 无需重构 ✓」。**回归失败且用户拒绝排除**：若 §7 中存在回归任务，且实际执行时存在失败用例，且用户拒绝批准排除，则 progress 中**必须**包含对应的 [TDD-RED] 记录，格式须含：任务 ID、验收命令、失败数、通过数、「用户拒绝批准排除」。验证方式：`grep -E "\[TDD-RED\].*用户拒绝" progress.*.txt` 或目视检查。若无则判不通过，修改建议：在 progress 中补充，例如「[TDD-RED] US-003 pytest vnpy_datamanager/ -v => 16 failed, 46 passed（用户拒绝批准排除，16 个失败用例须修复）」。
8. **speckit-workflow**：是否无伪实现、是否运行验收命令、是否架构忠实。
9. 是否无「将在后续迭代」等延迟表述。
10. **回归/验收失败用例**：**【回归判定强制规则】** 任何在本 Story 实施前已存在的测试用例，若实施后失败，一律视为回归，须在本轮修复或经用户批准后列入正式排除清单。禁止以「与 Story X 相关」「与本 Story 无关」「来自前置 Story」等理由排除失败用例。判定标准：实施前全量测试通过清单 ∩ 实施后失败清单 = 回归用例集。**强制步骤**：执行全量/回归测试，获取完整通过/失败列表；对每个失败用例核对是否存在于「实施前已存在」的用例集，若存在则标记为回归，须在审计结论中列为「须修复」或「已列入正式排除清单（附用户批准依据）」；禁止以「非本 Story 范围」为由排除。**结论绑定**：若审计结论或验收说明中出现「与 Story X 相关」「与本 Story 无关」「来自 Story 11.1」等表述且用于排除失败用例，且无对应正式排除记录（EXCLUDED_TESTS_*.md 经用户批准），结论为未通过。回归或验收命令执行结果中，失败用例数为 0，或所有失败已列入正式排除清单且清单路径、格式与理由符合本技能「正式排除失败用例的规定」并经本轮审计通过；禁止存在未记录或未审计通过的排除。**禁止自动生成 exclude**：若审计员或实施子代理在本次审计/实施过程中产出了 EXCLUDED_TESTS_*.md 或类似排除清单文件，且**未经用户明确批准**，结论为未通过。排除清单的创建/更新必须经用户明确批准。
11. **主 Agent 兜底 cleanup**：若子任务涉及运行 pytest（§7 或验收命令含 pytest），主 Agent 是否在子任务返回或超时后执行了 4.1.5 规定的兜底 cleanup（检查 `_bmad-output/current_pytest_session_pid.txt`，若存在则执行 `cleanup_test_processes.py --only-from-file --session-pid` 并删除该文件）；若未执行且子任务涉及 pytest，结论为未通过。

验证方式：阅读代码、grep 关键符号、**执行 §7 或文档规定的验收/回归命令并获取完整通过/失败列表**；若存在失败，**核对正式排除清单（若有）并确认每项符合「正式排除」规定**；运行 pytest 等验收命令、核对 §7 验收；**对审计项⑦**：`grep -E "\[TDD-(RED|GREEN|REFACTOR)\]" progress.*.txt` 或目视检查 progress 是否含每任务的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录；**对审计项⑪**：若 §7 或验收涉及 pytest，确认主 Agent 在子任务返回后执行了兜底 cleanup。

报告结尾必须按以下格式输出：结论：通过 / 未通过。必达子项 1–11 如上；⑪ 主 Agent 兜底 cleanup（若涉及 pytest）；若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议。
```

### 4.3 主 Agent 禁止事项

- 禁止直接对生产代码执行编辑操作
- 必须将实施任务委托给子代理
- 若子代理返回不完整，可发起二次子任务，**不得**替代子代理直接改代码

---

## 使用示例

以下示例中，主 Agent 在发起子任务时**必须**使用本 skill 内该阶段的完整 prompt 模板并填入占位符，不得省略或概括。

### 示例 1：全新 BUG 报告

用户：「多周期图表主图右键看不到「从图表同步 GDS」，请分析根因并生成 BUGFIX 文档。」

主 Agent：执行阶段一——将「阶段一根因辩论完整 prompt 模板」整段复制并填入用户描述后，优先通过显式调用 `@"party-mode-facilitator (agent)"` 发起子任务；仅当 facilitator 不可用时才回退到 `general-purpose`。子任务返回后，将「阶段一审计完整 prompt 模板」整段复制后发起审计子任务；迭代至审计通过。

### 示例 2：补充信息后更新

用户：「我补充一下，是重启程序后打开多周期图表才出现。」

主 Agent：执行阶段二——将「阶段二信息补充辩论完整 prompt 模板」整段复制，替换补充信息与 BUGFIX 文档路径后发起子任务；再发起审计（阶段一审计模板），迭代至通过。

### 示例 3：补充任务列表

用户：「为 BUGFIX 文档补充最终任务列表。」

主 Agent：执行阶段三——将「阶段三任务列表补充完整 prompt 模板」整段复制，填入 BUGFIX 文档路径与项目根目录后通过 Agent tool 发起子任务；子代理产出含 §7 的更新文档后，将「阶段三 §7 审计完整 prompt 模板」整段复制后发起审计子任务；若审计未通过，**审计子代理须在本轮内直接修改 BUGFIX 文档**，主 Agent 收到报告后再次发起审计，直至通过。

### 示例 4：实施修复

用户：「按 BUGFIX 文档实施修复。」

主 Agent：执行阶段四——将「阶段四实施详细提示词」整段复制，仅替换 BUGFIX 文档路径与项目根目录后通过 Agent tool（`subagent_type: general-purpose`）发起子任务；实施完成后，将「阶段四实施后审计完整 prompt 模板」整段复制后发起审计子任务；若审计结论为未通过，须按修改建议委托子代理修改后再次发起审计，直至结论为「完全覆盖、验证通过」。禁止直接改生产代码。

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->

