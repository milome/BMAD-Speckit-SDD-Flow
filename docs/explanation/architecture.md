# 架构概述

> BMAD-Speckit-SDD-Flow 的五层架构与 Speckit 工作流。

---

## 五层架构

BMAD-Speckit-SDD-Flow 采用五层渐进式架构，每一层的产出是下一层的输入，并且每层之间有强制审计门控。

```
Layer 1: Product Brief        → 定义产品愿景与核心问题
Layer 2: PRD + Architecture   → 详细需求 + 技术架构
Layer 3: Epic / Story         → 拆分为可执行的 Story 单元
Layer 4: Speckit Workflow     → specify → plan → GAPS → tasks → implement
Layer 5: 收尾与集成           → PR + human review + commit gate
```

### Layer 1-2: 产品与架构定义

由 BMAD Method 的 bmm（BMAD Method Manager）驱动，通过 `create-prd`、`create-architecture` 等 workflow 产出 PRD 和架构文档。关键决策点使用 Party-Mode 进行多角色辩论。

### Layer 3: Epic/Story 规划

通过 `bmad-story-assistant` 技能驱动：
- **Create Story**：从 Epic 中创建 Story 文档，涉及方案选择时进入 Party-Mode（≥100 轮）
- **Story Audit**：由 code-reviewer 审计 Story 文档的完整性和可执行性
- 审计通过后进入 Layer 4

### Layer 4: Speckit 工作流

这是技术实现的核心层，按顺序执行 6 个阶段：

| 阶段 | 命令 | 产出 | 审计依据 |
|------|------|------|----------|
| constitution | `/speckit.constitution` | constitution.md | 项目原则完整性 |
| specify | `/speckit.specify` | spec.md | audit-prompts §1 |
| plan | `/speckit.plan` | plan.md | audit-prompts §2 |
| GAPS | 自动深度分析 | IMPLEMENTATION_GAPS.md | audit-prompts §3 |
| tasks | `/speckit.tasks` | tasks.md | audit-prompts §4 |
| implement | `/speckit.implement` | 可运行代码 + 测试 | audit-prompts §5 |

每个阶段产出必须通过 code-review 审计后才能进入下一阶段。

### Layer 5: 收尾与集成

- 实施后审计（Post Audit）：强制门控，验证实现是否覆盖 tasks/spec/plan
- Commit Gate：审计通过后才能提交
- PR + Human Review：最终人工审查

---

## 审计闭环机制

每个阶段的审计遵循固定流程：

```
产出文档 → 调用 code-review 技能 → 审计报告
  ↓                                      ↓
  ← 若未通过：修改文档 ← ← ← ← ← ← ←  判断
  ↓                                      ↓
  → 若通过：进入下一阶段 → → → → → →    "完全覆盖、验证通过"
```

审计严格度分级：
- **standard**：单次审计 + 批判审计员（specify/plan/GAPS/tasks）
- **strict**：连续 3 轮无 gap + 批判审计员 >50%（最终实施审计）

---

## TDD 红绿灯模式

执行 tasks 时强制遵循 TDD 循环：

1. **红灯（RED）**：编写测试，运行确认失败
2. **绿灯（GREEN）**：编写最少量生产代码使测试通过
3. **重构（REFACTOR）**：在测试保护下优化代码质量

禁止先写生产代码再补测试。每个 US 必须独立执行完整 TDD 循环。

---

## 相关文档

- [评分系统](scoring-system.md) — 审计评分与 Coach 诊断
- [Party-Mode](party-mode.md) — 多角色辩论机制
- [入门教程](../tutorials/getting-started.md) — 安装与第一次使用
- [Speckit CLI 参考](../reference/speckit-cli.md) — 命令行工具
