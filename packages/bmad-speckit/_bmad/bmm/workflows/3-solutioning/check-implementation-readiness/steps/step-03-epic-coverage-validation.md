---
name: 'step-03-epic-coverage-validation'
description: 'Validate that all P0 journeys are traceable into epics and stories with smoke paths and evidence-backed acceptance'

nextStepFile: './step-04-ux-alignment.md'
outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
---

# Step 3: Epic Coverage Validation

## STEP GOAL:

To validate that every P0 journey from the PRD is traceable into epics and stories, that each critical journey has at least one smoke path, and that stories do not drift away from journey-backed acceptance.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure entire file is read
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are an expert Product Manager and Scrum Master
- ✅ Your expertise is in journey traceability
- ✅ You ensure the most important user journeys do not disappear in epic decomposition
- ✅ Success is measured in complete journey-to-story coverage

### Step-Specific Rules:

- 🎯 Focus on journey traceability, not only FR enumeration
- 🚫 Don't analyze story quality yet
- 💬 Compare PRD journey contracts against epics and stories
- 🚪 Document every missing journey path, missing smoke path, or evidence gap

## EXECUTION PROTOCOLS:

- 🎯 Load epics document completely
- 💾 Extract journey coverage information
- 📖 Compare against PRD journey contracts from previous step
- 🚫 FORBIDDEN to proceed without documenting traceability gaps

## JOURNEY TRACEABILITY VALIDATION PROCESS:

### 1. Initialize Traceability Validation

"Beginning **Journey Traceability Validation**.

I will:

1. Load the epics and stories document
2. Extract journey mappings, story IDs, and acceptance evidence
3. Compare against PRD P0 journeys
4. Identify any missing smoke paths, no-evidence acceptance, or orphan stories"

### 2. Load Epics Document

From the document inventory in step 1:

- Load the epics and stories document (whole or sharded)
- Read it completely to find trace IDs, coverage mapping, story acceptance, and verification hooks

### 3. Extract Journey Coverage

From the epics document, extract:

- which epic / story maps to which journey ID
- whether the story includes a runnable or smoke slice
- whether acceptance includes evidence type or verification hook
- whether any story lacks a journey source

### 4. Compare Coverage Against PRD Journeys

Using the P0 journey list from step 2, check for each journey:

- Is there epic / story coverage?
- Is there at least one smoke path?
- Is there acceptance evidence or verification hook?
- Is the journey sliced into runnable user value rather than module-only work?

Create this matrix:

```md
## Journey Traceability Analysis

| Journey ID | Journey Contract | Epic/Story Coverage | Smoke Path | Evidence Type | Status |
| ---------- | ---------------- | ------------------- | ---------- | ------------- | ------ |
| P0-1       | [summary]        | Epic X Story Y      | Yes/No     | [type]        | ✓ / ❌ |
```

### 5. Document Missing Coverage and Orphan Work

List all gaps, including:

- journeys missing epic / story coverage
- journeys with no smoke path
- journeys with acceptance but no evidence type
- stories with no journey source
- stories that appear module-only and do not create a runnable slice

Format findings as:

```md
## Missing Journey Coverage

## Missing Smoke Paths

## No-Evidence Acceptance Findings

## Orphan Stories
```

### 6. Add to Assessment Report

Append to {outputFile}:

```markdown
## Journey Traceability Validation

### Journey Traceability Analysis

[Complete matrix from section 4]

### Missing Journey Coverage

[Findings from section 5]

### Missing Smoke Paths

[Findings from section 5]

### No-Evidence Acceptance Findings

[Findings from section 5]

### Orphan Stories

[Findings from section 5]

### Coverage Statistics

- Total P0 journeys: [count]
- Journeys mapped to epics/stories: [count]
- Journey coverage percentage: [percentage]
- Journeys with smoke path: [count]
- Stories without journey source: [count]
```

### 7. Auto-Proceed to Next Step

After traceability validation is complete, immediately load next step.

## PROCEEDING TO UX ALIGNMENT

Journey traceability validation complete. Loading next step for UX alignment.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Epics document loaded completely
- Every P0 journey checked against epic/story mappings
- Smoke path coverage assessed
- Evidence-backed acceptance checked
- Orphan stories identified and documented

### ❌ SYSTEM FAILURE:

- Not reading complete epics document
- Checking only FR numbering without journey contracts
- Missing no-evidence acceptance findings
- Ignoring stories with no journey source

**Master Rule:** Every critical journey must have a traceable, runnable implementation path.
