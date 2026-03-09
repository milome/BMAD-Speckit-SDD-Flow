# IMPLEMENTATION_GAPS E13-S3: upgrade 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.3 - upgrade 子命令  
**输入**: plan-E13-S3.md, spec-E13-S3.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `bin/bmad-speckit.js`：仅有 init、check、version 子命令；description 提及 upgrade 但**无 upgrade 命令注册**
- `src/commands/`：存在 init.js、check.js、version.js；**无 upgrade.js**
- template-fetcher、init-skeleton、config-manager：已存在，可直接复用

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1 | GAP-1.1 | upgradeCommand(cwd, options) 骨架 | 未实现 | 无 upgrade.js |
| spec §3.2 | GAP-1.2 | 已 init 校验：config 不存在 → exit 1 | 未实现 | 无 upgrade 命令 |
| spec §3.3 | GAP-1.3 | bin 注册 upgrade、--dry-run、--template、--offline | 未实现 | bin 无 upgrade .command |
| spec §4 | GAP-2.1 | --dry-run 仅 fetch 并输出，不写入 | 未实现 | 无 upgrade 逻辑 |
| spec §5 | GAP-3.1 | fetchTemplate + generateSkeleton 覆盖 _bmad | 未实现 | 无升级执行路径 |
| spec §5.4 | GAP-3.2 | bmadPath 存在时仅更新 templateVersion | 未实现 | 无 worktree 模式分支 |
| spec §6 | GAP-3.3 | ConfigManager 仅更新 templateVersion，合并已有配置 | 未实现 | 需使用 set 单键更新 |
| spec §7 | GAP-3.4 | networkTimeoutMs 从配置链传入 fetchTemplate | 未实现 | upgrade 未调用 fetchTemplate |
| plan Phase 1-4 | GAP-4.1 | 完整 upgrade 流程 | 未实现 | 全部缺失 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **UpgradeCommand 骨架** | GAP-1.1, GAP-1.2, GAP-1.3 | upgrade.js 新建、已 init 校验、bin 注册 |
| **--dry-run** | GAP-2.1 | dry-run 分支：fetch 并输出，不写入 |
| **执行更新** | GAP-3.1, GAP-3.2, GAP-3.3, GAP-3.4 | fetchTemplate、generateSkeleton、templateVersion 更新、networkTimeoutMs |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|------------|----------|------|
| Phase 1 | GAP-1.1, GAP-1.2, GAP-1.3 | UpgradeCommand 骨架、bin 注册 |
| Phase 2 | GAP-2.1 | --dry-run |
| Phase 3 | GAP-3.1, GAP-3.2 | 执行更新、worktree 模式 |
| Phase 4 | GAP-3.3, GAP-3.4 | templateVersion 合并、networkTimeoutMs |

---

## 5. 实施顺序建议

1. Phase 1：新建 upgrade.js、已 init 校验、bin 注册 upgrade
2. Phase 2：实现 --dry-run 分支
3. Phase 3：实现执行更新（无 bmadPath / 有 bmadPath）
4. Phase 4：确保 templateVersion 合并、networkTimeoutMs 传入

<!-- AUDIT: PASSED by code-reviewer -->
