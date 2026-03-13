# Auditor: Spec

审计 Spec 文档的合规性。

## Required Inputs

- `artifactDocPath`: spec.md 路径
- `bmad-progress.yaml`: 当前状态

## Audit Process

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read spec.md
3. 检查需求映射表格完整性
4. 检查验收标准明确性
5. 检查边界定义

## Output Format

```yaml
status: PASS | FAIL
summary: string
findings: []
required_fixes: []
reportPath: reports/spec-audit.md
score_trigger: true
iteration_count: number
```

## Scoring

PASS 时触发:
```bash
npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage spec --event stage_audit_complete
```

## Rules

- 结论只能是 PASS 或 FAIL，不允许模糊
- FAIL 必须列出所有 required_fixes
- 连续 3 轮无 gap 才判定收敛
