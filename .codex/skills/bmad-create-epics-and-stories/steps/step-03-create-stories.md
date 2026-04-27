# Step 3: Generate Epics and Stories

> Legacy compatibility step only. Canonical epics output path is `{planning_artifacts}/{branch}/epics.md`.

## STEP GOAL:

To generate all epics with their stories based on the approved epics_list, following the template structure exactly.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 馃洃 NEVER generate content without user input
- 馃摉 CRITICAL: Read the complete step file before taking any action
- 馃攧 CRITICAL: Process epics sequentially
- 馃搵 YOU ARE A FACILITATOR, not a content generator
- 鉁?YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- 鉁?You are a product strategist and technical specifications writer
- 鉁?If you already have been given communication or persona patterns, continue to use those while playing this new role
- 鉁?We engage in collaborative dialogue, not command-response
- 鉁?You bring story creation and acceptance criteria expertise
- 鉁?User brings their implementation priorities and constraints

### Step-Specific Rules:

- 馃幆 Generate stories for each epic following the template exactly
- 馃毇 FORBIDDEN to deviate from template structure
- 馃挰 Each story must have clear acceptance criteria
- 馃毆 ENSURE each story is completable by a single dev agent
- 馃敆 **CRITICAL: Stories MUST NOT depend on future stories within the same epic**

## EXECUTION PROTOCOLS:

- 馃幆 Generate stories collaboratively with user input
- 馃捑 Append epics and stories to {planning_artifacts}/{branch}/epics.md following template
- 馃摉 Process epics one at a time in sequence
- 馃毇 FORBIDDEN to skip any epic or rush through stories

## STORY GENERATION PROCESS:

### 1. Load Approved Epic Structure

Load {planning_artifacts}/{branch}/epics.md and review:

- Approved epics_list from Step 2
- FR coverage map
- All requirements (FRs, NFRs, additional, **UX Design requirements if present**)
- Template structure at the end of the document

**UX Design Integration**: If UX Design Requirements (UX-DRs) were extracted in Step 1, ensure they are visible during story creation. UX-DRs must be covered by stories 鈥?either within existing epics (e.g., accessibility fixes for a feature epic) or in a dedicated "Design System / UX Polish" epic.

### 2. Explain Story Creation Approach

**STORY CREATION GUIDELINES:**

For each epic, create stories that:

- Follow the exact template structure
- Are sized for single dev agent completion
- Have clear user value
- Include specific acceptance criteria
- Reference requirements being fulfilled

**馃毃 DATABASE/ENTITY CREATION PRINCIPLE:**
Create tables/entities ONLY when needed by the story:

- 鉂?WRONG: Epic 1 Story 1 creates all 50 database tables
- 鉁?RIGHT: Each story creates/alters ONLY the tables it needs

**馃敆 STORY DEPENDENCY PRINCIPLE:**
Stories must be independently completable in sequence:

- 鉂?WRONG: Story 1.2 requires Story 1.3 to be completed first
- 鉁?RIGHT: Each story can be completed based only on previous stories
- 鉂?WRONG: "Wait for Story 1.4 to be implemented before this works"
- 鉁?RIGHT: "This story works independently and enables future stories"

**STORY FORMAT (from template):**

```
### Story {N}.{M}: {story_title}

As a {user_type},
I want {capability},
So that {value_benefit}.

**Acceptance Criteria:**

**Given** {precondition}
**When** {action}
**Then** {expected_outcome}
**And** {additional_criteria}
```

**鉁?GOOD STORY EXAMPLES:**

_Epic 1: User Authentication_

- Story 1.1: User Registration with Email
- Story 1.2: User Login with Password
- Story 1.3: Password Reset via Email

_Epic 2: Content Creation_

- Story 2.1: Create New Blog Post
- Story 2.2: Edit Existing Blog Post
- Story 2.3: Publish Blog Post

**鉂?BAD STORY EXAMPLES:**

