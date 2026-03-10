# IMPLEMENTATION_GAPS-E2-S2：eval-authority-doc

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.2  
**输入**：plan-E2-S2.md、spec-E2-S2.md、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| §3.10 第 1–24 项 | GAP-1 | 权威文档 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md | 未实现 | 文件不存在；scoring/docs/ 目录存在但为空 |
| §3.10 第 1 项 | GAP-2 | BMAD 五层与阶段列表（表 A） | 未实现 | 权威文档未产出 |
| §3.10 第 2 项 | GAP-3 | 阶段→评分环节映射（表 B） | 未实现 | 同上 |
| §3.10 第 3 项 | GAP-4 | 审计产出路径与解析规则 | 未实现 | 同上 |
| §3.10 第 4–10 项 | GAP-5 | stage 枚举、六环节权重、检查项、一票否决、四维度、L1–L5、schema | 未实现 | 同上 |
| §3.10 第 11–24 项 | GAP-6 | YAML schema、Code Reviewer、全链路 Skill、AI 教练、Epic 综合、环节 1 维度、config 关系、Gaps 规则、阶梯扣分、schema 扩展、Epic veto 扩展 | 未实现 | 同上 |
| §3.9 | GAP-7 | 题量表述（已实现题数、目标题池、更新日期） | 未实现 | 权威文档未产出 |
| AC-5 | GAP-8 | 禁止词表合规 | 待验证 | 文档产出后执行全文检索 |
| AC-2 | GAP-9 | 与 scoring/rules 一致且可追溯 | 未实现 | 需在文档中注明规则版本号、修订日期，与 rules YAML 对齐 |
| plan §4 | GAP-10 | scripts/accept-e2-s2.ts 验收脚本 | 未实现 | 脚本不存在，AC-1～AC-6 无自动化验收 |

---

## 2. Gaps → 任务映射

| Gap ID | 本任务表行 | 对应任务 |
|--------|------------|----------|
| GAP-1 | ✓ 有 | T1（创建目录与骨架）、T2–T3（编写内容） |
| GAP-2–GAP-6 | ✓ 有 | T2、T3（24 项内容） |
| GAP-7 | ✓ 有 | T5（题量表述章节） |
| GAP-8 | ✓ 有 | T7（禁止词检查） |
| GAP-9 | ✓ 有 | T6（与 rules 对照） |
| GAP-10 | ✓ 有 | tasks 中需新增验收脚本任务 |

---

## 3. 优先级

| 优先级 | Gap ID | 说明 |
|--------|--------|------|
| P0 | GAP-1 | 权威文档为 Story 核心产出，必须存在 |
| P0 | GAP-2～GAP-6 | 24 项内容缺一不可 |
| P0 | GAP-7 | 题量表述为 AC-3 要求 |
| P0 | GAP-8、GAP-9 | 禁止词、与 rules 追溯为 AC |
| P0 | GAP-10 | 验收脚本为端到端验收入口 |

---

## 4. 与 plan 的对应

| plan 章节 | Gaps 覆盖 |
|-----------|-----------|
| §2.1 文档结构 | GAP-1～GAP-6 |
| §2.3 题量表述 | GAP-7 |
| §2.4 禁止词表 | GAP-8 |
| §2.2 与 rules 一致 | GAP-9 |
| §4 测试计划、§3 目录 | GAP-10 |

<!-- AUDIT: PASSED by code-reviewer -->
