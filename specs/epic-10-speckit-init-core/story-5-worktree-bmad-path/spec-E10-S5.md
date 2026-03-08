# Spec E10-S5: --bmad-path worktree 共享

**Epic**: 10 - Speckit Init Core  
**Story**: 10.5 - --bmad-path worktree 共享  
**原始需求文档**: 10-5-worktree-bmad-path.md

---

## 1. 概述

本 spec 定义 `bmad-speckit init` 的 **worktree 共享模式**：通过 `--bmad-path <path>` 指定共享 _bmad 路径，不复制 _bmad 到项目内，仅创建 _bmad-output 与 AI 配置；commands、rules、skills 从 path 指向的目录同步；将 bmadPath 写入项目级配置；check 子命令在存在 bmadPath 时验证该路径存在且结构符合清单；path 不存在或结构不符合时 init 以退出码 4 退出。

---

## 2. 功能范围

### 2.1 本 Story 范围

| 功能点 | 描述 | 边界条件 |
|--------|------|----------|
| init --bmad-path | 不复制 _bmad，仅创建 _bmad-output 与 AI 目录 | 须与 --ai、--yes 配合非交互使用；缺 --ai 或 --yes 且为 TTY 时报错或按 10.2 非 TTY 行为处理 |
| bmadPath 写入 | 将规范化的绝对路径写入 _bmad-output/config/bmad-speckit.json 的 bmadPath | 通过 ConfigManager（Story 10.4）set/setAll，不绕过配置层；合并已有字段 |
| check 验证 bmadPath | 当 bmad-speckit.json 含 bmadPath 时，验证该路径存在且结构符合 §5.5 清单 | 不要求项目内存在 _bmad；不符合时退出码 4（目标路径不可用）或 1（与 PRD §5.5 一致时取其一并统一约定） |
| 退出码 4 | init：--bmad-path 指向 path 不存在或结构不符合时退出码 4 | 使用 constants/exit-codes.js 的 EXIT_PATH_UNAVAILABLE（4）；错误信息明确 |

### 2.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| ConfigManager 底层（get/set/list、项目级路径） | Story 10.4 | 本 Story 仅调用 ConfigManager 写入 bmadPath 及 init 已有字段 |
| config 子命令（config get/set/list、--global、--json） | Story 13.4 | 不实现 config 子命令 |
| 交互式 init、Banner、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 --ai、--yes、TTY 检测 | Story 10.2 | 本 Story 依赖 10.2 行为一致 |
| 跨平台脚本生成（--script sh/ps） | Story 10.3 | 由 Story 10.3 负责 |

---

## 3. 验收标准（AC）技术规格

### AC-1: init --bmad-path 不复制 _bmad，仅创建 _bmad-output

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 非交互完整调用 | 用户执行 `init --bmad-path /path/to/shared/_bmad --ai cursor-agent --yes` | init 执行 | 项目内不创建 _bmad；仅创建 _bmad-output 及所选 AI 目标目录（如 .cursor/）；commands、rules、skills 从 /path/to/shared/_bmad 同步 |
| 缺 --ai 或 --yes | 用户仅传 `--bmad-path /path/to/_bmad` 且为 TTY | init 执行 | 报错提示须与 --ai、--yes 配合，或按 10.2 非 TTY 自动 --yes 后允许继续（以 PRD 为准：须配合非交互使用） |
| 目标目录为空 | 当前目录为空或仅含 .git | init --bmad-path ... --ai cursor-agent --yes | 创建 _bmad-output/config/、bmad-speckit.json 及 .cursor/ 等 AI 目录，不创建 _bmad |

**实现要点**：
- 解析 `--bmad-path <path>`；若存在则进入 worktree 分支：不拉取/解压 _bmad 到项目内，不调用 generateSkeleton 的 _bmad 复制逻辑。
- 仅创建 _bmad-output 目录结构（含 config/）；commands、rules、skills 的同步源改为 bmadPath 指向目录（从 path 的 cursor/、skills/ 等读取）。
- 校验 --bmad-path 须与 --ai、--yes 配合：若未同时传 --ai 与 --yes（且非 TTY 自动 --yes），报错并退出。

