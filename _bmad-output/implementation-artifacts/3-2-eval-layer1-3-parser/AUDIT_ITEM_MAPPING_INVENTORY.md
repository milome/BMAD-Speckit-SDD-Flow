# T1: code-reviewer-config dimensions.checks 可映射清单

从 `config/code-reviewer-config.yaml` 盘点 prd/arch 模式（story 模式为 Create Story 审计，维度与 prd/arch 不同）。

## prd 模式（4 维度）

| 维度 | checks 原文 | 可映射 item_id | 匹配关键词（报告问题描述中可能出现） |
|------|------------|----------------|-----------------------------------|
| 需求完整性 | 覆盖所有用户场景 | prd_req_completeness_scenarios | 用户场景、场景覆盖 |
| 需求完整性 | 边界条件明确 | prd_req_completeness_boundary | 边界条件、边界 |
| 需求完整性 | 异常流程考虑 | prd_req_completeness_exception | 异常流程、异常 |
| 可测试性 | 验收标准明确 | prd_testability_criteria | 验收标准、AC |
| 可测试性 | 可验证 | prd_testability_verifiable | 可验证 |
| 可测试性 | 测试场景清晰 | prd_testability_scenarios | 测试场景 |
| 一致性 | 与Product Brief一致 | prd_consistency_brief | Product Brief、PB |
| 一致性 | 内部逻辑自洽 | prd_consistency_logic | 逻辑自洽 |
| 一致性 | 术语统一 | prd_consistency_terminology | 术语、统一 |
| 可追溯性 | 需求有唯一ID | prd_traceability_req_id | 唯一ID、需求ID、REQ-ID |
| 可追溯性 | 需求描述足够详细以便追溯 | prd_traceability_detail | 追溯、描述详细 |
| 可追溯性 | 依赖关系明确 | prd_traceability_dependency | 依赖关系 |

## arch 模式（4 维度）

| 维度 | checks 原文 | 可映射 item_id | 匹配关键词 |
|------|------------|----------------|-----------|
| 技术可行性 | 方案可实现 | arch_tech_feasibility_implementable | 可实现、方案 |
| 技术可行性 | 技术选型合理 | arch_tech_feasibility_choice | 技术选型、选型 |
| 技术可行性 | 资源需求明确 | arch_tech_feasibility_resource | 资源需求 |
| 扩展性 | 未来3年可持续 | arch_scalability_sustainability | 可持续、3年 |
| 扩展性 | 水平扩展能力 | arch_scalability_horizontal | 水平扩展、扩展能力 |
| 扩展性 | 向后兼容 | arch_scalability_compat | 向后兼容、兼容 |
| 安全性 | 威胁建模完整 | arch_security_threat_model | 威胁建模、ADR |
| 安全性 | 安全控制措施 | arch_security_controls | 安全控制 |
| 安全性 | 数据保护 | arch_security_data_protection | 数据保护 |
| 成本效益 | ROI合理 | arch_cost_roi | ROI、投资回报 |
| 成本效益 | 运维成本可控 | arch_cost_ops | 运维成本 |
| 成本效益 | 人力成本估算 | arch_cost_human | 人力成本 |

## story 模式（Create Story 审计）

code-reviewer-config 无独立 story 模式；Create Story 报告维度（如 sample-story-report）：需求覆盖、可追溯性、可实施性。
采用 BUGFIX §4.3 示例 + 通用项：

| 类型 | item_id | 匹配说明 |
|------|---------|----------|
| overall | story_overall | 问题清单为空或从维度评分 |
| 检查项 | story_coverage_req | 覆盖需求与 Epic |
| 检查项 | story_traceability | 可追溯性 |
| 检查项 | story_implementability | 可实施性 |
