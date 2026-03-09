# Spec E13-S1: check 与 version 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.1 - check 与 version 子命令  
**输入**: 13-1-check-version.md, PRD §5.5/§5.12/§5.12.1, ARCH §3.2 CheckCommand/VersionCommand

---

## 1. 概述

本 spec 定义 Story 13.1（check 与 version 子命令）的技术规格，覆盖：

- **VersionCommand**：输出 CLI 版本、模板版本、Node 版本；支持 `--json` 结构化输出
- **CheckCommand 诊断输出**：已安装 AI 工具（通过 detectCommand 检测）、CLI 版本、模板版本、关键环境变量；支持 `--json`；`--ignore-agent-tools` 时跳过 AI 工具检测
- **CheckCommand --list-ai**：输出可用 AI 列表（内置 19+ 与用户/项目 registry 合并）；支持 `--json`
- **CheckCommand 结构验证**：按 §5.5 验证清单读取 `bmad-speckit.json` 逐项校验；失败时退出码 1，成功退出码 0
- **CheckCommand subagentSupport**：输出所选 AI 的子代理支持等级；`none`/`limited` 时输出全流程兼容性提示
- **退出码**：本 Story 仅实现 0（成功）、1（结构验证失败）；退出码 2/3/4/5 由其他 Story 负责

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story AC1 | check 诊断报告：AI 工具、CLI 版本、模板版本、环境变量；--json | §3.1, §3.2, §3.3 | ✅ |
| Story AC2 | check --list-ai：19+ 内置 + 用户/项目 registry 合并；--json | §3.4 | ✅ |
| Story AC3 | version 子命令：CLI 版本、模板版本、Node 版本；--json | §4 | ✅ |
| Story AC4 | 结构验证：读取 bmad-speckit.json，§5.5 验证；失败 exit 1，成功 exit 0 | §5.1, §5.2 | ✅ |
| Story AC5 | 验证清单：_bmad/bmadPath、_bmad-output/config、_bmad/cursor 子目录 | §5.2 | ✅ |
| Story AC6 | selectedAI 目标目录验证；无 init 跳过；无 selectedAI 验证 .cursor | §5.3, §5.4 | ✅ |
| Story AC7 | check --ignore-agent-tools 跳过 AI 工具检测 | §3.2 | ✅ |
| Story AC8 | subagentSupport 输出；none/limited 时提示 | §3.5 | ✅ |
| Story AC9 | 退出码 0/1；2/3/4/5 由其他 Story | §6 | ✅ |
| PRD §5.5 | check 结构验证清单、version 输出 | §5, §4 | ✅ |
| PRD §5.12.1 | 子代理支持 subagentSupport | §3.5 | ✅ |
| ARCH §3.2 | CheckCommand、VersionCommand 职责 | §3, §4 | ✅ |
| Dev Notes | selectedAI → 目标目录映射表 | §5.4 | ✅ |

---

## 3. CheckCommand

### 3.1 诊断报告输出（AC1）

| 字段 | 来源 | 说明 |
|------|------|------|
| aiToolsInstalled | detectCommand 检测 | 遍历 AIRegistry 中有 detectCommand 的条目，执行 `detectCommand`（如 `cursor --version`），成功则视为已安装；`--ignore-agent-tools` 时输出为空或跳过此段 |
| cliVersion | package.json | bmad-speckit 包 version |
| templateVersion | bmad-speckit.json 或 bmadPath 指向目录 | 从项目配置或 bmad 根目录 package.json 等解析 |
| envVars | process.env | 关键环境变量（如 PATH、HOME、CURSOR_*、项目相关） |
| selectedAI | bmad-speckit.json | 当前所选 AI id |
| subagentSupport | configTemplate.subagentSupport | 所选 AI 的子代理支持等级 |

**输出格式**：
- 默认：人类可读文本，逐行输出
- `--json`：JSON 对象输出到 stdout，便于脚本解析

### 3.2 --ignore-agent-tools（AC7）

| 场景 | 行为 |
|------|------|
| 未传 --ignore-agent-tools | 执行 detectCommand 检测已安装 AI 工具 |
| 传 --ignore-agent-tools | 跳过 AI 工具检测；诊断报告中 aiToolsInstalled 为空或省略该段 |

### 3.3 诊断报告实现要点

- **detectCommand 检测**：从 AIRegistry.listIds / 迭代条目获取有 detectCommand 的 AI；对每个执行 `child_process.spawnSync(detectCommand, { shell: true })` 或等效；exitCode 0 视为已安装
- **模板版本**：优先从 `_bmad-output/config/bmad-speckit.json` 的 templateVersion；若无则尝试 bmadPath 或 _bmad 根下 package.json 等
- **环境变量**：输出与 BMAD/Speckit 相关的 key（如 CURSOR_*、BMAD_*、PATH 摘要）

### 3.4 check --list-ai（AC2）

| 行为 | 说明 |
|------|------|
| 数据源 | AIRegistry.listIds({ cwd })：合并内置 19+ 与用户/项目 registry |
| 输出 | 默认每行一个 AI id；`--json` 时输出 JSON 数组 |
| 用途 | 供 `--ai` 无效时提示用户参考 |

### 3.5 subagentSupport 输出（AC8）

