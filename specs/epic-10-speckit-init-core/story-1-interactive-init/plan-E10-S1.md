# Implementation Plan: 交互式 init（Story 10.1）

**Epic**: 10 - speckit-init-core  
**Story**: 10.1 - 交互式 init  
**Created**: 2025-03-08  
**Status**: Draft  
**Input**: spec-E10-S1.md、Story 10-1、PRD §5.2–5.10、ARCH §3

---

## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 10-1 本 Story 范围 | spec §User Scenarios、§Requirements | Phase 1–5、§Integration Test Plan | ✅ |
| spec FR-001–FR-020 | spec §Requirements | Phase 1–5、§Module Design | ✅ |
| PRD §5.2 | spec FR-001–FR-020 | §Module Design、§Data Flow | ✅ |
| PRD §5.3、§5.10 | spec Key Entities | Phase 2 ai-builtin、Phase 4 模板结构 | ✅ |
| ARCH §3.1–3.4 | spec Implementation Constraints | §Module Design、§Tech Stack | ✅ |

---

## Phase 0: Technical Context

### Tech Stack（来自 ARCH ADR）

| 组件 | 选型 | 版本 |
|------|------|------|
| 运行时 | Node.js | 18+ |
| CLI 框架 | Commander.js | ^11.x |
| 交互框架 | Inquirer.js | ^9.x |
| 富终端 | chalk、boxen、ora | ^5.x、^7.x、^8.x |
| 路径 | Node.js path | 内置 |

### Constitution Check

