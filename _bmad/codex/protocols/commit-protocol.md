# Commit Protocol

This protocol defines how BMAD-Speckit-SDD-Flow agents request a commit after governed work. Worker agents must not commit directly unless the user explicitly asks for it in the current session.

## Rules

1. Worker agents produce a TaskReport and evidence bundle.
2. The main agent or human maintainer reviews audit status and gate results.
3. A commit is allowed only when required audits and gates are pass or explicitly marked as not applicable with evidence.
4. Failed, blocked, or missing audit evidence denies the commit.

## Commit Request Format

```yaml
request_type: commit_request
stage: implement
audit_status: pending | pass | fail | blocked
artifact_paths:
  - src/example.ts
  - tests/example.test.ts
gate_reports:
  - _bmad-output/runtime/gates/example.json
```

## Gate Logic

- `audit_status=fail` or `blocked`: deny.
- Missing TaskReport or missing required gate report: deny.
- `audit_status=pass` plus required gate pass: allow maintainer-controlled commit.

## Authority

The main agent coordinates commit readiness, but the user retains final authority over local git operations unless they explicitly delegate commit execution.
