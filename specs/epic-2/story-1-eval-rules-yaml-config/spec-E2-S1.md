# spec-E2-S1：eval-rules-yaml-config 技术规格

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.1  
**来源**：2-1-eval-rules-yaml-config.md、Architecture §2、§8、§9、REQUIREMENTS §3.11

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

实现 scoring/rules 下环节 2/3/4 的 YAML schema 定义与解析，与 config/code-reviewer-config 通过 `ref: code-reviewer-config#item_id` 衔接；实现 gaps-scoring.yaml（前置 40%、后置 implement/post_impl 权重）、iteration-tier.yaml（1 次 100%、2 次 80%、3 次 50%、≥4 次 0%，severity_override）；实现 YAML 解析器，支持 ref 解析并产出供 scoring/core 或 Story 3.x 使用的结构化配置。不包含权威文档编写（Story 2.2）、全链路 Skill 编排（Story 3.x）、一票否决与阶梯扣分业务逻辑（Story 4.1）。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| 环节 2/3/4 的 YAML schema 定义与校验 | scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 24 项 |
| implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml | 全链路 Skill 编排、审计报告解析、scoring 写入 |
| gaps-scoring.yaml（前置 40%、后置 implement/post_impl） | 一票否决、阶梯扣分业务逻辑（仅提供配置与解析） |
| iteration-tier.yaml（iteration_tier、severity_override） | |
| ref 解析：code-reviewer-config#item_id、veto_* | |
| 解析器产出结构化配置（权重、items、veto_items、迭代档位） | |
| code-reviewer-config 的 item_id / veto_* 扩展（若需） | |

---

## 2. 与 Architecture §9、Story 1.1 的衔接

### 2.1 目录结构

```
scoring/
├── rules/
│   ├── default/
│   │   ├── implement-scoring.yaml    # 环节 2
│   │   ├── test-scoring.yaml         # 环节 3
│   │   └── bugfix-scoring.yaml       # 环节 4
│   ├── gaps-scoring.yaml
│   └── iteration-tier.yaml
├── data/
├── docs/
└── schema/
```

与 Story 1.1 的 scoring/rules/、scoring/data/、scoring/docs/ 一致。

### 2.2 环节 2/3/4 YAML Schema 核心结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 是 | 规则版本，如 "1.0" |
| stage | string | 是 | implement / test / bugfix 等 |
| link_stage | string[] | 是 | 关联 stages，如 [tasks, post_impl] |
| link_环节 | number | 是 | 2 / 3 / 4 |
| weights | object | 是 | base、bonus 子对象 |
| items | array | 是 | 每项含 id、ref、deduct |
| veto_items | array | 是（可空） | 每项含 id、ref、consequence |

**items 项**：
- id：string，检查项本地标识
- ref：string，格式 `code-reviewer-config#item_id`
- deduct：number，扣分数值

**veto_items 项**：
- id：string，否决项本地标识
- ref：string，格式 `code-reviewer-config#veto_*`
- consequence：string，如 stage_0_level_down

### 2.3 ref 解析约定

- ref 格式：`code-reviewer-config#item_id` 或 `code-reviewer-config#veto_xxx`
- 解析器需加载 config/code-reviewer-config.yaml，按 item_id 查找对应检查项
- 若 ref 指向的 item_id 在 config 中不存在，解析器给出明确错误（抛错或返回校验失败），不得静默忽略

### 2.4 gaps-scoring.yaml 结构

- version、stage: gaps、link_stage、link_环节
- weights：前置 spec_coverage 40%、后置 implement/post_impl 权重
- veto_items：gaps_pre_0_veto 等 consequence（Architecture §9、REQUIREMENTS §3.11）

### 2.5 iteration-tier.yaml 结构

- iteration_tier：1→1.0、2→0.8、3→0.5、4→0（Architecture §9.3）
- severity_override：fatal: 3、serious: 2 等

---

## 3. 验收标准映射

| AC | 验收标准 | spec 对应 |
|----|----------|-----------|
| AC-1 | 环节 2/3/4 YAML 符合 schema，含 version、stage、link_环节、weights、items、veto_items | §2.2、§2.3 |
| AC-2 | items 每项含 id、ref、deduct；ref 格式 code-reviewer-config#item_id | §2.2 |
| AC-3 | veto_items 每项含 id、ref、consequence；ref 指向 veto_* | §2.2 |
| AC-4 | gaps-scoring.yaml 可解析，产出前置 40%、后置 implement/post_impl 权重 | §2.4 |
| AC-5 | iteration-tier.yaml 可解析，产出 iteration_tier、severity_override | §2.5 |
| AC-6 | 解析器可解析 ref 并关联 code-reviewer-config；item_id 不存在时明确报错 | §2.3 |
| AC-7 | scoring/rules/default/ 下 implement/test/bugfix-scoring.yaml 分别对应环节 2/3/4 | §2.1 |

---

## 4. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.1 | 规则以 YAML 配置化，与 code-reviewer-config 衔接 |
| REQ-3.3~3.4 | 环节 2/3/4 的检查项、权重、否决项在 rules 中的可配置表达 |
| REQ-3.7 | Implementation Gaps 评审规则：gaps-scoring.yaml |
| REQ-3.8 | 多次迭代阶梯式扣分：iteration-tier.yaml |
| REQ-3.12 | 评分规则版本与目录；与 code-reviewer-config 通过 ref 衔接 |
| REQ-3.14 | 环节 2/3/4、gaps、iteration_tier 的 YAML schema |
| REQ-3.15~3.17 | 评分规则与 Code Reviewer、审计环节的配置化与引用关系 |

---

## 5. 需求映射清单（spec ↔ Story 文档）

| Story § | 要点 | spec 对应 |
|---------|------|-----------|
| §1.1 环节 2/3/4 YAML schema | version、stage、weights、items、veto_items、ref | §2.2 |
| §1.1 gaps-scoring.yaml | 前置 40%、后置 implement/post_impl | §2.4 |
| §1.1 iteration-tier.yaml | 1/2/3/4 档位、severity_override | §2.5 |
| §1.1 ref 衔接 | items/veto_items 中 ref 解析与校验 | §2.3 |
| §2 验收标准 AC-1～AC-7 | 全部 | §3 |
| §4 Architecture 约束 | 目录结构、引用关系、YAML schema、iteration-tier | §2 |

---

## 6. 禁止词表合规

本 spec 及后续 plan/GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。

---

## 7. 自审结论

- **Scope**：Story 2.1 §1.1 四项均已覆盖。
- **验收标准**：AC-1～AC-7 均有 spec 对应。
- **PRD 追溯**：REQ-3.1、3.3~3.4、3.7、3.8、3.12、3.14、3.15~3.17 已映射。
- **与 Architecture 衔接**：§9.1 目录结构、§9.2 YAML schema、§9.3 iteration_tier 已明确。
- **禁止词表**：已合规。
