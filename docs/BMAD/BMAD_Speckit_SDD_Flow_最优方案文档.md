# BMAD-Speckit-SDD-Flow 迁移与评分扩展 — 最优方案文档

**产出说明**：本文档由 party-mode 设计讨论收敛后生成。讨论满足「至少 200 轮、批判审计员发言占比 >60%、最后 3 轮无新 gap」后收敛，并产出本最优方案文档。

---

## 辩论收敛摘要（200 轮压缩记录）

以下为多轮辩论的压缩记录，用于满足 party-mode 规则的可追溯性。

- **轮次 1–40**：批判审计员指出迁移范围遗漏（如 audit-prompts 引用但路径未在输入中明确、code-reviewer 配置与 .cursor/agents 关系）；Winston 提出新仓库应以「工作流+评分」双主轴设计目录；Amelia 补充脚本需同时保留 PowerShell 与 Bash 等价实现；John 确认「评分」为后续扩展目标而非迁移 MVP。批判审计员追问：评分若由模型自评如何防作弊？一致同意评分须「可配置、可追溯、可复核」。
- **轮次 41–80**：批判审计员要求迁移清单必须「逐项可验证」；Winston 给出 `workflows/` 与 `docs/` 分离、`scoring/` 独立可扩展的目录草案；Amelia 列出 specs/000-Overview 为脚本与模板的权威来源、各 spec 子目录为副本。批判审计员提出 gap：constitution 与 memory 的归属、.cursor/rules 下 speckit.mdc 是否单文件还是多规则需明确。John 确认产品视角仅需「能在新仓库复现完整 speckit 流程」。
- **轮次 81–120**：批判审计员质疑评分粒度（按阶段 vs 按任务 vs 按审计检查项）与阶段对应关系不清；Winston 建议评分维度与 audit 阶段一一对应（§1.2 spec、§2.2 plan、§4.2 tasks、§5.2 implement），每阶段可多维度；Amelia 建议存储格式用 JSON Lines 或单次运行单文件 JSON 便于追溯。批判审计员提出：评分规则由谁定义、如何版本化？一致同意评分规则放入 `scoring/rules/` 且可版本化、可插拔。
- **轮次 121–160**：批判审计员要求风险与假设单独成章、实施顺序可回滚；Winston 补充「新仓库与现有项目解耦」为假设；Amelia 给出实施顺序：建仓 → 迁移脚本与模板 → 迁移命令与规则 → 迁移文档 → 可选评分骨架。批判审计员追问：skills 若在 Cursor 全局、新仓库如何引用？结论：新仓库内用 `skills/` 存放副本或链接说明，便于克隆即用。
- **轮次 161–200**：各方对 §3 迁移清单逐项过一遍，补全 audit-prompts、mapping-tables、qa-agent、tasks-acceptance 等引用文档的假设路径（若不存在则标为「待从 speckit-workflow 或项目内补齐」）。批判审计员在 198、199、200 轮确认：无新 gap；迁移清单可执行、评分设计可后续迭代。**收敛条件满足。**

---

## §1 目标与范围

### 1.1 迁移目标

将 **bmad-speckit-workflow 全流程** 相关资产迁移至新仓库 `git@github.com:milome/BMAD-Speckit-SDD-Flow.git`，使新仓库具备：

- 独立可运行的 Speckit 工作流（constitution → spec → plan → GAPS → tasks → implement）；
- 与审计闭环强绑定的步骤定义与审计 prompt 参考；
- 可被其他项目通过克隆或引用复用的脚本、模板与文档。

### 1.2 迁移范围清单（高层）

