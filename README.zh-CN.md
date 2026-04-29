# BMAD-Speckit-SDD-Flow

[English](README.md) | 简体中文

<p align="center">
  <img src="docs/assets/readme-slogan.final.svg" alt="BMAD-Speckit-SDD-Flow" width="100%" />
</p>

<h3 align="center">
  面向 Cursor 与 Claude Code 的规范化 Spec-Driven AI 开发流程
</h3>

<p align="center">
  <strong>基于 <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> 与 <a href="https://github.com/github/spec-kit">Spec-Kit</a> 构建。</strong><br>
  <em>把需求规范、审计流程、运行监控和评分反馈整合成一条完整的工程化交付链路。</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js Version"></a>
</p>

---

## 这套流程要解决什么问题？

很多 AI 工具只停留在提示词编排层面。BMAD-Speckit-SDD-Flow 把它推进成一条可管理的交付流水线：先写规范、再出计划、经过审计，确认 ready 后再进入实现阶段，执行过程中有运行时管控，最后统一输出评分、看板和训练数据。

<p align="center">
  <img src="docs/assets/readme-architecture-overview.final.svg" alt="架构总览" width="100%" />
</p>

### 主要特性

- **五层交付架构**：Product Def → Epic Planning → Story Dev → Technical Implementation → Finish
- **强制审计闭环**：每个治理阶段必须通过代码审查才能继续
- **四信号就绪检查**：实现入口前需满足需求覆盖、冒烟测试就绪、证据链完整、文档可追溯
- **运行时管控循环**：执行失败不会被静默跳过，而是沿同一条治理链路进入重试或阻塞
- **执行证据链**：通过、需修复、阻塞、重跑等状态都会留下完整记录
- **看板、诊断与训练数据**：运行结果自动汇总到可视化面板、问题诊断和模型微调数据集

