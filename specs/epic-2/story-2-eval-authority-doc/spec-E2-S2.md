# spec-E2-S2：eval-authority-doc 技术规格

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.2  
**来源**：2-2-eval-authority-doc.md、Architecture §9.4、REQUIREMENTS §3.10

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

产出 `scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md` 权威文档，含 REQUIREMENTS §3.10 定义的 24 项内容；含题量表述：须明确列出「当前已实现并验证题数」「各环节目标题量」「全流程目标题池规模」并注明更新日期；与 scoring/rules 一致且可追溯；spec/tasks 含 24 项与需求 §3.10 逐一核对清单。不包含 YAML 配置（Story 2.1）、全链路 Skill 编排（Story 3.x）、一票否决业务逻辑（Story 4.1）。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 产出 | scoring/rules/*.yaml 配置编写 |
| 24 项内容逐一实现与核对 | 全链路 Skill 编排与解析 |
| 题量表述：当前已实现并验证题数、各环节目标题量、全流程目标题池规模、更新日期 | 一票否决、阶梯扣分业务逻辑实现 |
| 与 scoring/rules 一致性校验与追溯 | AI 代码教练实现 |
| 24 项逐一核对清单（spec §2、tasks 验收） | |
| 禁止词表合规 | |

---

## 2. 24 项与需求 §3.10 逐一核对清单

权威文档产出时，须逐项核对并勾选。每项在 SCORING_CRITERIA_AUTHORITATIVE.md 中须有对应章节或段落。

| # | 需求 §3.10 项 | 对应需求章节 | 验证方式 | ☐ |
|---|---------------|--------------|----------|---|
| 1 | BMAD 五层与阶段列表（§2.1 表 A） | REQUIREMENTS §2.1 表 A | 权威文档含表 A（Layer→stage 映射表，列名与需求一致） | ☑ |
| 2 | 阶段 → 评分环节映射（§2.1 表 B） | §2.1 表 B | 权威文档含表 B（stage→环节映射表，列名与需求一致） | ☑ |
| 3 | 各阶段审计产出路径与解析规则（§2.3、§2.4） | §2.3、§2.4 | 权威文档含映射表与 Layer 1–3 同机解析规则 | ☑ |
| 4 | stage 字段完整枚举（§3.6） | §3.6 | 权威文档含 prd\|arch\|epics\|story\|specify\|plan\|gaps\|tasks\|implement\|post_impl\|pr_review | ☑ |
| 5 | 六环节权重及依据说明 | §3.3 | 权威文档含 20/25/25/15/10/5 及工业依据 | ☑ |
| 6 | 每环节的检查项清单（至少 5 项强制、3 项加分），含 ID/名称/判定标准/扣加分/与 audit-prompts、code-reviewer 检查的对应关系 | §3.5、§3.5.1 | 权威文档含环节 1–6 检查项清单，每项可追溯至 audit-prompts 与 code-reviewer-config | ☑ |
| 7 | 一票否决项及触发条件、后果；OWASP Top 10、CWE-798 判定标准；角色一票否决权（§3.4.1、§3.4.2） | §3.4、§3.4.1、§3.4.2 | 权威文档含官方链接与判定方式 | ☑ |
| 8 | 四能力维度聚合公式 | §3.2 | 权威文档含四维度与聚合公式 | ☑ |
| 9 | L1–L5 等级定义与得分区间 | §3.2 | 权威文档含 L5 90–100、L4 80–89、L3 60–79、L2 40–59、L1 0–39 | ☑ |
| 10 | 数据保存 schema（§3.6）及字段说明 | §3.6 | 权威文档含 run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass 等 | ☑ |
| 11 | 评分规则配置示例（§3.11）及 YAML schema 说明 | §3.11 | 权威文档含环节 2/3/4、gaps、iteration_tier 示例或引用 | ☑ |
| 12 | Code Reviewer Skill 与需求的整合说明（§3.12） | §3.12 | 权威文档含 6 阶段↔六环节、触发时机、维度换算 | ☑ |
| 13 | 全链路 Skill 独立与引用关系（§3.13） | §3.13 | 权威文档含引用组件表、与 speckit-workflow/bmad-story-assistant 协同 | ☑ |
| 14 | AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式（§3.14） | §3.14 | 权威文档含禁止「面试」表述说明 | ☑ |
| 15 | Epic 综合评分（§3.2.1） | §3.2.1 | 权威文档含单 Story 综合分、Epic 综合分、Story 权重配置 | ☑ |
| 16 | Epic 级一票否决（§3.4.3） | §3.4.3 | 权威文档含 8 项条件、默认阈值 | ☑ |
| 17 | 环节 1 完整评分维度表（§3.5.1） | §3.5.1 | 权威文档含与环节 2 同级的环节 1 维度表 | ☑ |
| 18 | 环节 3、4、5、6 的 YAML schema 示意 | §3.11 扩展 | 权威文档含或引用环节 3–6 schema | ☑ |
| 19 | Epic 综合报告六部分结构（§3.12） | §3.12 | 权威文档含六部分结构说明 | ☑ |
| 20 | _bmad-output/config code-reviewer-score 与 scoring/rules 的关系（§3.13） | §3.13 | 权威文档含加载优先级与覆盖规则 | ☑ |
| 21 | Implementation Gaps 评审规则（§3.4.4） | §3.4.4 | 权威文档含前置/后置双轨、原子化检查项、gaps 一票否决项 | ☑ |
| 22 | 多次迭代阶梯式扣分规则（§3.4.5） | §3.4.5 | 权威文档含阶梯系数表、问题严重等级差异化 | ☑ |
| 23 | schema 扩展字段（iteration_count、iteration_records、first_pass） | §3.6 | 权威文档含上述字段说明 | ☑ |
| 24 | Epic 级一票否决扩展条件（第 5–8 项） | §3.4.3 | 权威文档含整改≥4 次未通过、一次通过率<50%、整改≥3 次 Story≥2、致命问题整改≥3 次 | ☑ |

**验收**：权威文档产出完成后，本清单 24 项须全部勾选通过。

---

## 3. 需求映射清单（spec ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| §1 概述 | 全体系评分、迭代结束标准 | spec §1 | ✅ |
| §2.1 表 A/B | BMAD 五层、阶段→评分环节映射 | spec §2 第 1–2 项 | ✅ |
| §2.3、§2.4 | 审计产出→评分映射、Layer 1–3 同机解析 | spec §2 第 3 项 | ✅ |
| §3.2 | 四能力维度、L1–L5、Epic 综合评分 | spec §2 第 8、9、15 项 | ✅ |
| §3.3 | 六环节权重及依据 | spec §2 第 5 项 | ✅ |
| §3.4–§3.4.5 | 一票否决、OWASP/CWE-798、角色 veto、Epic veto、Gaps、阶梯扣分 | spec §2 第 7、16、21、22、24 项 | ✅ |
| §3.5、§3.5.1 | 检查项清单、环节 1 维度表 | spec §2 第 6、17 项 | ✅ |
| §3.6 | stage 枚举、schema、扩展字段 | spec §2 第 4、10、23 项 | ✅ |
| §3.9 | 题量表述 | spec §1.1、Story §3 | ✅ |
| §3.10 | 权威文档 24 项 | spec §2 全表 | ✅ |
| §3.11 | YAML schema、环节 3–6 示意 | spec §2 第 11、18 项 | ✅ |
| §3.12 | Code Reviewer 整合、报告结构 | spec §2 第 12、19 项 | ✅ |
| §3.13 | 全链路 Skill、config 关系 | spec §2 第 13、20 项 | ✅ |
| §3.14 | AI 代码教练 | spec §2 第 14 项 | ✅ |

---

## 4. 验收标准映射

| AC | 验收标准 | spec 对应 |
|----|----------|-----------|
| AC-1 | scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 产出，含 24 项内容 | §2 核对清单，24 项全部通过 |
| AC-2 | 权威文档与 scoring/rules 一致且可追溯 | 规则版本号、文档修订日期对应；每项与 scoring/rules 中 item_id、veto_items 可映射 |
| AC-3 | 含题量表述（已实现 vs 目标规模） | 文档含独立章节或表格，列明：当前已实现并验证题数、各环节目标题量、全流程目标题池规模，并注明更新日期 |
| AC-4 | spec/tasks 含 24 项逐一核对清单 | 本文档 §2 表格存在且可用于验收 |
| AC-5 | 权威文档无禁止词表所列表述 | 全文检索，无「可选」「后续」「待定」等 |
| AC-6 | 权威文档路径为 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md | 文件存在且路径正确 |

---

## 5. PRD 需求追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| **REQ-3.13** | 评分标准权威文档：scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容；E2.2 spec/tasks 须含 24 项与需求 §3.10 逐一核对清单；与 scoring/rules 一致且可追溯；每项可验证 |
| REQ-3.13a | 题量表述：区分已实现题数 vs 目标题池规模，文档与产出一致 |

---

## 6. Architecture 约束

| 约束项 | 说明 |
|--------|------|
| 权威文档路径 | 必须为 `scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md`（Architecture §9.1、§9.4） |
| 与 scoring/rules 一致 | 权威文档为人类可读完整标准；scoring/rules/*.yaml 为机器可读配置；两者须一致且可追溯 |
| 题量表述 | 须区分「已实现并验证的题数」与「目标题池规模」 |
| 24 项内容 | 必须完整覆盖需求 §3.10 定义的 24 项，不可缺项 |
| 目录结构 | 须置于 scoring/docs/ |
| _bmad-output/config 关系 | 须在权威文档中说明与 scoring/rules 的加载优先级、覆盖规则 |

---

## 7. 依赖

| 依赖项 | 说明 |
|--------|------|
| 前置 Story 2.1 | eval-rules-yaml-config；依赖 2.1 的 scoring/rules 结构与 YAML schema；权威文档须与 2.1 产出的规则一致且可追溯 |
| REQUIREMENTS §3.10 | 24 项定义；本 spec §2 与 tasks 须含逐一核对清单 |
| Architecture §9.4 | 权威文档与题量表述的约定 |

**与 Story §8 实施任务**：spec 对应 plan/tasks 产出；Story §8 的 T1–T7 由 plan、tasks 文档拆解实现。

---

## 8. 禁止词表合规

本 spec 及产出禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。

---

## 9. 自审结论

- **Scope**：Story 2.2 §1.1 四项均已覆盖。
- **24 项核对清单**：§2 表格与 Story §2 一一对应，可用于验收。
- **验收标准**：AC-1～AC-6 均有 spec 对应。
- **PRD 追溯**：REQ-3.13、REQ-3.13a 已映射。
- **与 Architecture 衔接**：§9.4 权威文档、题量表述已明确。
- **禁止词表**：已合规。

<!-- AUDIT: PASSED by code-reviewer -->
