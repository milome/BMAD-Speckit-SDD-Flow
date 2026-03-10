# 批判审计员 (Critical Auditor) 文档索引

**最后更新**: 2026-02-27  
**维护者**: BMAD Core Team

---

## 快速导航

### 🎯 根据您的角色选择入口

| 如果您是... | 推荐阅读 |
|------------|---------|
| **Party Mode Facilitator** | [Step 02 - Discussion Orchestration](../workflows/party-mode/steps/step-02-discussion-orchestration.md) |
| **批判审计员扮演者** | [详细操作指南](./critical-auditor-guide.md) |
| **新用户想了解角色** | [改进总结报告](../../../docs/BMAD/party_mode_挑战者人格引入_改进总结报告_2026-02-27.md) |
| **开发者/维护者** | [基础定义](./adversarial-reviewer.md) + [Agent Manifest](../../_config/agent-manifest.csv) |

---

## 文档清单

### 核心文档

| 文档 | 路径 | 用途 | 优先级 |
|------|------|------|--------|
| **详细操作指南** | [critical-auditor-guide.md](./critical-auditor-guide.md) | 完整的使用手册、模板、检查清单 | ⭐⭐⭐ 必读 |
| **基础角色定义** | [adversarial-reviewer.md](./adversarial-reviewer.md) | Persona、核心属性、快速参考 | ⭐⭐ 重要 |
| **改进总结报告** | [party_mode_挑战者人格引入_改进总结报告_2026-02-27.md](../../../docs/BMAD/party_mode_挑战者人格引入_改进总结报告_2026-02-27.md) | 设计背景、实施详情、流程图 | ⭐⭐ 重要 |

### Party Mode 工作流集成

| 文档 | 路径 | 包含的批判审计员内容 |
|------|------|---------------------|
| **Step 01 - Agent Loading** | [step-01-agent-loading.md](../workflows/party-mode/steps/step-01-agent-loading.md) | 挑战者介绍规则 |
| **Step 02 - Discussion Orchestration** | [step-02-discussion-orchestration.md](../workflows/party-mode/steps/step-02-discussion-orchestration.md) | 质疑操作定义、收敛条件、强制参与规则 |
| **Step 03 - Graceful Exit** | [step-03-graceful-exit.md](../workflows/party-mode/steps/step-03-graceful-exit.md) | Challenger Final Review 格式化 |
| **Workflow** | [workflow.md](../workflows/party-mode/workflow.md) | 顶层指南、鼓励质疑 |

### 配置与注册

| 文档 | 路径 | 内容 |
|------|------|------|
| **Agent Manifest** | [agent-manifest.csv](../../_config/agent-manifest.csv) | Agent 注册配置（第22行） |

---

## 关键概念速查

### 有效质疑的4种类型

1. **明确反对** - 对某结论提出明确反对
2. **指出遗漏** - 指出未覆盖的 risk/edge case
3. **反证** - 「若 X 则结论无效」类论证
4. **证据请求** - 要求证据支持某主张

### 关键规则

| 规则 | 说明 |
|------|------|
| **首轮必出场** | Round 1 必须包含批判审计员 |
| **每5轮必出场** | 每个5轮窗口至少出场1次 |
| **最少轮次** | 生成最终方案：100轮 / 其他：50轮 |
| **收敛前终审** | 展示 [E] 前必须完成终审陈述 |

### 终审陈述的3种状态

- **同意** - 所有质疑已解决
- **有条件同意** - 存在前置条件，需在任务列表中体现
- **有保留** - 存在 Deferred Gaps，需记录并追踪

---

## 使用场景指南

### 场景1: Create Story 阶段

**目标**: 确保 Story 文档质量，发现需求漏洞

**关键动作**:
1. 质疑需求理解是否准确
2. 挑战方案假设是否合理
3. 发现遗漏的 edge cases
4. 确保无禁止词（可选、后续、待定等）

**参考章节**: [详细操作指南 - 9.3 Story 文档检查清单](./critical-auditor-guide.md#93-story-文档检查清单)

### 场景2: 根因分析讨论

**目标**: 确保找到真正的根本原因

**关键动作**:
1. 质疑当前根因是否足够深入
2. 挑战"5 Whys"是否已到底
3. 发现遗漏的相关因素
4. 验证解决方案是否能真正解决问题

**参考章节**: [详细操作指南 - 五、质疑技巧与模板](./critical-auditor-guide.md#五质疑技巧与模板)

### 场景3: 技术方案评审

**目标**: 确保技术方案的合理性和可行性

**关键动作**:
1. 质疑技术选型的理由
2. 挑战架构的扩展性假设
3. 发现遗漏的性能瓶颈
4. 评估风险缓解措施的有效性

**参考章节**: [详细操作指南 - 9.2 技术方案检查清单](./critical-auditor-guide.md#92-技术方案检查清单)

---

## 常见问题 FAQ

**Q: 批判审计员和 Quinn (QA) 有什么区别？**
A: 批判审计员关注方案本身的合理性（需求、设计、架构），在 Party Mode 中实时参与；Quinn 关注测试覆盖和质量保证，在独立审计阶段介入。

**Q: 质疑过多导致讨论无法推进怎么办？**
A: 区分"致命缺陷"和"优化建议"，优先解决致命缺陷；将优化建议记录为 Deferred Gaps，分配给后续 Story；使用"有条件同意"退出。

**Q: 如何在有限时间内完成充分质疑？**
A: 聚焦最高风险的决策点；使用检查清单确保系统性；提前准备常见质疑模板；利用每5轮必出场规则保持节奏。

更多 FAQ 见 [详细操作指南 - 八、常见问题与解决方案](./critical-auditor-guide.md#八常见问题与解决方案)

---

## 相关资源

- [BMAD 多 Agent 使用指南](../../../docs/BMAD/Cursor_BMAD_多Agent使用指南.md) - 所有 Agent 的展示名和命令对照
- [audit-prompts.md](../../references/audit-prompts.md) - 通用审计清单（如存在）
- [ralph-method](../../../../.cursor/skills/ralph-method/SKILL.md) - 用户故事分解方法
- [speckit-workflow](../../../../.cursor/skills/speckit-workflow/SKILL.md) - 规范开发流程

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-02-27 | 1.0 | 初始版本，整合所有批判审计员相关文档 |

---

*本文档由 BMAD Core Team 维护。如有问题或建议，请通过 BMAD Master 反馈。*