> **关于图片**：README 中的图片放在 `docs/assets/` 目录下并纳入 Git 管理。npm 包里的 README 会按 GitHub Flavored Markdown 渲染，因此"仓库内相对路径 + 已跟踪资源"是对 GitHub 和 npm 都最稳定的策略。来源：[About package README files](https://docs.npmjs.com/about-package-readme-files)

---

## 运行时管控一览

- **四信号就绪检查**：在进入实现阶段前执行，与实现评分保持独立
- **先读 `main-agent-orchestration inspect`**：主 Agent 必须先读取 repo-native authoritative surface，再决定下一条全局分支
- **按需执行 `dispatch-plan`**：只有 surface 明确需要 materialize packet 时，才生成正式派发计划
- **子代理只执行 `bounded packet`**：子代理只返回 packet 结果，不负责决定下一条全局执行链
- **`runAuditorHost` 只负责 post-audit close-out**：审计通过后统一写入评分、看板、诊断和训练数据，然后主 Agent 重新读取 `inspect`
- **旧 worker / 手工 close-out 口径仅保留为历史证据**：可继续审计追溯，但不再是当前 accepted runtime path

## 看板与 MCP

- **看板是默认能力**：发布包默认支持运行时看板状态查询、启停辅助、快照生成
- **运行时 MCP 是可选能力**：只有在你希望把运行时数据暴露成 agent 工具接口时，才显式启用 `--with-mcp`
- **看板和运行时管控不依赖 MCP**：实时看板、钩子、评分投影、运行时收口在没有 `.mcp.json` 的情况下也能工作

简单理解：

- `dashboard`：给人看的运行时/评分可视化
- `runtime-mcp`：把同一份运行时数据暴露成 agent 工具接口

---

## 推荐的 npm 安装方式

确保本机已安装 **[Node.js](https://nodejs.org) v18+**。

### 推荐的 npm 离仓安装路径

如果你是要把它装进一个消费项目，而不是修改本仓库源码，当前推荐直接使用已发布的根包：

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit version
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent cursor --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit check
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit dashboard-status
```

为什么推荐这条路径：

- 它使用唯一公开发布的根包
- 它显式对齐两侧宿主安装面
- 它保留 `--no-package-json` 这种非侵入式消费安装风格
- 它对应的是这次已经验证过的已发布 npm 路径，而不是旧的纯引导快捷入口

### 持久安装到项目依赖树

如果你希望把包写进消费项目的依赖树：

```bash
npm install --save-dev bmad-speckit-sdd-flow@latest
npx bmad-speckit-init . --agent claude-code --full --no-package-json
npx bmad-speckit-init . --agent cursor --full --no-package-json
npx bmad-speckit check
```

### 快速引导路径

更快的引导命令仍然保留：

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit init . --ai cursor-agent --yes
```

但应把它理解成一个快速初始化入口，而不是完整运行时治理安装面的最高置信路径。如果你关心已发布钩子、运行时管控、看板接入和双宿主对齐，优先使用上面的推荐路径。

> 不确定该走哪条治理路径时，在 AI IDE 中运行 `/bmad-help`。它会结合流程、上下文成熟度、复杂度和实现就绪状态做推荐或阻断。

### 其他安装方式

<details>
<summary><b>通过 CI 产物安装到消费项目</b></summary>
<br>
如果你使用 release 产物，而不是直接从 npm registry 安装：

1. 下载 GitHub Actions 产物 `npm-packages-<commit-sha>`
2. 解压出 `bmad-speckit-sdd-flow-<version>.tgz`
3. 执行：

   ```bash
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
   ```

</details>

<details>
<summary><b>一键部署脚本</b></summary>
<br>

```powershell
# Windows
pwsh scripts/setup.ps1 -Target <项目路径>
```

```bash
# WSL / Linux / macOS
bash scripts/setup.sh -Target <项目路径>
```

</details>

<details>
<summary><b>安全卸载</b></summary>
<br>
如果要移除当前项目里的受管安装面：

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit uninstall
```

它只会删除安装器受管条目，不会整删 `.cursor`、`.claude` 或全局 skills，也不会删除 `_bmad-output`。

</details>

---

## 架构与模块

### 核心组件

| 组件                        | 说明                                                                                                               |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **`_bmad/`**                | 工作流模块、钩子、提示词、路由与宿主侧资产的规范源                                                                 |
| **`packages/scoring/`**     | 评分引擎、就绪漂移评估、看板投影、诊断输入与训练数据提取                                                           |
| **`dashboard`**             | 默认运行时可观测层：实时看板、运行时快照、评分投影                                                                 |
| **`runtime-mcp`**           | 可选的 MCP 工具接口，通过 `--with-mcp` 显式启用                                                                    |
| **`speckit-workflow`**      | Specify → Plan → GAPS → Tasks → TDD，并带强制审计循环                                                              |
| **`bmad-story-assistant`**  | Story 生命周期入口：主 Agent 先读 `inspect`，按需派发 bounded packet，并在 post-audit 后通过 `runAuditorHost` 收口 |
| **`bmad-bug-assistant`**    | Bug 生命周期路径：RCA → Party Mode → BUGFIX → Implement，但全局 `inspect -> dispatch-plan -> closeout` 主链仍由主 Agent 控制 |
| **`bmad-standalone-tasks`** | 针对 TASKS 或 BUGFIX 文档的执行仍先经过主 Agent `inspect`，必要时 `dispatch-plan`，再进入 bounded 子代理实施       |

<details>
<summary><b>查看目录结构</b></summary>

```text
BMAD-Speckit-SDD-Flow/
├── _bmad/                # 核心模块与配置
├── packages/             # Monorepo 包（CLI、评分）
├── scripts/              # 安装与部署工具脚本
├── docs/                 # Diataxis 风格文档
├── tests/                # 验收测试与 epic 测试
└── specs/                # 生成的 Story 规范
```

</details>

---

## 文档入口

- [快速开始](docs/tutorials/getting-started.md)
- [主 Agent 编排参考](docs/reference/main-agent-orchestration.md)
- [消费项目安装指南](docs/how-to/consumer-installation.md)
- [运行时看板指南](docs/how-to/runtime-dashboard.md)
- [运行时 MCP 安装](docs/how-to/runtime-mcp-installation.md)
- [Provider 配置](docs/how-to/provider-configuration.md)
- [Cursor 配置](docs/how-to/cursor-setup.md)
- [Claude Code 配置](docs/how-to/claude-code-setup.md)
- [WSL / Shell 脚本](docs/how-to/wsl-shell-scripts.md)

---

<p align="center">
  <a href="LICENSE">MIT License</a> •
  <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> •
  <a href="https://github.com/github/spec-kit">Spec-Kit</a>
</p>
