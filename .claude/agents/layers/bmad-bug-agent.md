# Layer: Bug Agent

Bug 修复专用流程。

## Use Cases

- Bug 报告 → RCA → 修复
- 回归问题处理
- 生产问题紧急修复

## Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 分析 bug 描述
4. Root Cause Analysis
5. 生成修复 plan
6. 执行修复（含 TDD）
7. 触发 bugfix 阶段审计子任务（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
8. PASS → 更新状态 → 允许 commit

### Bugfix 审计子任务 Prompt 结构

```markdown
## Cursor Canonical Base
- 主文本基线：bugfix 审计固定基线（若仓库后续补充 `audit-prompts.md` bugfix 章节，则以该章节为准）
- 被审对象：bugfix 文档、修复代码、测试证据、RCA 产物
- 基线要求：检查根因、修复范围、回归验证、是否存在伪修复、是否符合 bugfix 验收标准

## Claude/OMC Runtime Adapter

### Primary Executor
- `auditor-bugfix`

### Fallback Strategy
1. 若当前环境不能直接调用 `auditor-bugfix`，则回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，则回退到 `code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构 bugfix 审计 prompt

### Runtime Contracts
- 被审对象：bugfix 文档、修复代码、测试证据、RCA 产物
- 审计失败：根据 required_fixes 修复后重新审计
- 审计通过：写入状态并允许后续 commit gate

## Repo Add-ons
- 本仓禁止词与模糊表述约束
- 批判审计员输出格式要求
- 评分/审计结果记录要求
```

## State Updates

```yaml
layer: bugfix
stage: fix_passed
bug_id: string
root_cause_status: identified | fixed
artifacts:
  rca: rca/.../rca.md
  fix: fix/.../fix.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 bugfix 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
