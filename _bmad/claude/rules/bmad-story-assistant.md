# BMAD Story 助手——自检后发起

当使用 **bmad-story-assistant** 技能且即将通过 **Agent tool** 发起子任务时，必须先完成该阶段「发起前自检清单」全部项并在发起前**输出自检结果**（格式见技能「主 Agent 传递提示词规则」）；禁止在未完成自检或未输出自检结果的情况下发起子任务。

## Party-Mode 决策规则

> Party-mode gate source of truth：`{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md`
> 本规则只定义 Story 场景何时必须进入 party-mode。轮次分级、`designated_challenger_id`、`challenger_ratio > 0.60`、session/meta/snapshot/evidence、恢复与退出门禁都以 core step-02 为准。

### 触发条件

凡涉及代码实现的 Story，**必须**进入 party-mode（至少 100 轮）。

### 例外场景（仅限以下情况可跳过）

1. 用户明确说「跳过 party-mode」或「已通过 party-mode 且审计通过」
2. Story 为纯文档更新，无代码实现
3. Story 为纯配置修改，无业务逻辑变更

### 严格度选择

| 情形 | 阶段二严格度 |
|------|--------------|
| 用户明确跳过 party-mode | strict |
| 用户显式要求 strict | strict |
| 正常完成 party-mode | standard |
| 无产物且无用户确认 | strict |

### 禁止

- 不得以「功能简单」「用户说简单」等理由跳过 party-mode
- 「简单实现」「快速实现」不算明确的「跳过 party-mode」表述
- 不得在无 party-mode 产物时使用 standard

## 审计粒度配置系统

`bmad-story-assistant` 必须支持以下审计粒度模式：

- `full`
- `story`
- `epic`

### 配置来源优先级

按优先级从高到低：

1. 用户输入 / CLI 参数中的 `--audit-granularity=...`
2. 环境变量 `BMAD_AUDIT_GRANULARITY`
3. 项目配置 `_bmad/_config/bmad-story-config.yaml`
4. 默认值 `full`

### Claude Code CLI 运行时调用约束

Claude Code 环境下发起子任务时，执行器分两类：

```text
party-mode 主路径:
tool: Agent tool (native subagent)
显式调用示例: @"party-mode-facilitator (agent)"

非 specialized 执行体:
tool: Agent tool (native subagent)
subagent_type: general-purpose
```

### 阶段路由矩阵

涉及的阶段包括：

- `story_create`
- `story_audit`
- `specify`
- `plan`
- `gaps`
- `tasks`
- `implement`
- `post_audit`
- `epic_create`
- `epic_complete`

### 各模式行为矩阵

| 粒度 | speckit 阶段流程 | 文档生成 | 审计/验证行为 |
|------|------------------|----------|---------------|
| `full` | 完整 specify→plan→GAPS→tasks→implement | 全部生成 | 每阶段完整审计 |
| `story` | 完整 specify→plan→GAPS→tasks→implement | 全部生成 | 中间阶段 basic review，阶段四完整审计 |
| `epic` | 完整 specify→plan→GAPS→tasks→implement | 全部生成 | 仅测试验证，审计责任在 Epic 级 |

#### `full`

- `story_create` / `story_audit` / `specify` / `plan` / `gaps` / `tasks` / `implement` / `post_audit` 全部执行完整审计

#### `story`

- `story_create` / `story_audit` / `post_audit` → 完整审计
- `specify` / `plan` / `gaps` / `tasks` → **文档必须生成** + `validation: basic`
- `implement` → **文档必须生成** + `validation: test_only`

**关键**：`story` 粒度下，speckit 阶段（specify/plan/gaps/tasks）**不能跳过**，必须：
1. 生成对应文档（spec.md, plan.md, GAPS.md, tasks.md）
2. 执行 basic review（非完整审计）
3. 在文档末尾追加 `<!-- BASIC_REVIEW: PASSED (granularity=story) -->`

#### `epic`

