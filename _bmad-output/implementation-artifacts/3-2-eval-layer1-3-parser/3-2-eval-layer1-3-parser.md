# Story 3.2：eval-layer1-3-parser

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**描述**：实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts-prd/arch、Create Story 审计报告提取维度，映射环节 1 检查项，约定 AUDIT_Story_{epic}-{story}.md 路径

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **从审计报告解析出评分记录（Layer 1–3 同机解析）**
   - Layer 1：从 prd、arch 阶段审计产出（audit-prompts-prd/arch 等）解析出可映射到环节 1（需求拆解与方案设计）的维度与检查项结果
   - Layer 3：从 Create Story 审计报告解析出 story 阶段的可评分维度，映射到环节 1 检查项
   - 同机解析：在同一执行环境中读取审计报告文件，解析为结构化数据，产出符合 Story 1.1 存储 schema 的评分记录（或中间结构，供 3.3 写入）
   - 报告路径约定：AUDIT_Story_{epic}-{story}.md 等路径在 3.1 约定基础上在本 Story 中实现解析

2. **解析输出与 schema 对齐**
   - 解析结果包含 phase_score、phase_weight、check_items（item_id、passed、score_delta、note）等字段，与 Story 1.1 的 schema 一致，便于 Story 3.3 直接写入

### 1.2 本 Story 不包含

- 解析结果的持久化写入（由 Story 3.3 实现）
- 全链路 Skill 的编排与触发定义（由 Story 3.1 实现）
- 与 speckit-workflow、bmad-story-assistant 的协同与触发模式表（由 Story 3.3 实现）
- 一票否决、多次迭代阶梯式扣分（由 Story 4.1 实现）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 给定 Layer 1 审计报告（prd/arch），解析器可产出环节 1 的评分相关结构（phase_score、check_items 等），且与 Story 1.1 schema 兼容 | 单元测试：注入样本报告，断言输出结构及必填字段存在 |
| AC-2 | 给定 Layer 3 Create Story 审计报告（符合 AUDIT_Story_{epic}-{story}.md 约定），解析器可产出环节 1 的评分相关结构 | 单元测试或验收脚本：样本报告路径与解析结果校验 |
| AC-3 | 解析逻辑与 3.1 约定的报告路径、命名一致；文档或代码中明确支持的报告路径列表 | 文档或常量表；测试覆盖约定路径 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-2.1~2.5 | 表 A 阶段与审计产出的对应；从审计报告提取维度并映射到环节 1 |
| REQ-3.12~3.17 | Layer 1–3 同机解析、审计产出到评分环节的映射、检查项提取 |

---

## 7. 依赖

- **前置 Story**：Story 3.1（eval-lifecycle-skill-def）。依赖 3.1 的 stage 与报告路径约定、环节映射。
- 依赖 Story 1.1 的存储 schema（解析输出与之对齐）；不依赖 1.2 的写入实现。

---

*本 Story 实现从审计报告解析出评分记录（Layer 1–3 同机解析），为 Story 3.3 的写入提供结构化输入。*
