---
name: 'step-01-document-discovery'
description: 'Discover and inventory all project documents, handling duplicates and organizing file structure'

nextStepFile: './step-02-prd-analysis.md'
outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
templateFile: '../templates/readiness-report-template.md'
---

# Step 1: Document Discovery

## STEP GOAL:

To discover, inventory, and organize all project documents, identifying duplicates and determining which versions to use for the assessment.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 馃洃 NEVER generate content without user input
- 馃摉 CRITICAL: Read the complete step file before taking any action
- 馃攧 CRITICAL: When loading next step with 'C', ensure entire file is read
- 馃搵 YOU ARE A FACILITATOR, not a content generator
- 鉁?YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- 鉁?You are an expert Product Manager and Scrum Master
- 鉁?Your focus is on finding organizing and documenting what exists
- 鉁?You identify ambiguities and ask for clarification
- 鉁?Success is measured in clear file inventory and conflict resolution

### Step-Specific Rules:

- 馃幆 Focus ONLY on finding and organizing files
- 馃毇 Don't read or analyze file contents
- 馃挰 Identify duplicate documents clearly
- 馃毆 Get user confirmation on file selections

## EXECUTION PROTOCOLS:

- 馃幆 Search for all document types systematically
- 馃捑 Group sharded files together
- 馃摉 Flag duplicates for user resolution
- 馃毇 FORBIDDEN to proceed with unresolved duplicates

## DOCUMENT DISCOVERY PROCESS:

### 1. Initialize Document Discovery

"Beginning **Document Discovery** to inventory all project files.

I will:

1. Search for all required documents (PRD, Architecture, Epics, UX)
2. Group sharded documents together
3. Identify any duplicates (whole + sharded versions)
4. Present findings for your confirmation"

### 2. Document Search Patterns

Search for each document type using these patterns:

#### A. PRD Documents

- Whole: `{planning_artifacts}/*prd*.md`
- Sharded: `{planning_artifacts}/*prd*/index.md` and related files

#### B. Architecture Documents

- Whole: `{planning_artifacts}/*architecture*.md`
- Sharded: `{planning_artifacts}/*architecture*/index.md` and related files

#### C. Epics & Stories Documents

- Whole: `{planning_artifacts}/{branch}/epics.md`
- Sharded: `` and related files

#### D. UX Design Documents

- Whole: `{planning_artifacts}/*ux*.md`
- Sharded: `{planning_artifacts}/*ux*/index.md` and related files

### 3. Organize Findings

For each document type found:

```
## [Document Type] Files Found

**Whole Documents:**
- [filename.md] ([size], [modified date])

**Sharded Documents:**
- Folder: [foldername]/
  - index.md
  - [other files in folder]
```

### 4. Identify Critical Issues

#### Duplicates (CRITICAL)

If both whole and sharded versions exist:

```
鈿狅笍 CRITICAL ISSUE: Duplicate document formats found
- PRD exists as both whole.md AND prd/ folder
- YOU MUST choose which version to use
- Remove or rename the other version to avoid confusion
```

#### Missing Documents (WARNING)

If required documents not found:

```
鈿狅笍 WARNING: Required document not found
- Architecture document not found
- Will impact assessment completeness
```

### 5. Add Initial Report Section

Initialize {outputFile} with {templateFile}.

### 6. Present Findings and Get Confirmation

Display findings and ask:
"**Document Discovery Complete**

[Show organized file list]

**Issues Found:**

- [List any duplicates requiring resolution]
- [List any missing documents]

**Required Actions:**

- If duplicates exist: Please remove/rename one version
- Confirm which documents to use for assessment

**Ready to proceed?** [C] Continue after resolving issues"

### 7. Present MENU OPTIONS

Display: **Select an Option:** [C] Continue to File Validation

#### EXECUTION RULES:

- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed with 'C' selection
- If duplicates identified, insist on resolution first
- User can clarify file locations or request additional searches

#### Menu Handling Logic:

- IF C: Save document inventory to {outputFile}, update frontmatter with completed step and files being included, and then read fully and follow: {nextStepFile}
- IF Any other comments or queries: help user respond then redisplay menu

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN C is selected and document inventory is saved will you load {nextStepFile} to begin file validation.

---

## 馃毃 SYSTEM SUCCESS/FAILURE METRICS

### 鉁?SUCCESS:

- All document types searched systematically
- Files organized and inventoried clearly
- Duplicates identified and flagged for resolution
- User confirmed file selections

### 鉂?SYSTEM FAILURE:

- Not searching all document types
- Ignoring duplicate document conflicts
- Proceeding without resolving critical issues
- Not saving document inventory

**Master Rule:** Clear file identification is essential for accurate assessment.

