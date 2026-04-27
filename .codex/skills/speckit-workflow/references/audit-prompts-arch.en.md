# Architecture audit prompts (English)

## Scope
Architecture design document

## Goals
Validate technical feasibility, scalability, security, and cost; ensure design is sound.

## Dimensions

### 1. Technical feasibility (30%)

**Checks**
- [ ] Technology choices are justified
- [ ] Architecture can be delivered within time/resource constraints
- [ ] Tools and stacks are mature and available
- [ ] Team can implement

**Grades**: A鈥揇 (see Chinese `audit-prompts-arch.md` for full rubric)

### 2. Scalability (25%)

**Checks**
- [ ] Supports near-term growth
- [ ] Horizontal scaling path
- [ ] New features without breaking existing
- [ ] Backward compatibility

### 3. Security (25%)

**Checks**
- [ ] Threat modeling documented
- [ ] Controls per threat
- [ ] Data in transit and at rest
- [ ] AuthN/AuthZ design
- [ ] Compliance for sensitive data

### 4. Cost effectiveness (20%)

**Checks**
- [ ] Infra cost estimate
- [ ] Ops cost under control
- [ ] ROI supports investment
- [ ] Cost optimization alternatives

## Tradeoff / ADR

Major decisions should have ADR records:

**ADR checks**
- [ ] Context clear
- [ ] At least two options considered
- [ ] Pros/cons documented
- [ ] Decision rationale with evidence
- [ ] Consequences analyzed
- [ ] Stakeholders acknowledged

## Output format

```
Architecture audit report
=========================

Subject: [document name]
Date: [YYYY-MM-DD]

Overall Grade: [A/B/C/D]

Dimension scores:
1. Technical feasibility: [A/B/C/D] ([score]/30)
2. Scalability: [A/B/C/D] ([score]/25)
3. Security: [A/B/C/D] ([score]/25)
4. Cost effectiveness: [A/B/C/D] ([score]/20)

Tradeoff / ADR:
- ADR coverage: [X/Y] major decisions
- ADR quality: [A/B/C/D]

Issue list:
1. [Severity: High/Medium/Low] [description] [suggestion]

Pass criteria: (same pattern as PRD)
```

## Additional checks

### Complexity
- [ ] Architecture complexity assessment reasonable
- [ ] Party-mode triggers correct

### Alignment with PRD
- [ ] Architecture satisfies PRD requirements
- [ ] Constraints flow to downstream docs
- [ ] Technical approach matches business goals

---

## Critical Auditor (standard/strict)

Follow [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md).
