# IMPLEMENTATION_GAPS-E2-S1：eval-rules-yaml-config

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.1  
**输入**：plan-E2-S1.md、当前代码库 scoring/、config/

---

## 1. 现状摘要

- **已有**：scoring/core、scoring/constants、scoring/schema/run-score-schema.json、scoring/writer、scoring/__tests__；config/code-reviewer-config.yaml（含 modes: code/prd/arch/pr，无 item_id、veto_* 结构）；scoring/rules/ 下 implement-scoring.yaml、tasks-scoring.yaml、spec-scoring.yaml、plan-scoring.yaml（均为占位符）。
- **缺失**：scoring/rules/default/ 子目录；环节 2/3/4 的完整 YAML（implement、test、bugfix 符合 schema）；gaps-scoring.yaml、iteration-tier.yaml；YAML 解析器；ref 解析与 code-reviewer-config 的 item_id 扩展；单元测试与验收脚本。

---

## 2. 差距列表

| Gap ID | 描述 | plan 对应 | 优先级 |
|--------|------|-----------|--------|
| G1 | scoring/rules/default/ 目录不存在；环节 2/3/4 YAML 未按 Architecture §9.1 置于 default/ | plan §4 | P0 |
| G2 | implement-scoring.yaml 为占位符，缺 version、stage、link_stage、link_环节、weights、items、veto_items | plan §2.1、§4 | P0 |
| G3 | test-scoring.yaml、bugfix-scoring.yaml 不存在 | plan §4 | P0 |
| G4 | gaps-scoring.yaml 不存在；缺前置 40%、后置 implement/post_impl 权重结构 | plan §2.2、§4 | P0 |
| G5 | iteration-tier.yaml 不存在；缺 iteration_tier、severity_override | plan §2.3、§4 | P0 |
| G6 | YAML 解析器未实现：无 scoring/parsers/rules.ts 或 scoring/rules/parser.ts | plan §3 | P0 |
| G7 | ref 解析未实现：无法将 ref 关联 code-reviewer-config；item_id 不存在时无明确报错 | plan §3.2、§3.3 | P0 |
| G8 | code-reviewer-config 无 items、veto_items 的 item_id 结构；ref 指向的 id 无法解析 | plan §3.3 | P0 |
| G9 | 环节 2/3/4 的 TypeScript 类型或 JSON schema 未定义 | plan §2.1 | P1 |
| G10 | scoring/__tests__/rules/*.test.ts 缺失；AC-1～AC-7 无单元/集成测试 | plan §5 | P0 |
| G11 | scripts/accept-e2-s1.ts 缺失；AC-1～AC-7 无自动化验收 | plan §4、Story §6 | P0 |

---

## 3. 与 plan 的对应关系

- **G1–G5**：创建 scoring/rules/default/；实现 implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml、gaps-scoring.yaml、iteration-tier.yaml，符合 schema。
- **G6–G7**：实现 scoring/parsers/rules.ts（或 scoring/rules/parser.ts），支持 loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml、resolveRef；ref 不存在时抛 RefResolutionError。
- **G8**：在 config/code-reviewer-config.yaml 中扩展 items、veto_items 节，补充与 rules 中 ref 对应的 item_id。
- **G9**：定义 PhaseScoringYaml、GapsScoringYaml、IterationTierYaml 类型；可选 phases-scoring-schema.json。
- **G10–G11**：scoring/__tests__/rules/*.test.ts、scripts/accept-e2-s1.ts，覆盖 AC-1～AC-7。

---

## 4. 非差距（无需本 Story 实现）

- 权威文档（Story 2.2）；全链路 Skill 编排（Story 3.x）；一票否决与阶梯扣分业务逻辑（Story 4.1）；scoring/core、scoring/writer 已存在，本 Story 不修改。

---

## 5. 闭合条件

- scoring/rules/default/ 下 implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml 存在且 schema 校验通过；scoring/rules/gaps-scoring.yaml、iteration-tier.yaml 存在且可解析；解析器可加载 YAML、解析 ref、产出结构化配置；item_id 不存在时明确报错；单测与 accept-e2-s1.ts 全部通过。
