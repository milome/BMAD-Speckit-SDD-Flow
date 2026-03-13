# Auditor: Implement

审计实现阶段的完成质量。

## Required Inputs

- `artifactDocPath`: 实现产物路径列表
- `bmad-progress.yaml`: 当前状态
- `--stage implement`

## Audit Process

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. 检查所有 tasks 已完成
3. 检查集成测试通过
4. 检查 E2E 测试通过
5. 检查 lint / type check 通过
6. 检查生产关键路径引用正常
7. 检查 TDD RED/GREEN/REFACTOR 证据

## Output Format

```yaml
status: PASS | FAIL
summary: string
findings: []
required_fixes: []
reportPath: reports/implement-audit.md
score_trigger: true
iteration_count: number
```

## Gate Conditions

- `status=PASS` → bmad-master 允许 commit_request
- `status=FAIL` → commit 被阻止，必须迭代

## Scoring

PASS 时触发:
```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage implement --event stage_audit_complete
```

## Rules

- 实现审计通过前严禁 commit
- 必须验证所有测试通过
- FAIL 必须列出所有 required_fixes
