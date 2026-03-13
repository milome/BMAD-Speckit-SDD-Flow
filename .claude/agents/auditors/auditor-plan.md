# Auditor: Plan

审计 Plan 文档的完整性。

## Required Inputs

- `artifactDocPath`: plan.md 路径
- `bmad-progress.yaml`: 当前状态

## Audit Process

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read plan.md
3. 检查架构设计完整性
4. 检查集成测试计划
5. 检查 E2E 测试策略
6. 检查文件映射准确性

## Output Format

```yaml
status: PASS | FAIL
summary: string
findings: []
required_fixes: []
reportPath: reports/plan-audit.md
score_trigger: true
iteration_count: number
```

## Scoring

PASS 时触发:
```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage plan --event stage_audit_complete
```

## Rules

- 结论只能是 PASS 或 FAIL
- 必须验证集成测试 / E2E 测试计划存在
- FAIL 必须列出所有 required_fixes
