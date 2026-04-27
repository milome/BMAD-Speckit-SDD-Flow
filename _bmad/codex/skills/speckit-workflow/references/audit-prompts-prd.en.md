# PRD audit prompts (English)

## Scope
Product Requirements Document (PRD)

## Goals
Verify completeness, accuracy, and testability; ensure requirements are clear and traceable.

## Dimensions

### 1. Requirements completeness (40%)

**Checks**
- [ ] PRD covers all core requirements from the Product Brief
- [ ] Major user scenarios are covered
- [ ] Edge cases and exceptions are considered
- [ ] Non-functional requirements (performance, security, availability) are stated
- [ ] i18n/l10n when applicable

**Grades**
- A: All checks pass
- B: Most pass; minor gaps
- C: Important gaps
- D: Severe gaps

### 2. Testability (30%)

**Checks**
- [ ] Each requirement has clear acceptance criteria
- [ ] Criteria are verifiable (measurable or demonstrable)
- [ ] Test scenarios cover positive and negative paths
- [ ] Test data needs are stated where needed

**Grades**
- A: All requirements testable
- B: Most testable
- C: Some not testable
- D: Many not testable

### 3. Consistency (30%)

**Checks**
- [ ] PRD aligns with Product Brief goals and scope
- [ ] Internal consistency; no contradictions
- [ ] Terminology is unified (glossary)
- [ ] Priorities are justified

**Grades**
- A: Fully consistent
- B: Minor inconsistencies
- C: Notable inconsistencies
- D: Severe contradictions

## Output format

```
PRD audit report
================

Subject: [PRD file name]
Date: [YYYY-MM-DD]

Overall Grade: [A/B/C/D]

Dimension scores:
1. Requirements completeness: [A/B/C/D] ([score]/40)
   - [issues]

2. Testability: [A/B/C/D] ([score]/30)
   - [issues]

3. Consistency: [A/B/C/D] ([score]/30)
   - [issues]

Issue list:
1. [Severity: High/Medium/Low] [description] [suggestion]
2. ...

Pass criteria:
- Overall A or B: pass, next stage
- C: conditional pass; fix high/medium issues
- D: fail, major revision

Next actions:
[suggestions]
```

## Additional checks

### Complexity
- [ ] Complexity assessment is reasonable
- [ ] Party-mode triggers applied correctly

### Traceability
- [ ] Requirements have unique IDs
- [ ] Descriptions are detailed enough for traceability
- [ ] Dependencies between requirements are explicit

---

## Critical Auditor (standard/strict)

Follow [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
