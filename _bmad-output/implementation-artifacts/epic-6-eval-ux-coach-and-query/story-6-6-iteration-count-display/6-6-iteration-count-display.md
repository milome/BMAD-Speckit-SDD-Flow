# Story 6.6：迭代次数展示

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.6  
**Slug**：iteration-count-display  
**来源**：_orphan 归类（原 REQUIREMENTS_iteration_count_display.md）

---

## 1. 需求追溯

本 Story 为 Epic 6 增强：在 Coach 诊断报告与 Dashboard 中展示各 stage 的 iteration_count（整改轮次）。

| 需求 | 描述 | 本 Story |
|------|------|----------|
| 迭代次数展示 | Coach phase_scores 旁展示整改轮次；Dashboard 高迭代 Top 3 | 是 |
| 阶梯扣分说明 | phase_score 已按整改轮次应用阶梯扣分 | 是 |

---

## 2. Scope

- Coach：phase_iteration_counts、format 扩展、recommendations
- Dashboard：getHighIterationTop3、highIterTop3 小节
- sanitize-iteration 工具

---

## 3. 关联文档

- **需求**：REQUIREMENTS_iteration_count_display.md
- **任务**：TASKS_iteration_count_display.md
- **辩论**：DEBATE_iteration_count_display_100轮.md
