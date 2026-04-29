---
name: 'step-02-prd-analysis'
description: 'Read and analyze PRD to extract journey contracts, evidence contracts, and supporting FR/NFR requirements for readiness validation'

nextStepFile: './step-03-epic-coverage-validation.md'
outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
epicsFile: '{planning_artifacts}/{branch}/epics.md'
---

# Step 2: PRD Analysis

## STEP GOAL:

To fully read and analyze the PRD document (whole or sharded) and extract the product contracts that determine implementation readiness: P0 journeys, evidence contracts, actor-permission-state links, failure paths, unresolved ambiguities, plus supporting FRs and NFRs.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure entire file is read
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are an expert Product Manager and Scrum Master
- ✅ Your expertise is in requirements analysis and readiness traceability
- ✅ You think critically about runnable paths, not just requirement lists
- ✅ Success is measured in extracting every contract needed for downstream implementation

### Step-Specific Rules:

- 🎯 Focus ONLY on reading and extracting from the PRD
- 🚫 Don't validate epics yet
- 💬 Read PRD completely - whole or all sharded files
- 🚪 Extract journey contracts in addition to FRs and NFRs

## EXECUTION PROTOCOLS:

- 🎯 Load and completely read the PRD
- 💾 Extract all journey and evidence contracts systematically
- 📖 Document findings in the report
- 🚫 FORBIDDEN to skip failure paths, deferred ambiguities, or actor/state links

## PRD ANALYSIS PROCESS:

### 1. Initialize PRD Analysis

"Beginning **PRD Analysis** to extract product contracts for readiness review.

I will:

1. Load the PRD document (whole or sharded)
2. Read it completely and thoroughly
3. Extract all P0 journey contracts
4. Extract all journey evidence contracts
5. Extract actor-permission-state links, failure paths, and unresolved ambiguities
6. Extract supporting FRs and NFRs for traceability"

### 2. Load and Read PRD

From the document inventory in step 1:

- If whole PRD file exists: Load and read it completely
- If sharded PRD exists: Load and read ALL files in the PRD folder
- Ensure complete coverage - no files skipped

### 3. Extract P0 Journey Contracts

Search for and extract:

- `P0 Journey Inventory`
- journey IDs and names
- actor + permission + starting state + ending state
- success outcome or business completion state
- current workaround if mentioned

Format findings as:

```md
## P0 Journey Contracts Extracted

Journey ID:
- Goal:
- Actor / permission:
- Start state -> end state:
- Business completion outcome:
- Current workaround:
```

### 4. Extract Journey Evidence Contracts

Search for and extract:

- success evidence
- failure evidence
- observable signals or proof requirements
- validation owner or verification method

Format findings as:

```md
## Journey Evidence Contracts Extracted

Journey ID:
- Success evidence:
- Failure evidence:
- Verification method:
- Validation owner:
```

### 5. Extract Actor-Permission-State Links, Failure Paths, and Ambiguities

Search for and extract:

- actor-permission-state relationships
- failure triggers and recovery expectations
- deferred ambiguities or unresolved decisions

Format findings as:

```md
## Actor-Permission-State Links Extracted

## Failure Paths Extracted

## Deferred Ambiguities Extracted
```

### 6. Extract Supporting Functional Requirements (FRs)

Search for and extract:

- numbered FRs (FR1, FR2, FR3, etc.)
- requirements labeled "Functional Requirement"
- user stories or use cases that represent functional needs
- business rules that must be implemented

### 7. Extract Supporting Non-Functional Requirements (NFRs)

Search for and extract:

- performance requirements
- security requirements
- usability requirements
- reliability requirements
- scalability requirements
- compliance requirements
- environment / fixture / dependency assumptions when present

### 8. Add to Assessment Report

Append to {outputFile}:

```markdown
## PRD Analysis

### P0 Journey Contracts Extracted

[Journey contract list from section 3]

### Journey Evidence Contracts Extracted

[Evidence contract list from section 4]

### Actor-Permission-State Links Extracted

[Findings from section 5]

### Failure Paths Extracted

[Findings from section 5]

### Deferred Ambiguities Extracted

[Findings from section 5]

### Functional Requirements

[Supporting FR list]

### Non-Functional Requirements

[Supporting NFR list]

### PRD Completeness Assessment

[Initial assessment of whether the PRD defines runnable product contracts clearly enough for readiness review]
```

### 9. Auto-Proceed to Next Step

After PRD analysis is complete, immediately load next step for journey traceability validation.

## PROCEEDING TO JOURNEY TRACEABILITY VALIDATION

PRD analysis complete. Loading next step to validate journey coverage in epics and stories.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- PRD loaded and read completely
- All P0 journeys extracted with actor, state, and completion information
- Evidence contracts documented
- Failure paths and deferred ambiguities captured
- Supporting FRs and NFRs extracted
- Findings added to assessment report

### ❌ SYSTEM FAILURE:

- Not reading complete PRD
- Missing P0 journeys or evidence contracts
- Ignoring failure paths or unresolved ambiguities
- Extracting only FR/NFR lists without runnable journey contracts

**Master Rule:** Readiness review begins with explicit product contracts, not generic requirement summaries.