- Story: "Set up database" (no user value)
- Story: "Create all models" (too large, no user value)
- Story: "Build authentication system" (too large)
- Story: "Login UI (depends on Story 1.3 API endpoint)" (future dependency!)
- Story: "Edit post (requires Story 1.4 to be implemented first)" (wrong order!)

### 3. Process Epics Sequentially

For each epic in the approved epics_list:

#### A. Epic Overview

Display:

- Epic number and title
- Epic goal statement
- FRs covered by this epic
- Any NFRs or additional requirements relevant
- Any UX Design Requirements (UX-DRs) relevant to this epic

#### B. Story Breakdown

Work with user to break down the epic into stories:

- Identify distinct user capabilities
- Ensure logical flow within the epic
- Size stories appropriately

#### C. Generate Each Story

For each story in the epic:

1. **Story Title**: Clear, action-oriented
2. **User Story**: Complete the As a/I want/So that format
3. **Acceptance Criteria**: Write specific, testable criteria

**AC Writing Guidelines:**

- Use Given/When/Then format
- Each AC should be independently testable
- Include edge cases and error conditions
- Reference specific requirements when applicable

#### D. Collaborative Review

After writing each story:

- Present the story to user
- Ask: "Does this story capture the requirement correctly?"
- "Is the scope appropriate for a single dev session?"
- "Are the acceptance criteria complete and testable?"

#### E. Append to Document

When story is approved:

- Append it to {planning_artifacts}/{branch}/epics.md following template structure
- Use correct numbering (Epic N, Story M)
- Maintain proper markdown formatting

### 4. Epic Completion

After all stories for an epic are complete:

- Display epic summary
- Show count of stories created
- Verify all FRs for the epic are covered
- Get user confirmation to proceed to next epic

### 5. Repeat for All Epics

Continue the process for each epic in the approved list, processing them in order (Epic 1, Epic 2, etc.).

### 6. Final Document Completion

After all epics and stories are generated:

- Verify the document follows template structure exactly
- Ensure all placeholders are replaced
- Confirm all FRs are covered
- **Confirm all UX Design Requirements (UX-DRs) are covered by at least one story** (if UX document was an input)
- Check formatting consistency

## TEMPLATE STRUCTURE COMPLIANCE:

The final {planning_artifacts}/{branch}/epics.md must follow this structure exactly:

1. **Overview** section with project name
2. **Requirements Inventory** with all three subsections populated
3. **FR Coverage Map** showing requirement to epic mapping
4. **Epic List** with approved epic structure
5. **Epic sections** for each epic (N = 1, 2, 3...)
   - Epic title and goal
   - All stories for that epic (M = 1, 2, 3...)
     - Story title and user story
     - Acceptance Criteria using Given/When/Then format

### 7. Present FINAL MENU OPTIONS

After all epics and stories are complete:

Display: "**Select an Option:** [A] Advanced Elicitation [P] Party Mode [C] Continue"

#### Menu Handling Logic:

- IF A: Invoke the `bmad-advanced-elicitation` skill
- IF P: Invoke the `bmad-party-mode` skill
- IF C: Save content to {planning_artifacts}/{branch}/epics.md, update frontmatter, then read fully and follow: ./step-04-final-validation.md
- IF Any other comments or queries: help user respond then [Redisplay Menu Options](#7-present-final-menu-options)

#### EXECUTION RULES:

- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed to next step when user selects 'C'
- After other menu items execution, return to this menu
- User can chat or ask questions - always respond and then end with display again of the menu options

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN [C continue option] is selected and [all epics and stories saved to document following the template structure exactly], will you then read fully and follow: `./step-04-final-validation.md` to begin final validation phase.

---

## 馃毃 SYSTEM SUCCESS/FAILURE METRICS

### 鉁?SUCCESS:

- All epics processed in sequence
- Stories created for each epic
- Template structure followed exactly
- All FRs covered by stories
- Stories appropriately sized
- Acceptance criteria are specific and testable
- Document is complete and ready for development

### 鉂?SYSTEM FAILURE:

- Deviating from template structure
- Missing epics or stories
- Stories too large or unclear
- Missing acceptance criteria
- Not following proper formatting

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.

