# Party-Mode 多角色辩论

> 关键决策点使用多角色辩论机制，确保方案充分论证。

---

## 概述

Party-Mode 是 BMAD Method 的核心决策机制。当 Story 创建、方案选择或 Bug 根因分析涉及多方案 trade-off 时，系统进入 Party-Mode，由多个虚拟角色进行结构化辩论，确保方案经过充分质疑和论证。

---

## 角色定义

Party-Mode 必须引入以下角色（展示名与 `_bmad/_config/agent-manifest.csv` 一致）：

| Icon | 角色 | 职责 |
|------|------|------|
| ⚔️ | 批判性审计员 | 质疑可操作性、可验证性、边界情况，发言占比 >60% |
| 🏗️ | Winston 架构师 | 架构设计、技术选型、系统级 trade-off |
| 💻 | Amelia 开发 | 实现细节、代码级可行性、开发成本评估 |
| 📋 | John 产品经理 | 需求对齐、用户价值、优先级判断 |

可按需引入其他 BMAD 角色（如 Quinn 测试等）。

---

## 发言格式

每轮每位角色发言**必须**使用格式：

```
[Icon Emoji] **[展示名]**: [发言内容]
```

示例：
```
🏗️ **Winston 架构师**: 方案 A 引入了额外的网络调用延迟...
⚔️ **批判性审计员**: 方案 A 的延迟评估缺乏量化数据...
```

---

## 轮次与收敛规则

| 规则 | 要求 |
|------|------|
| 最少轮次 | 100 轮 |
| 批判审计员发言占比 | >60%（100 轮中至少 61 轮） |
| 收敛条件 | 最后 3 轮无新 gap |
| 禁止凑轮次 | 每轮须有实质角色发言 |

---

## 触发场景

| 场景 | 触发方式 |
|------|----------|
| Story 创建涉及多方案 | bmad-story-assistant 自动进入 |
| 用户描述问题/BUG | bmad-bug-auto-party-mode 规则自动触发 |
| Plan 阶段重大架构决策 | speckit-workflow §2 可选触发 |
| 用户显式请求 | 直接说「进入 party-mode」 |
| 连续两个阶段 C 级评分 | speckit-workflow 强制升级 |

---

## 产出

Party-Mode 辩论收敛后产出：
- **最终方案描述**：经过充分论证的技术方案
- **最终任务列表**：无模糊/可选措辞的执行任务
- **BUGFIX 文档**（Bug 场景）：§1-§7 结构化文档

---

## 工作流文件

Party-Mode 的 canonical skill 定义位于：
- `_bmad/skills/bmad-party-mode/workflow.md` — Skill 工作流入口
- `_bmad/skills/bmad-party-mode/steps/step-01-agent-loading.md` — 角色加载
- `_bmad/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md` — 辩论编排

兼容保留的旧路径：
- `_bmad/core/workflows/party-mode/workflow.md` — 旧 workflow 路径（仍被部分规则/技能引用）

---

## 相关文档

- [架构概述](architecture.md) — 五层架构中 Party-Mode 的位置
- [Agent 参考](../reference/agents.md) — 角色定义与 Agent 清单
- [BMAD Story 助手](../how-to/bmad-story-assistant.md) — Story 工作流中的 Party-Mode 使用
