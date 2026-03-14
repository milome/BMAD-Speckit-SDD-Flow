# Audit Result Schema (Cursor speckit format)

结构化审计报告格式，所有 auditor 必须输出符合此 schema 的结果。

## Required Sections

审计报告必须包含以下章节：

### §1 逐条对照验证

对照原始需求文档逐条验证：

```markdown
## §1 逐条对照验证

### 1.1 Story 本 Story 范围

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 要点1 | 对照 Story | FR-001 | ✅ |
| 要点2 | 对照 AC-1 | FR-002 | ✅ |

### 1.2 Acceptance Criteria 逐条

| AC | 要点 | 验证方式 | spec 对应 | 验证结果 |
|----|------|----------|-----------|----------|
| AC-1 | ... | 逐条对照 | FR-001 | ✅ |

### 1.3 Tasks 映射

| Task | 要点 | 验证方式 | spec 对应 | 验证结果 |
|------|------|----------|-----------|----------|
| T1 | ... | 对照 Tasks | FR-001 | ✅ |

### 1.4 PRD 相关章节

| PRD 章节 | 要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|------|----------|-----------|----------|
| §5.2 | ... | 逐条对照 | FR-001 | ✅ |

### 1.5 ARCH 相关章节

| ARCH 章节 | 要点 | 验证方式 | spec 对应 | 验证结果 |
|-----------|------|----------|-----------|----------|
| §3.1 | ... | 逐条对照 | FR-001 | ✅ |
```

### §2 模糊表述检查

识别文档中的模糊表述：

```markdown
## §2 模糊表述检查

| 位置 | 表述 | 问题类型 | 建议澄清 |
|------|------|----------|----------|
| FR-006 | 「可编辑或接受默认」 | 默认值未定义 | 默认值为... |
| FR-007 | 「指定 tag」 | 输入方式未定义 | 用户可输入... |

**结论**：spec 存在 X 处模糊表述，已标注位置。
```

### §3 遗漏与边界检查

检查遗漏需求和边界条件：

```markdown
## §3 遗漏与边界检查

| 检查项 | 验证结果 |
|--------|----------|
| Story 非本 Story 范围是否被错误纳入 | ✅ 未纳入 |
| 目标路径不可写 | ✅ Edge Cases 已覆盖 |
| 模板拉取超时 | ✅ Edge Cases 已覆盖 |
| 非空目录判定 | ✅ FR-019 明确定义 |
```

### §4 结论

明确的审计结论：

```markdown
## §4 结论

**完全覆盖、验证通过。**

spec-E{epic}-S{story}.md 已覆盖 Story {epic}-{story}、PRD、ARCH 中与本 Story 相关的全部要点。

**报告保存路径**：specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md
**iteration_count**：{count}
```

### 批判审计员结论 (§4 子节)

详细的多维度检查：

```markdown
## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、术语歧义、边界条件完整性、需求可追溯性、与 Story 范围一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story...无遗漏。
- **边界未定义**：...边界条件已覆盖。
- **验收不可执行**：...验收可执行。
- **与前置文档矛盾**：...无矛盾。
- **术语歧义**：§2 已标注 X 处模糊表述。
- **边界条件完整性**：...完整。
- **需求可追溯性**：...可追溯性良好。
- **与 Story 范围一致性**：...一致。

**本轮结论**：本轮无新 gap。spec 完全覆盖原始需求。
```

### 可解析评分块

供 parseAndWriteScore 解析：

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 94/100
```

## Required Fields

- `status`: `PASS` | `FAIL` — 审计结论
- `summary`: string — 审计摘要
- `findings`: array — 发现的问题列表
- `required_fixes`: array — 必须修复的项目
- `reportPath`: string — 完整审计报告路径
- `score_trigger`: boolean — 是否触发评分写入
- `iteration_count`: number — 当前迭代轮次

## Example

```yaml
status: PASS
summary: 规范文档符合要求
findings: []
required_fixes: []
reportPath: specs/epic-10-speckit-init-core/story-1-interactive-init/AUDIT_spec-E10-S1.md
score_trigger: true
iteration_count: 0
```

## Rules

1. 不允许模糊表述，结论必须是 PASS 或 FAIL
2. FAIL 时必须列出所有 required_fixes
3. PASS 时必须触发评分写入
4. 必须包含 §1-§4 完整章节结构
5. 必须包含可解析评分块
6. 报告路径使用 Cursor speckit 格式：`specs/epic-{number}-{name}/story-{number}-{name}/AUDIT_{type}-E{epic}-S{story}.md`
