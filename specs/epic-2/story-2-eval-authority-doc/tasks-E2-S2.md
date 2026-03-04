# tasks-E2-S2：eval-authority-doc 任务列表

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.2  
**来源**：plan-E2-S2.md、IMPLEMENTATION_GAPS-E2-S2.md、Story 2.2 §8

---

## Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止用「预留」「占位」等词规避实现
4. ❌ 禁止权威文档使用禁止词表所列词汇

**必须事项**:
1. ✅ 必须运行验证命令确认文档符合 AC
2. ✅ 遇到无法完成的情况，应报告阻塞
3. ✅ 实施前必须先检索并阅读 REQUIREMENTS §3.10、Story 2.2、spec §2
4. ✅ 需求追溯：24 项与 spec §2 逐一对应

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 2.2 | §8 | 创建 scoring/docs/ 目录与 SCORING_CRITERIA_AUTHORITATIVE.md 骨架 |
| T2 | REQUIREMENTS | §3.10 第 1–10 项 | 表 A/B、审计产出、stage、权重、检查项、一票否决、四维度、L1–L5、schema |
| T3 | REQUIREMENTS | §3.10 第 11–24 项 | YAML schema、Code Reviewer、全链路 Skill、AI 教练、Epic、config、Gaps、阶梯扣分、扩展字段 |
| T4 | spec | §2 | 24 项逐一核对并勾选 |
| T5 | Story 2.2 §3 | 题量表述 | 已实现题数、目标题池、更新日期 |
| T6 | AC-2 | 与 rules 一致 | 规则版本号、文档修订日期、item_id/veto_items 映射 |
| T7 | AC-5 | 禁止词表 | 全文无禁止词 |
| T8 | plan §4 | 验收脚本 | scripts/accept-e2-s2.ts 覆盖 AC-1～AC-6 |

---

## Gaps → 任务映射

| Gap ID | 本任务表行 | 对应任务 |
|--------|------------|----------|
| GAP-1 | ✓ 有 | T1, T2, T3 |
| GAP-2～GAP-6 | ✓ 有 | T2, T3 |
| GAP-7 | ✓ 有 | T5 |
| GAP-8 | ✓ 有 | T7 |
| GAP-9 | ✓ 有 | T6 |
| GAP-10 | ✓ 有 | T8 |

---

## 任务列表

### T1：创建 scoring/docs/ 目录并初始化 SCORING_CRITERIA_AUTHORITATIVE.md 骨架

**产出物**：scoring/docs/ 目录、SCORING_CRITERIA_AUTHORITATIVE.md 骨架（含文档标题、版本与修订日期占位、章节标题列表）

**验收标准**：
- 目录 scoring/docs/ 存在
- 文件 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md 存在
- 文档含主标题、修订日期占位、20 个章节标题骨架

**验证命令**：
```bash
test -f scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md && echo "OK"
```

---

- [x] **T1.1** 创建 scoring/docs/ 目录（若不存在）
- [x] **T1.2** 初始化 SCORING_CRITERIA_AUTHORITATIVE.md，含主标题、修订日期、20 章标题骨架

---

### T2：编写权威文档核心内容（§2 第 1–10 项）

**产出物**：文档章节 1–10（表 A、表 B、审计产出映射、stage 枚举、六环节权重、检查项清单、一票否决、四维度、L1–L5、schema）

**验收标准**：
- 每项在 spec §2 第 1–10 项中有对应段落
- 表 A 含 BMAD Layer→stage；表 B 含 stage→评分环节
- stage 枚举含 prd|arch|epics|story|specify|plan|gaps|tasks|implement|post_impl|pr_review
- 六环节权重 20/25/25/15/10/5 及工业依据
- L1–L5 得分区间：L5 90–100、L4 80–89、L3 60–79、L2 40–59、L1 0–39

**验证命令**：按 spec §2 逐项 grep 关键字

---

- [x] **T2.1** 编写表 A（BMAD 五层与阶段列表）
- [x] **T2.2** 编写表 B（阶段→评分环节映射）
- [x] **T2.3** 编写审计产出路径与解析规则（§2.3、§2.4）
- [x] **T2.4** 编写 stage 字段完整枚举
- [x] **T2.5** 编写六环节权重及依据说明
- [x] **T2.6** 编写各环节检查项清单（至少 5 项强制、3 项加分，含 ID/名称/判定标准/扣加分/与 audit-prompts、code-reviewer 对应）
- [x] **T2.7** 编写一票否决项（OWASP Top 10、CWE-798 官方链接、角色一票否决权）
- [x] **T2.8** 编写四能力维度聚合公式
- [x] **T2.9** 编写 L1–L5 等级定义与得分区间
- [x] **T2.10** 编写数据保存 schema（run_id、scenario、stage、phase_score、check_items、iteration_count、iteration_records、first_pass）

---

### T3：编写权威文档扩展内容（§2 第 11–24 项）

