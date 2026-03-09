# IMPLEMENTATION_GAPS E12-S4: Post-init 引导

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.4 - Post-init 引导  
**输入**: plan-E12-S4.md, spec-E12-S4.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `init.js`：runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 在成功完成点输出 `console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));`，未包含 speckit.constitution 提及；文案与 PRD §5.2、§5.13 不完全一致
- `_bmad`：本地项目 _bmad 无 `cursor/commands/` 子目录；无 bmad-help.md、speckit.constitution.md 命令文件（init 若从 GitHub tarball 拉取模板，取决于 bmad-method 仓库结构；worktree 模式用 bmadPath 指向的 _bmad）
- SyncService（Story 12.2）：从 `cursor/commands/` 复制到 configTemplate.commandsDir；若模板源无该目录或文件，同步后目标 commands 目录将不含 bmad-help、speckit.constitution

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1、PRD §5.2/5.13 | GAP-1.1 | 引导文案含 /bmad-help 与 speckit.constitution | 部分实现 | 现有文案仅含 /bmad-help，未提及 speckit.constitution；需扩展为「Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。」 |
| spec §3.2、AC-2 | GAP-2.1 | 模板源包含 bmad-help 命令文件 | 未实现 | 本项目 _bmad 无 cursor/commands/bmad-help.md；若模板由本项目提供须补齐；若由 GitHub tarball 提供须在模板规范中明确 |
| spec §3.2、AC-2.2 | GAP-2.2 | --modules 场景下 bmad-help 在公共或所选模块 commands 中可用 | 未实现 | 取决于模板结构；若模板按模块拆分，需确保 bmad-help 在公共 commands 或所选模块 commands |
| spec §3.3、AC-3 | GAP-3.1 | 模板源包含 speckit.constitution 命令文件 | 未实现 | 本项目 _bmad 无 cursor/commands/speckit.constitution.md；须补齐或文档约束 |
| spec §3.3、AC-3.2 | GAP-3.2 | speckit.constitution 可触发 Spec-Driven Development 宪章阶段 | 未实现 | 命令文件不存在，无法验证 |
| plan Phase 4 | GAP-4.1 | E2E 验收：init --ai cursor --yes 后 stdout 含 /bmad-help、speckit.constitution | 未实现 | 无对应 E2E 用例 |
| plan Phase 4 | GAP-4.2 | 验收模板：init 后 commands 目录存在 bmad-help、speckit.constitution | 未实现 | 模板源缺失时无法通过 |
| plan Phase 4 | GAP-4.3 | 更新 InitCommand 注释说明 Post-init 引导 | 未实现 | init.js 无相关注释 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **Post-init 引导文案** | GAP-1.1 | 扩展 init.js 三处 grey 消息为完整 PRD 文案 |
| **模板 bmad-help** | GAP-2.1, GAP-2.2 | 模板源含 bmad-help；--modules 场景对齐 |
| **模板 speckit.constitution** | GAP-3.1, GAP-3.2 | 模板源含 speckit.constitution；功能可验证 |
| **验收与文档** | GAP-4.1, GAP-4.2, GAP-4.3 | E2E、模板验收、InitCommand 注释 |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1 | Post-init 引导 stdout 输出 |
| Phase 2 | GAP-2.1, GAP-2.2 | 模板含 bmad-help |
| Phase 3 | GAP-3.1, GAP-3.2 | 模板含 speckit.constitution |
| Phase 4 | GAP-4.1, GAP-4.2, GAP-4.3 | 验收与文档 |

---

## 5. 实施顺序建议

1. Phase 1：修改 init.js，替换三处引导文案为 PRD 完整版
2. Phase 2：在 _bmad/cursor/commands/ 创建 bmad-help.md（若本项目提供模板）；或补充模板规范文档
3. Phase 3：在 _bmad/cursor/commands/ 创建 speckit.constitution.md
4. Phase 4：编写 E2E 验收、模板验收、更新 InitCommand 注释
