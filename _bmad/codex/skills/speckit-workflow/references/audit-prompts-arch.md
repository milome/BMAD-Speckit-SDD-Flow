# Architecture审计提示词

## 审计对象
Architecture Design Document (架构设计文档)

## 审计目标
验证架构设计是否承接了 PRD 的关键产品合同，尤其是 `P0 journey`、`key path sequence`、`business completion state vs system completion state`、`sync / async boundary`、`failure handling`、`smoke E2E preconditions` 与 `observability / traceability`。

## 审计维度

### 1. 技术可行性（30%）

**检查项**：
- [ ] 技术选型有充分的理由和依据
- [ ] 架构可以在给定的资源内实现
- [ ] 所需技术和工具成熟且可获得
- [ ] 每条关键 `P0 journey` 都有对应 `key path sequence`
- [ ] 关键路径中的 `sync / async boundary` 已定义

**评分标准**：
- A: 技术方案成熟可行，关键路径清晰
- B: 基本可行，有部分风险需要关注
- C: 可行性存疑，关键路径仍有空白
- D: 不可行或风险过高

### 2. 扩展性（25%）

**检查项**：
- [ ] 架构支持未来业务增长
- [ ] 新功能可以在不破坏关键路径的情况下添加
- [ ] `business completion state` 与 `system completion state` 的差异已定义
- [ ] 异步边界、重试、补偿或幂等策略足够支撑扩展

**评分标准**：
- A: 扩展性优秀，关键状态语义明确
- B: 良好的扩展性，基本满足未来需求
- C: 扩展性有限，状态/异步策略存在缺口
- D: 缺乏扩展性考虑，很快会遇到瓶颈

### 3. 安全性（25%）

**检查项**：
- [ ] 进行了威胁建模并记录了主要威胁
- [ ] 针对每个威胁有相应安全控制措施
- [ ] 数据传输和存储安全性有考虑
- [ ] 身份认证和授权机制与 actor / permission 约束一致
- [ ] 失败路径、补偿策略、审计日志与追踪信息可用于安全排查

**评分标准**：
- A: 全面的安全设计，威胁与追踪链完整
- B: 良好的安全设计，主要威胁已覆盖
- C: 安全设计有遗漏，存在中等风险
- D: 安全设计严重不足，存在高风险

### 4. 成本效益（20%）

**检查项**：
- [ ] 基础设施成本估算合理
- [ ] 运维成本可控
- [ ] `minimum observability contract` 成本与收益平衡
- [ ] `smoke E2E preconditions` 与 fixture / environment 方案可实际维护

**评分标准**：
- A: 成本效益优秀，关键运维合同明确
- B: 成本效益良好，基本合理
- C: 成本偏高或测试/观测成本不清
- D: 成本过高或 ROI 不明确

## Tradeoff分析审计

每个重大架构决策必须有 ADR（Architecture Decision Record）或等价 tradeoff 说明。

**ADR检查项**：
- [ ] 决策背景描述清晰
- [ ] 考虑了至少 2 个备选方案
- [ ] 每个方案的优缺点分析到位
- [ ] 决策理由充分且能回指关键路径需求
- [ ] 决策后果（正面和负面）分析完整
- [ ] 关键路径、smoke E2E、failure handling 是否被纳入决策后果分析

## 输出格式

```text
Architecture审计报告
====================

审计对象: [Architecture文档名]
审计日期: [YYYY-MM-DD]

总体评级: [A/B/C/D]

维度评分:
1. 技术可行性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
2. 扩展性: [A/B/C/D] ([得分]/25)
   - [具体问题描述]
3. 安全性: [A/B/C/D] ([得分]/25)
   - [具体问题描述]
4. 成本效益: [A/B/C/D] ([得分]/20)
   - [具体问题描述]

关键合同检查:
- P0 Journey Coverage: [通过/未通过]
- Key Path Sequence Coverage: [通过/未通过]
- Business Completion State vs System Completion State: [通过/未通过]
- Smoke E2E Preconditions: [通过/未通过]
- Observability / Traceability Contract: [通过/未通过]
- Failure Handling / Compensation: [通过/未通过]

Tradeoff分析审计:
- ADR覆盖率: [X/Y] 个重大决策
- ADR质量评级: [A/B/C/D]
- [具体问题描述]

问题清单:
1. [严重程度:高/中/低] [问题描述] [建议修改]
2. ...

通过标准:
- 总体评级A或B: 通过，可进入下一阶段
- 总体评级C: 有条件通过，必须修复高/中 severity 问题
- 总体评级D: 不通过，需要重大修改

下一步行动:
[具体建议]
```

## 特殊检查

### 复杂度评估验证
- [ ] Architecture 的复杂度评估是否合理
- [ ] Party-Mode 触发条件是否正确应用
- [ ] 评估结果与实际架构复杂度是否匹配

### 与PRD的一致性
- [ ] 架构设计是否满足 PRD 中的所有关键 journeys
- [ ] PRD 的 evidence contract 是否在架构中有承接
- [ ] 架构约束是否传递到下游文档
- [ ] 技术方案与业务目标、关键路径、验证方式对齐

### Readiness-to-Implement 审计
- [ ] 是否存在没有 key path sequence 的关键路径
- [ ] 是否存在没有 smoke E2E 前提的关键 journey
- [ ] 是否存在 business done / system accepted 语义不清的路径
- [ ] 是否存在 failure handling、fixture、environment 仍需实现者猜测的未定义合同

---

## 批判审计员检查（standard/strict 模式必须）

审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
