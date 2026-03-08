# Feature Specification: 交互式 init（Story 10.1）

**Epic**: 10 - speckit-init-core  
**Story**: 10.1 - 交互式 init  
**Created**: 2025-03-08  
**Status**: Draft  
**Input**: Story 10-1 文档、PRD §5.2–5.6、ARCH §3.1–3.2

---

## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 10-1 本 Story 范围 | Banner BMAD-Speckit、19+ AI 列表、路径确认、模板版本、--modules、--force、--no-git、错误码 4、--debug/--github-token/--skip-tls | spec §User Scenarios、§Requirements | ✅ |
| PRD §5.2 | init 子命令设计、交互式流程、边界与异常、错误码 | spec §Requirements FR-001–FR-020 | ✅ |
| PRD §5.3 | 19+ AI 内置列表、configTemplate 结构 | spec §Key Entities、FR-004 | ✅ |
| PRD §5.6 | chalk + boxen + ora 富终端 UI | spec §Implementation Constraints | ✅ |
| PRD §5.10 | 项目根目录结构方案 A | spec §Success Criteria SC-003 | ✅ |
| ARCH §3.2 | InitCommand 职责、init 流程状态机 | spec §Requirements | ✅ |
| ARCH §3.1 | 包结构、commands/init.js、constants/ai-builtin.js | spec §Implementation Constraints | ✅ |

---

## User Scenarios & Testing

### User Story 1 - 交互式初始化新项目 (Priority: P1)

独立开发者运行 `init my-project` 或 `init .` / `init --here`，通过富终端交互式选择 AI assistant、确认路径、选择模板版本与模块，获得一个配置好的 SDD 项目骨架。

**Why this priority**: 核心 MVP，降低新项目接入 SDD 的门槛。

**Independent Test**: 运行 `init test-dir`，完成交互流程后，目标目录包含 `_bmad`、`_bmad-output`、所选 AI 的配置目录，可独立验证。

**Acceptance Scenarios**:

1. **Given** 用户运行 `init` 进入交互模式，**When** 流程开始，**Then** 显示 Banner「BMAD-Speckit」，采用 ASCII art 或 box-drawing 风格（┌─┐│└─┘），含 CLI 名称与版本号
2. **Given** 内置 19+ AI 列表，**When** 用户进入 AI 选择步骤，**Then** 显示完整列表，支持输入过滤（按名称搜索），选择器边框采用 box-drawing 风格
3. **Given** 用户运行 `init .` 或 `init --here`，**When** 解析参数，**Then** 目标路径为当前工作目录
4. **Given** 用户运行 `init my-project`，**When** 解析参数，**Then** 目标路径为 `./my-project` 或等效
5. **Given** 交互模式下，**When** 路径选择步骤，**Then** 向用户确认目标路径，可编辑或接受默认
6. **Given** 交互模式，**When** 模板版本步骤，**Then** 提供 latest 与指定 tag 选项
7. **Given** 用户传 `--modules bmm,tea`，**When** 解析参数，**Then** 仅初始化 bmm、tea 模块
8. **Given** 用户未传 `--modules`，**When** 执行，**Then** 初始化完整模板
9. **Given** 目标路径已存在且含文件或子目录，**When** 用户未传 `--force`，**Then** 报错退出，提示使用 `--force` 或选择其他路径，退出码 4
10. **Given** 目标路径已存在且非空，**When** 用户传 `--force`，**Then** 跳过确认，强制合并/覆盖，继续执行
11. **Given** 目标路径为空目录，**When** 任意，**Then** 允许 init，无需 `--force`
12. **Given** 用户未传 `--no-git`，**When** init 完成，**Then** 执行 git init，创建 .gitignore
13. **Given** 用户传 `--no-git`，**When** init 完成，**Then** 不执行 git init，不创建 .gitignore
14. **Given** 用户传 `--debug`，**When** 执行过程，**Then** 输出详细调试日志
15. **Given** 用户传 `--github-token <token>`，**When** 模板拉取，**Then** 使用该 token 调用 GitHub API；或读取 GH_TOKEN/GITHUB_TOKEN 环境变量
16. **Given** 用户传 `--skip-tls`，**When** 网络请求，**Then** 跳过 SSL/TLS 验证；需在文档或输出中明确警告

### Edge Cases

