# PRD 更新建议：spec-kit 按所选 AI 写入对应目录

**议题**：specify-cn / spec-kit 的做法 vs PRD 当前设计  
**产出日期**：2025-03-07  
**Party-Mode**：100 轮，批判审计员 >70%，最后 3 轮无新 gap 收敛  
**参考**：spec-kit (https://github.com/github/spec-kit)、BMAD-METHOD、AGENTS.md

---

## 一、Party-Mode 讨论收敛摘要（100 轮）

### 1.1 核心结论

| 决策项 | 结论 | 依据 |
|--------|------|------|
| **采纳 spec-kit 思路** | ✅ 采纳「按所选 AI 写入对应目录」 | Claude Code 只读 `.claude/`，不读 `.cursor/`；选 Claude 时写入 `.cursor/` 无效 |
| **configTemplate 结构** | 每 AI 定义 `commandsDir`、`rulesDir`、`skillsDir`、`agentsDir`（可选） | spec-kit AGENTS.md 的 Directory 列；部分 AI 用 workflows/prompts/rules 替代 commands |
| **check 验证清单** | 按所选 AI 的 configTemplate 验证对应目录（.cursor/、.claude/、.gemini/ 等） | 选 claude 时验证 .claude/，选 cursor-agent 时验证 .cursor/ |
| **同步步骤** | 从 `_bmad/cursor/`（或 bmadPath）同步到**所选 AI 的 configTemplate 定义的目标目录** | 不再写死 `.cursor/` |

### 1.2 批判审计员主导的 Gap 与修复

| 轮次区间 | 批判审计员质疑 | 收敛结论 |
|----------|----------------|----------|
| 1–15 | PRD §5.10 写死 cursor/commands→.cursor/commands，选 claude 时无效 | 采纳按 AI 映射 |
| 16–30 | §5.12 示例「除写入 .cursor/rules、.vscode/settings 外」误导 | 改为「除写入所选 AI 的 configTemplate 定义的目标外」 |
| 31–45 | 19+ AI 的 configTemplate 未逐一定义 commands/rules/skills 路径 | 产出完整映射表（见 §二） |
| 46–60 | check 仅验证 .cursor/，选 claude 时 .claude/ 未验证 | check 按 selectedAI 验证对应目录 |
| 61–75 | generic、cody、tabnine、q 等 PRD 提及但 spec-kit 未列出的 AI 如何处理 | 需补充或标注「待调研」；generic 用 --ai-commands-dir |
| 76–90 | worktree 共享模式下 bmadPath 的 cursor 子目录是否仍为唯一源 | 保持 _bmad/cursor/ 为统一源，同步时按 configTemplate 映射到各 AI 目录 |
| 91–100 | 最后 3 轮无新 gap | 收敛 |

### 1.3 与 spec-kit、BMAD-METHOD 的差异说明

| 维度 | spec-kit | BMAD-METHOD | 本 PRD 修订后 |
|------|----------|-------------|---------------|
| **目录源** | 模板内按 agent 分目录（.claude/、.cursor/ 等） | 主要 .cursor/、_bmad | _bmad/cursor/ 统一源，按 configTemplate 映射到各 AI 目录 |
| **模板结构** | 每 agent 独立 package（spec-kit-template-claude-sh.zip 等） | 单一模板 + --tools | 单一模板，运行时按 --ai 选择目标目录 |
| **rules 位置** | 部分 agent 用 rules/ 替代 commands/（kilocode、auggie、roo） | .cursor/rules | configTemplate 支持 rulesDir、commandsDir 等差异化 |
| **skills** | --ai-skills 安装到 agent skills 目录 | 未明确 | 与 spec-kit 一致，按 AI 的 skillsDir 发布 |

---

## 二、PRD 更新建议（可直接用于修订）

### 2.1 §5.10 同步步骤 — 完整修订稿

**原稿（问题）**：
> 同步步骤：init 完成后，（1）从 `_bmad`（或 worktree 共享模式下 `bmadPath` 指向目录）的 `cursor/commands` → `.cursor/commands`，`cursor/rules` → `.cursor/rules`，`cursor/config/code-reviewer-config.yaml` → `.cursor/agents/`；（2）从 `_bmad/skills/` 发布到所选 AI 的全局 skill 目录。

**修订稿**：

**同步步骤**：init 完成后，根据所选 AI 的 **configTemplate** 决定目标目录，执行以下同步：

1. **commands / rules / config 同步**  
   从 `_bmad`（或 worktree 共享模式下 `bmadPath` 指向目录）的 `cursor/` 子目录，按 configTemplate 映射到所选 AI 的目标目录：
   - `cursor/commands` → `{configTemplate.commandsDir}`（如 `.cursor/commands`、`.claude/commands`、`.windsurf/workflows` 等）
   - `cursor/rules` → `{configTemplate.rulesDir}`（如 `.cursor/rules`、`.claude/rules`、`.kilocode/rules` 等；若 AI 无 rules 概念则映射到等价位置或跳过）
   - `cursor/config/code-reviewer-config.yaml` → `{configTemplate.agentsDir}` 或 `{configTemplate.configDir}`（如 `.cursor/agents/`、`.claude/agents/` 等；若 AI 不支持则跳过）

2. **skills 发布**  
   从 `_bmad/skills/`（或 bmadPath 的 skills）发布到所选 AI 的 `configTemplate.skillsDir`（如 `~/.cursor/skills/`、`~/.claude/skills/` 等）。若 AI 不支持全局 skill，则在 initLog 的 `skippedReasons` 中记录并跳过。

**原则**：**按所选 AI 写入对应目录**，不统一写入 `.cursor/`。Claude Code 只读 `.claude/`，Cursor 只读 `.cursor/`，选 Claude 时写入 `.cursor/` 无效。

---

### 2.2 §5.12 发布目标映射表 — 19+ AI 的 configTemplate

**新增/修订**：以下表格定义每 AI 的 `commandsDir`、`rulesDir`、`skillsDir`、`agentsDir`（或等价字段）。路径为项目根相对路径（如 `.cursor/commands`）或用户主目录相对路径（如 `~/.cursor/skills`）。

| AI id | commandsDir | rulesDir | skillsDir（全局） | agentsDir/configDir | 备注 |
|-------|-------------|----------|-------------------|---------------------|------|
| **cursor-agent** | `.cursor/commands` | `.cursor/rules` | `~/.cursor/skills` | `.cursor/agents` | Cursor IDE |
| **claude** | `.claude/commands` | `.claude/rules` 或同 commands | `~/.claude/skills` | `.claude/agents` | Claude Code 只读 .claude/ |
| **gemini** | `.gemini/commands` | — | `~/.gemini/skills`（待确认） | — | TOML 格式 |
| **copilot** | `.github/agents` | — | 按 Copilot 规范（待确认） | — | IDE-based |
| **qwen** | `.qwen/commands` | — | `~/.qwen/skills`（待确认） | — | TOML 格式 |
| **opencode** | `.opencode/command` | — | 待确认 | — | 单数 command |
| **codex** | `.codex/commands` | `.codex/prompts`（可选） | 待确认 | — | |
| **windsurf** | `.windsurf/workflows` | `.windsurf/rules` | 待确认 | — | workflows 替代 commands |
| **kilocode** | — | `.kilocode/rules` | 待确认 | — | rules 替代 commands |
| **auggie** | — | `.augment/rules` | 待确认 | — | rules 替代 commands |
| **roo** | — | `.roo/rules` | 待确认 | — | rules 替代 commands |
| **codebuddy** | `.codebuddy/commands` | — | 待确认 | — | |
| **amp** | `.agents/commands` | — | 待确认 | — | |
| **shai** | `.shai/commands` | — | 待确认 | — | |
| **q** | 待调研 | 待调研 | 待调研 | — | PRD 提及，spec-kit 未列 |
| **agy** | `.agy/workflows`（参考 spec-kit） | — | 待确认 | — | Antigravity |
| **bob** | `.bob/commands` | — | 待确认 | — | IBM Bob IDE |
| **qodercli** | `.qoder/commands` | — | 待确认 | — | |
| **cody** | 待调研（或 `.cody/commands`） | 待调研 | 待调研 | — | PRD 提及，spec-kit 未列 |
| **tabnine** | 待调研 | 待调研 | 待调研 | — | PRD 提及，spec-kit 未列 |
| **kiro-cli** | `.kiro/prompts` | — | 待确认 | — | prompts 替代 commands |
| **generic** | `--ai-commands-dir` 指定 | 由 registry 的 configTemplate 定义 | 由 registry 定义 | 由 registry 定义 | 须提供 --ai-commands-dir 或 registry |

**configTemplate 结构定义**（registry 与内置共用）：

```json
{
  "id": "claude",
  "name": "Claude Code",
  "configTemplate": {
    "commandsDir": ".claude/commands",
    "rulesDir": ".claude/rules",
    "skillsDir": "~/.claude/skills",
    "agentsDir": ".claude/agents",
    "vscodeSettings": ".vscode/settings.json"
  },
  "rulesPath": null,
  "detectCommand": "claude"
}
```

**说明**：
- `commandsDir`、`rulesDir` 为项目内相对路径；`skillsDir` 可为 `~/.xxx/skills` 或项目内 `.xxx/skills`
- 部分 AI 用 `workflows`、`prompts`、`rules` 替代 `commands`，configTemplate 中 `commandsDir` 可指向该等价目录
- 标注「待确认」「待调研」的项，首版可实现时采用保守默认（如与 cursor 类似），后续迭代补充

---

### 2.3 §5.5 check 结构验证清单 — 修订

**原稿（问题）**：
> - `.cursor` 存在时（init 后由 sync 创建），含 `commands/`、`rules/` 或 `agents/` 至少其一

**修订稿**：

**check 结构验证清单**（必须全部通过，否则报错并列出缺失项）：

- `_bmad` 存在，且含子目录：`core/`、`cursor/`、`speckit/`、`skills/`（或至少其二，依模板而定）；**例外**：当 `_bmad-output/config/bmad-speckit.json` 含 `bmadPath` 时（worktree 共享模式），改为验证 `bmadPath` 指向的目录存在且结构符合本清单
- `_bmad/cursor/` 存在时，含 `commands/`、`rules/`（worktree 共享模式下验证 `bmadPath` 指向目录的 cursor 子目录）
- `_bmad-output` 存在，且含 `config/`
- **按所选 AI 验证目标目录**：读取 `_bmad-output/config/bmad-speckit.json` 的 `selectedAI`（或 init 时传入的 `--ai`），根据该 AI 的 configTemplate 验证对应目录存在且含关键子目录：
  - 若 `selectedAI` 为 `cursor-agent`：`.cursor` 存在，且含 `commands/`、`rules/` 或 `agents/` 至少其一
  - 若 `selectedAI` 为 `claude`：`.claude` 存在，且含 `commands/` 或 `rules/` 至少其一
  - 若 `selectedAI` 为 `gemini`：`.gemini` 存在，且含 `commands/`
  - 若 `selectedAI` 为 `windsurf`：`.windsurf` 存在，且含 `workflows/`
  - 若 `selectedAI` 为 `kilocode`、`auggie`、`roo`：对应 `.kilocode`、`.augment`、`.roo` 存在，且含 `rules/`
  - 其他 AI：按 configTemplate 的 `commandsDir`、`rulesDir` 解析根目录（如 `.qwen`、`.opencode`），验证该目录存在
  - 若项目未 init 或 `bmad-speckit.json` 无 `selectedAI`：跳过本项验证（或验证 `.cursor` 作为向后兼容默认）

---

### 2.4 §5.12 与 init 流程集成 — 修订

**原稿（问题）**：
> init 选择 AI 后，除写入 `.cursor/rules`、`.vscode/settings` 等 configTemplate 外，须执行 skill 发布步骤

**修订稿**：

**与 init 流程集成**：init 选择 AI 后，根据该 AI 的 **configTemplate** 执行：
1. 将 commands、rules、config 同步到 configTemplate 定义的 `commandsDir`、`rulesDir`、`agentsDir`（**按所选 AI 写入对应目录**，不统一写入 `.cursor/`）
2. 若 configTemplate 含 `vscodeSettings`，写入 `.vscode/settings.json`（可与 Cursor、Copilot 等共用）
3. 执行 skill 发布步骤，将 `_bmad/skills/` 复制到 configTemplate 的 `skillsDir`
4. 若 AI 不支持全局 skill，在 initLog 的 `skippedReasons` 中记录并跳过

---

### 2.5 新增：configTemplate 结构定义（Appendix 或 §5.3 扩展）

在 §5.3 AI Assistant 枚举与扩展机制 中，将 **configTemplate** 结构明确定义为：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `commandsDir` | string | 条件 | 项目内 commands 目标目录，如 `.cursor/commands`、`.claude/commands`；部分 AI 用 workflows/prompts 替代 |
| `rulesDir` | string | 否 | 项目内 rules 目标目录，如 `.cursor/rules`、`.claude/rules`；部分 AI 仅 rules 无 commands |
| `skillsDir` | string | 条件 | 全局或项目内 skills 目录，如 `~/.cursor/skills`、`~/.claude/skills`；不支持则省略 |
| `agentsDir` | string | 否 | 项目内 agents/config 目录，如 `.cursor/agents`、`.claude/agents` |
| `vscodeSettings` | string | 否 | `.vscode/settings.json` 等 VS Code 配置路径，可与多 AI 共用 |

**条件**：`commandsDir` 与 `rulesDir` 至少其一；`skillsDir` 若 AI 支持 skill 则必填。

---

## 三、与 spec-kit、BMAD-METHOD 的差异说明（完整）

| 维度 | spec-kit | BMAD-METHOD | 本 PRD 修订后 |
|------|----------|-------------|---------------|
| **按 AI 写目录** | ✅ 每 agent 独立目录 | 主要 .cursor/ | ✅ 采纳 spec-kit，按 configTemplate 映射 |
| **模板打包** | 每 agent 独立 zip（spec-kit-template-claude-sh.zip） | 单一模板 | 单一模板 + 运行时按 --ai 映射，减少包数量 |
| **commands 子目录名** | commands / agents / workflows / prompts / command（单数） | commands | configTemplate 支持差异化，与 spec-kit 对齐 |
| **rules 位置** | 部分 agent 仅 rules 无 commands | .cursor/rules | configTemplate.rulesDir 支持 |
| **skills 发布** | --ai-skills 按 agent 安装 | 未明确 | 按 configTemplate.skillsDir 发布，与 spec-kit 一致 |
| **CLI 框架** | Python/uv | Node/npx | 本 PRD 保持 Node/Commander.js |
| **目录源** | 模板内预分 agent 目录 | _bmad | _bmad/cursor/ 统一源，同步时映射 |

---

## 四、实施优先级建议

| 优先级 | 内容 | 说明 |
|--------|------|------|
| P0 | cursor-agent、claude 的 configTemplate 与同步逻辑 | 主流 AI，必须首版正确 |
| P0 | §5.10 同步步骤修订、§5.5 check 按 AI 验证 | 核心逻辑变更 |
| P1 | gemini、copilot、windsurf、qwen、opencode、codex 的 configTemplate | spec-kit 已列，路径明确 |
| P1 | kilocode、auggie、roo、codebuddy、amp、shai、bob、qodercli、kiro-cli、agy | spec-kit AGENTS.md 有目录定义 |
| P2 | cody、tabnine、q 的调研与 configTemplate | PRD 提及但 spec-kit 未列 |
| P2 | 各 AI 的 skillsDir 确认（部分待确认） | 首版可保守默认或跳过 |

---

## 五、收敛声明

**第 98 轮**：Mary 分析师总结采纳的 spec-kit 按 AI 写目录思路及 configTemplate 结构；无新 gap。

**第 99 轮**：Winston 架构师确认 _bmad/cursor/ 作为统一源、按 configTemplate 映射到各 AI 目录的架构合理性；无新 gap。

**第 100 轮**：**批判审计员终审**：「我同意当前共识。所有质疑（选 Claude 写 .cursor/ 无效、19+ AI configTemplate 完整性、check 按 AI 验证、与 spec-kit 差异）均已纳入本 PRD 更新建议。未发现新的 risks 或 edge cases。建议将本建议合并入 PRD 正式修订稿，并同步更新 ARCH 文档。」
