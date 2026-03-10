# Story 2.1：eval-rules-yaml-config

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.1  
**描述**：实现 scoring/rules 下环节 2/3/4 的 YAML schema，与 code-reviewer-config 通过 ref 衔接，veto_items、weights、items 结构，gaps-scoring.yaml、iteration-tier.yaml

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **环节 2/3/4 的 YAML schema 定义与解析**
   - scoring/rules/ 下环节 2（代码生成与工程规范）、环节 3（测试用例与质量保障）、环节 4（调试与 bug 修复）的 YAML schema 定义
   - 与 config/code-reviewer-config 通过 `ref: code-reviewer-config#item_id` 的配置引用关系
   - weights（base、bonus）、items、veto_items 在 YAML 中的结构与校验
   - 解析器读入 YAML 并产出供评分核心使用的结构化配置（权重、检查项、否决项、迭代档位）

2. **gaps-scoring.yaml**
   - gaps 前置完整性、后置闭合度的评分规则 schema
   - 与环节 1 补充、环节 2/6 子维度的配置结构

3. **iteration-tier.yaml**
   - 多次迭代阶梯式扣分配置：1 次 100%、2 次 80%、3 次 50%、≥4 次 0%
   - severity_override（致命/严重问题差异化）

4. **ref 衔接实现**
   - items 中 `ref: code-reviewer-config#item_id` 的解析与校验
   - veto_items 中 `ref: code-reviewer-config#veto_*` 的解析与校验
   - 解析器可解析 ref 并关联 code-reviewer-config 中的检查项

### 1.2 本 Story 不包含

- 权威文档 `scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md` 的编写与 24 项内容（由 Story 2.2 eval-authority-doc 实现）
- 全链路 Skill 编排与触发、审计报告解析、scoring 写入（由 Story 3.1 eval-lifecycle-skill-def、Story 3.2 eval-layer1-3-parser、Story 3.3 eval-skill-scoring-write 实现）
- 一票否决与多次迭代阶梯式扣分的业务逻辑实现（由 Story 4.1 eval-veto-iteration-rules 实现；本 Story 仅提供 rules 中的配置与解析）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 环节 2、环节 3、环节 4 的 YAML 文件符合既定 schema，含 version、stage、link_环节、weights（base/bonus）、items、veto_items（如适用） | 给定合法 YAML，解析成功；给定违反 schema 的 YAML，解析报错或校验失败 |
| AC-2 | items 中每项含 id、ref、deduct；ref 格式为 `code-reviewer-config#item_id` |  schema 校验与解析器单元测试 |
| AC-3 | veto_items 中每项含 id、ref、consequence；ref 指向 code-reviewer-config 的 veto_* 检查项 | schema 校验与解析器单元测试 |
| AC-4 | gaps-scoring.yaml 可被解析器读取，产出结构化对象（前置 40%、后置 implement/post_impl 权重等） | 单元测试：解析后结构与 Architecture §9 约定一致 |
| AC-5 | iteration-tier.yaml 可被解析器读取，产出 iteration_tier（1→1.0、2→0.8、3→0.5、4→0）与 severity_override | 单元测试：解析后结构与 Architecture §9.3 约定一致 |
| AC-6 | 解析器可解析 ref 并解析被引用的 code-reviewer-config 配置；ref 指向的 item_id 在 config 中存在或解析器给出明确错误 | 集成测试或验收脚本证明 ref 解析路径可用 |
| AC-7 | scoring/rules/default/ 下 implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml 分别对应环节 2、3、4 | 文件存在且 schema 校验通过 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.1 | 设计原则中的可追溯、可优化：规则以 YAML 配置化，与 code-reviewer-config 衔接 |
| REQ-3.3~3.4 | 环节 2/3/4 的检查项、权重、否决项在 rules 中的可配置表达；veto_items 与环节映射 |
| REQ-3.7 | Implementation Gaps 评审规则：gaps-scoring.yaml 承载前置 40%、后置 implement/post_impl 权重 |
| REQ-3.8 | 多次迭代阶梯式扣分：iteration-tier.yaml 承载 1/2/3/≥4 次档位与 severity_override |
| REQ-3.12 | 评分规则版本与目录：scoring/rules/ 可版本化、可插拔；与 code-reviewer-config 通过 ref 衔接 |
| REQ-3.14 | 评分规则配置示例：环节 2/3/4、gaps、iteration_tier 的 YAML schema |
| REQ-3.15~3.17 | 评分规则与 Code Reviewer、审计环节的配置化与引用关系；全链路 Skill 引用 scoring/rules |