- Story 级阶段不执行完整审计
- 中间文档仍需生成
- `implement` 至少保留 `validation: test_only`
- 审计责任转移到 `epic_create` / `epic_complete`

### Basic Review 定义

当 `validation: basic` 时，主 Agent 或子代理必须执行以下检查：

1. **文档存在性**：对应文档已生成
2. **Schema 验证**：包含必要章节（如 spec 的「需求」「范围」「验收标准」）
3. **禁止词检查**：文档不含模糊词（如「可能」「大概」「待定」「TODO」）
4. **完整性检查**：关键信息无缺失

**Basic Review 不需要批判审计员**，仅需主 Agent 或子代理执行上述 4 项检查。

**basic review 通过后**，在文档末尾追加：

```markdown
<!-- BASIC_REVIEW: PASSED (granularity={granularity}, stage={stage}) -->
```

**basic review 失败时**，直接修正文档后重新检查，不发起审计子任务。

### 完整审计定义

「完整审计」指使用 `.claude/skills/speckit-workflow/references/audit-prompts.md` §1–§5 定义的审计流程，包括：

1. **审计提示词**：使用对应阶段的审计提示词（spec/plan/GAPS/tasks/implement）
2. **批判审计员**：必须包含批判审计员段落，发言占比 ≥50%
3. **收敛条件**：
   - `strictness: standard`：单次审计通过即可
   - `strictness: strict`：连续 3 轮无 gap
4. **可解析评分块**：报告末尾必须包含可解析评分块

完整审计通过后，在文档末尾追加：

```markdown
<!-- AUDIT: PASSED by code-reviewer -->
```

完整审计失败时，审计子代理必须直接修改被审文档以消除 gap，修改完成后在报告中注明已修改内容。

### 阶段四补偿检查（story 粒度）

当 `audit_mode: story` 且进入 `post_audit` 阶段时，主 Agent 必须补偿以下检查：

1. **需求覆盖度**：实现是否覆盖 Story 文档所有需求
2. **架构一致性**：实现是否符合 plan 方向（如有 plan 文档）
3. **GAPS 闭环**：已知差距是否已解决（如有 GAPS 文档）
4. **任务完整性**：tasks 列表是否全部完成（如有 tasks 文档）

**补偿检查通过标准**：以上 4 项全部检查通过。任一项未通过则视为补偿检查失败，需修复后重新检查。

**补偿检查通过后**，才能结束 `post_audit` 阶段。

### 发起子任务 prompt 传递要求

主 Agent 在 Claude Code 中通过 Agent tool 发起子任务前，必须把以下配置上下文显式传入子任务提示词：

- `audit_mode`
- `stage`
- `should_audit`
- `validation`

推荐传递格式示例：

```text
配置上下文:
- audit_mode: story
- stage: specify
- should_audit: false
- validation: basic
```

### 验收命令

本规则的正确执行可通过以下方式验证：

#### 配置加载验证

```bash
# 验证配置文件存在
test -f _bmad/_config/bmad-story-config.yaml && echo "PASS: config exists"

# 验证配置加载脚本存在
test -f scripts/bmad-config.ts && echo "PASS: bmad-config.ts exists"
```

#### 行为矩阵验证

| 粒度 | 验证方式 |
|------|----------|
| `full` | 所有阶段文档末尾有 `<!-- AUDIT: PASSED by code-reviewer -->` |
| `story` | story_create/story_audit/post_audit 有 AUDIT 标记；specify/plan/gaps/tasks 有 `<!-- BASIC_REVIEW: PASSED -->` |
| `epic` | Story 级文档仅有 BASIC_REVIEW 或无标记；epic_create/epic_complete 有 AUDIT 标记 |

### 最低文案要求

与 `bmad-story-assistant` 相关的规则与说明文档中，必须能看到以下关键词：

- `--audit-granularity`
- `BMAD_AUDIT_GRANULARITY`
- `Agent tool`
- `party-mode-facilitator`
- `general-purpose`
- `full`
- `story`
- `epic`
- `basic`
- `test_only`
