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

## 当前 accepted runtime path

Cursor 侧当前 accepted runtime path 已经收敛为：

1. `.cursor/hooks/runtime-policy-inject.cjs`
2. `.cursor/hooks/pre-continue-check.cjs`
3. 用户在 Cursor 会话中通过 `$bmad-speckit`、`/bmad-speckit`、`bmad-speckit` 或等价 skill 入口激活主控
4. 主 Agent 内部执行或等价消费 package-local `bmad-speckit main-agent inspect|dispatch-plan`
5. 主 Agent 只从 `requirement-record.json`、`currentMentalModel`、六个心智模型链路和 controlled ingest 记录决定是否 claim / dispatch / complete / invalidate

旧 worker 相关 start/skip 日志只应视为 legacy compatibility 提示，不再是当前成功标准。

## Hook 提示开关

如果你希望 Cursor 项目里的 hooks 在执行时把更多提示信息直接打印出来，可在项目级环境配置中开启：

```json
{
  "env": {
    "BMAD_HOOKS_VERBOSE": "1"
  }
}
```

当前效果：

- `BMAD_HOOKS_VERBOSE=0`
  - 默认安静模式
- `BMAD_HOOKS_VERBOSE=1`
  - Cursor hooks 会额外打印：
    - `pre-continue-check passed`
    - `pre-continue-check failed`
    - `pre-continue-check skipped: artifact self write`
    - `runtime-policy-inject` blocked-flow / handoff 提示

这个开关适合验证：

1. `.cursor/hooks.json` 是否真的接到了事件
2. `runtime-policy-inject.cjs` / `pre-continue-check.cjs` 是否真的被执行
3. 主 Agent 能否通过 package-local `bmad-speckit main-agent inspect|dispatch-plan` 读取 authoritative surface

## Skill 与 Command 依赖

| Command                  | 依赖 Skill                             | 说明                                             |
| ------------------------ | -------------------------------------- | ------------------------------------------------ |
| `/bmad-bmm-create-story` | bmad-story-assistant, bmad-party-mode  | Create Story 全流程；涉及方案选择时需 party-mode |
| `/bmad-bmm-dev-story`    | bmad-story-assistant, speckit-workflow | Dev Story 全流程                                 |
| `/bmad-coach`            | bmad-eval-analytics                    | Coach 诊断                                       |
| `/bmad-sft-extract`      | bmad-eval-analytics                    | SFT 数据提取                                     |

**安装**：普通 Cursor 消费项目先按 [消费项目安装指南](./consumer-installation.md) 使用项目本地安装：

```powershell
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npm ls bmad-speckit-sdd-flow --depth=0
npx --no-install bmad-speckit version
npx --no-install bmad-speckit init . --ai cursor-agent --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

`pwsh scripts/setup.ps1 -Target <项目根>` 只适用于已经 clone 本仓库的源码维护者、安装器调试或本地未发布改动验证，不是普通消费项目的默认安装方式。

**衔接步骤**：Create Story 产出 Story 文档后，须**显式触发** `/bmad-bmm-dev-story` 完成 Dev Story 流程，无自动衔接。  
**Manifest**：结构化依赖见 `_bmad/_config/skill-command-mapping.yaml`。
