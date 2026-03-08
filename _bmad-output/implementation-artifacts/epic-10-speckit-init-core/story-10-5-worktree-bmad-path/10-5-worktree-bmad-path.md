# Story 10.5: --bmad-path worktree 共享

Status: ready-for-dev

## Story

**As a** 使用 git worktree 或多目录共享 _bmad 的用户，  
**I want to** 通过 `--bmad-path` 指定共享 _bmad 路径且不复制 _bmad、仅创建 _bmad-output，并将 bmadPath 写入项目配置，  
**so that** check 可验证共享路径，且 path 不存在或结构不符合时以退出码 4 退出。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.2 | `--bmad-path <path>`：不复制 _bmad，通过配置关联；仅创建 _bmad-output 与 AI 配置；须与 --ai、--yes 配合非交互使用；path 不存在或结构不符合时退出码 4 |
| PRD | §5.5 | check 结构验证：当 bmad-speckit.json 含 bmadPath 时，验证 bmadPath 指向目录存在且结构符合清单；不要求项目内存在 _bmad |
| PRD | §5.10 / worktree 共享模式 | 不部署 _bmad，在 _bmad-output/config/bmad-speckit.json 记录 bmadPath；commands/rules/skills 同步从该路径读取；check 验证 bmadPath |
| PRD | US-9 | worktree 共享 _bmad（--bmad-path） |
| ARCH | §3.2 InitCommand | 生成 _bmad、_bmad-output；--bmad-path 时仅 _bmad-output；--bmad-path 须与 --ai、--yes 配合 |
| ARCH | §3.2 CheckCommand | 按 selectedAI 验证目标目录；worktree 共享时验证 bmadPath 指向目录 |
| ARCH | §3.4 退出码 | 4 = 目标路径不可用（--bmad-path 指向路径不存在或结构不符合） |
| Epics | 10.5 | --bmad-path worktree 共享：不复制 _bmad、仅创建 _bmad-output、bmadPath 记录、check 验证；须与 --ai、--yes 配合；path 不存在或结构不符合时退出码 4 |

## 本 Story 范围

- **--bmad-path worktree 共享**：init 子命令在传入 `--bmad-path <path>` 时不复制 _bmad 到项目内，仅创建 _bmad-output 与 AI 配置（commands、rules、skills 从 path 指向的目录同步）；须与 `--ai`、`--yes` 配合非交互使用；缺少 `--ai` 或 `--yes` 时报错或自动视为非交互（与 Story 10.2 非 TTY 行为一致）。
- **bmadPath 写入项目配置**：将用户指定的 bmad 路径（绝对路径或解析后的规范路径）写入项目级配置 `_bmad-output/config/bmad-speckit.json` 的 `bmadPath` 字段，供 check 及后续命令使用；写入通过 ConfigManager（Story 10.4）完成。
- **check 验证 bmadPath**：check 子命令在检测到项目级 bmad-speckit.json 含 `bmadPath` 时，改为验证 bmadPath 指向的目录存在且结构符合 §5.5 验证清单（core/、cursor/、speckit/、skills 等至少其二；cursor 存在时含 commands/、rules/）；不要求项目内存在 _bmad。
- **退出码 4**：当 `--bmad-path` 指向的 path 不存在、或该路径下目录结构不符合 §5.5 验证清单时，init 报错退出，退出码 4；check 在验证 bmadPath 失败时同样退出码 1（结构验证失败，与 PRD §5.5 一致），或需在本文约定为 4（按 PRD §5.2 表：4 = 目标路径不可用，故 check 验证 bmadPath 失败时退出码 4 与 init 一致）。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 配置读写底层（ConfigManager 模块、get/set/list 接口） | Story 10.4 | 由 Story 10.4 负责；本 Story 仅调用 ConfigManager 写入 bmadPath 及 initLog 等既有字段 |
| config 子命令（config get/set/list、--global、--json） | Story 13.4 | 由 Story 13.4 负责；bmadPath 的读写通过 ConfigManager，本 Story 不实现 config 子命令 |
| 交互式 init、Banner、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 --ai、--yes、TTY 检测 | Story 10.2 | 由 Story 10.2 负责；本 Story 依赖 --ai、--yes 与 10.2 行为一致 |
| 跨平台脚本生成（--script sh/ps） | Story 10.3 | 由 Story 10.3 负责 |

## Acceptance Criteria

