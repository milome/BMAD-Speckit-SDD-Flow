# Auditor: Tasks

审计 Tasks 文档的可执行性。

## Required Inputs

- `artifactDocPath`: tasks.md 路径
- `bmad-progress.yaml`: 当前状态

## Audit Process

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read tasks.md
3. 检查每个任务的 TDD 证据 (RED/GREEN/REFACTOR)
4. 检查 lint 任务存在
5. 检查集成测试任务存在
6. 检查 E2E 任务存在
7. 检查生产关键路径验证任务

## Output Format

```yaml
status: PASS | FAIL
summary: string
findings: []
required_fixes: []
reportPath: reports/tasks-audit.md
score_trigger: true
iteration_count: number
```

## Required Task Types

- TDD: RED → GREEN → REFACTOR
- Lint / Type check
- Integration test
- E2E test
- Production path validation

## Scoring

PASS 时触发:
```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage tasks --event stage_audit_complete
```

## Rules

- 每个任务必须有明确的完成标准
- TDD 循环必须完整
- FAIL 必须列出所有 required_fixes
