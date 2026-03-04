# AI 代码评测体系 — Epics 与 Story 列表

**版本**：1.0  
**来源**：prd.ai-code-eval-system.md、architecture.ai-code-eval-system.md

---

## 1. Epic 列表

| ID | 名称 | 描述 | 预估工时 | 优先级 |
|----|------|------|----------|--------|
| E1 | feature-eval-scoring-core | 评分核心：四层架构（六环节→四能力维度→综合百分制→L1-L5）、存储 schema、scoring 目录结构、表 A/B 映射 | 5d | P0 |
| E2 | feature-eval-rules-authority | 评分规则与权威文档：scoring/rules YAML、code-reviewer-config ref、SCORING_CRITERIA_AUTHORITATIVE.md、gaps/iteration_tier、环节 3–6 schema | 4d | P0 |
| E3 | feature-eval-lifecycle-skill | 全链路 Skill 与编排：全链路 Code Reviewer Skill、Layer 1–3 同机解析、审计产出解析、scoring 写入、与 speckit-workflow/bmad-story-assistant 协同 | 5d | P0 |
| E4 | feature-eval-coach-veto-integration | AI 代码教练、一票否决、场景与 BMAD 集成：教练定位与输出、角色/Epic 级一票否决、多次迭代阶梯式扣分、场景区分、迭代结束标准、BMAD 五层集成 | 4d | P0 |

---

## 2. Story 列表

### Epic 1：feature-eval-scoring-core

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 1.1 | eval-system-scoring-core：实现四层架构（六环节分项评分、四能力维度聚合、综合百分制、L1-L5 等级）、六环节权重 20/25/25/15/10/5、存储 schema（run_id/scenario/stage/phase_score/check_items/iteration_count/iteration_records/first_pass）、scoring/data 与 scoring/rules 目录结构、表 A 表 B 映射 | 无 | 3d | 低 |
| 1.2 | eval-system-storage-writer：实现评分写入逻辑，支持 JSON/JSONL 追加模式，单次运行单文件与 scores.jsonl 双模式，check_items 明细结构 | E1.1 | 2d | 低 |

### Epic 2：feature-eval-rules-authority

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 2.1 | eval-rules-yaml-config：实现 scoring/rules 下环节 2/3/4 的 YAML schema，与 code-reviewer-config 通过 ref 衔接，veto_items、weights、items 结构，gaps-scoring.yaml、iteration-tier.yaml | E1.1 | 2d | 中 |
| 2.2 | eval-authority-doc：产出 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容（BMAD 五层、阶段→环节映射、检查项清单、一票否决、L1-L5、schema、Code Reviewer 整合、Epic 综合评分等），与 scoring/rules 一致且可追溯；须含题量表述（区分已实现题数 vs 目标题池规模、与文档/产出一致）；spec/tasks 须含「24 项与需求 §3.10 逐一核对清单」以可验证 | E2.1 | 2d | 低 |

### Epic 3：feature-eval-lifecycle-skill

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 3.1 | eval-lifecycle-skill-def：定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules，编排逻辑（触发时机、stage 映射、解析规则） | E1.2, E2.1 | 2d | 中 |
| 3.2 | eval-layer1-3-parser：实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts-prd/arch、Create Story 审计报告提取维度，映射环节 1 检查项，约定 AUDIT_Story_{epic}-{story}.md 路径 | E3.1 | 2d | 中 |
| 3.3 | eval-skill-scoring-write：全链路 Skill 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同，触发模式表实现 | E3.1, E3.2 | 1d | 低 |

### Epic 4：feature-eval-coach-veto-integration

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 4.1 | eval-veto-iteration-rules：实现一票否决项与环节映射（OWASP Top 10、CWE-798、核心需求遗漏等）、角色一票否决权（批判审计员、AI 代码教练）、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分（1 次 100%/2 次 80%/3 次 50%/≥4 次 0%）、致命/严重问题差异化 | E2.1 | 2d | 中 |
| 4.2 | eval-ai-coach：实现 AI 代码教练定位、职责、人格、技能配置（引用全链路 Skill）、工作流、输出格式（summary/phase_scores/weak_areas/recommendations/iteration_passed）、一票否决权，禁止「面试」主导表述 | E3.3 | 1d | 低 |
| 4.3 | eval-scenario-bmad-integration：实现场景区分（real_dev/eval_question）、两种场景均走 Layer 1→5 完整路径、各阶段迭代结束标准、轻量化三原则（同机执行、可选启用、最小侵入）、数据污染防护（题目来源与时间隔离、定期迭代题池、混淆变量校验、私有闭卷与评测接口分离；操作要点与触发条件可置于 scoring/ 或项目 checklist）、与 BMAD 五层 workflows 集成点 | E3.3 | 1d | 低 |

---

## 3. PRD 需求 → Story 映射

| PRD 需求 ID | 映射 Story |
|-------------|------------|
| REQ-1.1~1.6 | 1.1, 4.3 |
| REQ-2.1~2.5 | 1.1, 3.2, 4.3 |
| REQ-3.1~3.10 | 1.1, 1.2, 2.1, 2.2, 4.1 |
| REQ-3.11 | 4.3 |
| REQ-3.12~3.17, REQ-3.13a | 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2 |
| REQ-4.1, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2 | 2.2, 4.3 |

---

## 4. Architecture 组件 → Task 映射

| Architecture 组件 | 映射 Story |
|-------------------|------------|
| 评分规则 scoring/rules/*.yaml | 2.1 |
| 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md | 2.2 |
| 评分存储 scoring/data/、schema | 1.1, 1.2 |
| 全链路 Skill | 3.1, 3.2, 3.3 |
| code-reviewer-config 引用关系 | 2.1, 3.1 |
| audit-prompts 引用关系 | 3.1, 3.2 |
| 表 A 表 B | 1.1, 2.2 |
| 审计产出→评分环节映射 | 3.2, 2.2 |
| Layer 1–3 同机解析 | 3.2 |
| 数据流、BMAD 集成点 | 3.3, 4.3 |
| 数据污染防护（§3.7 四条） | 4.3 |
| 题量表述（§3.9 已实现 vs 目标规模） | 2.2 |

---

## 5. 依赖图

```
E1.1 (scoring-core)
    ├──→ E1.2 (storage-writer)
    └──→ E2.1 (rules-yaml)

E2.1 (rules-yaml)
    ├──→ E2.2 (authority-doc)
    └──→ E4.1 (veto-iteration)

E1.2, E2.1
    └──→ E3.1 (lifecycle-skill-def)

E3.1
    ├──→ E3.2 (layer1-3-parser)
    └──→ E3.3 (skill-scoring-write)

E3.2
    └──→ E3.3

E3.3
    └──→ E4.2 (ai-coach), E4.3 (scenario-bmad)

E2.1
    └──→ E4.1 (veto-iteration)
```

**关键路径**：E1.1 → E1.2 → E3.1 → E3.2 → E3.3 → E4.2/E4.3

---

## 6. 命名规范

- **Epic**：feature-{domain}-{capability}（如 feature-eval-scoring-core）
- **Story**：{epic_num}.{story_num} {description}（如 1.1 eval-system-scoring-core）

---

*本文档确保每个 PRD 需求映射到至少一个 Story，每个 Architecture 组件映射到至少一个 task。*
