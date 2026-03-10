# skills/

本目录用于存放或引用与 BMAD-Speckit 工作流协同所需的技能说明，便于克隆即用。

## 清单与安装方式

| 技能 | 用途 | 安装方式 |
|------|------|----------|
| **speckit-workflow** | specify→plan→GAPS→tasks→implement 与审计闭环 | Cursor 全局 skill；可复制 SKILL.md 与 references 至本目录或从 Cursor 全局引用 |
| **code-review / requesting-code-review** | 审计闭环依赖 | Cursor 全局 skill |
| **bmad-bug-assistant** | BUGFIX 流程、party-mode、§7 任务执行 | Cursor 全局 skill（必须） |
| **bmad-story-assistant** | Epic/Story、Create Story、Dev Story | Cursor 全局 skill（必须） |
| **bmad-standalone-tasks** | 按 TASKS/BUGFIX 文档执行未完成任务 | Cursor 全局 skill |
| **bmad-customization-backup** | _bmad 定制备份与迁移 | Cursor 全局 skill |
| **bmad-orchestrator** | BMAD 流程编排（若有） | Cursor 全局 skill |
| **bmad-code-reviewer-lifecycle** | 全链路 Code Reviewer：审计→解析→scoring 写入；parseAndWriteScore | **全局 skill（必须）**；复制至 `{SKILLS_ROOT}\bmad-code-reviewer-lifecycle\`（Windows: `%USERPROFILE%\.cursor\skills\`；macOS/Linux: `~/.cursor/skills/`） |
| **using-git-worktrees** | Epic 级 worktree、串行/并行模式 | Cursor 全局 skill；FINAL-COMPLETE §4.1.3 |
| **pr-template-generator** | Layer 5 PR 模板生成 | Cursor 全局 skill |
| **auto-commit-utf8** | 中文提交、UTF-8 防乱码 | Cursor 全局 skill |
| **git-push-monitor** | 长时间 push 监控 | Cursor 全局 skill |

**本目录已按文档 §3 清单 1–7、26–29 拷贝**：以下技能已从 Cursor 全局（`{SKILLS_ROOT}`，即 `$HOME/.cursor/skills/`）或 `.agents/skills/` 复制至本目录同名子目录，便于克隆即用。  
- **已拷贝**：speckit-workflow、code-review（来源 requesting-code-review）、bmad-bug-assistant、bmad-story-assistant、bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator（来源 .agents）、using-git-worktrees、pr-template-generator、auto-commit-utf8、git-push-monitor。

安装到 Cursor 全局后，也可将对应 skill 置于 `{SKILLS_ROOT}`（`$HOME/.cursor/skills/`）与 `commands/`、`rules/` 协同使用。
