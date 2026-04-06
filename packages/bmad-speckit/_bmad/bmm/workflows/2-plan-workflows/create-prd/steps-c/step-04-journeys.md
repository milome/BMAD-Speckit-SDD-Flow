---
name: 'step-04-journeys'
description: 'Map ALL user types that interact with the system through evidence-backed journey contracts'

# File References
nextStepFile: './step-05-domain.md'
outputFile: '{planning_artifacts}/{branch}/prd.md'

# Task References
advancedElicitationTask: '{project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml'
partyModeWorkflow: '{project-root}/_bmad/core/workflows/party-mode/workflow.md'
---

# Step 4: User Journey Mapping

**Progress: Step 4 of 11** - Next: Domain Requirements

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- 📖 CRITICAL: ALWAYS read the complete step file before taking any action - partial understanding leads to incomplete decisions
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on mapping ALL user types that interact with the system
- 🎯 CRITICAL: No journey = no functional requirements = product doesn't exist
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- ⚠️ Present A/P/C menu after generating journey content
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update output file frontmatter, adding this step name to the end of the list of stepsCompleted
- 🚫 FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Success criteria and scope already defined
- Input documents from step-01 are available (product briefs with user personas)
- Every human interaction with the system needs a journey

## YOUR TASK:

Create evidence-backed user journey contracts that leverage existing personas from product briefs, identify additional user types needed for comprehensive coverage, and make the P0 paths executable downstream.

## JOURNEY MAPPING SEQUENCE:

### 1. Leverage Existing Users & Identify Additional Types

**Check Input Documents for Existing Personas:**
Analyze product brief, research, and brainstorming documents for user personas already defined.

**If User Personas Exist in Input Documents:**
Guide user to build on existing personas:
- Acknowledge personas found in their product brief
- Extract key persona details and backstories
- Leverage existing insights about their needs
- Prompt to identify additional user types beyond those documented
- Suggest additional user types based on product context (admins, moderators, support, API consumers, internal ops)
- Ask what additional user types should be considered

**If No Personas in Input Documents:**
Start with comprehensive user type discovery:
- Guide exploration of ALL people who interact with the system
- Consider beyond primary users: admins, moderators, support staff, API consumers, internal ops
- Ask what user types should be mapped for this specific product
- Ensure comprehensive coverage of all system interactions

### 2. Create Narrative Story-Based Journeys

For each user type, create compelling narrative journeys that tell their story:

#### Narrative Journey Creation Process:

**If Using Existing Persona from Input Documents:**
Guide narrative journey creation:
- Use persona's existing backstory from brief
- Explore how the product changes their life/situation
- Craft journey narrative: where do we meet them, how does product help them write their next chapter?

**If Creating New Persona:**
Guide persona creation with story framework:
- Name: realistic name and personality
- Situation: What's happening in their life/work that creates need?
- Goal: What do they desperately want to achieve?
- Obstacle: What's standing in their way?
- Solution: How does the product solve their story?

**Story-Based Journey Mapping:**

Guide narrative journey creation using story structure:
- **Opening Scene**: Where/how do we meet them? What's their current pain?
- **Rising Action**: What steps do they take? What do they discover?
- **Climax**: Critical moment where product delivers real value
- **Resolution**: How does their situation improve? What's their new reality?

Encourage narrative format with specific user details, emotional journey, and clear before/after contrast

**Mandatory Journey Contract Fields (for every P0 and important non-P0 journey):**
- `Journey ID`
- `Actor-State-Path` triplet
- `Given / When / Then`
- `Success evidence`
- `Failure trigger + recovery`
- `Current workaround`
- `Business completion state`

### 3. Guide Journey Exploration

For each journey, facilitate detailed exploration:
- What happens at each step specifically?
- What could go wrong? What's the recovery path?
- What information do they need to see/hear?
- What's their emotional state at each point?
- Where does this journey succeed or fail?
- What concrete actor-state-path transition is occurring?
- What proof would let a reviewer say this journey really ran?
- What is the current workaround if this journey is not yet supported?

### 4. Connect Journeys to Requirements

After each journey, explicitly state:
- This journey reveals requirements for specific capability areas
- Help user see how different journeys create different feature sets
- Connect journey needs to concrete capabilities (onboarding, dashboards, notifications, etc.)
- Mark which journeys are P0 and therefore must become downstream acceptance anchors

### 5. Build P0 Journey Inventory And Evidence Contract

Guide toward complete journey set and explicit contract capture:

- **Primary user** - happy path (core experience)
- **Primary user** - edge case (different goal, error recovery)
- **Secondary user** (admin, moderator, support, etc.)
- **API consumer** (if applicable)

Ask if additional journeys are needed to cover uncovered user types

