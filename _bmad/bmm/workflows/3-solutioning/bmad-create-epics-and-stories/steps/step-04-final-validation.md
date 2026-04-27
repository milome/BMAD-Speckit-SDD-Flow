# Step 4: Final Validation

> Legacy compatibility step only. Canonical epics output path is `{planning_artifacts}/{branch}/epics.md`.

## STEP GOAL:

To validate complete coverage of all requirements and ensure stories are ready for development.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 馃洃 NEVER generate content without user input
- 馃摉 CRITICAL: Read the complete step file before taking any action
- 馃攧 CRITICAL: Process validation sequentially without skipping
- 馃搵 YOU ARE A FACILITATOR, not a content generator
- 鉁?YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- 鉁?You are a product strategist and technical specifications writer
- 鉁?If you already have been given communication or persona patterns, continue to use those while playing this new role
- 鉁?We engage in collaborative dialogue, not command-response
- 鉁?You bring validation expertise and quality assurance
- 鉁?User brings their implementation priorities and final review

### Step-Specific Rules:

- 馃幆 Focus ONLY on validating complete requirements coverage
- 馃毇 FORBIDDEN to skip any validation checks
- 馃挰 Validate FR coverage, story completeness, and dependencies
- 馃毆 ENSURE all stories are ready for development

## EXECUTION PROTOCOLS:

- 馃幆 Validate every requirement has story coverage
- 馃捑 Check story dependencies and flow
- 馃摉 Verify architecture compliance
- 馃毇 FORBIDDEN to approve incomplete coverage

## CONTEXT BOUNDARIES:

- Available context: Complete epic and story breakdown from previous steps
- Focus: Final validation of requirements coverage and story readiness
- Limits: Validation only, no new content creation
- Dependencies: Completed story generation from Step 3

## VALIDATION PROCESS:

### 1. FR Coverage Validation

Review the complete epic and story breakdown to ensure EVERY FR is covered:

**CRITICAL CHECK:**

- Go through each FR from the Requirements Inventory
- Verify it appears in at least one story
- Check that acceptance criteria fully address the FR
- No FRs should be left uncovered

### 2. Architecture Implementation Validation

**Check for Starter Template Setup:**

- Does Architecture document specify a starter template?
- If YES: Epic 1 Story 1 must be "Set up initial project from starter template"
- This includes cloning, installing dependencies, initial configuration

**Database/Entity Creation Validation:**

- Are database tables/entities created ONLY when needed by stories?
- 鉂?WRONG: Epic 1 creates all tables upfront
- 鉁?RIGHT: Tables created as part of the first story that needs them
- Each story should create/modify ONLY what it needs

### 3. Story Quality Validation

**Each story must:**

- Be completable by a single dev agent
- Have clear acceptance criteria
- Reference specific FRs it implements
- Include necessary technical details
- **Not have forward dependencies** (can only depend on PREVIOUS stories)
- Be implementable without waiting for future stories

### 4. Epic Structure Validation

**Check that:**

- Epics deliver user value, not technical milestones
- Dependencies flow naturally
- Foundation stories only setup what's needed
- No big upfront technical work

### 5. Dependency Validation (CRITICAL)

**Epic Independence Check:**

- Does each epic deliver COMPLETE functionality for its domain?
- Can Epic 2 function without Epic 3 being implemented?
- Can Epic 3 function standalone using Epic 1 & 2 outputs?
- 鉂?WRONG: Epic 2 requires Epic 3 features to work
- 鉁?RIGHT: Each epic is independently valuable

**Within-Epic Story Dependency Check:**
For each epic, review stories in order:

- Can Story N.1 be completed without Stories N.2, N.3, etc.?
- Can Story N.2 be completed using only Story N.1 output?
- Can Story N.3 be completed using only Stories N.1 & N.2 outputs?
- 鉂?WRONG: "This story depends on a future story"
- 鉂?WRONG: Story references features not yet implemented
- 鉁?RIGHT: Each story builds only on previous stories

### 6. Complete and Save

If all validations pass:

- Update any remaining placeholders in the document
- Ensure proper formatting
- Save the final branch-scoped `epics.md` at `{planning_artifacts}/{branch}/epics.md`

**Present Final Menu:**
**All validations complete!** [C] Complete Workflow

HALT 鈥?wait for user input before proceeding.

When C is selected, the workflow is complete and the epics.md is ready for development.

Epics and Stories complete. Invoke the `bmad-help` skill.

Upon Completion of task output: offer to answer any questions about the Epics and Stories.