| 行为 | 说明 |
|------|------|
| 数据源 | AIRegistry.getById(selectedAI) → configTemplate.subagentSupport |
| 取值 | `native` | `mcp` | `limited` | `none` |
| 输出 | 诊断报告中含「子代理支持等级: {subagentSupport}」 |
| 提示 | 当为 `none` 或 `limited` 时，输出：「所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、审计子任务等）可能不可用」 |

---

## 4. VersionCommand（AC3）

### 4.1 模块职责

输出 CLI 版本、模板版本、Node 版本；支持 `--json`。

| 字段 | 来源 |
|------|------|
| cliVersion | package.json version |
| templateVersion | bmad-speckit.json 或 bmadPath 指向目录 |
| nodeVersion | process.version |

### 4.2 实现位置

`packages/bmad-speckit/src/commands/version.js`（新建）；在 bin 注册 `version` 子命令。

---

## 5. 结构验证（AC4, AC5, AC6）

### 5.1 验证触发

- 读取 `_bmad-output/config/bmad-speckit.json`
- 若文件不存在：视为项目未 init，跳过 AI 目标目录验证（AC6）；仍执行 _bmad/_bmad-output 结构验证（若项目内存在 _bmad）
- 若文件存在：按 §5.2、§5.3、§5.4 执行完整验证

### 5.2 验证清单（§5.5）

| 检查项 | 条件 | 验证内容 |
|--------|------|----------|
| _bmad 或 bmadPath | 无 bmadPath | `_bmad` 存在且为目录；含 core/、cursor/、speckit/、skills/ 至少其二 |
| bmadPath | 有 bmadPath | bmadPath 指向目录存在；该目录含 core/、cursor/、speckit/、skills/ 至少其二 |
| _bmad/cursor | cursor 存在 | 含 commands/、rules/（与 structure-validate、Story AC5 一致） |
| _bmad-output | 始终 | 存在且含 config/ |

**worktree 共享**：当 bmad-speckit.json 含 `bmadPath` 时，不要求项目内存在 `_bmad`；改为验证 `bmadPath` 指向目录的结构。

### 5.3 无 bmad-speckit.json 时

- 跳过 AI 目标目录验证
- 若项目内有 `_bmad`，仍验证 _bmad 结构；若无，结构验证通过（无 _bmad 即无结构要求）

### 5.4 selectedAI 目标目录验证（AC6）

| 场景 | 行为 |
|------|------|
| 无 bmad-speckit.json | 跳过 AI 目标目录验证 |
| 有 bmad-speckit.json 但无 selectedAI | 验证 `.cursor` 作为向后兼容默认（含 commands/、rules/ 或 agents/ 至少其一） |
| 有 selectedAI | 按映射表验证目标目录 |

**selectedAI → 目标目录映射表**（PRD §5.5、Dev Notes）：

| selectedAI | 根目录 | 必须含子目录 |
|------------|--------|--------------|
| cursor-agent | .cursor/ | commands/、rules/ 或 agents/ 至少其一 |
| claude | .claude/ | commands/ 或 rules/ 至少其一 |
| gemini | .gemini/ | commands/ |
| windsurf | .windsurf/ | workflows/ |
| kilocode | .kilocode/ | rules/ |
| auggie | .augment/ | rules/ |
| roo | .roo/ | rules/ |
| opencode | .opencode/ | command/（单数） |
| bob | .bob/ | commands/ |
| shai | .shai/ | commands/ |
| codex | .codex/ | commands/ |
| 其他 AI | 按 configTemplate.commandsDir/rulesDir 解析 | 根目录存在 |

**禁止写死**：所有目标目录由 configTemplate 或上表映射决定，禁止硬编码 `.cursor`。

### 5.5 验证失败处理

- 列出缺失项到 stderr 或诊断输出
- 退出码 1
- 成功时退出码 0

---

## 6. 退出码约定（AC9）

| 退出码 | 含义 | 负责 Story |
|--------|------|------------|
| 0 | 成功 | 本 Story |
| 1 | 结构验证失败 | 本 Story |
| 2 | --ai 无效 | Story 13.2 |
| 3 | 网络/模板 | Story 13.2 |
| 4 | 路径不可用 | Story 13.2 |
| 5 | 离线 cache 缺失 | Story 11.2 |

本 Story 仅实现 0、1。

---

## 7. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| detectCommand 字段定义、AIRegistry 实现 | Story 12.1 | 本 Story 消费 |
| 退出码 2、3、4、5 | Story 13.2、11.2 | 异常路径与 cache |
| ConfigManager、init 核心 | Story 10.x | 本 Story 读取配置 |

---

## 8. 依赖与实现约束

- **依赖**：AIRegistry（Story 12.1）、ConfigManager、validateBmadStructure、exit-codes.js
- **扩展**：structure-validate 需扩展 _bmad-output/config/ 验证；或 check 内联实现
- **文件路径**：项目级配置 `_bmad-output/config/bmad-speckit.json`；worktree 共享时 bmadPath 指向 _bmad 根

---

## 9. 术语

| 术语 | 定义 |
|------|------|
| detectCommand | registry 条目中用于检测 AI 是否已安装的可执行命令 |
| subagentSupport | configTemplate 子代理支持等级：native | mcp | limited | none |
| templateVersion | 模板版本，来自 bmad-speckit.json 或 bmad 目录 |

<!-- AUDIT: PASSED by code-reviewer -->
