# Sprint-planning-gate 同步至全局与 micang-trader 执行摘要

**日期**：2026-03-04  
**范围**：TASKS_sprint-planning-gate 相关改动同步

---

## 同步范围

### 1. 全局 skills

| 目标 | 内容 | 状态 |
|------|------|------|
| `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md` | sprint-status 前置检查、示例 1/3 要求、自检清单、§1.0 | 已存在（此前已同步） |

### 2. 项目 micang-trader-015-indicator-system-refactor

| 目标 | 内容 | 状态 |
|------|------|------|
| `skills/bmad-story-assistant/SKILL.md` | 完整 SKILL（含 sprint-status 全部内容） | ✅ 已拷贝 |
| `scripts/check-sprint-ready.ps1` |  centralized sprint-status 检查脚本 | ✅ 已拷贝 |
| `.cursor/commands/bmad-bmm-create-story.md` | 前置条件、Story docs path 豁免 | ✅ 已更新 |
| `.claude/commands/bmad-bmm-create-story.md` | 同上 | ✅ 已更新 |
| `.cursor/commands/bmad-bmm-dev-story.md` | sprint-planning 前置条件 | ✅ 已更新 |
| `.claude/commands/bmad-bmm-dev-story.md` | 同上 | ✅ 已更新 |
| `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` | T2 门控逻辑、epic-story 检查顺序 | ✅ 已补同步 |
| `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml` | T3 移除 Non-sprint discovery | ✅ 已补同步 |
| `_bmad/_config/bmad-help.csv` | Create Story、Dev Story 前置条件描述 | ✅ 已补同步 |
| `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` | 增加 `-RequireSprintStatus` 参数与逻辑（T5） | ✅ 已补同步 |
| `specs/*/speckit.implement.md` | 步骤 1 调用增加 `-RequireSprintStatus` 及 Note（T5） | ✅ 已补同步（8 处） |

---

## T5 补同步明细（2026-03-04）

- **check-prerequisites.ps1**：从 BMAD-Speckit-SDD-Flow 拷贝至 micang-trader `_bmad/scripts/bmad-speckit/powershell/`，含 `-RequireSprintStatus` 参数；BMAD 模式下（存在 `_bmad-output/implementation-artifacts`）需 sprint-status.yaml 才放行 implement。
- **speckit.implement.md**：以下 8 个文件步骤 1 已补充 `-RequireSprintStatus` 及用途说明：
  - `specs/000-Overview/.cursor/commands/speckit.implement.md`
  - `specs/002-PyQt画线交易支持/.cursor/commands/speckit.implement.md`
  - `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.implement.md`
  - `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.implement.md`
  - `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.implement.md`
  - `specs/011-cta-kline-style-activation/.cursor/commands/speckit.implement.md`
  - `specs/015-indicator-system-refactor/.cursor/commands/speckit.implement.md`
  - `multi-timeframe-webapp/.cursor/commands/speckit.implement.md`

---

## 审计依据

- audit-prompts.md §5（执行阶段审计）
- 批判审计员发言占比 >50%
- 连续 3 轮无 gap 收敛
