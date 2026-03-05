# Story 6.5：bmad-eval-analytics Skill 扩展

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.5  
**Slug**：bmad-eval-analytics-skill  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.1（REQ-UX-1.7）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-1.7 | 新建或扩展 Skill `bmad-eval-analytics`，用户可用自然语言触发 | 是 | AC-1 |
| REQ-UX-1.7 | Skill 复用 Command 的 discoverLatestRunIds 等共享逻辑 | 是 | AC-3 |
| REQ-UX-1.7 | 「最近一轮」以 timestamp 最近为准 | 是 | AC-2 |
| REQ-UX-4.7 | 纳入 bmad-eval-analytics Skill（SFT 提取由 Story 7.3 负责） | partial | 本 Story 仅 Coach 相关，SFT 归属 7.3 |

---

## 2. User Story

**As a** 日常开发者  
**I want to** 在 Cursor 中说「帮我看看短板」或「最近一轮的 Coach 报告」  
**so that** 无需记住 Command 名称即可获得诊断

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **新建或扩展 Skill `bmad-eval-analytics`**  
   - 支持自然语言触发，如「帮我看看短板」「最近一轮的 Coach 报告」等短语

2. **复用 Command 共享逻辑**  
   - 复用 `discoverLatestRunIds` 与 `coachDiagnose` 调用  
   - 不以独立实现 discovery 或 coach 逻辑；与 Story 6.1 的 Command 共享脚本/模块

3. **timestamp 最近为准**  
   - 当用户说「最近一轮的 Coach 报告」时，以 timestamp 最近为准输出诊断  
   - 与 Story 6.1 的 discovery 逻辑一致

4. **触发短语示例**  
   - 「帮我看看短板」  
   - 「最近一轮的 Coach 报告」  
   - 可扩展其他等价短语（如「诊断一下」「看看评分短板」），以 Skill 配置或文档为准

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| SFT 提取自然语言触发（「提取微调数据集」） | Story 7.3 | 归属 Epic 7 |
| `/bmad-coach --epic/--story` | Story 6.2 | 6.5 首版可仅支持「全部/最近一轮」；按 Epic/Story 筛选触发由 6.2 定义 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「帮我看看短板」 | Skill 调用 Coach 逻辑并输出诊断报告 |
| AC-2 | 最近一轮 | 存在多条评分记录 | 用户说「最近一轮的 Coach 报告」 | 以 timestamp 最近为准，输出对应诊断 |
| AC-3 | 共用逻辑 | — | Skill 被触发 | 复用 Command 的 discoverLatestRunIds 与 coachDiagnose 调用，无重复实现 |

---

## 5. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 6. 产出物清单

| 产出 | 路径 |
|------|------|
| Skill 文档 | `skills/bmad-eval-analytics/SKILL.md` 或扩展已有 Skill |
| 触发配置 | 自然语言短语 → Coach 诊断调用的映射或规则 |
| 验收 | 在 Cursor 中说「帮我看看短板」「最近一轮的 Coach 报告」可触发并输出诊断 |
