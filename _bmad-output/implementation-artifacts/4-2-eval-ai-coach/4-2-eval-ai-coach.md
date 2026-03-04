# Story 4.2：eval-ai-coach

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.2  
**Slug**：eval-ai-coach  
**描述**：实现 AI 代码教练定位、职责、人格、技能配置（引用全链路 Skill）、工作流、输出格式（summary/phase_scores/weak_areas/recommendations/iteration_passed）、一票否决权；禁止「面试」主导表述（REQUIREMENTS §3.14）

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **AI 代码教练定位与职责**
   - 定位：用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案；作为「现有全流程各审计闭环的重要输出和迭代结束标准」的承载者
   - 职责边界：解读评分、定位短板、给出改进方向；设计题池补充、权重调整、检查项细化等可落地方案（建议型，非直接执行）
   - 与全流程 Code Reviewer 的关系：非替代、非并列；教练消费 Reviewer（及全链路 Skill）的产出，不重复执行审计

2. **人格定义**：资深工程师视角、工业级标准、可落地导向；输出风格：精准、可执行、无模糊表述

3. **技能配置**
   - 引用全链路 Code Reviewer Skill（必引）；speckit-workflow、bmad-story-assistant 在 post_impl 阶段按配置引用
   - fallback：若全链路 Skill 不可用，可降级为「仅解读既有 scoring 存储中的已有数据」，不执行新审计

4. **工作流**
   - 与 BMAD 五层、六环节、迭代结束标准的衔接：教练在各 stage 审计完成且得分写入后可被触发
   - 输入：scoring 存储中 run_id 对应数据
   - 输出：综合诊断报告（含 summary、phase_scores、weak_areas、recommendations、iteration_passed）
   - 触发时机：手动触发（用户请求「对本轮迭代做教练诊断」）或阶段式触发（post_impl 完成后按配置决定是否自动触发）；默认不强制，由配置决定

5. **输出格式**：含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed` 等字段；支持 JSON 与 Markdown；与 §3.6 schema 兼容

6. **一票否决权**：教练输出 `iteration_passed: false` 时，对全流程迭代达标行使一票否决（见 §3.4.2）

7. **禁止表述**：教练产出不得以「面试」为主导；仅可保留「成果可用于对外能力说明等场景」等中性表述（REQUIREMENTS §3.14）

### 1.2 本 Story 不包含

- 一票否决项与环节映射、多次迭代阶梯式扣分、Epic 级 veto（由 Story 4.1 实现）
- 全链路 Skill 定义、Layer1-3 解析、scoring 写入（由 Story 3.1、3.2、3.3 实现）
- 场景区分、BMAD 五层集成（由 Story 4.3 实现）
- 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md 产出（由 Story 2.2 实现）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | AI 代码教练定位、职责、人格定义明确，与 REQUIREMENTS §3.14 一致 | 文档或代码注释；与 §3.14 逐项对照 |
| AC-2 | 技能配置引用全链路 Skill；fallback 行为明确 | 配置或代码；单测或验收脚本覆盖 fallback 路径 |
| AC-3 | 工作流：输入 run_id/scoring 存储，输出含 summary、phase_scores、weak_areas、recommendations、iteration_passed | 单测或集成测试：给定 scoring 数据，断言输出格式符合 schema |
| AC-4 | 一票否决权：iteration_passed: false 时，全流程迭代不达标 | 逻辑或文档明确；可验证 |
| AC-5 | 教练产出无「面试」主导表述；仅有中性表述（如「成果可用于对外能力说明等场景」） | 全文检索教练产出；禁止词表校验 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.12~3.17 | AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式、一票否决权 |
| §3.14 | AI 代码教练（AI Code Coach）整节 |
| §3.4.2 | 角色一票否决权（AI 代码教练） |

---

## 4. 依赖

- **前置 Story**：Story 3.3（eval-skill-scoring-write）。教练消费 3.3 写入的 scoring 存储；依赖 Story 1.1/1.2 的 schema。
- 依赖 Story 4.1 的一票否决规则定义（角色 veto 权），本 Story 实现教练侧的 veto 执行（iteration_passed）。

---

*本 Story 实现 AI 代码教练，与 Story 3.3 的 scoring 写入及 4.1 的一票否决规则衔接，满足 REQUIREMENTS §3.14。*
