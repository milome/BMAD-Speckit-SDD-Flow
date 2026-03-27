# PRD审计提示词

## 审计对象
Product Requirements Document (PRD)

## 审计目标
验证 PRD 是否真正定义了可落地的产品合同，而不仅是需求摘要。审计必须显式检查 `P0 journey`、`journey evidence contract`、`actor-permission-state matrix`、`failure matrix`、`smoke E2E` 前提以及需求追溯完整性。

## 审计维度

### 1. 需求完整性（40%）

**检查项**：
- [ ] PRD 是否覆盖了 Product Brief 中的所有核心需求
- [ ] 是否建立了完整的 `P0 Journey Inventory`
- [ ] 每条关键 journey 是否包含 actor / permission / state transition
- [ ] 是否定义了边界条件、异常情况与 failure path
- [ ] 是否明确了非功能性需求（性能、安全、可用性）
- [ ] 是否考虑了国际化 / 本地化需求（如适用）

**评分标准**：
- A: 所有检查项通过，无遗漏
- B: 大部分检查项通过，minor 遗漏
- C: 部分检查项未通过，存在重要遗漏
- D: 大量检查项未通过，严重遗漏

### 2. 可测试性（30%）

**检查项**：
- [ ] 每条关键需求或 journey 都有明确的验收标准
- [ ] 是否定义了 `journey evidence contract`（成功证据 / 失败证据）
- [ ] 验收标准是否可验证（可量化、可演示或可观测）
- [ ] 是否定义了 smoke E2E 生成前提或最小验证方式
- [ ] 是否说明了测试数据、fixture、环境依赖（如需要）

**评分标准**：
- A: 所有需求都有清晰可验证的证据与验收标准
- B: 大部分需求有验收标准，部分证据可补强
- C: 部分需求缺少验收标准、证据类型或 E2E 前提
- D: 大量需求缺少验收标准或不可验证

### 3. 一致性（30%）

**检查项**：
- [ ] PRD 与 Product Brief 的目标和范围一致
- [ ] PRD 内部逻辑自洽，无矛盾
- [ ] 术语使用统一，有明确术语表
- [ ] 是否建立 `actor-permission-state matrix`
- [ ] 是否建立 `failure matrix`
- [ ] 需求优先级、journey 优先级与业务目标一致

**评分标准**：
- A: 完全一致，逻辑严密
- B: 基本一致，minor 不一致
- C: 存在明显不一致或矩阵缺口
- D: 严重不一致或矛盾

## 输出格式

```text
PRD审计报告
============

审计对象: [PRD文件名]
审计日期: [YYYY-MM-DD]

总体评级: [A/B/C/D]

维度评分:
1. 需求完整性: [A/B/C/D] ([得分]/40)
   - [具体问题描述]
2. 可测试性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]
3. 一致性: [A/B/C/D] ([得分]/30)
   - [具体问题描述]

关键合同检查:
- P0 Journey Inventory: [通过/未通过]
- Journey Evidence Contract: [通过/未通过]
- Actor-Permission-State Matrix: [通过/未通过]
- Failure Matrix: [通过/未通过]
- Smoke E2E Preconditions: [通过/未通过]

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
- [ ] PRD 的复杂度评估是否合理
- [ ] Party-Mode 触发条件是否正确应用
- [ ] 评估结果与实际需求是否匹配

### 需求追溯准备
- [ ] PRD 中的 journey / requirement 是否有唯一 ID
- [ ] 需求描述是否足够详细以便追溯到 epic / story / smoke path
- [ ] 是否明确了与其他 journey 或 requirement 的依赖关系

### Journey-First 审计
- [ ] 是否存在遗漏的 P0 路径
- [ ] 是否存在只有 happy path、没有 failure path 的关键 journey
- [ ] 是否存在成功验收但没有成功证据定义的路径
- [ ] 是否存在依赖 fixture / 环境却未定义的关键路径

---

## 批判审计员检查（standard/strict 模式必须）

审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
