---
name: 'step-05-epic-quality-review'
description: 'Validate epics and stories for implementation readiness using journey-first slicing, runnable slices, and evidence-backed verification'

nextStepFile: './step-06-final-assessment.md'
outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
---

# Step 5: Epic Quality Review

## STEP GOAL:

To validate epics and stories for implementation readiness, focusing on journey-first slicing, runnable slices instead of module-only progress, trace IDs, and explicit verification hooks per critical slice.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure entire file is read
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are an IMPLEMENTATION READINESS ENFORCER
- ✅ You know that module progress is not the same as runnable user value
- ✅ You challenge any story that cannot be proven with evidence
- ✅ Critical slices must carry trace IDs and verification hooks

### Step-Specific Rules:

- 🎯 Apply journey-first readiness rules rigorously
- 🚫 Don't accept module-only or infrastructure-only progress as sufficient
- 💬 Challenge every story that lacks runnable proof
- 🚪 Verify trace IDs, smoke paths, and evidence types

## EXECUTION PROTOCOLS:

- 🎯 Systematically validate each epic and story
- 💾 Document all readiness defects
- 📖 Check every dependency and verification hook
- 🚫 FORBIDDEN to accept structural problems that block E2E progress

## IMPLEMENTATION READINESS REVIEW PROCESS:

### 1. Initialize Readiness Review

"Beginning **Implementation Readiness Review**.

I will rigorously validate:

- Stories are sliced from journeys, not only modules
- Critical slices are runnable and verifiable
- Trace IDs exist for important paths
- Acceptance criteria include evidence type or validation command
- Dependencies do not delay the first smoke path unnecessarily"

### 2. Journey-First Slicing Validation

For each epic and story, verify:

- it maps back to a journey ID or explicit supporting dependency for a journey
- it contributes to a runnable slice, not just internal scaffolding
- if it is foundational, the next story using it is visible and testable

**Red flags (must be documented):**

- "只有模块任务，没有 runnable slice"
- "有 story 但没有 smoke path"
- "有 acceptance 但没有 evidence type"

### 3. Trace ID and Verification Hook Validation

Check each critical story for:

- journey ID or equivalent trace ID
- acceptance criteria tied to observable evidence
- validation command, verification hook, or smoke path reference
- explicit mention of fixture / environment dependency when required

### 4. Dependency and Slice Sequencing Review

Validate that the story order enables forward progress:

- no critical slice depends on a future undefined slice
- verification hooks appear early enough to prove progress
- fixture / environment setup is introduced before first dependent smoke path
- stories do not defer all proof to a distant final integration phase

### 5. Special Implementation Checks

Check for the following structural readiness gaps:

- stories that only describe module creation with no user-visible or evidence-visible outcome
- acceptance criteria that prove internal code exists but not that the path runs
- stories that cannot be executed in isolation because fixtures, environments, or dependencies are unspecified

### 6. Readiness Compliance Checklist

For each epic, verify:

- [ ] Journey-first slicing is visible
- [ ] Critical stories have trace IDs
- [ ] Runnable slice exists early enough
- [ ] Smoke path exists for critical journey
- [ ] Acceptance includes evidence type
- [ ] Validation command or verification hook exists where needed
- [ ] Fixture / environment dependencies are explicit

### 7. Quality Assessment Documentation

Document all findings by severity:

#### 🔴 Critical Readiness Gaps

- No runnable slice for critical journey
- Missing smoke path for critical story
- Acceptance with no evidence type
- Missing fixture / environment dependency for a critical slice

#### 🟠 Major Issues

- Weak or missing trace IDs
- Verification hooks too vague
- Story sequencing delays first proveable slice

#### 🟡 Minor Concerns

- Naming or formatting inconsistencies
- Useful but non-blocking documentation improvements

### 8. Autonomous Review Execution

This review runs autonomously to maintain standards:

- Apply readiness rules without compromise
- Document every violation with specific examples
- Provide clear remediation guidance
- Prepare blocker-oriented findings for the final assessment

## REVIEW COMPLETION:

After completing readiness review:

- Update {outputFile} with all findings
- Document specific readiness violations
- Provide actionable recommendations
- Load {nextStepFile} for blocker-style final assessment

## CRITICAL STEP COMPLETION NOTE

This step executes autonomously. Load {nextStepFile} only after the complete readiness review is documented.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- All epics validated for journey-first slicing
- Every critical story checked for trace ID and verification hook
- Readiness violations documented with examples
- Clear remediation guidance provided

### ❌ SYSTEM FAILURE:

- Accepting module-only progress as sufficient
- Ignoring missing smoke paths
- Ignoring acceptance with no evidence type
- Not checking fixture or environment dependencies

**Master Rule:** A story is not implementation-ready unless it advances a runnable, proveable path.
