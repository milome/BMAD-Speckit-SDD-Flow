# 配置文件参考

> `_bmad/_config/` 目录下所有配置文件的说明。

---

## 概述

BMAD-Speckit-SDD-Flow 的配置文件集中在 `_bmad/_config/` 目录下，控制审计行为、评分触发、Coach 诊断等功能。

---

## 配置文件清单

### code-reviewer-config.yaml

Code Reviewer 的多模式配置，定义审计时的行为参数。

| 字段 | 说明 |
|------|------|
| 审计模式 | prd / arch / code / pr |
| 严格度 | standard / strict |
| 批判审计员占比 | 各模式的最低发言占比要求 |

引用者：bmad-code-reviewer-lifecycle skill、code-reviewer agent。
IDE 副本：`.cursor/agents/code-reviewer-config.yaml`。

---

### bmad-story-config.yaml

Story 工作流配置，控制审计粒度和自动续跑行为。

```yaml
audit_granularity:
  mode: "full"           # full | story | epic

auto_continue:
  enabled: false
  require_ready_flag: true
  require_next_action: true
```

| 模式 | Story 创建 | 中间阶段 | 实施后 |
|------|-----------|---------|--------|
| full | 审计 | 全部审计 | 审计 |
| story | 审计 | 基础验证 | 审计 |
| epic | 不审计 | 不审计 | 不审计（Epic 级审计） |

示例文件：`bmad-story-config.example.yaml`。

---

### scoring-trigger-modes.yaml

控制评分写入是否启用。

```yaml
scoring_write_control:
  enabled: true
```

当 `enabled: false` 时，审计通过后不触发 `bmad-speckit score`。

---

### coach-trigger.yaml

AI Coach 诊断的触发配置。

| 字段 | 说明 |
|------|------|
| `required_skill_path` | 指向全局 `bmad-code-reviewer-lifecycle/SKILL.md` |
| 触发条件 | 评分写入完成后自动触发 |

---

### stage-mapping.yaml

Speckit 阶段名称到内部标识的映射。

| 阶段 | 内部标识 |
|------|----------|
| specify | speckit_1_2 |
| plan | speckit_2_2 |
| gaps | speckit_3_2 |
| tasks | speckit_4_2 |
| implement | speckit_5_2 |

---

### eval-lifecycle-report-paths.yaml

各阶段审计报告的路径约定。定义 `AUDIT_{stage}-E{epic}-S{story}.md` 的存放位置规则。

---

### audit-item-mapping.yaml

审计报告中各检查项到评分维度的映射关系。

---

### speckit.yaml

Speckit 模块的基础配置（原 `.speckit/config.yaml`）。

---

## _bmad/_config/ 目录

BMAD 核心配置（清单文件）：

| 文件 | 说明 |
|------|------|
| `agent-manifest.csv` | Agent 定义清单（displayName、icon、职责） |
| `task-manifest.csv` | Task 定义清单 |
| `workflow-manifest.csv` | Workflow 定义清单 |
| `files-manifest.csv` | 文件清单 |
| `tool-manifest.csv` | 工具清单 |
| `manifest.yaml` | 全局 manifest 配置 |
| `bmad-help.csv` | Help 命令数据源 |

---

## 相关文档

- [架构概述](../explanation/architecture.md) — 配置文件在架构中的位置
- [评分系统](../explanation/scoring-system.md) — scoring/coach 配置详解
- [入门教程](../tutorials/getting-started.md) — 安装与初始配置
