# BMAD-Speckit 5 分钟上手指南

> 从零到生成第一个 `spec.md` 的快速路径。完整安装与迁移见 [安装与迁移指南](../how-to/migration.md)。

---

## 1. 30 秒准备

**前置条件**：Node.js ≥18、Cursor IDE、Git。

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> D:\Dev\BMAD-Speckit-SDD-Flow
```

---

## 2. 2 分钟安装

运行一键安装（推荐，需 PowerShell ≥7）：

```powershell
# 在 BMAD-Speckit-SDD-Flow 源仓库根目录执行
pwsh scripts/setup.ps1 -Target D:\Dev\your-project
```

若 `setup.ps1` 未就绪，可手动三步：

1. `node scripts/init-to-root.js D:\Dev\your-project`
2. 将 speckit 命令复制到 `.cursor\commands\`
3. 将 5 个必须 Skill 复制到全局 `$env:USERPROFILE\.cursor\skills\`

**验证**：在**目标项目根目录**（即 `-Target` 指向的目录）执行：

```powershell
cd D:\Dev\your-project
pwsh _bmad\scripts\bmad-speckit\powershell\check-prerequisites.ps1 -PathsOnly
```

---

## 3. 1 分钟创建第一个 Feature

```powershell
cd D:\Dev\your-project
git checkout -b 001-my-first-feature
```

在 Cursor 中运行命令：`/speckit.specify`

确认 `specs/001-my-first-feature/spec.md` 已生成。

---

## 4. 2 分钟完成 specify → plan → tasks 流程

依次运行：`/speckit.plan` → 审计通过 → `/speckit.tasks`

确认 `plan.md`、`tasks.md` 已生成。

---

## 5. 下一步

**想体验 BMAD 全流程？** 最小示例：在 Cursor 中依次运行 `/bmad-bmm-create-story`（输入 Epic 与 Story 编号）→ 审计通过 → `/bmad-bmm-dev-story`，将触发 Layer 4 嵌套 Speckit（specify → plan → tasks → implement）。详见 [README.md §2](../README.md) 与 [完整方案](BMAD/bmad-speckit-integration-FINAL-COMPLETE.md)。

**常用 Skills**（安装时已部署到全局，直接可用）：
- **bmad-story-assistant**：Story 全流程（Create Story → Dev Story），对应命令 `/bmad-bmm-create-story`、`/bmad-bmm-dev-story`
- **bmad-bug-assistant**：描述问题时自动进入 Party-Mode，产出 BUGFIX 文档并生成修复任务
- **bmad-standalone-tasks**：按单份 TASKS/BUGFIX 文档执行，用法示例：`/bmad 按 TASKS_xxx.md 中的未完成任务实施`

- **完整安装**：[安装与迁移指南](../how-to/migration.md)
- **BMAD Story 流程**：[README.md §2](../README.md)
- **完整方案**：[bmad-speckit-integration-FINAL-COMPLETE.md](BMAD/bmad-speckit-integration-FINAL-COMPLETE.md)
