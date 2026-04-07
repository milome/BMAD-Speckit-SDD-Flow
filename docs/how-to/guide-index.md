# How-To 文档索引

本目录用于存放面向使用者的操作指南、流程说明。

## 推荐入口说明

对于 Story 级 BMAD 工作流，**`bmad-story-assistant` 是推荐入口**。

- `bmad-story-assistant`：Story 流程入口语义（统一文档，Cursor + Claude Code）
- `bmad-master`：其背后的总控、状态机、路由与门控执行机制

## 文档列表

### Story 工作流

- [`bmad-story-assistant.md`](./bmad-story-assistant.md) — Story 助手统一使用说明（Cursor + Claude Code 差异分节）

适合以下场景：

- 想了解 `bmad-story-assistant` 的完整工作流
- 想知道 Story 从创建到审计、实现、Post Audit 的阶段关系
- 想理解 Cursor 与 Claude Code 两个运行时的差异
- 想使用 `--continue` / `--audit-granularity=full|story|epic`

### Speckit 治理与 rollout

- [`speckit-rollout-playbook.md`](./speckit-rollout-playbook.md) — Speckit journey-first 治理的试点、分阶段 rollout、角色训练与 incident 回流
- [`../reference/speckit-governance.md`](../reference/speckit-governance.md) — 风险分层、owner、exception、默认 gate 摘要
- [`../reference/speckit-done-standards.md`](../reference/speckit-done-standards.md) — PRD / architecture / readiness / tasks / implement / closure 退出标准
- [`../reference/speckit-exception-log-template.md`](../reference/speckit-exception-log-template.md) — 例外登记模板
- [`../reference/speckit-flow-metrics.md`](../reference/speckit-flow-metrics.md) — rollout 与治理阶段的指标字典
- [`../examples/speckit-contracts/good-prd-contract.md`](../examples/speckit-contracts/good-prd-contract.md) — good PRD contract 示例
- [`../examples/speckit-contracts/good-architecture-contract.md`](../examples/speckit-contracts/good-architecture-contract.md) — good architecture contract 示例
- [`../examples/speckit-contracts/good-smoke-e2e.md`](../examples/speckit-contracts/good-smoke-e2e.md) — good smoke E2E 示例

### 其他指南

- [`consumer-installation.md`](./consumer-installation.md) — 面向消费项目的完整安装、provider 配置与 dashboard 启动入口
- [`runtime-mcp-installation.md`](./runtime-mcp-installation.md) — `runtime-mcp` 显式启用时的布局、配置与验活说明
- [`runtime-dashboard.md`](./runtime-dashboard.md) — 启动 live dashboard、runtime MCP，以及查看 `/api/snapshot` / `runtime_context` / `sft_summary`
- [`training-ready-sft-export.md`](./training-ready-sft-export.md) — 基于 `CanonicalSftSample` 预览、校验、打包 OpenAI / Hugging Face 训练数据
- [`runtime-locale-and-i18n-config.md`](./runtime-locale-and-i18n-config.md) — 运行时语言（`languagePolicy`）与 BMAD i18n YAML 如何配置、何时生效；与审计提示词选稿的关系
- [`multi-story.md`](./multi-story.md) — 多 Story 并行管理
- [`cursor-setup.md`](./cursor-setup.md) — Cursor IDE 配置
- [`claude-code-setup.md`](./claude-code-setup.md) — Claude Code 配置
- [`migration.md`](./migration.md) — 现有项目迁移
- [`wsl-shell-scripts.md`](./wsl-shell-scripts.md) — WSL 下使用 Shell 脚本

## 推荐阅读顺序

1. [入门教程](../tutorials/getting-started.md) — 安装与第一次使用
2. [`consumer-installation.md`](./consumer-installation.md) — 消费项目安装主入口
3. [`bmad-story-assistant.md`](./bmad-story-assistant.md) — Story 工作流
4. [`speckit-rollout-playbook.md`](./speckit-rollout-playbook.md) — 把 journey-first 治理落进团队日常
5. [`multi-story.md`](./multi-story.md) — 多 Story 管理

## 维护建议

新增 how-to 文档时，请同步更新本索引。
