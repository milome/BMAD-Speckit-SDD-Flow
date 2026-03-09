# IMPLEMENTATION_GAPS E13-S4: config 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.4 - config 子命令  
**输入**: 13-4-config.md (Story 13.4), plan-E13-S4.md, spec-E13-S4.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `bin/bmad-speckit.js`：已有 init、check、version、upgrade 子命令；description 提及 config 但**无 config 命令注册**
- `src/commands/`：存在 init.js、check.js、version.js、upgrade.js；**无 config.js**
- config-manager：`src/services/config-manager.js` 已存在，提供 get、set、list、getProjectConfigPath，可直接复用

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §2.1, §4.2 | GAP-1.1 | ConfigCommand 模块（config.js） | 未实现 | 无 config.js |
| spec §4.2, §4.3 | GAP-1.2 | bin 注册 config、子命令 get/set/list、--global、--json | 未实现 | bin 无 config .command |
| spec §3 AC-1 | GAP-2.1 | config get：ConfigManager.get、key 不存在 exit 1、--json | 未实现 | 无 get 逻辑 |
| spec §3 AC-3 | GAP-2.2 | config list：ConfigManager.list、可读/--json | 未实现 | 无 list 逻辑 |
| spec §3 AC-2, AC-4 | GAP-3.1 | config set：已 init 判定、作用域规则、--global | 未实现 | 无 set 逻辑 |
| spec §3 AC-2 | GAP-3.2 | networkTimeoutMs 解析为 Number | 未实现 | ConfigManager 已支持，CLI 层需传 Number |
| spec §3 AC-2#5 | GAP-3.3 | 合并已有配置：set 单 key 不删其他 | ConfigManager 已支持 | 仅需正确调用 set |
| plan Phase 1–4 | GAP-4.1 | 完整 config 流程、测试与回归 | 未实现 | 全部缺失；实施时须覆盖 plan §5 各场景 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **ConfigCommand 骨架** | GAP-1.1, GAP-1.2 | config.js 新建、bin 注册 config 及子命令 |
| **get 与 list** | GAP-2.1, GAP-2.2 | get 分支：ConfigManager.get、key 不存在 exit 1、--json；list 分支：ConfigManager.list、输出格式 |
| **set 与作用域** | GAP-3.1, GAP-3.2, GAP-3.3 | set 分支：已 init 判定、scope 决策、--global、networkTimeoutMs Number、合并写入 |
| **测试** | GAP-4.1 | 单元/集成测试、回归（plan §5：get 4 项、set 5 项、list 2 项、回归 init/check/upgrade） |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|------------|----------|------|
| Phase 1 | GAP-1.1, GAP-1.2 | ConfigCommand 骨架、bin 注册 |
| Phase 2 | GAP-2.1, GAP-2.2 | get、list |
| Phase 3 | GAP-3.1, GAP-3.2, GAP-3.3 | set、作用域规则 |
| Phase 4 | GAP-4.1 | 测试与回归 |
| plan §5 测试计划 | GAP-4.1 | get 存在/不存在/默认/--json；set 已init/未init/--global/数值/合并；list 合并/--json；回归 init/check/upgrade |

---

## 5. 实施顺序建议

1. Phase 1：新建 config.js、bin 注册 config 及 get/set/list 子命令
2. Phase 2：实现 get、list 逻辑
3. Phase 3：实现 set 及作用域规则
4. Phase 4：测试与回归验证

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_GAPS-E13-S4.md
