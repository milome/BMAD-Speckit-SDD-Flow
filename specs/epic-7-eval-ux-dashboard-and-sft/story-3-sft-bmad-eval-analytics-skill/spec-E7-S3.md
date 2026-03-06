# Spec E7-S3：SFT 纳入 bmad-eval-analytics Skill

*Story 7.3 技术规格*  
*Epic E7 eval-ux-dashboard-and-sft*

---

## 1. 概述

本 spec 将 Story 7.3 的实现范围固化为可执行技术规格，覆盖在 `skills/bmad-eval-analytics/SKILL.md` 中**扩展** SFT 相关触发短语及执行指引，与现有 Coach 触发并列，不删除原有内容。

**前置假设**：
- `skills/bmad-eval-analytics/SKILL.md` 已存在（Story 6.5 创建），含 Coach 触发（「帮我看看短板」「最近一轮的 Coach 报告」等）
- `scripts/sft-extract.ts` 已存在（Story 7.2 交付），执行 `npx ts-node scripts/sft-extract.ts` 可提取 SFT 数据集并输出摘要

**输入来源**：
- Story 7.3（7-3-sft-bmad-eval-analytics-skill.md）
- prd.eval-ux-last-mile.md §5.4（REQ-UX-4.7）
- skills/bmad-eval-analytics/SKILL.md（当前版本）

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| REQ-UX-4.7 | 纳入 bmad-eval-analytics Skill；用户可说「提取微调数据集」或「生成 SFT 训练数据」触发 | spec §3.1, §3.2, §3.3 | ✅ |
| AC-1 | 用户说上述短语时 Skill 执行脚本并输出摘要 | spec §3.4 | ✅ |

---

## 3. 功能规格

### 3.1 Skill 文档扩展范围

| 项目 | 规格 |
|------|------|
| 目标文件 | `skills/bmad-eval-analytics/SKILL.md` |
| 改动类型 | **扩展**（增加 SFT 相关，不删除 Coach 相关） |
| 与 Coach 触发关系 | 并列；SFT 触发与 Coach 触发共存 |

### 3.2 新增 SFT 触发短语

在 `description`（YAML frontmatter）和 `When to use` 中增加以下短语：

- 「提取微调数据集」
- 「生成 SFT 训练数据」
- 可扩展等价短语：如「生成 SFT 数据」

### 3.3 执行指引

在「执行指引」中增加 SFT 分支：

- 当用户消息匹配 SFT 相关短语时，执行 `npx ts-node scripts/sft-extract.ts`
- 将脚本输出（摘要）展示给用户
- 与 Coach 分支并列：Coach 短语 → `npx ts-node scripts/coach-diagnose.ts`；SFT 短语 → `npx ts-node scripts/sft-extract.ts`

### 3.4 验收用例

| 场景 | 条件 | 预期 |
|------|------|------|
| AC-1 自然语言触发 | bmad-eval-analytics Skill 已加载；用户说「提取微调数据集」或「生成 SFT 训练数据」 | Skill 执行 `npx ts-node scripts/sft-extract.ts` 并输出摘要 |
| 验收命令可执行 | 运行 `npx ts-node scripts/sft-extract.ts` | 脚本成功执行（Story 7.2 已保证）；无报错 |

---

## 4. 非本 Story 范围

| 功能 | 负责 | 说明 |
|------|------|------|
| SFT 提取核心实现（scripts/sft-extract.ts） | Story 7.2 | 本 Story 仅扩展 Skill 文档，不修改脚本 |
| Coach 自然语言触发 | Story 6.5 | 已实现；本 Story 不删除 |
| /bmad-sft-extract Command | Story 7.2 | 与本 Skill 共享脚本 |

---

## 5. 产出物路径

| 产出 | 路径 |
|------|------|
| Skill 文档 | 扩展 `skills/bmad-eval-analytics/SKILL.md` |

---

## 6. 测试要求

- **验收**：在 Cursor 中说「提取微调数据集」时，Agent 应识别并执行 `npx ts-node scripts/sft-extract.ts`，展示摘要
- **回归**：原有 Coach 触发（「帮我看看短板」等）仍可触发 `coach-diagnose.ts`，未被删除
