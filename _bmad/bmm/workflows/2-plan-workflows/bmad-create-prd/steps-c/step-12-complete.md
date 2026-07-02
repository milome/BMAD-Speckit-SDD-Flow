# Step 12: Workflow Completion

**Final Step - Complete the PRD**

## MANDATORY EXECUTION RULES (READ FIRST):

- ✅ THIS IS A FINAL STEP - Workflow completion required
- 📖 CRITICAL: ALWAYS read the complete step file before taking any action
- 🛑 NO content generation - this is a wrap-up step
- 📋 FINALIZE document and update workflow status
- 🧪 RUN source PRD instance lint before marking any source draft as ready
- 💬 FOCUS on completion, validation options, and next steps
- 🎯 UPDATE workflow status files with completion information
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 🧪 Run the canonical source PRD instance lint command against `{outputFile}` before workflow completion language:
  `npx tsx packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd.ts --source "{outputFile}" --entry-source bmad_prd --json`
- 🛑 If lint fails, record `source_prd_draft_blocked`, preserve the PRD for staging repair, and do not call it `source_prd_draft_ready`
- ✅ If lint passes, record `source_prd_draft_ready`; this state is not `confirmation_ready`, `implementation_ready`, or `delivery_ready`
- 💾 Update the main workflow status file with completion information (if exists)
- 📖 Offer validation workflow options to user
- 🚫 DO NOT load additional steps after this one

## TERMINATION STEP PROTOCOLS:

- This is a FINAL step - workflow completion required
- Update workflow status file with finalized document
- Suggest validation and next workflow steps
- Mark workflow as complete in status tracking

## CONTEXT BOUNDARIES:

- Complete and polished PRD document is available from all previous steps
- Workflow frontmatter shows all completed steps including polish
- All collaborative content has been generated, saved, and optimized
- Focus on completion, validation options, and next steps

## YOUR TASK:

Complete the PRD workflow, update status files, offer validation options, and suggest next steps for the project.

## WORKFLOW COMPLETION SEQUENCE:

### 1. Announce Workflow Completion

Inform user that the PRD is complete and polished:
- Celebrate successful completion of comprehensive PRD
- Summarize all sections that were created
- Highlight that document has been polished for flow and coherence
- Emphasize document is ready for downstream work

### 2. Workflow Status Update

Update the main workflow status file if there is one:

- Check workflow configuration for a status file (if one exists)
- Update workflow_status["prd"] = "{outputFile}"
- Update workflow_status["sourcePrdDraftStatus"] = "source_prd_draft_ready" only after the source PRD instance lint command exits 0
- Update workflow_status["sourcePrdDraftStatus"] = "source_prd_draft_blocked" when the lint command returns issues
- Store the lint JSON report path or output summary with the workflow status update
- Save file, preserving all comments and structure
- Mark current timestamp as completion time

### 3. Source PRD Instance Lint Result

Report the exact lint result before offering downstream workflows:

- `source_prd_draft_ready`: The PRD has the input structure required for requirements-contract-authoring.
- `source_prd_draft_blocked`: The PRD is still a valid discovery artifact, but it must enter staging repair before any confirmation-ready claim.
- Never state that source PRD draft readiness means confirmation, implementation, delivery, closeout, merge, or release readiness.

### 4. Validation Workflow Options

Offer validation workflows to ensure PRD is ready for implementation:

**Available Validation Workflows:**

**Option 1: Check Implementation Readiness** (`skill:bmad-check-implementation-readiness`)
- Validates PRD has all information needed for development
- Checks epic coverage completeness
- Reviews UX alignment with requirements
- Assesses epic quality and readiness
- Identifies gaps before architecture/design work begins

**When to use:** Before starting technical architecture or epic breakdown

**Option 2: Skip for Now**
- Proceed directly to next workflows (architecture, UX, epics)
- Validation can be done later if needed
- Some teams prefer to validate during architecture reviews

### 5. Suggest Next Workflows

PRD complete. Invoke the `bmad-help` skill.

### 6. Final Completion Confirmation

- Confirm completion with user and summarize what has been accomplished
- Document now contains: BMAD Discovery Layer, Product Context, Success Criteria, User Journeys, Functional Requirements, Non-Functional Requirements, Negative Requirements And Not Done Conditions, Trace Matrix Source, Implementation Path Map, Source Current State, Source Target State, and Current Target Map
- Ask if they'd like to run validation workflow or proceed to next workflows

## SUCCESS METRICS:

✅ PRD document contains all required sections and has been polished
✅ Source PRD instance lint has run before ready state language
✅ Failed lint records `source_prd_draft_blocked` and routes the PRD to staging repair
✅ Passing lint records `source_prd_draft_ready` without promoting to confirmation or implementation readiness
✅ All collaborative content properly saved and optimized
✅ Workflow status file updated with completion information (if exists)
✅ Validation workflow options clearly presented
✅ Clear next step guidance provided to user
✅ Document quality validation completed
✅ User acknowledges completion and understands next options

## FAILURE MODES:

❌ Not updating workflow status file with completion information (if exists)
❌ Marking `source_prd_draft_ready` without running source PRD instance lint
❌ Treating `source_prd_draft_ready` as confirmation, implementation, delivery, merge, or release readiness
❌ Blocking authoring repair because lint failed instead of routing to staging repair
❌ Not offering validation workflow options
❌ Missing clear next step guidance for user
❌ Not confirming document completeness with user
❌ Workflow not properly marked as complete in status tracking (if applicable)
❌ User unclear about what happens next or what validation options exist

❌ **CRITICAL**: Reading only partial step file - leads to incomplete understanding and poor decisions
❌ **CRITICAL**: Making decisions without complete understanding of step requirements and protocols

## FINAL REMINDER to give the user:

The polished PRD serves as the foundation for all subsequent product development activities. All design, architecture, and development work should trace back to the requirements and vision documented in this PRD - update it also as needed as you continue planning.

**Congratulations on completing the Product Requirements Document for {{project_name}}!** 🎉
