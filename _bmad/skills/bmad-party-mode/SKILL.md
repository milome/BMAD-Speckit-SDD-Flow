---
name: bmad-party-mode
description: 'Orchestrates group discussions between all installed BMAD agents, enabling natural multi-agent conversations. Use when user requests party mode.'
---

Follow the instructions in ./workflow.md.

**发言格式（强制，优先级最高）**：执行 party-mode 期间，每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`（如 `🏗️ **Winston 架构师**: ...`、`⚔️ **批判性审计员**: ...`）。Icon 与展示名取自 `_bmad/_config/agent-manifest.csv` 的 `icon` 和 `displayName` 字段，禁止省略。详见 `./steps/step-02-discussion-orchestration.md` 的 Response Structure。
