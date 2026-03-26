# Pull Request audit prompts (English)

## Scope
Pull Request (merge readiness)

## Goals
Verify CI health, code review quality, tests, and impact assessment.

## Dimensions

### 1. CI status (30%)

**Checks**
- [ ] All CI checks pass (build, test, lint)
- [ ] No build errors/warnings blocking merge
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Coverage meets or improves baseline

### 2. Code review (30%)

**Checks**
- [ ] Follows project style
- [ ] Naming and comments adequate
- [ ] No obvious security issues (SQLi, XSS, …)
- [ ] No major performance issues (N+1, leaks, …)
- [ ] Complexity reasonable

### 3. Test coverage (20%)

**Checks**
- [ ] New code has unit tests
- [ ] Critical paths have integration tests
- [ ] Edge cases covered
- [ ] Tests maintainable

### 4. Impact assessment (20%)

**Checks**
- [ ] PR description explains what and why
- [ ] Impact scope clear
- [ ] Backward compatibility considered

## Output format

```
PR audit report
===============

PR: [id/title]
Date: [YYYY-MM-DD]

Overall Grade: [A/B/C/D]

Dimension scores:
1. CI status: [A/B/C/D]
2. Code review: [A/B/C/D]
3. Test coverage: [A/B/C/D]
4. Impact assessment: [A/B/C/D]

Issue list:
1. [Severity: High/Medium/Low] [description] [suggestion]

Pass criteria: (A/B pass; C conditional; D fail)
```

---

## Critical Auditor (standard/strict)

Follow [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
