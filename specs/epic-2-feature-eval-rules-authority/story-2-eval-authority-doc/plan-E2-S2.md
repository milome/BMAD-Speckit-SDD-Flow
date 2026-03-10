# plan-E2-S2：eval-authority-doc 实现方案

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.2  
**输入**：spec-E2-S2.md

---

## 1. 目标与约束

- 产出 `scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md` 权威文档，含 REQUIREMENTS §3.10 定义的 24 项内容。
- 与 scoring/rules 一致且可追溯（规则版本号、文档修订日期对应）。
- 含题量表述：当前已实现并验证题数、各环节目标题量、全流程目标题池规模，并注明更新日期。
- 权威文档全文无禁止词表所列表述（可选、后续、待定、酌情、视情况、先实现、或后续扩展）。
- 本 Story 产出为文档，无生产代码；验收以文档存在性、24 项核对、禁止词检查为主。

---

## 2. 技术方案

### 2.1 文档结构

权威文档采用 Markdown 格式，按 24 项内容分章节组织，每章对应 spec §2 核对清单中的一项或多项：

| 章节 | 对应 24 项 | 主要来源 |
|------|------------|----------|
| 1. BMAD 五层与阶段列表 | 第 1 项 | REQUIREMENTS §2.1 表 A |
| 2. 阶段→评分环节映射 | 第 2 项 | REQUIREMENTS §2.1 表 B |
| 3. 审计产出路径与解析规则 | 第 3 项 | §2.3、§2.4 |
| 4. stage 字段完整枚举 | 第 4 项 | §3.6 |
| 5. 六环节权重及依据 | 第 5 项 | §3.3 |
| 6. 各环节检查项清单 | 第 6 项 | §3.5、§3.5.1 |
| 7. 一票否决项与角色 veto | 第 7 项 | §3.4、§3.4.1、§3.4.2 |
| 8. 四能力维度聚合 | 第 8 项 | §3.2 |
| 9. L1–L5 等级定义 | 第 9 项 | §3.2 |
| 10. 数据保存 schema | 第 10、23 项 | §3.6 |
| 11. 评分规则配置示例与 YAML schema | 第 11、18 项 | §3.11 |
| 12. Code Reviewer Skill 整合 | 第 12、19 项 | §3.12 |
| 13. 全链路 Skill 与 config 关系 | 第 13、20 项 | §3.13 |
| 14. AI 代码教练 | 第 14 项 | §3.14 |
| 15. Epic 综合评分与 veto | 第 15、16、24 项 | §3.2.1、§3.4.3 |
| 16. 环节 1 完整维度表 | 第 17 项 | §3.5.1 |
| 17. Implementation Gaps 评审规则 | 第 21 项 | §3.4.4 |
| 18. 多次迭代阶梯式扣分 | 第 22 项 | §3.4.5 |
| 19. 题量表述 | 题量 | §3.9、Story §3 |
| 20. 版本与维护 | 追溯 | 规则版本号、文档修订日期 |

### 2.2 与 scoring/rules 一致性

- 从 scoring/rules/default/*.yaml、gaps-scoring.yaml、iteration-tier.yaml 读取 version 字段。
- 权威文档头部注明：规则版本号、文档修订日期（ISO 8601）。
- item_id、veto_items 与 scoring/rules 中定义一一对应，在文档中列出或引用。
- 与 Story 2.1 产出的 YAML 结构对齐：implement/test/bugfix-scoring.yaml、gaps-scoring.yaml、iteration-tier.yaml。

### 2.3 题量表述

- 独立章节或表格，列明：
  - 当前已实现并验证题数
  - 各环节目标题量（如每环节 10+）
  - 全流程目标题池规模（如 50+）
  - 更新日期
- 数值与实现状态一致；需求拆解目标 20+、全流程 50+ 为参考值，可依据项目实际调整并注明。

### 2.4 禁止词表

- 全文检索不得出现：可选、后续、待定、酌情、视情况、先实现、或后续扩展。
- 验收脚本执行 grep/正则检查。

---

## 3. 目录与文件布局

| 路径 | 说明 |
|------|------|
| scoring/docs/ | 目录（若不存在则创建） |
| scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md | 权威文档主产出 |
| specs/epic-2/story-2-eval-authority-doc/spec-E2-S2.md | 24 项核对清单 |
| specs/epic-2/story-2-eval-authority-doc/tasks-E2-S2.md | 实施任务分解 |
| scripts/accept-e2-s2.ts | 验收脚本 AC-1～AC-6 |

---

## 4. 集成测试与端到端测试计划

本 Story 产出为文档，无生产代码模块。测试以文档验证为主：

| 测试类型 | 覆盖 | 验证方式 |
|----------|------|----------|
| 文档存在性 | AC-6 | 文件 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 存在 |
| 24 项核对 | AC-1 | 按 spec §2 逐项 grep/关键字检查，24 项均有对应内容 |
| 题量表述 | AC-3 | 文档含「当前已实现并验证题数」「各环节目标题量」「全流程目标题池规模」「更新日期」 |
| 禁止词检查 | AC-5 | grep 检索全文，无禁止词 |
| 与 rules 追溯 | AC-2 | 文档含规则版本号、修订日期；与 scoring/rules 中 version 对应 |
| 验收脚本 | 全部 | scripts/accept-e2-s2.ts 覆盖 AC-1～AC-6，全部 PASS |

**集成验证**：accept-e2-s2.ts 读入权威文档、scoring/rules YAML，执行上述检查；脚本为端到端验收入口。

---

## 5. 需求映射清单（plan ↔ spec + 需求文档）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| §2.1 表 A/B | spec §2 第 1–2 项 | plan §2.1 章节 1–2 | ✅ |
| §2.3、§2.4 | spec §2 第 3 项 | plan §2.1 章节 3 | ✅ |
| §3.2、§3.2.1 | spec §2 第 8、9、15 项 | plan §2.1 章节 8–9、15 | ✅ |
| §3.3 | spec §2 第 5 项 | plan §2.1 章节 5 | ✅ |
| §3.4–§3.4.5 | spec §2 第 7、16、21、22、24 项 | plan §2.1 章节 7、15–18 | ✅ |
| §3.5、§3.5.1 | spec §2 第 6、17 项 | plan §2.1 章节 6、16 | ✅ |
| §3.6 | spec §2 第 4、10、23 项 | plan §2.1 章节 4、10 | ✅ |
| §3.9 题量表述 | spec §1.1、AC-3 | plan §2.3、§4 | ✅ |
| §3.10 24 项 | spec §2 全表 | plan §2.1 全章节 | ✅ |
| §3.11 | spec §2 第 11、18 项 | plan §2.1 章节 11 | ✅ |
| §3.12 | spec §2 第 12、19 项 | plan §2.1 章节 12 | ✅ |
| §3.13 | spec §2 第 13、20 项 | plan §2.1 章节 13 | ✅ |
| §3.14 | spec §2 第 14 项 | plan §2.1 章节 14 | ✅ |

---

## 6. 依赖

- **Story 2.1**：scoring/rules 已产出；权威文档须与 2.1 的 YAML 结构、version、item_id、veto_items 一致。
- **REQUIREMENTS**：§3.10 24 项、§2.1 表 A/B、§2.3–§2.4、§3.2–§3.6、§3.11–§3.14。
- **Architecture**：§9.4 权威文档与题量表述约定。

---

## 7. 禁止词表合规

本 plan 及产出禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。

<!-- AUDIT: PASSED by code-reviewer -->
