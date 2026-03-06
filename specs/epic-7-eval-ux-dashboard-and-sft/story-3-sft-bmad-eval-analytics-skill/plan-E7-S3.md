# plan-E7-S3：SFT 纳入 bmad-eval-analytics Skill 实现方案

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.3  
**输入**：`spec-E7-S3.md`、Story 7.3、prd.eval-ux-last-mile.md §5.4、skills/bmad-eval-analytics/SKILL.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| REQ-UX-4.7 SFT 自然语言触发 | spec §3.1, §3.2 | Phase 1, §4 | ✅ |
| AC-1 执行脚本并输出摘要 | spec §3.4 | Phase 2, §5 | ✅ |

---

## 2. 目标与约束

- 扩展 `skills/bmad-eval-analytics/SKILL.md`：在 description、When to use、执行指引中增加 SFT 相关触发短语及执行 `npx ts-node scripts/sft-extract.ts` 的指引
- 与现有 Coach 触发并列，**不删除**原有 Coach 内容
- 复用 Story 7.2 的 `scripts/sft-extract.ts`，无独立实现
- 禁止伪实现、占位

---

## 3. 实施分期

### Phase 1：Skill 文档扩展

1. **description（YAML frontmatter）**：在 `description` 中增加 SFT 触发短语描述，如「提取微调数据集」「生成 SFT 训练数据」；与 Coach 描述并列
2. **When to use**：在现有 Coach 触发列表下方增加 SFT 触发短语列表：
   - 「提取微调数据集」
   - 「生成 SFT 训练数据」
   - 等价表述（如「生成 SFT 数据」）
3. **执行指引**：在现有 Coach 指引后增加 SFT 分支：
   - 识别 SFT 触发 → 执行 `npx ts-node scripts/sft-extract.ts`
   - 展示脚本输出（摘要）

### Phase 2：验收

1. 验收：`npx ts-node scripts/sft-extract.ts` 可执行
2. 验收：在 Cursor 中说「提取微调数据集」时，Agent 应执行该脚本并展示摘要
3. 回归：说「帮我看看短板」时仍触发 Coach 脚本

---

## 4. 模块与文件改动设计

### 4.1 修改文件

| 文件 | 改动 | 对应需求 |
|------|------|----------|
| `skills/bmad-eval-analytics/SKILL.md` | 扩展 description、When to use、执行指引；增加 SFT 触发 | spec §3.2, §3.3 |

### 4.2 依赖关系

| 依赖 | 路径 |
|------|------|
| SFT 提取脚本 | `scripts/sft-extract.ts`（Story 7.2 已交付） |
| 现有 Coach 触发 | 保留不变 |

---

## 5. 详细技术方案

### 5.1 description 扩展示例

```yaml
description: |
  bmad-eval-analytics：通过自然语言触发 Coach 诊断或 SFT 提取。
  Coach：当用户说「帮我看看短板」「最近一轮的 Coach 报告」等时，执行 npx ts-node scripts/coach-diagnose.ts。
  SFT：当用户说「提取微调数据集」「生成 SFT 训练数据」等时，执行 npx ts-node scripts/sft-extract.ts。
  Use when...
```

### 5.2 When to use 扩展

在 Coach 短语列表后增加：

**SFT 提取**：
- 「提取微调数据集」
- 「生成 SFT 训练数据」
- 等价表述（如「生成 SFT 数据」）

### 5.3 执行指引扩展

在 Coach 指引后增加 SFT 分支：

1. **识别触发**：用户消息匹配 SFT 短语 → 执行 SFT 提取；匹配 Coach 短语 → 执行 Coach 诊断
2. **SFT 执行**：运行 `npx ts-node scripts/sft-extract.ts`；将摘要展示给用户
3. **Coach 执行**（已有）：运行 `npx ts-node scripts/coach-diagnose.ts`；将输出展示给用户

### 5.4 验收命令

| 场景 | 操作 | 预期 |
|------|------|------|
| 脚本可执行 | `npx ts-node scripts/sft-extract.ts` | 成功执行；输出摘要（含「共提取 N 条...」或等价） |
| Cursor 触发 | 说「提取微调数据集」 | Agent 执行脚本并展示摘要 |
| 回归 Coach | 说「帮我看看短板」 | Agent 执行 coach-diagnose.ts |

---

## 6. 执行准入标准

- 生成 tasks-E7-S3.md 后，任务须具备明确文件路径与验收命令
- 禁止伪实现、占位
- ralph-method：prd 与 progress 在 story-7-3-sft-bmad-eval-analytics-skill 目录