- 目标路径不可写：报错退出，退出码 4
- 模板拉取超时：明确错误信息，退出码 3
- AI 选择后写入项目配置：所选 AI 用于生成阶段，写入项目配置

---

## Requirements

### Functional Requirements

- **FR-001**: 系统必须支持 `init [project-name]`、`init .`、`init --here` 三种路径形式
- **FR-002**: 系统必须在交互模式下显示 Banner「BMAD-Speckit」，采用 ASCII art 或 box-drawing 风格，含 CLI 名称与版本号
- **FR-003**: 系统必须提供 19+ AI 的交互式列表，支持输入过滤（按名称搜索）
- **FR-004**: AI 列表每项须含 id、name、description，供 configTemplate 扩展
- **FR-005**: 选择器边框必须采用 box-drawing 风格，与 Banner 一致
- **FR-006**: 系统必须在交互模式下向用户确认目标路径，可编辑或接受默认
- **FR-007**: 系统必须提供模板版本选择（latest / 指定 tag）
- **FR-008**: 系统必须支持 `--modules <bmm|bmb|tea|bmgd|cis|...>` 逗号分隔，未指定时初始化完整模板
- **FR-009**: 系统必须在目标路径已存在且非空且未传 `--force` 时报错退出，提示使用 `--force` 或选择其他路径，退出码 4
- **FR-010**: 系统必须在用户传 `--force` 时跳过确认，强制合并/覆盖
- **FR-011**: 系统必须在空目录允许 init，无需 `--force`
- **FR-012**: 系统必须在未传 `--no-git` 时执行 git init，创建 .gitignore
- **FR-013**: 系统必须在传 `--no-git` 时不执行 git init，不创建 .gitignore
- **FR-014**: 系统必须在传 `--debug` 时输出详细调试日志
- **FR-015**: 系统必须支持 `--github-token <token>` 或 GH_TOKEN/GITHUB_TOKEN 环境变量
- **FR-016**: 系统必须支持 `--skip-tls`，并在文档或输出中明确警告
- **FR-017**: 系统必须创建 constants/exit-codes.js，定义退出码 0/1/2/3/4/5
- **FR-018**: 交互式流程顺序：Banner → AI 选择 → 路径确认 → 模板版本 → 执行
- **FR-019**: 非空目录判定：目录存在且（含 _bmad 或 _bmad-output 或含其他文件/子目录）则视为非空
- **FR-020**: 按模板生成 _bmad、_bmad-output 目录结构，符合 PRD §5.10 方案 A

### Key Entities

- **AI 内置列表**：19+ 项，每项含 id、name、description；id 包括 claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic
- **InitCommand**：负责解析参数、编排交互流程、调用 TemplateFetcher、生成骨架、执行 git init
- **TemplateFetcher**：最小实现，从 GitHub Release 拉取 tarball
- **退出码**：0 成功、1 通用错误、2 --ai 无效、3 网络/模板失败、4 目标路径不可用、5 离线 cache 缺失

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用户可在 2 分钟内完成交互式 init 流程
- **SC-002**: 目标目录生成后包含 _bmad、_bmad-output 及所选 AI 的配置目录
- **SC-003**: 项目根目录结构符合 PRD §5.10 方案 A（_bmad、_bmad-output）
- **SC-004**: 非空目录无 --force 时 100% 报错退出码 4
- **SC-005**: --no-git 时 100% 不执行 git init

---

## Implementation Constraints（来自 ARCH）

- **CLI 框架**：Commander.js
- **交互框架**：Inquirer.js 或 prompts
- **富终端**：chalk、boxen、ora
- **包结构**：bin/bmad-speckit.js → src/commands/init.js、src/services/template-fetcher.js、src/constants/ai-builtin.js、src/constants/exit-codes.js
- **路径处理**：使用 Node.js path 模块，禁止硬编码 `/` 或 `\`
- **box-drawing**：Unicode 制表符 ┌ ─ ┐ │ └ ┘ 等

---

## Reference Documents

- [Story 10-1 交互式 init](../../../_bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-1-interactive-init/10-1-interactive-init.md)
- [PRD specify-cn-like-init](../../../_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md)
- [ARCH specify-cn-like-init](../../../_bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md)

<!-- AUDIT: PASSED by code-reviewer -->
