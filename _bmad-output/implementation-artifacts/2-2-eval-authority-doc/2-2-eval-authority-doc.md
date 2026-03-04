# Story 2.2：eval-authority-doc

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.2  
**Slug**：eval-authority-doc  
**描述**：产出 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容，与 scoring/rules 一致且可追溯；须含题量表述；spec/tasks 须含 24 项与需求 §3.10 逐一核对清单以可验证。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **权威文档产出**：`scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md`，含需求 §3.10 定义的 24 项内容
2. **题量表述**：区分已实现题数 vs 目标题池规模，与文档/产出一致
3. **24 项逐一核对清单**：实施时须按下方「§2 24 项与需求 §3.10 逐一核对清单」逐项勾选验证
4. **与 scoring/rules 一致性校验**：权威文档与 Story 2.1 产出的 YAML 规则版本号、文档修订日期对应，可追溯

### 1.2 本 Story 不包含

- **评分规则 YAML 配置**：由 Story 2.1（eval-rules-yaml-config）实现
- **全链路 Skill 编排与解析**：由 Story 3.1（eval-lifecycle-skill-def）、Story 3.2（eval-layer1-3-parser）、Story 3.3（eval-skill-scoring-write）实现
- **一票否决与多次迭代规则实现**：由 Story 4.1（eval-veto-iteration-rules）实现
- **AI 代码教练实现**：由 Story 4.2（eval-ai-coach）实现

---

## 2. 24 项与需求 §3.10 逐一核对清单

权威文档产出时，须逐项核对并勾选。每项在 SCORING_CRITERIA_AUTHORITATIVE.md 中须有对应章节或段落。

| # | 需求 §3.10 项 | 对应需求章节 | 验证方式 | ☐ |
|---|---------------|--------------|----------|---|
| 1 | BMAD 五层与阶段列表（§2.1 表 A） | REQUIREMENTS §2.1 表 A | 权威文档含表 A 或等价内容 | ☐ |
| 2 | 阶段 → 评分环节映射（§2.1 表 B） | §2.1 表 B | 权威文档含表 B 或等价内容 | ☐ |
| 3 | 各阶段审计产出路径与解析规则（§2.3、§2.4） | §2.3、§2.4 | 权威文档含映射表与 Layer 1–3 同机解析规则 | ☐ |
| 4 | stage 字段完整枚举（§3.6） | §3.6 | 权威文档含 prd\|arch\|epics\|story\|specify\|plan\|gaps\|tasks\|implement\|post_impl\|pr_review | ☐ |
| 5 | 六环节权重及依据说明 | §3.3 | 权威文档含 20/25/25/15/10/5 及工业依据 | ☐ |
| 6 | 每环节的检查项清单（至少 5 项强制、3 项加分），含 ID/名称/判定标准/扣加分/与 audit-prompts 对应 | §3.5、§3.5.1 | 权威文档含环节 1–6 检查项清单，每项可追溯 | ☐ |
| 7 | 一票否决项及触发条件、后果；OWASP Top 10、CWE-798 判定标准；角色一票否决权（§3.4.1、§3.4.2） | §3.4、§3.4.1、§3.4.2 | 权威文档含官方链接与判定方式 | ☐ |
| 8 | 四能力维度聚合公式 | §3.2 | 权威文档含四维度与聚合公式 | ☐ |
| 9 | L1–L5 等级定义与得分区间 | §3.2 | 权威文档含 L5 90–100、L4 80–89、L3 60–79、L2 40–59、L1 0–39 | ☐ |
| 10 | 数据保存 schema（§3.6）及字段说明 | §3.6 | 权威文档含 run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass 等 | ☐ |
| 11 | 评分规则配置示例（§3.11）及 YAML schema 说明 | §3.11 | 权威文档含环节 2/3/4、gaps、iteration_tier 示例或引用 | ☐ |
| 12 | Code Reviewer Skill 与需求的整合说明（§3.12） | §3.12 | 权威文档含 6 阶段↔六环节、触发时机、维度换算 | ☐ |
| 13 | 全链路 Skill 独立与引用关系（§3.13） | §3.13 | 权威文档含引用组件表、与 speckit-workflow/bmad-story-assistant 协同 | ☐ |
| 14 | AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式（§3.14） | §3.14 | 权威文档含禁止「面试」表述说明 | ☐ |
| 15 | Epic 综合评分（§3.2.1） | §3.2.1 | 权威文档含单 Story 综合分、Epic 综合分、Story 权重配置 | ☐ |
| 16 | Epic 级一票否决（§3.4.3） | §3.4.3 | 权威文档含 8 项条件、默认阈值 | ☐ |
| 17 | 环节 1 完整评分维度表（§3.5.1） | §3.5.1 | 权威文档含与环节 2 同级的环节 1 维度表 | ☐ |
| 18 | 环节 3、4、5、6 的 YAML schema 示意 | §3.11 扩展 | 权威文档含或引用环节 3–6 schema | ☐ |
| 19 | Epic 综合报告六部分结构（§3.12） | §3.12 | 权威文档含六部分结构说明 | ☐ |
| 20 | _bmad-output/config code-reviewer-score 与 scoring/rules 的关系（§3.13） | §3.13 | 权威文档含加载优先级与覆盖规则 | ☐ |
| 21 | Implementation Gaps 评审规则（§3.4.4） | §3.4.4 | 权威文档含前置/后置双轨、原子化检查项、gaps 一票否决项 | ☐ |
| 22 | 多次迭代阶梯式扣分规则（§3.4.5） | §3.4.5 | 权威文档含阶梯系数表、问题严重等级差异化 | ☐ |
| 23 | schema 扩展字段（iteration_count、iteration_records、first_pass） | §3.6 | 权威文档含上述字段说明 | ☐ |
| 24 | Epic 级一票否决扩展条件（第 5–8 项） | §3.4.3 | 权威文档含整改≥4 次未通过、一次通过率<50%、整改≥3 次 Story≥2、致命问题整改≥3 次 | ☐ |