### AC-1: init --bmad-path 不复制 _bmad，仅创建 _bmad-output

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 非交互完整调用 | 用户执行 `init --bmad-path /path/to/shared/_bmad --ai cursor-agent --yes` | init 执行 | 项目内不创建 _bmad 目录；仅创建 _bmad-output 及所选 AI 目标目录（如 .cursor/）；commands、rules、skills 从 /path/to/shared/_bmad 同步 |
| 2 | 缺 --ai 或 --yes | 用户仅传 `--bmad-path /path/to/_bmad` 且为 TTY | init 执行 | 报错提示须与 --ai、--yes 配合，或按 10.2 非 TTY 自动 --yes 后允许继续（以 PRD 为准：须配合非交互使用） |
| 3 | 目标目录为空 | 当前目录为空或仅含 .git | init --bmad-path ... --ai cursor-agent --yes | 创建 _bmad-output/config/、bmad-speckit.json 及 .cursor/ 等 AI 目录，不创建 _bmad |

### AC-2: bmadPath 写入项目级配置

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 写入路径 | init 使用 `--bmad-path /abs/path/to/_bmad` 且成功 | init 完成 | _bmad-output/config/bmad-speckit.json 含 `bmadPath` 字段，值为规范化的绝对路径（与 /abs/path/to/_bmad 等价） |
| 2 | 与 ConfigManager 一致 | 项目级配置文件路径为 _bmad-output/config/bmad-speckit.json | 写入 bmadPath | 通过 ConfigManager 的 set 或等价接口写入，不绕过 Story 10.4 的配置层 |
| 3 | 同文件其他字段 | bmad-speckit.json 已含 selectedAI、templateVersion、initLog 等 | 写入 bmadPath | 仅新增或更新 bmadPath，不删除已有字段 |

### AC-3: check 验证 bmadPath 指向路径与结构

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 存在且结构符合 | bmad-speckit.json 含 bmadPath，该路径存在且含 core/、cursor/、speckit/、skills/ 至少其二 | 用户运行 `check` | 验证通过，不校验项目内 _bmad；退出码 0 |
| 2 | cursor 子目录 | bmadPath 指向目录下存在 cursor/ | check 执行 | 验证 cursor/ 含 commands/、rules/（或依模板）；与 PRD §5.5 清单一致 |
| 3 | 路径不存在 | bmadPath 指向的路径不存在或不可读 | 用户运行 `check` | 验证失败，输出明确错误；退出码 4（目标路径不可用）或 1（结构验证失败）；与 PRD/ARCH 退出码约定一致 |
| 4 | 结构不符合 | bmadPath 指向目录存在但缺少 core/、cursor/、speckit/、skills/ 等必需子目录 | check 执行 | 验证失败，列出缺失项；退出码 4 或 1 |

### AC-4: path 不存在或结构不符合时 init 退出码 4

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | path 不存在 | 用户传 `--bmad-path /nonexistent --ai cursor-agent --yes` | init 执行 | 在复制/同步前校验路径；路径不存在则报错退出，退出码 4 |
| 2 | 结构不符合 | --bmad-path 指向的目录存在但不含 core/、cursor/、speckit/、skills/ 至少其二 | init 执行 | 报错退出，退出码 4，并列出不符合项 |
| 3 | 错误信息 | 上述任一失败 | 进程退出 | stdout/stderr 输出明确错误信息，便于脚本与用户排查 |

## Tasks / Subtasks

- [ ] **T1**：init 解析 --bmad-path 与前置校验（AC: 1, 4）
  - [ ] T1.1 在 InitCommand 中解析 `--bmad-path <path>`；若存在则进入 worktree 共享分支，不拉取/解压 _bmad 到项目内
  - [ ] T1.2 校验 --bmad-path 须与 --ai、--yes 配合：若未同时传 --ai 与 --yes（且非 TTY 自动 --yes），报错提示并退出
  - [ ] T1.3 在创建 _bmad-output 或写入配置前，校验 path 存在且为目录；校验该目录结构符合 §5.5（core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/）；不通过则报错退出码 4

- [ ] **T2**：worktree 分支仅创建 _bmad-output 与 AI 同步（AC: 1）
  - [ ] T2.1 当 --bmad-path 有效时，不创建项目内 _bmad；仅创建 _bmad-output 目录结构（含 config/）
  - [ ] T2.2 commands、rules、config、skills 的同步源改为 bmadPath 指向的目录（即从 path 的 cursor/、skills/ 等读取），与 PRD §5.10 一致
  - [ ] T2.3 确保 initLog、selectedAI、templateVersion 等仍写入 _bmad-output/config/bmad-speckit.json（与 10.1/10.2/10.4 一致）