**产出物**：文档章节 11–20（YAML schema、Code Reviewer、全链路 Skill、AI 教练、Epic 综合、Epic veto、环节 1 维度、环节 3–6 schema、报告结构、config 关系、Gaps 规则、阶梯扣分、schema 扩展、Epic veto 扩展）

**验收标准**：
- 每项在 spec §2 第 11–24 项中有对应段落
- 与 scoring/rules 中 implement-scoring.yaml、gaps-scoring.yaml、iteration-tier.yaml 结构一致或引用

**验证命令**：按 spec §2 逐项 grep 关键字

---

- [x] **T3.1** 编写评分规则配置示例与 YAML schema 说明
- [x] **T3.2** 编写 Code Reviewer Skill 整合说明（6 阶段↔六环节、触发时机、维度换算）
- [x] **T3.3** 编写全链路 Skill 引用关系与 speckit-workflow/bmad-story-assistant 协同
- [x] **T3.4** 编写 AI 代码教练定位、职责、人格、技能配置、工作流、输出格式，含禁止「面试」表述
- [x] **T3.5** 编写 Epic 综合评分（单 Story 综合分、Epic 综合分、Story 权重配置）
- [x] **T3.6** 编写 Epic 级一票否决（8 项条件、默认阈值）
- [x] **T3.7** 编写环节 1 完整评分维度表
- [x] **T3.8** 编写环节 3、4、5、6 的 YAML schema 示意
- [x] **T3.9** 编写 Epic 综合报告六部分结构
- [x] **T3.10** 编写 _bmad-output/config 与 scoring/rules 的加载优先级与覆盖规则
- [x] **T3.11** 编写 Implementation Gaps 评审规则（前置/后置双轨、原子化检查项、gaps 一票否决项）
- [x] **T3.12** 编写多次迭代阶梯式扣分规则（阶梯系数表、问题严重等级差异化）
- [x] **T3.13** 编写 schema 扩展字段（iteration_count、iteration_records、first_pass）
- [x] **T3.14** 编写 Epic 级一票否决扩展条件（第 5–8 项）

---

### T4：逐项核对 §2 清单 24 项

**产出物**：spec §2 表格中 24 项全部勾选 ☑

**验收标准**：
- 权威文档中每项有对应章节或段落
- spec 中 24 项核对清单全部勾选通过

**验证命令**：人工核对或脚本校验

---

- [x] **T4.1** 逐项核对第 1–12 项，确保文档有对应内容
- [x] **T4.2** 逐项核对第 13–24 项
- [x] **T4.3** 在 spec §2 表格中将 24 项全部勾选

---

### T5：编写题量表述章节

**产出物**：文档中含题量表述章节或表格

**验收标准**：
- 列明：当前已实现并验证题数、各环节目标题量、全流程目标题池规模
- 注明更新日期

**验证命令**：grep "已实现|目标题|题池|更新日期"

---

- [x] **T5.1** 编写题量表述章节，含三项必列内容及更新日期

---

### T6：与 Story 2.1 产出的 scoring/rules 对照

**产出物**：权威文档中规则版本号、文档修订日期与 scoring/rules 一致；item_id、veto_items 可映射

**验收标准**：
- 文档头部注明规则版本号（与 scoring/rules/*.yaml 中 version 一致）
- 注明文档修订日期（ISO 8601）
- item_id、veto_items 与 rules 中定义可对应

**验证命令**：比对 scoring/rules 中 version 与文档中版本号

---

- [x] **T6.1** 从 scoring/rules 读取 version，写入文档
- [x] **T6.2** 写入文档修订日期
- [x] **T6.3** 确认 item_id、veto_items 与 rules 一致

---

### T7：全文禁止词表合规检查

**产出物**：检查通过记录

**验收标准**：
- 全文无：可选、后续、待定、酌情、视情况、先实现、或后续扩展
- 若有替代表述，使用明确、可执行的表述

**验证命令**：
```bash
grep -E "可选|后续|待定|酌情|视情况|先实现|或后续扩展" scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md || echo "PASS"
```

---

- [x] **T7.1** 执行全文检索，确认无禁止词
- [x] **T7.2** 若有禁止词，替换为明确表述

---

### T8：编写 scripts/accept-e2-s2.ts 验收脚本

**产出物**：scripts/accept-e2-s2.ts

**验收标准**：
- AC-1：文档存在且含 24 项内容（通过关键字检查）
- AC-2：规则版本号、修订日期与 rules 对应
- AC-3：含题量表述
- AC-4：spec/tasks 含 24 项核对清单（本 tasks 文档存在即可）
- AC-5：全文无禁止词
- AC-6：路径正确 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md

**验证命令**：
```bash
npx ts-node scripts/accept-e2-s2.ts
```

---

- [x] **T8.1** 编写 accept-e2-s2.ts，覆盖 AC-1～AC-6
- [x] **T8.2** 运行脚本，全部 PASS

---

## 验收汇总

**运行验收**：`npx ts-node scripts/accept-e2-s2.ts` 或 `npm run accept:e2-s2`（若已配置）

**产出路径**：scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md