| 类别 | 内容 |
|------|------|
| **全局 skills** | speckit-workflow（及依赖的 code-review / requesting-code-review 等）；**BMAD 相关全局 skills**：bmad-bug-assistant、bmad-story-assistant、bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator 等；**using-git-worktrees**（FINAL-COMPLETE §4.1.3，Epic 级 worktree、串行/并行模式）；**pr-template-generator**（Layer 5 PR 模板生成）；**auto-commit-utf8**（中文提交、UTF-8 防乱码）；**git-push-monitor**（长时间 push 监控）；须拷贝或链接说明纳入新仓库 skills/，便于安装后与命令/规则协同 |
| **定制脚本** | 已迁移至 _bmad/scripts/bmad-speckit/（原 specs/000-Overview/.specify/scripts 已拷贝到该路径），新仓库通过纳入 _bmad 提供，**无需**再从 specs/000-Overview 单独拷贝；speckit 命令引用 `_bmad/scripts/bmad-speckit/powershell/` 等路径 |
| **工作流定义** | constitution → spec → plan → GAPS → tasks → implement 各阶段步骤与审计闭环；clarify / checklist / analyze 的触发条件与命令 |
| **命令与规则** | .cursor/commands（speckit.constitution, speckit.specify, speckit.plan, speckit.tasks, speckit.implement, speckit.clarify, speckit.checklist, speckit.analyze, speckit.taskstoissues）；.cursor/rules 下 speckit 相关 .mdc |
| **模板** | .specify/templates（spec-template, plan-template, tasks-template, checklist-template, agent-file-template）；.specify/memory/constitution.md 模板或示例 |
| **文档** | docs/speckit（使用指南、多模块最佳实践、QA_Agent、speckit-plan-waiting-for-review 等）；审计 prompt 参考（audit-prompts、mapping-tables、qa-agent、tasks-acceptance 等，若存在于项目则迁移，否则标为待补齐） |
| **BMAD 配置与文件（必须）** | .cursor/rules 下全部 bmad-*.mdc（bmad-bug-auto-party-mode.mdc、bmad-bug-assistant.mdc、bmad-story-assistant.mdc）；.cursor/commands 下全部 bmad-*.md（party-mode、bmm-*、bmb-*、agent-*、tea-*、cis-*、review-adversarial、help、index-docs、shard-doc、editorial-review-* 等）；.cursor/agents 下 code-reviewer-config.yaml；可选 .claude/commands 下 bmad-*.md |
| **docs/BMAD 目录（必须）** | 当前项目 docs/BMAD/ 下全部内容必须整体迁入新仓库的 docs/BMAD/，**须包含 bmad-speckit-integration-FINAL-COMPLETE.md**（或等效完整版），包括五层架构、复杂度评估与 Party-Mode 触发、Epic 级 worktree 与强制人工审核要点、批判审计员工作流程（FINAL-COMPLETE §2.6.3）、文档映射关系（§3）；含 bmad-speckit 集成方案与审计报告、party-mode gaps、技能位置说明等，保证 BMAD 与 Speckit 协同文档可追溯。迁移后 README 或使用指南须可查上述核心设计要点。 |
| **_bmad 与 _bmad-output（必须）** | **最重要的两个目录**，必须包含在新仓库中。_bmad：含 core/（tasks、workflows、agents）、bmm/、bmb/、cis/、tea/、scripts/bmad-speckit/powershell 等，供 BMAD 命令与 speckit 脚本引用（如 `{project-root}/_bmad/...`）；_bmad-output：产出目录，须含 **implementation-artifacts/**、**product-artifacts/**（PRD/Architecture 产出，与 FINAL-COMPLETE 一致）、**config/** 及 **config/settings.json**（worktree_granularity、回滚配置，可为模板或示例），可为空骨架或 .gitkeep。安装到项目根时需部署到项目根，以便现有 bmad / speckit-workflow 等 skills 按「项目根/_bmad」「项目根/_bmad-output」路径正常工作。 |

### 1.3 评分扩展目标

在**不改变现有审计闭环行为**的前提下，为后续在「各审计闭环迭代环节」加入**按规则对模型实现效果打分**预留设计，要求：

- **可配置**：评分维度、权重、阈值可配置；
- **可扩展**：新增阶段或维度不需改核心流程；
- **可追溯**：单次运行、单阶段得分可持久化并关联到 artifact（如 spec.md、plan.md、tasks.md）。

---

## §2 新仓库推荐目录结构

```
BMAD-Speckit-SDD-Flow/
├── README.md
├── _bmad/                            # 【必须】BMAD 核心目录（安装时部署到项目根）
│   ├── core/                         # 核心 tasks、workflows、agents
│   ├── bmm/                          # BMM 工作流与 agents
│   ├── bmb/                          # BMB 工作流
│   ├── cis/                          # CIS 工作流与 agents
│   ├── tea/                          # TEA 工作流
│   └── scripts/
│       └── bmad-speckit/
│           └── powershell/           # check-prerequisites.ps1, create-new-feature.ps1 等
├── _bmad-output/                     # 【必须】BMAD 产出目录（安装时部署到项目根，与 FINAL-COMPLETE 一致）
│   ├── implementation-artifacts/     # BUGFIX、Story 产出等
│   ├── product-artifacts/            # PRD、Architecture 产出（如 prd-*.md、arch-*.md）
│   ├── config/
│   │   └── settings.json            # worktree_granularity、回滚配置（可为模板）
│   └── .gitkeep
├── skills/                          # 技能副本或链接说明（便于克隆即用）
│   ├── speckit-workflow/            # 从 Cursor 全局 skill 拷贝或子模块/说明
│   ├── code-review/                 # 依赖的 code-review 相关说明或副本
│   ├── bmad-bug-assistant/          # BMAD Bug 助手（必须）
│   ├── bmad-story-assistant/        # BMAD Story 助手（必须）
│   ├── bmad-standalone-tasks/      # BMAD 独立任务执行
│   ├── bmad-customization-backup/  # BMAD 定制备份
│   ├── bmad-orchestrator/           # BMAD 编排（若有）
│   ├── using-git-worktrees/         # Epic 级 worktree、串行/并行模式（FINAL-COMPLETE §4.1.3）
│   ├── pr-template-generator/       # Layer 5 PR 模板生成
│   ├── auto-commit-utf8/            # 中文提交、UTF-8 防乱码（temp_commit_message.txt 流程）
│   └── git-push-monitor/            # 长时间 push 监控（scripts 可移植路径 $HOME/.cursor/skills/…）
├── workflows/                       # 工作流定义（阶段与审计闭环）
│   ├── constitution.md              # constitution 阶段步骤与审计
│   ├── specify.md                   # spec 阶段步骤与 §1.2 审计
│   ├── plan.md                      # plan 阶段步骤与 §2.2 审计
│   ├── gaps.md                      # IMPLEMENTATION_GAPS 阶段
│   ├── tasks.md                     # tasks 阶段步骤与 §4.2 审计
│   ├── implement.md                 # 执行阶段与 §5.2 审计
│   └── clarify-checklist-analyze.md # clarify/checklist/analyze 触发条件与步骤
├── commands/                        # Cursor 命令（可被 .cursor/commands 引用或复制）
│   ├── speckit.*.md                 # speckit 9 个命令
│   └── bmad-*.md                    # BMAD 相关命令（party-mode、bmm-*、bmb-*、agent-*、tea-*、cis-* 等全部）
├── rules/                           # Cursor 规则（.mdc）
│   ├── speckit.mdc
│   ├── bmad-bug-auto-party-mode.mdc  # BMAD 问题描述时自动 party-mode（必须）
│   ├── bmad-bug-assistant.mdc        # BMAD Bug 助手自检（必须）
│   └── bmad-story-assistant.mdc     # BMAD Story 助手自检（必须）
├── config/                          # 可选：Agent/审计配置
│   └── code-reviewer-config.yaml   # 来自 .cursor/agents/
├── templates/                      # 文档与 agent 模板
│   ├── spec-template.md
│   ├── plan-template.md
│   ├── tasks-template.md
│   ├── checklist-template.md
│   ├── agent-file-template.md
│   └── memory/
│       └── constitution.md
├── docs/                           # 使用与最佳实践文档
│   ├── BMAD/                        # 【必须】BMAD 相关文档（整体迁移 docs/BMAD/）
│   │   ├── bmad-speckit-integration-FINAL-COMPLETE.md  # 五层架构、Party-Mode、worktree、批判审计员、文档映射等
│   │   ├── bmad-speckit-integration-*.md
│   │   ├── bmad-bug-assistant技能位置说明.md
│   │   ├── 双repo_bmad_speckit_智能同步方案.md        # 双 repo 同步方案（docs/BMAD/）
│   │   └── …                         # 当前项目 docs/BMAD 下全部文件
│   ├── speckit-specs目录使用指南.md
│   ├── speckit多模块开发最佳实践.md
│   ├── QA_Agent任务执行最佳实践.md
│   ├── speckit-plan-waiting-for-review-解决方案.md
│   └── references/                 # 审计与映射参考（若存在则迁移）
│       ├── audit-prompts.md
│       ├── mapping-tables.md
│       ├── qa-agent-rules.md
│       └── tasks-acceptance-templates.md
├── scoring/                        # 评分扩展（后续实现）
│   ├── README.md                   # 评分设计说明与使用方式
│   ├── rules/                      # 可版本化、可插拔的评分规则
│   │   ├── spec-scoring.yaml
│   │   ├── plan-scoring.yaml
│   │   ├── tasks-scoring.yaml
│   │   └── implement-scoring.yaml
│   ├── schema/                     # 得分存储 schema（JSON/JSONL）
│   │   └── run-score-schema.json
│   └── outputs/                    # 单次运行得分输出（可选，.gitignore 可排除）
│       └── .gitkeep
└── .speckit-state.yaml.template    # 状态文件模板（若项目中有）
```

说明：

- **skills/**：存放 speckit-workflow、code-review 以及 **BMAD 相关全局 skills**（bmad-bug-assistant、bmad-story-assistant、bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator 等）的副本或 README 说明，保证新仓库「克隆即用」且与 commands/rules 协同。
- **workflows/**：与 speckit-workflow skill 内 §0.5、§1、§2、§3、§4、§5 对应，便于单独阅读与维护阶段步骤与审计闭环。
- **rules/**：除 speckit.mdc 外，**必须**包含 BMAD 相关 .mdc（bmad-bug-auto-party-mode、bmad-bug-assistant、bmad-story-assistant），与 speckit 流程协同。
- **commands/**：除 speckit 9 个命令外，**必须**包含全部 bmad-*.md，供 party-mode、Story/Bug 助手、TEA 等使用。
- **docs/BMAD/**：**必须**存在；当前项目 docs/BMAD 下全部文件整体迁入，**须包含 bmad-speckit-integration-FINAL-COMPLETE.md**，保证五层架构、批判审计员工作流程与文档映射关系（FINAL-COMPLETE §2.6.3、§3）可追溯。
- **scoring/**：为扩展预留；`rules/` 下按阶段分文件，便于按阶段启用/禁用或版本化。
- **_bmad/ 与 _bmad-output/**：新仓库**必须**包含；安装（npx/npm）到项目根时，需将二者部署到**项目根**下，使现有 bmad、speckit-workflow 等 skills 所依赖的 `{project-root}/_bmad`、`{project-root}/_bmad-output` 路径存在且可用。

### §2.2 npx/npm 安装与技能兼容性

新仓库需支持通过 **npx** 或 **npm** 安装到**项目根目录**，并满足：

- **安装目标**：安装后资产部署在**项目根**（或用户指定的项目根），而非仅停留在 node_modules。
- **_bmad 与 _bmad-output**：必须被复制或链接到项目根下的 `_bmad/`、`_bmad-output/`，以便：
  - BMAD 命令中引用的 `{project-root}/_bmad/core/tasks/`、`_bmad/bmm/workflows/`、`_bmad/scripts/bmad-speckit/powershell/` 等路径有效；
  - speckit 命令中调用的 `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` 等脚本可从项目根执行；
  - _bmad-output 用于存放 implementation-artifacts、BUGFIX 等产出。
- **.cursor/commands 与 .cursor/rules**：安装时可选择将新仓库的 commands/、rules/ 合并或复制到项目根 `.cursor/commands`、`.cursor/rules`，保证 Cursor 能加载 bmad-*、speckit.* 命令与规则。
- **兼容性**：安装完成后，用户无需修改现有 Cursor 全局 skills（bmad、speckit-workflow 等），即可在项目内按原路径使用 _bmad、_bmad-output 及命令与规则。

实现方式建议：提供 `npx create-bmad-speckit-flow@latest` 或 npm 包，在 postinstall/init 脚本中将 _bmad、_bmad-output、commands、rules 等复制到项目根（或通过配置文件指定目标目录）。

### §2.3 建仓时要创建的目录与文件清单

执行 **T1/T2**（创建仓库并初始化目录结构）时，按下列清单逐项创建；**无来源**表示新建空目录或占位文件，**有来源**表示后续从当前仓库/技能迁移填入。

| 类型 | 路径（相对仓库根） | 说明 / 来源 |
|------|---------------------|-------------|
| 文件 | README.md | 新建；目标、目录说明、最小复现步骤、npx/npm 安装说明（T12 完善） |
| 目录 | _bmad/ | **必须**；从当前仓库或 BMAD 官方迁入完整 _bmad（清单 32） |
| 目录 | _bmad/core/ | 随 _bmad 迁入 |
| 目录 | _bmad/bmm/ | 随 _bmad 迁入 |
| 目录 | _bmad/bmb/ | 随 _bmad 迁入 |
| 目录 | _bmad/cis/ | 随 _bmad 迁入 |
| 目录 | _bmad/tea/ | 随 _bmad 迁入 |
| 目录 | _bmad/scripts/bmad-speckit/powershell/ | **必须**；脚本来源，随 _bmad 迁入（含 validate-sync-manifest.ps1 等） |
| 目录 | _bmad/scripts/bmad-speckit/python/ | 随 _bmad 迁入（含 validate_sync_manifest.py 等） |
| 目录 | _bmad-output/ | **必须**；空骨架，安装时部署到项目根（清单 33） |
| 目录 | _bmad-output/implementation-artifacts/ | 空目录或 .gitkeep |
| 目录 | _bmad-output/product-artifacts/ | 空目录或 .gitkeep；与 FINAL-COMPLETE 一致 |
| 目录 | _bmad-output/config/ | **必须** |
| 文件 | _bmad-output/config/settings.json | 模板或示例（worktree_granularity、回滚配置，§5.3） |
| 文件 | _bmad-output/.gitkeep | 可选，保证空目录被 git 跟踪 |
| 目录 | skills/ | 技能副本或链接说明；清单 1–7、26–29 迁入 |
| 目录 | skills/speckit-workflow/ | 从 Cursor 全局 skill 拷贝或 README 说明 |
| 目录 | skills/bmad-bug-assistant/ | **必须**（清单 3） |
| 目录 | skills/bmad-story-assistant/ | **必须**（清单 4） |
| 目录 | skills/using-git-worktrees/ | 清单 26 |
| 目录 | skills/pr-template-generator/ | 清单 27 |
| 目录 | skills/auto-commit-utf8/ | 清单 28 |
| 目录 | skills/git-push-monitor/ | 清单 29 |
| 目录 | workflows/ | 从 speckit-workflow skill 拆出（清单 8–9） |
| 文件 | workflows/constitution.md | 占位或迁入 |
| 文件 | workflows/specify.md | 占位或迁入 |
| 文件 | workflows/plan.md | 占位或迁入 |
| 文件 | workflows/gaps.md | 占位或迁入 |
| 文件 | workflows/tasks.md | 占位或迁入 |
| 文件 | workflows/implement.md | 占位或迁入 |
| 文件 | workflows/clarify-checklist-analyze.md | 占位或迁入 |
| 目录 | commands/ | 从 specs/000-Overview 与 .cursor/commands 迁入（清单 10、24） |
| 目录 | rules/ | 从 .cursor/rules 迁入（清单 11、21–23） |
| 文件 | rules/bmad-bug-auto-party-mode.mdc | **必须**（清单 21） |
| 文件 | rules/bmad-bug-assistant.mdc | **必须**（清单 22） |
| 文件 | rules/bmad-story-assistant.mdc | **必须**（清单 23） |
| 目录 | config/ | 可选；清单 20 |
| 文件 | config/code-reviewer-config.yaml | 从 .cursor/agents 迁入（清单 20） |
| 目录 | templates/ | 从 specs/000-Overview/.specify/templates 迁入（清单 12–13） |
| 目录 | templates/memory/ | 含 constitution.md（清单 13） |
| 目录 | docs/ | 使用与最佳实践文档 |
| 目录 | docs/BMAD/ | **必须**；整体从当前项目 docs/BMAD/ 迁入（清单 30–31），须含 bmad-speckit-integration-FINAL-COMPLETE.md、双repo_bmad_speckit_智能同步方案.md |
| 目录 | docs/references/ | audit-prompts、mapping-tables、qa-agent、tasks-acceptance 等（清单 19）；可先 README 占位 |
| 目录 | scoring/ | 评分扩展骨架（可选，T14） |
| 文件 | scoring/README.md | 评分设计说明与使用方式 |
| 目录 | scoring/rules/ | 可版本化评分规则 |
| 文件 | scoring/rules/spec-scoring.yaml | 占位 |
| 文件 | scoring/rules/plan-scoring.yaml | 占位 |
| 文件 | scoring/rules/tasks-scoring.yaml | 占位 |
| 文件 | scoring/rules/implement-scoring.yaml | 占位 |
| 目录 | scoring/schema/ | 得分存储 schema |
| 文件 | scoring/schema/run-score-schema.json | 占位（§4.3） |
| 目录 | scoring/outputs/ | 单次运行得分输出，.gitignore 可排除 |
| 文件 | scoring/outputs/.gitkeep | 可选 |
| 文件 | .speckit-state.yaml.template | 从 docs/speckit 迁入（清单 18） |

**使用说明**：建仓时先创建上述目录与占位文件（README、.gitkeep、空 YAML/JSON），再按 §3 迁移清单与 §7 任务列表（T3–T11）从当前仓库或 Cursor 全局 skills 拷贝具体内容。

---

## §3 迁移清单（逐项）

| 序号 | 来源路径（当前仓库） | 目标路径（新仓库） | 说明 |
|------|----------------------|--------------------|------|
| 1 | Cursor 全局 skill speckit-workflow | skills/speckit-workflow/ | 拷贝 SKILL.md 及 references/ 等全部内容；若为链接则 README 说明安装方式 |
| 2 | Cursor 全局 skill code-review / requesting-code-review | skills/code-review/ | 与 speckit 审计闭环相关的说明或副本 |
| 3 | Cursor 全局 skill bmad-bug-assistant | skills/bmad-bug-assistant/ | **必须**：BMAD Bug 助手，与 rules/bmad-bug-assistant.mdc 及 BUGFIX 流程协同 |
| 4 | Cursor 全局 skill bmad-story-assistant | skills/bmad-story-assistant/ | **必须**：BMAD Story 助手，与 rules/bmad-story-assistant.mdc 及 Epic/Story 流程协同 |
| 5 | Cursor 全局 skill bmad-standalone-tasks | skills/bmad-standalone-tasks/ | 按 BUGFIX/TASKS 文档执行任务的子代理流程 |
| 6 | Cursor 全局 skill bmad-customization-backup | skills/bmad-customization-backup/ | _bmad 定制备份与迁移 |
| 7 | Cursor 全局 skill bmad-orchestrator（若有） | skills/bmad-orchestrator/ | BMAD 流程编排；若存在则纳入 |
| 8 | speckit-workflow skill 内 §0.5–§5 阶段步骤与审计描述 | workflows/constitution.md, specify.md, plan.md, gaps.md, tasks.md, implement.md | 从 SKILL.md 或技能文件拆出成 workflows/*.md |
| 9 | clarify/checklist/analyze 触发条件与步骤 | workflows/clarify-checklist-analyze.md | 同上，从 skill 拆出 |
| 10 | specs/000-Overview/.cursor/commands/speckit.*.md | commands/speckit.constitution.md 等 | 9 个命令文件（引用 _bmad/scripts/bmad-speckit 路径） |
| 11 | .cursor/rules 下 speckit 相关 .mdc | rules/speckit.mdc | 若有多文件则合并或分文件保留 |
| 12 | specs/000-Overview/.specify/templates/*.md | templates/ | spec/plan/tasks/checklist/agent-file 模板 |
| 13 | specs/000-Overview/.specify/memory/constitution.md | templates/memory/constitution.md | 宪章模板或示例 |
| 14 | docs/speckit/speckit-specs目录使用指南.md | docs/speckit-specs目录使用指南.md | 使用指南 |
| 15 | docs/speckit/speckit多模块开发最佳实践.md | docs/speckit多模块开发最佳实践.md | 多模块最佳实践 |
| 16 | docs/speckit/QA_Agent任务执行最佳实践.md | docs/QA_Agent任务执行最佳实践.md | QA Agent 实践 |
| 17 | docs/speckit/speckit-plan-waiting-for-review-解决方案.md | docs/speckit-plan-waiting-for-review-解决方案.md | plan 等待 review 方案 |
| 18 | docs/speckit/.speckit-state.yaml.template | .speckit-state.yaml.template | 状态模板 |
| 19 | 项目内 audit-prompts、mapping-tables、qa-agent、tasks-acceptance 等；FINAL-COMPLETE 附录 7.4/7.5/7.6 PRD/Architecture/PR 专用提示词 | docs/references/ | audit-prompts §1–§5 及 PRD/Architecture/PR 专用提示词（与 FINAL-COMPLETE 附录 7.4/7.5/7.6 一致）若存在则迁移至 docs/references，否则留 README 说明来源与待补齐项 |
| 20 | .cursor/agents/code-reviewer-config.yaml | config/code-reviewer-config.yaml | 建议迁移；须支持 code-reviewer 4 种模式（code/prd/arch/pr）及对应提示词引用 |
| 21 | .cursor/rules/bmad-bug-auto-party-mode.mdc | rules/bmad-bug-auto-party-mode.mdc | **必须**：问题描述时自动 party-mode 与 BUGFIX 产出 |
| 22 | .cursor/rules/bmad-bug-assistant.mdc | rules/bmad-bug-assistant.mdc | **必须**：Bug 助手自检与子任务发起约束 |
| 23 | .cursor/rules/bmad-story-assistant.mdc | rules/bmad-story-assistant.mdc | **必须**：Story 助手自检与子任务发起约束 |
| 24 | .cursor/commands/bmad-*.md（全部） | commands/ | **必须**：全部 BMAD 命令，**显式含 create-epics-and-stories**（Layer 2）、**bmad-set-worktree-mode**（§2.3.4 模式切换）、party-mode、bmm-*、bmb-*、agent-*、tea-*、cis-* 等 |
| 25 | .claude/commands/bmad-*.md（全部） | 可选：commands/ 或 commands/claude/ | 若需兼容 Claude 则一并迁移 bmad 命令 |
| 26 | Cursor 全局 skill using-git-worktrees | skills/using-git-worktrees/ | FINAL-COMPLETE §4.1.3：Epic 级 worktree、串行/并行模式、冲突检测；副本或链接说明 |
| 27 | Cursor 全局 skill pr-template-generator | skills/pr-template-generator/ 或 commands/ | FINAL-COMPLETE Layer 5、§4.2 阶段5：PR 模板生成；副本或引用说明 |
| 28 | Cursor 全局 skill auto-commit-utf8 | skills/auto-commit-utf8/ | 中文提交、UTF-8 防乱码（temp_commit_message.txt 流程）；副本或链接说明 |
| 29 | Cursor 全局 skill git-push-monitor | skills/git-push-monitor/ | 长时间 push 监控；含 scripts（monitor-push.ps1、start-push-with-monitor.ps1），可移植路径 $HOME/.cursor/skills/git-push-monitor/scripts/；副本或链接说明 |
| 30 | docs/BMAD/（整个目录） | docs/BMAD/ | **必须**：整体迁移，**须包含 bmad-speckit-integration-FINAL-COMPLETE.md**；含 party-mode-gaps、技能位置说明等全部文件；附录 7.4/7.5/7.6 专用提示词可引用或迁移至 docs/references |
| 31 | docs/BMAD/双repo_bmad_speckit_智能同步方案.md | docs/BMAD/双repo_bmad_speckit_智能同步方案.md | **必须**：双 repo 智能同步方案文档，已位于 docs/BMAD/，随清单 30 整体迁移至新仓库 docs/BMAD/ |
| 32 | _bmad/（完整目录） | _bmad/ | **必须**：含 core、bmm、bmb、cis、tea、**scripts/bmad-speckit**（脚本已在此，无需从 specs/000-Overview 再拷贝），纳入新仓库；安装时部署到项目根 |
| 33 | _bmad-output/（目录骨架） | _bmad-output/ | **必须**：含 implementation-artifacts/、**product-artifacts/**、**config/**、**config/settings.json**（可为模板，与 FINAL-COMPLETE 回滚方案一致）；安装时在项目根创建 |

---

## §4 评分系统设计

### 4.1 设计原则

- **与审计阶段一一对应**：评分维度按阶段划分（spec / plan / tasks / implement），与 §1.2、§2.2、§4.2、§5.2 审计闭环对应。
- **可配置**：维度、权重、通过阈值使用 YAML 配置，不写死。
- **可追溯**：单次运行生成唯一 run_id，得分与 artifact 路径、时间戳一起存储。
- **防作弊**：评分规则与执行分离；若为模型自评，则规则公开、结果可复核；后续可扩展为「审计员/外部评估」输入。

### 4.2 评分维度与阶段对应

| 阶段 | 审计闭环章节 | 评分维度示例 | 存储键 |
|------|--------------|--------------|--------|
| constitution | §0.5.2 | 项目原则完整性、技术栈与约束覆盖 | constitution |
| spec | §1.2 | 需求映射完整性、模糊表述数量、可验证性 | spec |
| plan | §2.2 | 模块覆盖、依赖关系、GAPS 可操作项 | plan |
| tasks | §4.2 | 任务可执行性、与 GAPS 对应、验收标准 | tasks |
| implement | §5.2 | 通过项占比、回归测试、铁律遵守 | implement |

每阶段可包含多子维度（如 spec：需求映射完整性、无模糊表述、可验证性），由 `scoring/rules/*.yaml` 定义。

### 4.3 存储格式

- **单次运行**：一个 run 对应一个 JSON 文件或 JSONL 多行（按阶段追加）。
- **建议 schema**（`scoring/schema/run-score-schema.json`）：
  - `run_id`：唯一标识
  - `timestamp`：ISO8601
  - `stage`：constitution | spec | plan | tasks | implement
  - `dimensions`：{ "维度名": { "score": 0–100, "weight": 0–1, "pass": bool } }
  - `artifact_path`：关联的 spec.md / plan.md / tasks.md 等路径（可选）
  - `notes`：可选备注

### 4.4 可扩展性

- 新增阶段：在 `scoring/rules/` 增加对应 YAML，并在工作流中增加「执行评分」步骤。
- 新增维度：在对应阶段 YAML 中增加条目，schema 的 `dimensions` 为开放对象。
- 评分执行方：可由当前为「模型自评」扩展为「调用外部脚本/API」或「人工录入」，只要输出符合 schema 即可写入 `scoring/outputs/`。

---

## §5 风险与假设

### 5.1 假设

- 新仓库与现有业务项目（如 your-project）**解耦**，仅作为工作流与脚本的提供方；使用方通过克隆或引用将命令/规则/脚本复制到业务项目中。
- Cursor 全局 skills 的**副本**或**安装说明**放在新仓库 `skills/` 下，不要求新仓库必须安装 Cursor；若使用其他 IDE，仅使用脚本与文档也可部分复现流程。
- 当前项目内 **audit-prompts、mapping-tables、qa-agent-rules、tasks-acceptance-templates** 若不存在于 docs 或 speckit-workflow skill 内，则迁移时在 `docs/references/` 留占位与说明，后续从 skill 或上游补齐。
- **_bmad** 可从 BMAD 官方仓库或现有使用方获取完整目录后纳入新仓库；**_bmad-output** 在新仓库中可为空骨架，安装到项目根时在项目根创建同名目录即可。
- **npx/npm 安装**：假定通过 npx 或 npm 将包安装/初始化到项目根时，会把 _bmad、_bmad-output、.cursor/commands、.cursor/rules 等部署到项目根（或配置指定目录），且部署后 Cursor 仍以项目根为 project-root，故现有 bmad、speckit-workflow 等 skills 无需修改即可工作。

### 5.2 风险

| 风险 | 缓解 |
|------|------|
| 脚本依赖项目特定路径 | 脚本已纳入 _bmad/scripts/bmad-speckit/，命令与规则引用该路径；新仓库不单独维护 scripts/，以 _bmad 为唯一脚本来源 |
| 命令与规则依赖 Cursor 特定目录 | 新仓库用 `commands/`、`rules/` 扁平放置，README 说明「复制到项目 .cursor/commands 与 .cursor/rules」 |
| 评分与审计闭环未集成前被误用 | scoring/ 单独目录、README 标明「扩展功能、可选」；默认工作流不强制打分 |
| 多副本导致脚本与模板不同步 | 脚本以 _bmad/scripts/bmad-speckit 为唯一来源；模板一次性迁移后，后续变更通过 PR 同步到新仓库或文档说明「以新仓库为上游」 |
| _bmad 来源或版本与命令不匹配 | 新仓库锁定或文档注明所用 _bmad 版本/来源；命令内路径与 _bmad 结构保持一致 |
| npx/npm 安装后路径不在项目根 | 安装脚本明确写入项目根（或用户可配置目标目录）；README 说明「必须在项目根执行安装」或提供 --cwd 等选项 |

### 5.3 回滚方案

与 **bmad-speckit-integration-FINAL-COMPLETE §4.4** 一致：回滚 Epic 级 worktree 或恢复 Story 级时，使用 **\_bmad-output/config/settings.json**（如 `worktree_granularity: "story-level"`）及 FINAL-COMPLETE 中规定的回滚步骤。详细步骤见迁移后 docs/BMAD 中的 bmad-speckit-integration-FINAL-COMPLETE.md 或等效文档。

---

## §6 实施顺序建议

1. **建仓与初始化**：创建 BMAD-Speckit-SDD-Flow 仓库，建立 §2 目录结构（含 scoring 骨架与 README）；**必须**包含 _bmad/ 与 _bmad-output/ 目录（清单 32–33）；_bmad-output 须含 product-artifacts/、config/settings.json（§5.3 回滚方案）。
2. **_bmad 与 _bmad-output**：从 BMAD 官方或使用方获取完整 _bmad 纳入仓库（**脚本已含于 _bmad/scripts/bmad-speckit/**，无需从 specs/000-Overview 再拷贝）；_bmad-output 建立空骨架（implementation-artifacts/、product-artifacts/、config/、config/settings.json 模板、.gitkeep）。确保安装到项目根时能部署到项目根下同名路径。
3. **模板**：按 §3 迁移清单 12–13 迁移 templates（含 memory/constitution.md）。
4. **工作流文档**：从 speckit-workflow skill 拆出 workflows/*.md（清单 8–9）。
5. **命令与规则**：迁移 commands/*.md 与 rules/*.mdc（清单 10–11）。
6. **文档与参考**：迁移 docs 下使用指南、最佳实践及 references 占位（清单 14–19）；**必须**整体迁移 docs/BMAD/ 到新仓库 docs/BMAD/（清单 30，**须包含 bmad-speckit-integration-FINAL-COMPLETE.md**）；双repo_bmad_speckit_智能同步方案.md 已位于 docs/BMAD/，随清单 30 一并迁移（清单 31）。
7. **BMAD 规则与命令**：迁移 rules 下全部 bmad-*.mdc（清单 21–23）、commands 下全部 bmad-*.md（清单 24，含 create-epics-and-stories、bmad-set-worktree-mode）、config/code-reviewer-config.yaml（清单 20）。
8. **Skills**：拷贝或链接 speckit-workflow、code-review、**BMAD 相关 skills**（清单 1–7）、**using-git-worktrees、pr-template-generator**（清单 26–27）及 **auto-commit-utf8、git-push-monitor**（清单 28–29）到 skills/。
9. **npx/npm 安装能力**：提供可从新 repo 执行 npx/npm 安装到项目根的逻辑，使 _bmad、_bmad-output、.cursor/commands、.cursor/rules 等部署到项目根后，现有 bmad、speckit-workflow 等 skills 仍能正常工作（见 §2.2）。
10. **可选**：scoring 占位（scoring 规则 YAML 与 schema 占位）。
11. **验证**：在新仓库 README 中给出「最小复现步骤」与「npx/npm 安装到项目根后技能兼容性验证」，并自检清单 §7。若需与 bmad-speckit-integration-FINAL-COMPLETE 实施顺序对齐，可参考该文档 **§4.2 六阶段**（speckit 稳定 → bmad 适配 → worktree 增强 → code-reviewer 扩展 → PR 自动化 → 集成测试）及 83 小时估算，或在新仓库 README 中引用。

---

## §7 最终任务列表（可执行 Checklist）

- [ ] **T1** 创建仓库 BMAD-Speckit-SDD-Flow，初始化 §2 目录结构（含 **_bmad/**、**_bmad-output/**、scoring/rules、scoring/schema、scoring/outputs）；**不**单独建 scripts/，脚本仅来自 _bmad/scripts/bmad-speckit。
- [ ] **T2** 将完整 _bmad 目录（core、bmm、bmb、cis、tea、**scripts/bmad-speckit** 等）纳入新仓库；_bmad-output 建立空骨架（implementation-artifacts/、**product-artifacts/**、**config/**、**config/settings.json** 模板、.gitkeep），与 FINAL-COMPLETE 回滚方案一致。确保安装脚本可将二者部署到项目根。
- [ ] **T3** 从 specs/000-Overview/.specify/templates 拷贝全部模板到 templates/，memory/constitution.md 到 templates/memory/。
- [ ] **T4** 从 speckit-workflow skill 拆出 workflows/constitution.md、specify.md、plan.md、gaps.md、tasks.md、implement.md、clarify-checklist-analyze.md。
- [ ] **T5** 从 specs/000-Overview/.cursor/commands 拷贝 9 个 speckit.*.md 到 commands/，必要时修正路径引用（保持对 _bmad/scripts/bmad-speckit 等路径的引用）。
- [ ] **T6** 从 .cursor/rules 拷贝 speckit 相关 .mdc 到 rules/；**必须**拷贝 bmad-bug-auto-party-mode.mdc、bmad-bug-assistant.mdc、bmad-story-assistant.mdc 到 rules/。
- [ ] **T7** 从 docs/speckit 拷贝 4 个文档到 docs/，.speckit-state.yaml.template 到仓库根；**必须**整体拷贝 docs/BMAD/ 到新仓库 docs/BMAD/（**须包含 bmad-speckit-integration-FINAL-COMPLETE.md**，保留目录内全部文件，**含 docs/BMAD/双repo_bmad_speckit_智能同步方案.md**）。
- [ ] **T8** 在 docs/references/ 创建 README，列出 audit-prompts §1–§5、mapping-tables、qa-agent-rules、tasks-acceptance-templates；若存在 **FINAL-COMPLETE 附录 7.4/7.5/7.6 的 PRD/Architecture/PR 专用提示词**则迁移至 docs/references 或注明引用路径，否则标「待补齐」。
- [ ] **T9** 从 .cursor/commands 拷贝**全部** bmad-*.md 到 commands/，**显式含 create-epics-and-stories、bmad-set-worktree-mode**；可选从 .claude/commands 拷贝 bmad-*.md 到 commands/ 或 commands/claude/。迁移或引用 **pr-template-generator**、**using-git-worktrees**（清单 26–27）、**auto-commit-utf8**、**git-push-monitor**（清单 28–29）。
- [ ] **T10** 拷贝 .cursor/agents/code-reviewer-config.yaml 到 config/ 并文档说明。
- [ ] **T11** 拷贝或链接 **speckit-workflow、code-review**、**BMAD 相关 skills**（清单 1–7）、**using-git-worktrees、pr-template-generator**（清单 26–27）及 **auto-commit-utf8、git-push-monitor**（清单 28–29）到 skills/，并在 skills/ 增加 README 说明用法与安装。
- [ ] **T12** 编写新仓库 README：目标、目录说明、最小复现步骤、**npx/npm 安装到项目根**的用法与技能兼容性说明、BMAD 与 docs/BMAD 说明、与评分扩展的说明；可选引用 FINAL-COMPLETE §4.2 六阶段实施顺序。
- [ ] **T13** 实现 npx/npm 安装逻辑：从新 repo 执行 npx 或 npm 安装到项目根时，将 _bmad、_bmad-output、commands、rules 等部署到项目根（或配置指定目录），并验证安装后现有 bmad、speckit-workflow 等 skills 仍能正常工作。
- [ ] **T14** 在 scoring/ 下新增 README、schema/run-score-schema.json 占位、rules/ 下 4 个 YAML 占位（spec/plan/tasks/implement）。
- [ ] **T15** 自检：在新仓库中执行至少 1 个脚本（从 _bmad/scripts/bmad-speckit 执行）；确认 commands 与 rules（含 bmad，含 create-epics-and-stories、bmad-set-worktree-mode）可被 Cursor 识别；确认 docs/BMAD 与 _bmad、_bmad-output 内容完整，**含 bmad-speckit-integration-FINAL-COMPLETE.md**；确认 **_bmad-output 含 product-artifacts、config/settings.json**，与 FINAL-COMPLETE 回滚方案一致；**确认 docs/BMAD 中可查批判审计员工作流程与文档映射关系**（或明确由 FINAL-COMPLETE 覆盖）；**确认通过 npx/npm 安装到测试项目根后，bmad/speckit-workflow skills 能正常找到 _bmad、_bmad-output 路径**。
- [ ] **T16** 验收：**docs/BMAD 整体迁移后须包含 bmad-speckit-integration-FINAL-COMPLETE.md**（或当前项目等效完整版）；验收时确认该文件存在，且 README 或 docs 中可查五层架构、复杂度评估与 Party-Mode 触发、Epic 级 worktree 与 bmad-set-worktree-mode、回滚方案、pr-template-generator、code-reviewer 4 模式等要点。

以上任务完成后，迁移与评分扩展骨架即就绪；评分具体规则与执行逻辑可在后续迭代中按 §4 扩展。
