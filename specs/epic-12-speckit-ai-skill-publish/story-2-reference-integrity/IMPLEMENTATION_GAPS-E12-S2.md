# IMPLEMENTATION_GAPS E12-S2: 引用完整性

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.2 - 引用完整性  
**输入**: plan-E12-S2.md, spec-E12-S2.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `init-skeleton.js`：createWorktreeSkeleton 将 cursor/ 复制到 .cursor/（硬编码）；generateWorktreeSkeleton 将 cursor/→.cursor/、claude/→.claude/（硬编码）；无 configTemplate 驱动
- `init.js`：runNonInteractiveFlow、runWorktreeFlow 调用 createWorktreeSkeleton/generateSkeleton，无 SyncService 调用；普通 init 的 generateSkeleton 后无按 configTemplate 同步
- `check.js`：仅当 bmadPath 存在时验证 bmadPath 结构；无 selectedAI 目标目录验证；无 bmadPath 时直接 exit 0
- `src/services/`：无 sync-service.js

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1 | GAP-1.1 | SyncService.syncCommandsRulesConfig(projectRoot, selectedAI, options) | 未实现 | 无 sync-service.js 模块 |
| spec §3.2 | GAP-1.2 | 按 configTemplate.commandsDir、rulesDir、agentsDir/configDir 映射，禁止写死 .cursor/ | 未实现 | init-skeleton 硬编码 .cursor/、.claude/ 复制 |
| spec §3.2 | GAP-1.3 | opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands | 未实现 | 仅复制到 .cursor/，未按 selectedAI 切换目标 |
| spec §3.3 | GAP-1.4 | agentsDir 复制 cursor/config → agentsDir；configDir 单文件写入 | 未实现 | 无 config 同步逻辑 |
| spec §3.4 | GAP-1.5 | vscodeSettings 深度合并 .vscode/settings.json | 未实现 | 无 vscodeSettings 处理 |
| spec §3.5 | GAP-1.6 | bmadPath 存在时从 bmadPath/cursor/ 读取源；否则从 projectRoot/_bmad/cursor/ | 部分实现 | createWorktreeSkeleton 从 bmadPath 读，但目标硬编码 .cursor/ |
| spec §5、plan Phase 2 | GAP-2.1 | init 流程调用 SyncService.syncCommandsRulesConfig | 未实现 | init.js 未调用 SyncService |
| spec §5、plan Phase 2 | GAP-2.2 | 移除 init-skeleton 硬编码 .cursor/、.claude/ 同步 | 未实现 | createWorktreeSkeleton 仍硬编码 |
| spec §5 | GAP-2.3 | 普通 init（generateSkeleton）后也调用 SyncService | 未实现 | generateSkeleton 后无同步步骤 |
| spec §4.1、plan Phase 3 | GAP-3.1 | check 读取 bmad-speckit.json 的 selectedAI、bmadPath | 部分实现 | check 通过 ConfigManager.get 读 bmadPath；无 selectedAI 读取用于验证 |
| spec §4.2 | GAP-3.2 | 按 selectedAI 验证目标目录（cursor-agent、claude、opencode、bob、shai、codex） | 未实现 | check 无 selectedAI 验证 |
| spec §4.2 | GAP-3.3 | 结构验证失败 exit 1，成功 exit 0 | 部分实现 | 仅有 bmadPath 验证，无 selectedAI 验证 |
| spec §4.3 | GAP-3.4 | bmadPath 路径不存在或结构不符合时 exit 4 | 已实现 | check 已有 validateBmadStructure，exit 4 |
| spec §4.1 | GAP-3.5 | 无 bmadPath 时验证 _bmad + selectedAI 目标 | 未实现 | 无 bmadPath 时 check 直接 exit 0 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **SyncService** | GAP-1.1–1.6 | sync-service.js 新建，按 configTemplate 同步、vscodeSettings |
| **Init 集成** | GAP-2.1, GAP-2.2, GAP-2.3 | init 调用 SyncService；移除硬编码；普通 init 也同步 |
| **Check 验证** | GAP-3.1–3.3, GAP-3.5 | selectedAI 目标验证；无 bmadPath 时 _bmad + selectedAI 验证 |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1–1.6 | SyncService 实现 |
| Phase 2 | GAP-2.1, GAP-2.2, GAP-2.3 | InitCommand 集成 |
| Phase 3 | GAP-3.1, GAP-3.2, GAP-3.3, GAP-3.5 | CheckCommand 结构验证（GAP-3.4 已实现） |

---

## 5. 实施顺序建议

1. Phase 1：新建 sync-service.js，实现 syncCommandsRulesConfig + vscodeSettings
2. Phase 2：修改 init-skeleton 移除硬编码；init.js 在 generateSkeleton/createWorktreeSkeleton 后调用 SyncService
3. Phase 3：修改 check.js，增加 selectedAI 验证、无 bmadPath 时的 _bmad 验证
