# 各阶段迭代结束标准

与 REQUIREMENTS §2.2、architecture 表 A/B、Story 4.3 一致。

---

## 1. 总则

在**启用全体系评分**的前提下，以下条件同时满足时，可视为**该阶段迭代结束**：

1. 该阶段审计结论为「完全覆盖、验证通过」；
2. （若启用评分）该阶段对应环节得分已写入 scoring 存储。

**未启用全体系评分时**：各阶段仅以该阶段审计结论「完全覆盖、验证通过」为迭代结束标准，与现有 BMAD+Speckit 行为一致。

---

## 2. 各 stage 迭代结束标准

| 阶段 | 迭代结束标准 | 与 REQUIREMENTS §2.2 对照 |
|------|--------------|---------------------------|
| prd | PRD 审计「完全覆盖」且（若启用）环节 1 得分已写入 | Layer 1 prd |
| arch | Architecture 审计「完全覆盖」且（若启用）环节 1 补充与环节 2 设计侧得分已更新 | Layer 1 arch |
| epics | create-epics-and-stories 产出完成；无独立评分环节 | Layer 2 |
| story | Create Story 审计「完全覆盖、验证通过」且（若启用）环节 1 补充得分已写入 | Layer 3 |
| specify | spec 审计「完全覆盖、验证通过」且（若启用）环节 1 得分已写入 | Layer 4 |
| plan | plan 审计「完全覆盖、验证通过」且（若启用）环节 1 补充与环节 2 设计侧得分已更新 | Layer 4 |
| gaps | gaps 前置完整性评审通过；IMPLEMENTATION_GAPS 审计「完全覆盖、验证通过」；与 tasks 衔接已确认；且（若启用）环节 1 补充得分已写入 | Layer 4 |
| tasks | tasks 审计「完全覆盖、验证通过」且各任务验收表已按实际执行填写 | Layer 4 |
| implement | 执行 tasks 后审计（audit-prompts §5）「完全覆盖、验证通过」且环节 2–6 得分已录入 | Layer 4 |
| post_impl | 实施后审计 §5「完全覆盖、验证通过」且环节 2–6 得分已录入、综合分与等级已计算并写入 | Layer 5 |
| pr_review | 强制人工审核通过；可记录（不强制写入） | Layer 5 |

---

## 3. 与 Story 4.2 AI 代码教练 iteration_passed 的衔接

AI 代码教练的 `iteration_passed` 判定依赖上述各阶段迭代结束标准：

- **输入**：scoring 存储中 run_id 对应各 stage 记录；每项含 phase_score、veto_triggered、iteration_count、first_pass 等。
- **判定逻辑**：`iteration_passed = !epicVeto.triggered && 所有 storyRecords 经 applyTierAndVeto 后的 veto_triggered 均 false && 各环节 phase_score 经阶梯后不为 0`。
- **衔接点**：当各 stage 均满足上表迭代结束标准且得分已写入时，教练可加载完整数据并执行 `iteration_passed` 判定；任一 stage 未达标则数据不完整，教练须返回 `run_not_found` 或等效错误。
