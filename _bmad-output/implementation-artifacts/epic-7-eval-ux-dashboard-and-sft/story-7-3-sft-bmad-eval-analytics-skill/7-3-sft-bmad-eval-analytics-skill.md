# Story 7.3：SFT 纳入 bmad-eval-analytics Skill

**Epic**：7 eval-ux-dashboard-and-sft  
**Story**：7.3  
**Slug**：sft-bmad-eval-analytics-skill  
**来源**：epics.md §Epic 7、prd.eval-ux-last-mile.md §5.4（REQ-UX-4.7）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-4.7 | 纳入 bmad-eval-analytics Skill；用户可说「提取微调数据集」或「生成 SFT 训练数据」触发 | 是 | AC-1 |

---

## 2. User Story

**As a** AI 研发效能工程师  
**I want to** 在 Cursor 中说「提取微调数据集」或「生成 SFT 训练数据」  
**so that** 无需记住 Command 即可触发 SFT 提取

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **扩展 Skill `bmad-eval-analytics`**  
   - 支持自然语言触发，如「提取微调数据集」「生成 SFT 训练数据」等短语

2. **复用 SFT 提取逻辑**  
   - 复用 Story 7.2 的 `/bmad-sft-extract` 实现；Skill 触发时调用 SFT 提取逻辑并输出摘要  
   - 不以独立实现 SFT 提取；与 Story 7.2 的 Command 共享脚本/模块

3. **触发短语示例**  
   - 「提取微调数据集」  
   - 「生成 SFT 训练数据」  
   - 可扩展其他等价短语（如「生成 SFT 数据」），以 Skill 配置或文档为准

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| SFT 提取核心实现（/bmad-sft-extract） | Story 7.2 | 本 Story 仅扩展 Skill 触发映射 |
| Coach 自然语言触发（「帮我看看短板」） | Story 6.5 | 归属 Epic 6 |

### 3.3 技术依赖与路径

| 依赖 | 路径/来源 | 说明 |
|------|-----------|------|
| SFT 提取脚本 | `scripts/sft-extract.ts` | Story 7.2 已交付；本 Story 触发时执行 `npx ts-node scripts/sft-extract.ts` |
| SFT 提取逻辑 | Story 7.2 的 /bmad-sft-extract 实现 | 与 Command 共享同一脚本；无独立实现 |
| Skill 产出目录 | `skills/` | 项目 skills 根目录；本 Story 扩展 `skills/bmad-eval-analytics/SKILL.md`（由 Story 6.5 创建） |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「提取微调数据集」或「生成 SFT 训练数据」 | Skill 执行 `npx ts-node scripts/sft-extract.ts` 并输出摘要 |

---

## 5. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 6. 产出物清单

| 产出 | 路径 |
|------|------|
| Skill 文档 | 扩展 `skills/bmad-eval-analytics/SKILL.md`，增加 SFT 相关触发短语映射（执行命令 `npx ts-node scripts/sft-extract.ts`） |
| 验收 | 在 Cursor 中说「提取微调数据集」或「生成 SFT 训练数据」可触发并输出 SFT 提取摘要 |

---

## 7. 推迟闭环

| 项目 | 归属 | 说明 |
|------|------|------|
| SFT 提取核心实现（逻辑、脚本、CLI） | Story 7.2 | 已交付 `scripts/sft-extract.ts` 与 `/bmad-sft-extract` Command |
| 本 Story | 仅扩展 Skill | 在现有 SKILL.md 中增加 SFT 触发短语及执行指引，不实现或修改 SFT 提取逻辑 |