### AC-2: bmadPath 写入项目级配置

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 写入路径 | init 使用 `--bmad-path /abs/path/to/_bmad` 且成功 | init 完成 | _bmad-output/config/bmad-speckit.json 含 `bmadPath`，值为规范化的绝对路径 |
| 与 ConfigManager 一致 | 项目级配置文件路径为 _bmad-output/config/bmad-speckit.json | 写入 bmadPath | 通过 ConfigManager 的 set 或 setAll 写入，不绕过 Story 10.4 的配置层 |
| 同文件其他字段 | bmad-speckit.json 已含 selectedAI、templateVersion、initLog 等 | 写入 bmadPath | 仅新增或更新 bmadPath，不删除已有字段（setAll 合并或先 get 再 set） |

**实现要点**：
- 将 --bmad-path 解析为绝对路径（path.resolve），写入 bmad-speckit.json 的 `bmadPath`。
- 通过 ConfigManager 写入项目级配置；写入时合并已有键值。

### AC-3: check 验证 bmadPath 指向路径与结构

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 存在且结构符合 | bmad-speckit.json 含 bmadPath，该路径存在且含 core/、cursor/、speckit/、skills/ 至少其二 | 用户运行 `check` | 验证通过，不校验项目内 _bmad；退出码 0 |
| cursor 子目录 | bmadPath 指向目录下存在 cursor/ | check 执行 | 验证 cursor/ 含 commands/、rules/（或依模板）；与 PRD §5.5 清单一致 |
| 路径不存在 | bmadPath 指向的路径不存在或不可读 | 用户运行 `check` | 验证失败，输出明确错误；退出码 4（目标路径不可用）或 1（与 PRD/ARCH 约定一致） |
| 结构不符合 | bmadPath 指向目录存在但缺少必需子目录 | check 执行 | 验证失败，列出缺失项；退出码 4 或 1 |

**实现要点**：
- CheckCommand 读取项目级 bmad-speckit.json；若存在 `bmadPath`，则跳过项目内 _bmad 存在性校验，改为验证 bmadPath 指向目录。
- 验证 bmadPath 指向目录存在且可读；验证结构：core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/。
- 与现有 check 逻辑复用同一套「结构验证清单」逻辑，参数为根路径（projectRoot 或 bmadPath）。

### AC-4: path 不存在或结构不符合时 init 退出码 4

| Scenario | Given | When | Then |
|----------|-------|------|------|
| path 不存在 | 用户传 `--bmad-path /nonexistent --ai cursor-agent --yes` | init 执行 | 在创建 _bmad-output 或同步前校验路径；路径不存在则报错退出，退出码 4 |
| 结构不符合 | --bmad-path 指向的目录存在但不含 core/、cursor/、speckit/、skills/ 至少其二 | init 执行 | 报错退出，退出码 4，并列出不符合项 |
| 错误信息 | 上述任一失败 | 进程退出 | stdout/stderr 输出明确错误信息，便于脚本与用户排查 |

**实现要点**：
- init 在 --bmad-path 校验失败时使用 constants/exit-codes.js 的 TARGET_PATH_UNAVAILABLE（4）。
- 错误信息明确包含「路径不存在」或「结构不符合」及缺失项。

---

## 4. 架构约束与依赖

### 4.1 InitCommand（packages/bmad-speckit/src/commands/init.js）

- 解析 `--bmad-path <path>`；若存在则进入 worktree 共享分支。
- 在创建 _bmad-output 或写入配置前，校验 path 存在且为目录；校验该目录结构符合 §5.5（core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/）；不通过则退出码 4。
- 当 --bmad-path 有效时：不创建项目内 _bmad；仅创建 _bmad-output；commands、rules、skills 同步源改为 bmadPath 指向目录；initLog、selectedAI、templateVersion 等仍写入 bmad-speckit.json。

### 4.2 CheckCommand（待实现或扩展）

- 读取项目级 bmad-speckit.json；若存在 bmadPath，则跳过项目内 _bmad 存在性校验，改为验证 bmadPath 指向目录存在且结构符合清单。
- 验证失败时退出码 4（目标路径不可用）或 1（与 PRD §5.5 一致）；本 Story 与 ARCH §3.4 约定：4 = 目标路径不可用，故 check 验证 bmadPath 失败时使用退出码 4 与 init 一致。

### 4.3 ConfigManager（Story 10.4）

