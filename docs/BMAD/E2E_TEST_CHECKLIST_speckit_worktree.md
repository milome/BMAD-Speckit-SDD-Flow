# Speckit Worktree 端到端回归测试清单

**日期**: 2026-03-03  
**用途**: 人工或 CI 按步骤执行并勾选，验证 create-new-feature、setup_worktree、产出路径全流程。  
**测试隔离**: 使用临时分支名 `999-e2e-test`，测试后执行清理步骤。

**参考**: TASKS_产出路径与worktree约定_2026-03-02.md §三回归测试 RT-E2E

---

## 前置条件

- [ ] 项目根为 git 仓库
- [ ] 当前分支为 `dev` 或可切换回 `dev`
- [ ] PowerShell 可用

---

## 步骤 1：create-new-feature.ps1 无参数（standalone）

| 操作 | 验证点 | 勾选 |
|------|--------|------|
| 执行 `.\specs\000-Overview\.specify\scripts\powershell\create-new-feature.ps1 "test e2e feature"` | spec 子目录创建（如 `specs/999-test-e2e-feature/`） | [ ] |
| 同上 | branch 创建（如 `999-test-e2e-feature`） | [ ] |
| 同上 | spec.md 存在 | [ ] |

**注意**: 若使用 `999-e2e-test` 作为 slug，可改为 `-ShortName "e2e-test"` 或 `-Number 999` 配合描述。

---

## 步骤 2：setup_worktree.ps1 create

| 操作 | 验证点 | 勾选 |
|------|--------|------|
| 执行 `.\specs\000-Overview\.specify\scripts\powershell\setup_worktree.ps1 create 999-e2e-test` | worktree 在父目录平级创建（如 `{父目录}/{repo名}-999-e2e-test`） | [ ] |
| 同上 | worktree 目录存在且可 cd 进入 | [ ] |

**路径约定**: 若主 repo 在 `{父目录}/{repo名}`，worktree 在 `{父目录}/{repo名}-999-e2e-test`（与主 repo 平级）。

---

## 步骤 3：create-new-feature.ps1 -ModeBmad

| 操作 | 验证点 | 勾选 |
|------|--------|------|
| 执行 `.\specs\000-Overview\.specify\scripts\powershell\create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug test-e2e` | `specs/epic-4/story-1-test-e2e/` 存在 | [ ] |
| 同上 | `spec-E4-S1.md` 存在 | [ ] |
| 同上 | `_bmad-output/implementation-artifacts/4-1-test-e2e/` 存在 | [ ] |

---

## 步骤 4：产出路径 - speckit 产出在 spec 子目录

| 产出 | 路径 | 勾选 |
|------|------|------|
| spec.md | `specs/{index}-{name}/spec.md` 或 `specs/epic-{epic}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | [ ] |
| plan.md | 同上目录 | [ ] |
| tasks.md | 同上目录 | [ ] |
| IMPLEMENTATION_GAPS.md | 同上目录 | [ ] |

**注意**: 本步骤需执行 speckit.specify / speckit.plan / speckit.tasks / speckit.gaps 后验证产出位置；若仅做 create-new-feature 验收，可跳过。

---

## 步骤 5：产出路径 - BMAD 产出在 _bmad-output

| 产出 | 路径 | 勾选 |
|------|------|------|
| Story 文档 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` | [ ] |
| TASKS | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/TASKS_*.md` | [ ] |
| prd、progress | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/` | [ ] |

---

## 清理步骤（测试后必须执行）

| 操作 | 说明 | 勾选 |
|------|------|------|
| `git worktree remove <worktree-path>` 或 `git worktree remove 999-e2e-test` | 删除 worktree | [ ] |
| `git branch -D 999-e2e-test`（若存在） | 删除测试分支 | [ ] |
| 删除 `specs/999-*` 或 `specs/epic-4/story-1-test-e2e` | 删除测试 spec 目录 | [ ] |
| 删除 `_bmad-output/implementation-artifacts/4-1-test-e2e` | 删除测试 BMAD 产出 | [ ] |

---

## 验收标准

- [ ] 步骤 1～3 全部通过
- [ ] 步骤 4、5 产出路径符合约定（或按需执行 speckit/BMAD 命令后验证）
- [ ] 清理步骤已执行

---

*本清单由 T-RT-1 创建，用于 RT-E2E 回归测试。*