For every journey promoted to P0, require:
- one-line actor-state-path summary
- one-line Given/When/Then
- one success evidence statement
- one failure trigger and recovery statement
- one current workaround statement

### 6. Generate User Journey Content

Prepare the content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## User Journeys

[All journey narratives based on conversation]

### P0 Journey Inventory

- **Journey ID**: J01
  - **Actor-State-Path**: [actor] -> [state] -> [path]
  - **Given / When / Then**: Given [...], When [...], Then [...]
  - **Success Evidence**: [...]
  - **Failure Trigger + Recovery**: [...]
  - **Current Workaround**: [...]

### Journey Evidence Contract

[How each P0 journey will be proven and what evidence exists]

### Failure Triggers And Recovery

[Failure matrix summary based on conversation]

### Journey Requirements Summary

[Summary of capabilities revealed by journeys based on conversation]
```

### 6A. Run PRD Contract Gate Before Continue

Before you offer `[C] Continue`, validate that the current PRD journey contract explicitly covers:

- `P0 Journey Inventory`
- `Journey Evidence Contract`
- `Failure Triggers And Recovery`
- unresolved blockers are named and owned

If any blocker-level contract field is missing:
- emit a `GateFailure`
- build a `RemediationPlan`
- do not show plain Continue until the blocker is repaired and the local gate is rerun

### 7. Present MENU OPTIONS

Present the user journey content for review, then display menu:
- Show the mapped user journeys (using structure from section 6)
- Highlight how each journey reveals different capabilities
- Ask if they'd like to refine further, get other perspectives, or proceed
- Present menu options naturally as part of conversation

Display: "**Select:** [A] Advanced Elicitation [P] Party Mode [C] Continue to Domain Requirements (Step 5 of 11)"

#### Menu Handling Logic:
- IF A: Read fully and follow: {advancedElicitationTask} with the current journey content, process the enhanced journey insights that come back, ask user "Accept these improvements to the user journeys? (y/n)", if yes update content with improvements then redisplay menu, if no keep original content then redisplay menu
- IF P: Read fully and follow: {partyModeWorkflow} using the `prd-contract-gate` stage profile with current blocker/gap context, process the collaborative journey improvements and additions, ask user "Accept these changes to the user journeys? (y/n)", if yes update content with improvements then redisplay menu, if no keep original content then redisplay menu
- IF C: Append the final content to {outputFile}, update frontmatter by adding this step name to the end of the stepsCompleted array, then read fully and follow: {nextStepFile}
- IF Any other: help user respond, then redisplay menu

#### EXECUTION RULES:
- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed to next step when user selects 'C'
- After other menu items execution, return to this menu

## APPEND TO DOCUMENT:

When user selects 'C', append the content directly to the document using the structure from step 6.

## SUCCESS METRICS:

✅ Existing personas from product briefs leveraged when available
✅ All user types identified (not just primary users)
✅ Rich narrative storytelling for each persona and journey
✅ Complete story-based journey mapping with emotional arc
✅ Journey requirements clearly connected to capabilities needed
✅ Every P0 journey includes actor-state-path, Given/When/Then, success evidence, failure trigger + recovery, and current workaround
✅ Minimum 3-4 compelling narrative journeys covering different user types
✅ A/P/C menu presented and handled correctly
✅ Content properly appended to document when C selected

## FAILURE MODES:

❌ Ignoring existing personas from product briefs
❌ Only mapping primary user journeys and missing secondary users
❌ Creating generic journeys without rich persona details and narrative
❌ Missing emotional storytelling elements that make journeys compelling
❌ Missing critical decision points and failure scenarios
❌ Missing actor-state-path, Given/When/Then, success evidence, or current workaround for P0 journeys
❌ Not connecting journeys to required capabilities
❌ Not having enough journey diversity (admin, support, API, etc.)
❌ Not presenting A/P/C menu after content generation
❌ Appending content without user selecting 'C'

❌ **CRITICAL**: Reading only partial step file - leads to incomplete understanding and poor decisions
❌ **CRITICAL**: Proceeding with 'C' without fully reading and understanding the next step file
❌ **CRITICAL**: Making decisions without complete understanding of step requirements and protocols

## JOURNEY TYPES TO ENSURE:

**Minimum Coverage:**

1. **Primary User - Success Path**: Core experience journey
2. **Primary User - Edge Case**: Error recovery, alternative goals
3. **Admin/Operations User**: Management, configuration, monitoring
4. **Support/Troubleshooting**: Help, investigation, issue resolution
5. **API/Integration** (if applicable): Developer/technical user journey

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-05-domain.md`.

Remember: Do NOT proceed to step-05 until user explicitly selects 'C' from the A/P/C menu and content is saved!