- 通过 ConfigManager 的 set 或 setAll（scope: 'project', cwd: targetPath）写入 bmadPath；不新增独立写文件逻辑；写入时合并已有键值。

### 4.4 结构验证清单（共享）

- 可抽取「结构验证清单」为共享函数（如 src/utils/structure-validate.js 或 src/services/），参数为根路径（projectRoot 或 bmadPath）。
- 清单内容：core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/。

### 4.5 退出码（constants/exit-codes.js）

- 已存在 TARGET_PATH_UNAVAILABLE: 4；init 与 check 在 --bmad-path 或 bmadPath 校验失败时使用该常量。

---

## 5. CLI 参数扩展

init 命令须新增以下选项（在 bin 与 init.js 中）：

| 选项 | 类型 | 描述 |
|------|------|------|
| `--bmad-path <path>` | string | 共享 _bmad 路径；不复制 _bmad，仅创建 _bmad-output；须与 --ai、--yes 配合；path 不存在或结构不符合时退出码 4 |

**实现要点**：
- 解析 `--bmad-path`；若存在则进入 worktree 分支；须与 --ai、--yes 配合（或非 TTY 自动 --yes），否则报错。
- 在创建 _bmad-output 前校验 path 存在且结构符合；不通过则退出码 4。

---

## 6. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 陈述 | worktree 共享、--bmad-path、不复制 _bmad、仅 _bmad-output、bmadPath 写入、check 验证、退出码 4 | §1 概述、§2.1、§3 | ✅ |
| 需求追溯 PRD §5.2 | --bmad-path：不复制 _bmad、配置关联；须与 --ai、--yes 配合；path 不存在或结构不符合时退出码 4 | §2.1、§3 AC-1、AC-4、§5 | ✅ |
| 需求追溯 PRD §5.5 | check 结构验证：bmadPath 时验证指向目录存在且结构符合清单；不要求项目内存在 _bmad | §2.1、§3 AC-3、§4.2、§4.4 | ✅ |
| 需求追溯 PRD §5.10 | worktree 共享：不部署 _bmad，bmad-speckit.json 记录 bmadPath；commands/rules/skills 从该路径读取；check 验证 bmadPath | §2.1、§3 AC-1、AC-2、AC-3、§4.1 | ✅ |
| 需求追溯 ARCH §3.2 InitCommand | 生成 _bmad、_bmad-output；--bmad-path 时仅 _bmad-output；--bmad-path 须与 --ai、--yes 配合 | §3 AC-1、§4.1、§5 | ✅ |
| 需求追溯 ARCH §3.2 CheckCommand | worktree 共享时验证 bmadPath 指向目录 | §3 AC-3、§4.2 | ✅ |
| 需求追溯 ARCH §3.4 退出码 | 4 = 目标路径不可用（--bmad-path 指向路径不存在或结构不符合） | §3 AC-4、§4.5 | ✅ |
| Epics 10.5 | --bmad-path worktree 共享：不复制 _bmad、仅 _bmad-output、bmadPath 记录、check 验证；须与 --ai、--yes 配合；退出码 4 | §1、§2.1、§3、§4、§5 | ✅ |
| 本 Story 范围 --bmad-path worktree | 不复制 _bmad、仅 _bmad-output、AI 同步源为 path | §3 AC-1、§4.1 | ✅ |
| 本 Story 范围 bmadPath 写入 | 写入 bmad-speckit.json，通过 ConfigManager | §3 AC-2、§4.3 | ✅ |
| 本 Story 范围 check 验证 bmadPath | bmadPath 存在时验证指向目录与结构 | §3 AC-3、§4.2、§4.4 | ✅ |
| 本 Story 范围 退出码 4 | init 与 check 在 path/bmadPath 不可用时退出码 4 | §3 AC-4、§4.5 | ✅ |
| 非本 Story 范围 | 10.1/10.2/10.3/10.4/13.4 职责 | §2.2 | ✅ |
| AC-1～AC-4 表 | 各 Scenario Given/When/Then | §3 对应 AC 节 | ✅ |
| Dev Notes 架构约束 | InitCommand/CheckCommand 双分支、ConfigManager、结构验证共享、与 13.1 衔接 | §4 | ✅ |

<!-- AUDIT: PASSED by code-reviewer -->