---

## 4. Architecture 约束

| 约束项 | 说明 |
|--------|------|
| 引用关系 | scoring/rules/*.yaml 通过 `ref: code-reviewer-config#item_id` 引用 config/code-reviewer-config；veto_items 通过 `ref: code-reviewer-config#veto_*` 引用一票否决检查项 |
| 目录结构 | scoring/rules/default/ 含 implement-scoring.yaml（环节 2）、test-scoring.yaml（环节 3）、bugfix-scoring.yaml（环节 4）；gaps-scoring.yaml、iteration-tier.yaml 置于 scoring/rules/ 根目录 |
| YAML schema | 环节 2/3/4 文件含 version、stage、link_stage、link_环节、weights（base、bonus）、items（id、ref、deduct）、veto_items（id、ref、consequence） |
| iteration-tier | 含 iteration_tier（1:1.0、2:0.8、3:0.5、4:0）与 severity_override（fatal、serious 档位） |
| 加载优先级 | 优先加载 scoring/rules；_bmad-output/config 的 code-reviewer-score 可覆盖，不得替代 scoring/rules 的完整定义 |
| code-reviewer-config | 路径为 config/code-reviewer-config.yaml；若 ref 指向的 item_id 不存在，Story 2.1 须在 config 中补充或约定占位，确保解析时无歧义 |

---

## 5. 禁止词表合规

本 Story 文档及产出物禁止使用以下表述：

- 可选
- 后续
- 待定
- 酌情
- 视情况
- 先实现
- 或后续扩展

---

## 6. 实施任务分解

| Task ID | 任务描述 | 产出物 |
|---------|----------|--------|
| T1 | 定义环节 2/3/4 的 YAML schema（TypeScript 类型或 JSON schema） | scoring/schema/phases-scoring-schema.json 或等效 |
| T2 | 实现 scoring/rules/default/implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml，含 weights、items、veto_items 及 ref 字段 | 三个 YAML 文件 |
| T3 | 实现 gaps-scoring.yaml，含前置 40%、后置 implement/post_impl 权重结构 | scoring/rules/gaps-scoring.yaml |
| T4 | 实现 iteration-tier.yaml，含 iteration_tier（1/2/3/4）、severity_override | scoring/rules/iteration-tier.yaml |
| T5 | 实现 YAML 解析器，支持 ref 解析并关联 code-reviewer-config | scoring/rules/parser.ts 或等效模块 |
| T6 | 在 code-reviewer-config 中补充或约定 items、veto_items 的 item_id，与 rules 中 ref 对应 | config/code-reviewer-config.yaml 更新或文档 |
| T7 | 编写本 Story 对应的单元测试与集成测试（AC-1~AC-7） | scoring/__tests__/rules/*.test.ts 或等效 |

---

## 7. 依赖

- **前置 Story**：Story 1.1（eval-system-scoring-core）。依赖 1.1 的环节定义、目录结构（scoring/rules/、scoring/data/、scoring/docs/）、表 A/B 映射。
- 依赖 Architecture 中 scoring/rules 与 code-reviewer-config 引用关系的约定（§2、§9）。
- 依赖 PRD REQ-3.12、REQ-3.14 的完整定义。

---

*本 Story 实现评分规则 YAML 配置与解析，为 Story 2.2、3.1、4.1 提供规则数据源。*