- [ ] **T3**：bmadPath 写入项目配置（AC: 2）
  - [ ] T3.1 将 --bmad-path 解析为绝对路径（path.resolve），写入 bmad-speckit.json 的 `bmadPath` 字段
  - [ ] T3.2 通过 ConfigManager（Story 10.4）写入项目级配置，不新增独立写文件逻辑
  - [ ] T3.3 写入时合并已有键值，不覆盖 selectedAI、templateVersion、initLog 等

- [ ] **T4**：check 在 bmadPath 存在时验证指向目录（AC: 3）
  - [ ] T4.1 CheckCommand 读取项目级 bmad-speckit.json；若存在 `bmadPath`，则跳过项目内 _bmad 存在性校验
  - [ ] T4.2 验证 bmadPath 指向的目录存在且可读；不存在或不可读则报错，退出码 4（目标路径不可用）
  - [ ] T4.3 验证 bmadPath 指向目录结构：含 core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/；不符合则列出缺失项，退出码 4 或 1（与 ARCH §3.4 及 PRD §5.5 一致）
  - [ ] T4.4 与现有 check 逻辑复用同一套「结构验证清单」逻辑，仅数据源从项目内 _bmad 改为 bmadPath 指向路径

- [ ] **T5**：退出码与错误信息（AC: 4）
  - [ ] T5.1 init 在 --bmad-path 校验失败时使用 constants/exit-codes.js 的 EXIT_PATH_UNAVAILABLE（4）
  - [ ] T5.2 错误信息明确包含「路径不存在」或「结构不符合」及缺失项，便于 CI/脚本判断

## Dev Notes

- **架构约束**：InitCommand 与 CheckCommand 均需支持「数据源 = 项目内 _bmad 或 bmadPath」两种分支；可抽取「结构验证清单」为共享函数，参数为根路径（projectRoot 或 bmadPath）。
- **ConfigManager**：Story 10.4 已提供项目级 set/get；本 Story 仅调用 set 写入 bmadPath（及 init 流程已有的 selectedAI、templateVersion、initLog）；不扩展 ConfigManager 接口，除非 10.4 已支持任意 key 写入。
- **与 13.1 的衔接**：Story 13.1 负责 check 与 version 的完整行为；本 Story 负责「当 bmadPath 存在时 check 验证 bmadPath 指向目录」这一逻辑；13.1 实施时须包含本 Story 的 check 扩展，或本 Story 直接修改 CheckCommand 实现 T4。
- **测试**：单元测试覆盖 (1) init --bmad-path 与 --ai、--yes 组合不复制 _bmad、写入 bmadPath；(2) init --bmad-path 指向不存在路径时退出码 4；(3) init --bmad-path 指向结构不符合目录时退出码 4；(4) check 在 bmadPath 存在时验证指向路径，存在且符合时退出码 0，不存在或不符合时退出码 4 或 1；(5) bmad-speckit.json 含 bmadPath 时 check 不要求项目内存在 _bmad。
- **禁止词表**：文档中未使用「可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债」。

### Project Structure Notes

- 涉及文件：`src/commands/init.js`（或等价）、`src/commands/check.js`、`src/services/config-manager.js`（调用）、`src/constants/exit-codes.js`（已有 4）；若存在共享的「结构验证」逻辑，可置于 `src/utils/structure-validate.js` 或 `src/services/` 下。
- 与 10.1、10.2、10.4 共用同一项目结构；无新增顶层目录。

### References

- [PRD §5.2](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md)：--bmad-path、边界与异常、退出码 4
- [PRD §5.5](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md)：check 结构验证清单、bmadPath 例外
- [PRD §5.10](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md)：worktree 共享模式
- [ARCH §3.2、§3.4](_bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md)：InitCommand、CheckCommand、退出码约定
- [Epics 10.5](_bmad-output/planning-artifacts/dev/epics.md)：Story 10.5 一行描述与依赖
- [Story 10.4](_bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-4-config-persistence/10-4-config-persistence.md)：ConfigManager 接口与项目级路径

## Dev Agent Record

### Agent Model Used

（实施时填写）

### Debug Log References

### Completion Notes List

### File List
