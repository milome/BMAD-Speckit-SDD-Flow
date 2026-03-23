# Cursor Guide 索引

本目录存放面向 **Cursor 运行时** 的专项使用说明。

## 文档列表

### BMAD Story Assistant

- [`bmad-story-assistant.md`](./bmad-story-assistant.md)

适合以下场景：

- 想从 Cursor 版 `bmad-story-assistant` 作为入口理解 Story 工作流
- 想查看 Cursor 运行时中 `mcp_task` 与 `generalPurpose` 的调用方式
- 想使用 `--audit-granularity=full|story|epic`
- 想理解 Cursor 版与 Claude Code / OMC 版在运行时入口上的区别

## 说明

该目录下的文档默认描述的是：

- Cursor IDE / Cursor 运行时
- `.cursor/rules/*`
- Cursor Task / `mcp_task`
- `generalPurpose` 子代理类型

不等同于 Claude Code CLI / OMC 中的同名文档。

## Skill 与 Command 依赖

| Command | 依赖 Skill | 说明 |
|---------|------------|------|
| `/bmad-bmm-create-story` | bmad-story-assistant, bmad-party-mode | Create Story 全流程；涉及方案选择时需 party-mode |
| `/bmad-bmm-dev-story` | bmad-story-assistant, speckit-workflow | Dev Story 全流程 |
| `/bmad-coach` | bmad-eval-analytics | Coach 诊断 |
| `/bmad-sft-extract` | bmad-eval-analytics | SFT 数据提取 |

**安装**：执行 `pwsh scripts/setup.ps1 -Target <项目根>` 将 skills 部署到 `{SKILLS_ROOT}`。**init 后须 setup**：`init-to-root` 仅部署 commands，skills 需单独安装。

**衔接步骤**：Create Story 产出 Story 文档后，须**显式触发** `/bmad-bmm-dev-story` 完成 Dev Story 流程，无自动衔接。

**Manifest**：结构化依赖见 `_bmad/_config/skill-command-mapping.yaml`。