**验收**：权威文档产出完成后，本清单 24 项须全部勾选通过。

---

## 3. 题量表述要求

- 权威文档及产出须区分「已实现并验证的题数」与「目标题池规模」（如需求拆解目标 20+，全流程题池目标 50+）
- 在文档与产出一致，避免与实现状态不符
- 具体表述形式：可为独立章节或表格，明确列出「当前已实现并验证题数」「各环节目标题量」「全流程目标题池规模」，并注明更新日期

---

## 4. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 产出，含 24 项内容 | 按 §2 核对清单逐项勾选，24 项全部通过 |
| AC-2 | 权威文档与 scoring/rules 一致且可追溯 | 规则版本号、文档修订日期对应；每项与 scoring/rules 中 item_id、veto_items 可映射 |
| AC-3 | 含题量表述（已实现 vs 目标规模） | 文档中有明确章节或表格 |
| AC-4 | spec/tasks 含 24 项逐一核对清单 | 本文档 §2 表格存在且可用于验收 |
| AC-5 | 权威文档无禁止词表所列表述 | 全文检索，无「可选」「后续」「待定」等 |
| AC-6 | 权威文档路径为 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md | 文件存在且路径正确 |

---

## 5. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| **REQ-3.13** | 评分标准权威文档：scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容；E2.2 spec/tasks 须含 24 项与需求 §3.10 逐一核对清单；与 scoring/rules 一致且可追溯；每项可验证 |
| REQ-3.13a | 题量表述：区分已实现题数 vs 目标题池规模，文档与产出一致 |

**覆盖说明**：REQ-3.13 为本 Story 核心需求，直接对应权威文档产出与 24 项核对清单；REQ-3.13a 对应 §3 题量表述要求。

---

## 6. Architecture 约束

| 约束项 | 说明 |
|--------|------|
| **权威文档路径** | 必须为 `scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md`（Architecture §9.1、§9.4） |
| **与 scoring/rules 一致** | 权威文档为人类可读完整标准；scoring/rules/*.yaml 为机器可读配置；两者须一致且可追溯（规则版本号、文档修订日期对应） |
| **题量表述** | 须区分「已实现并验证的题数」与「目标题池规模」，与 Architecture §9.4、需求 §3.9 一致 |
| **24 项内容** | 必须完整覆盖需求 §3.10 定义的 24 项，不可缺项 |
| **目录结构** | 须置于 scoring/docs/，与 Architecture §9.1 目录结构一致 |
| **_bmad-output/config 关系** | 须在权威文档中说明与 scoring/rules 的加载优先级、覆盖规则（Architecture §2.3） |

---

## 7. 禁止词表合规

本 Story 文档及产出物（含 SCORING_CRITERIA_AUTHORITATIVE.md）禁止使用以下表述：

- 可选
- 后续
- 待定
- 酌情
- 视情况
- 先实现
- 或后续扩展

**验证方式**：产出完成后对全文进行检索，确认无上述词汇；若有替代表述需要，须使用明确、可执行的表述。

---

## 8. 实施任务分解

| Task ID | 任务描述 | 产出物 |
|---------|----------|--------|
| T1 | 创建 scoring/docs/ 目录（若不存在）并初始化 SCORING_CRITERIA_AUTHORITATIVE.md 骨架 | 目录及文档骨架 |
| T2 | 编写权威文档核心内容：表 A、表 B、六环节权重、四能力维度、L1–L5、schema、检查项清单（对应 §2 第 1–10 项） | 文档章节 1–10 |
| T3 | 编写权威文档扩展内容：Code Reviewer 整合、全链路 Skill 引用、AI 代码教练、Epic 综合评分、Epic 级一票否决、环节 1 维度表、环节 3–6 schema、报告结构、config 关系、Gaps 规则、阶梯扣分、schema 扩展、Epic veto 扩展（对应 §2 第 11–24 项） | 文档章节 11–24 |
| T4 | 逐项核对 §2 清单 24 项，确保每项在文档中有对应章节或段落，勾选通过 | 核对清单全部勾选 |
| T5 | 编写题量表述章节，明确「已实现题数」「目标题池规模」，与实现状态一致 | 题量表述章节或表格 |
| T6 | 与 Story 2.1 产出的 scoring/rules 对照，确保 item_id、veto_items、权重与文档一致，注明规则版本号与文档修订日期 | 一致性校验记录或文档内引用 |
| T7 | 全文禁止词表合规检查 | 检查通过记录 |

---

## 9. 依赖

- **前置 Story**：Story 2.1（eval-rules-yaml-config）。依赖 2.1 的 scoring/rules 结构与 YAML schema；权威文档须与 2.1 产出的规则一致且可追溯。
- **依赖需求与架构**：Architecture §9.4 权威文档与题量表述的约定；REQUIREMENTS §3.10 24 项定义。

---

*本 Story 产出评分标准权威文档，为全体系评分提供人类可读的完整标准，可审计、可版本化。*
