---
outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
---

# Step 4: UX Alignment

> Legacy compatibility step only. Canonical readiness report path is `{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md`.

## STEP GOAL:

To check if UX documentation exists and validate that it aligns with PRD requirements and Architecture decisions, ensuring architecture accounts for both PRD and UX needs.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 馃洃 NEVER generate content without user input
- 馃摉 CRITICAL: Read the complete step file before taking any action
- 馃攧 CRITICAL: When loading next step with 'C', ensure entire file is read
- 馃搵 YOU ARE A FACILITATOR, not a content generator
- 鉁?YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- 鉁?You are a UX VALIDATOR ensuring user experience is properly addressed
- 鉁?UX requirements must be supported by architecture
- 鉁?Missing UX documentation is a warning if UI is implied
- 鉁?Alignment gaps must be documented

### Step-Specific Rules:

- 馃幆 Check for UX document existence first
- 馃毇 Don't assume UX is not needed
- 馃挰 Validate alignment between UX, PRD, and Architecture
- 馃毆 Add findings to the output report

## EXECUTION PROTOCOLS:

- 馃幆 Search for UX documentation
- 馃捑 If found, validate alignment
- 馃摉 If not found, assess if UX is implied
- 馃毇 FORBIDDEN to proceed without completing assessment

## UX ALIGNMENT PROCESS:

### 1. Initialize UX Validation

"Beginning **UX Alignment** validation.

I will:

1. Check if UX documentation exists
2. If UX exists: validate alignment with PRD and Architecture
3. If no UX: determine if UX is implied and document warning"

### 2. Search for UX Documentation

Search patterns:

- `{planning_artifacts}/*ux*.md` (whole document)
- `{planning_artifacts}/*ux*/index.md` (sharded)
- Look for UI-related terms in other documents

### 3. If UX Document Exists

#### A. UX 鈫?PRD Alignment

- Check UX requirements reflected in PRD
- Verify user journeys in UX match PRD use cases
- Identify UX requirements not in PRD

#### B. UX 鈫?Architecture Alignment

- Verify architecture supports UX requirements
- Check performance needs (responsiveness, load times)
- Identify UI components not supported by architecture

### 4. If No UX Document

Assess if UX/UI is implied:

- Does PRD mention user interface?
- Are there web/mobile components implied?
- Is this a user-facing application?

If UX implied but missing: Add warning to report

### 5. Add Findings to Report

Append to {outputFile}:

```markdown
## UX Alignment Assessment

### UX Document Status

[Found/Not Found]

### Alignment Issues

[List any misalignments between UX, PRD, and Architecture]

### Warnings

[Any warnings about missing UX or architectural gaps]
```

### 6. Auto-Proceed to Next Step

After UX assessment complete, immediately load next step.

## PROCEEDING TO EPIC QUALITY REVIEW

UX alignment assessment complete. Read fully and follow: `./step-05-epic-quality-review.md`

---

## 馃毃 SYSTEM SUCCESS/FAILURE METRICS

### 鉁?SUCCESS:

- UX document existence checked
- Alignment validated if UX exists
- Warning issued if UX implied but missing
- Findings added to report

### 鉂?SYSTEM FAILURE:

- Not checking for UX document
- Ignoring alignment issues
- Not documenting warnings

