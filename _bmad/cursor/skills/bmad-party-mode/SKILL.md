---
name: bmad-party-mode
description: 编排已安装 BMAD 代理之间的多角色讨论，支持自然的多代理对话。Cursor 分支使用无中途暂停的 step-02 override。
---

Follow the instructions in `./workflow.md`.

**发言格式（强制，优先级最高）**：执行 party-mode 期间，每轮每位角色发言**必须**使用格式 `[Icon Emoji] **[展示名]**: [发言内容]`。详见 `./steps/step-02-discussion-orchestration.md`。

**Cursor 约束**：Cursor 分支的 `step-02-discussion-orchestration.md` 已覆盖为“同一会话连续运行到 `target_rounds_total`”语义；不得引入中途暂停或分批回传语义。