- 路径处理：使用 `path` 模块，禁止硬编码 `/` 或 `\`
- 编码：统一 UTF-8
- 包结构：符合 ARCH §3.1

---

## Phase 1: Module Design

### 1.1 包结构（Story 10.1 范围）

```
bmad-speckit/
├── bin/bmad-speckit.js
├── src/
│   ├── commands/init.js
│   ├── services/template-fetcher.js
│   ├── constants/
│   │   ├── ai-builtin.js
│   │   └── exit-codes.js
│   └── utils/
│       ├── path.js
│       └── tty.js
```

### 1.2 InitCommand 职责

- 使用 Commander.js 注册 init 子命令
- 解析 `[project-name]`、`.`、`--here`、`--modules`、`--force`、`--no-git`、`--debug`、`--github-token`、`--skip-tls`
- 目标路径解析：`.`/`--here` → `process.cwd()`；`[project-name]` → `path.resolve(cwd, project-name)`
- 非空目录校验：无 `--force` 且路径已存在且非空 → 退出码 4；非空判定（FR-019）：目录存在且（含 _bmad 或 _bmad-output 或含其他文件/子目录）则视为非空
- 编排交互流程：Banner → AI 选择 → 路径确认 → 模板版本 → 执行

### 1.3 TemplateFetcher（最小实现）

- 从 GitHub Release 拉取 tarball
- 支持 `--github-token`（参数优先，否则 GH_TOKEN/GITHUB_TOKEN）
- 支持 `--skip-tls`（需输出警告）
- 本 Story 不实现 cache、--offline（由 Story 11.1 扩展）

### 1.4 ai-builtin.js

- 19+ AI：claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic
- 每项含 id、name、description

### 1.5 exit-codes.js

- 定义 0/1/2/3/4/5 与 PRD §5.2 一致

### 1.6 utils/path.js、utils/tty.js（避免孤岛）

- **path.js**：封装跨平台路径解析（如 `path.resolve`、`path.join`），供 InitCommand、TemplateFetcher 调用；禁止硬编码 `/` 或 `\`
- **tty.js**：本 Story 实现最小 TTY 检测接口（如 `process.stdout.isTTY` 封装），供 InitCommand 判断交互模式；Story 10.2 扩展
- **调用链**：InitCommand 导入 path.js、tty.js；path.js 被 init.js、template-fetcher.js 使用

---

## Phase 2: Banner 与富终端 UI

### 2.1 Banner

- 使用 chalk + boxen 实现「BMAD-Speckit」
- ASCII/box-drawing 风格（┌─┐│└─┘）
- 含 CLI 名称与版本号（从 package.json 读取）

### 2.2 AI 选择步骤

- 使用 Inquirer.js 或 prompts
- 从 ai-builtin.js 加载列表
- 支持输入过滤（按名称搜索）
- 选择器边框采用 box-drawing 风格

### 2.3 路径确认与模板版本

- 路径确认：可编辑或接受默认（默认=解析后的目标路径）
- 模板版本：latest / 指定 tag（用户可输入 tag 字符串）

---

## Phase 3: 模板拉取与 --modules

### 3.1 模板拉取

- TemplateFetcher 从 GitHub Release 拉取 tarball
- 版本选择：latest 或用户指定 tag
- 集成 --github-token、--skip-tls
- 错误处理：模板拉取超时/网络失败 → 明确错误信息，退出码 3（spec Edge Cases、PRD §5.2）

### 3.2 --modules 逻辑

- 解析逗号分隔：`--modules bmm,tea` → ['bmm','tea']
- 未指定时初始化完整模板
- 指定时仅部署所选模块的 commands、rules、workflows、skills

---

## Phase 4: 项目骨架生成与 git init

### 4.1 目录结构（PRD §5.10 方案 A）

- 按模板生成 `_bmad`、`_bmad-output`
- `_bmad-output` 含 `config/` 等子目录

### 4.2 git init

- 未传 `--no-git`：执行 `git init`，创建 `.gitignore`
- 传 `--no-git`：跳过

### 4.3 --force 行为

- 覆盖已存在的同名文件，保留无冲突的既有文件

---

## Phase 5: --debug 与错误处理

### 5.1 --debug

- 输出详细调试日志（参数解析、路径、模板拉取状态等）

### 5.2 错误码

- 目标路径不可用：退出码 4，明确提示使用 `--force` 或选择其他路径；含「路径已存在且非空」「目标路径不可写」两种场景（spec Edge Cases）

---

## Integration Test Plan（强制）

### 生产代码关键路径验证

| 验证项 | 方式 | 预期 |
|--------|------|------|
| InitCommand 被 bin 入口调用 | grep bin/bmad-speckit.js 导入 init | 存在 init 子命令注册 |
| TemplateFetcher 被 InitCommand 调用 | grep init.js 导入 template-fetcher | 存在调用 |
| ai-builtin 被 InitCommand 使用 | grep init.js 导入 ai-builtin | 存在使用 |
| 交互流程 E2E | 运行 `init test-e2e-dir`，完成交互 | 目标目录含 _bmad、_bmad-output、所选 AI 配置 |
| 非空目录无 force | 在非空目录运行 `init .` 无 --force | 退出码 4，提示 --force |
| --no-git | 运行 `init test-nogit --no-git` | 无 .git、无 .gitignore |
| path.js、tty.js 被生产代码调用 | grep init.js、template-fetcher.js 导入 utils/path、utils/tty | 存在调用，无孤岛 |
| --force 覆盖行为 | 在非空目录运行 `init . --force` | 强制合并/覆盖，继续执行 |
| --github-token、--skip-tls | 运行 `init test-dir --github-token xxx` 或 mock 网络验证 | 模板拉取使用 token；--skip-tls 输出警告 |
| 模板拉取失败/超时 | mock 网络失败或超时 | 退出码 3，明确错误信息 |
| 目标路径不可写 | 在无写权限目录运行 `init .` | 退出码 4，明确提示 |

### 集成测试用例

1. **E2E-1**：`init test-dir` 完整交互流程，验证 _bmad、_bmad-output 生成
2. **E2E-2**：`init .` 路径解析为 cwd
3. **E2E-3**：`init --here` 路径解析为 cwd
4. **E2E-4**：`--modules bmm,tea` 仅部署指定模块
5. **E2E-5**：非空目录无 --force 退出码 4
6. **E2E-6**：--no-git 不执行 git init
7. **E2E-7**：非空目录传 --force 强制覆盖，继续执行
8. **E2E-8**：--github-token、--skip-tls 参数传递与模板拉取集成验证
9. **E2E-9**：模板拉取超时/网络失败 → 退出码 3，明确错误信息
10. **E2E-10**：目标路径不可写 → 退出码 4，明确提示

---

## Data Model（简要）

- **AI 项**：{ id, name, description }
- **InitOptions**：{ targetPath, modules, force, noGit, debug, githubToken, skipTls }
- **InitResult**：{ success, exitCode, selectedAI, templateVersion }

---

## Reference Documents

- [spec-E10-S1](./spec-E10-S1.md)
- [Story 10-1](../../../_bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-1-interactive-init/10-1-interactive-init.md)
- [PRD](../../../_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md)
- [ARCH](../../../_bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md)
