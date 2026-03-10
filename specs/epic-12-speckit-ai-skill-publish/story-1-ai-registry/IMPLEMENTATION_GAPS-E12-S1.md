# IMPLEMENTATION_GAPS E12-S1: AI Registry

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.1 - AI Registry  
**输入**: plan-E12-S1.md, spec-E12-S1.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `ai-builtin.js`：19+ AI，仅 id/name/description，无 configTemplate
- `init.js`：直接引用 aiBuiltin，无 AIRegistry；无 generic 校验；无 --ai-commands-dir
- `check.js`：无 --list-ai，无 AIRegistry
- `bin/bmad-speckit.js`：init 无 --ai-commands-dir 选项
- `src/services/`：无 ai-registry.js

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3、Story AC-1 | GAP-1.1 | Registry 全局路径 ~/.bmad-speckit/ai-registry.json | 未实现 | 无 AIRegistry 模块，未读取全局 registry |
| spec §3、Story AC-1 | GAP-1.2 | Registry 项目路径 _bmad-output/config/ai-registry.json | 未实现 | 无 AIRegistry 模块，未读取项目 registry |
| spec §3.2、Story AC-1 | GAP-1.3 | 合并优先级：项目 > 全局 > 内置 | 未实现 | 无合并逻辑 |
| spec §3.3、Story AC-1 | GAP-1.4 | 文件不存在不报错、JSON 解析失败含路径抛错 | 未实现 | 无 load 实现 |
| spec §4、Story AC-2 | GAP-2.1 | 19+ 内置 configTemplate（commandsDir、rulesDir、skillsDir、agentsDir、subagentSupport） | 部分实现 | ai-builtin 仅 id/name/description；无 configTemplate |
| spec §4.3 | GAP-2.2 | opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands | 未实现 | 无 configTemplate 数据 |
| spec §4.2.2 | GAP-2.3 | subagentSupport：native/mcp/limited/none | 未实现 | 无 subagentSupport 字段 |
| spec §4.1、Story AC-3 | GAP-3.1 | registry 文件格式：{ "ais": [...] } 或 [...] | 未实现 | 无解析逻辑 |
| spec §4.1、Story AC-3 | GAP-3.2 | 用户/项目自定义 AI 时 configTemplate 必填、校验 | 未实现 | 无校验逻辑 |
| spec §4.1 | GAP-3.3 | detectCommand、rulesPath、aiCommandsDir 字段支持 | 未实现 | 无 registry 条目解析 |
| spec §5、Story AC-4 | GAP-4.1 | generic 无 aiCommandsDir 时退出码 2 | 未实现 | init 未校验 generic + aiCommandsDir |
| spec §5 | GAP-4.2 | --ai-commands-dir 选项、generic 有该选项时通过 | 未实现 | bin 无 --ai-commands-dir；init 未使用 |
| spec §6、Story AC-5 | GAP-5.1 | AIRegistry.load({ cwd }) | 未实现 | 无 ai-registry.js |
| spec §6 | GAP-5.2 | AIRegistry.getById(id, { cwd }) | 未实现 | 无 ai-registry.js |
| spec §6 | GAP-5.3 | AIRegistry.listIds({ cwd }) | 未实现 | 无 ai-registry.js |
| plan Phase 4 | GAP-5.4 | init 使用 AIRegistry 替代 aiBuiltin | 未实现 | init 仍用 aiBuiltin |
| plan Phase 4 | GAP-5.5 | init --ai 无效时用 listIds 提示 | 部分实现 | 有 check --list-ai 提示，但未用 listIds 动态获取 |
| plan Phase 4 | GAP-5.6 | check 使用 AIRegistry（--list-ai 或 generic 校验） | 未实现 | check 无 --list-ai，无 AIRegistry |
| spec §6.2 | GAP-5.7 | configTemplate 深度合并 | 未实现 | 无合并实现 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **数据模块** | GAP-2.1, GAP-2.2, GAP-2.3 | 19+ 完整 configTemplate、spec-kit 对齐、subagentSupport |
| **AIRegistry 服务** | GAP-1.1–1.4, GAP-5.1–5.3, GAP-5.7 | load、getById、listIds、路径、合并、校验 |
| **Registry 解析** | GAP-3.1, GAP-3.2, GAP-3.3 | 文件格式、configTemplate 校验、扩展字段 |
| **init 集成** | GAP-4.1, GAP-4.2, GAP-5.4, GAP-5.5 | generic 校验、--ai-commands-dir、AIRegistry 替代 aiBuiltin |
| **check 集成** | GAP-5.6 | check --list-ai 或 AIRegistry 接入（若本 Story 实现） |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1–1.4, GAP-5.1–5.3, GAP-5.7 | AIRegistry 模块、load/getById/listIds |
| Phase 2 | GAP-2.1, GAP-2.2, GAP-2.3 | ai-registry-builtin 完整 configTemplate |
| Phase 3 | GAP-3.1, GAP-3.2, GAP-3.3 | registry 文件解析与校验 |
| Phase 4 | GAP-4.1, GAP-4.2, GAP-5.4, GAP-5.5, GAP-5.6 | init/check 集成、generic、--ai-commands-dir |
| Phase 5 | — | 测试（不产生新 Gap） |

---

## 5. 实施顺序建议

1. Phase 2 优先：创建 ai-registry-builtin.js，确保内置数据完整
2. Phase 1：创建 ai-registry.js，实现 load/getById/listIds
3. Phase 3：在 load 中集成 registry 解析与校验
4. Phase 4：修改 init、bin；可选扩展 check --list-ai（若 Story 13.1 未实现则本 Story 实现基础 listIds 供 init 使用）
