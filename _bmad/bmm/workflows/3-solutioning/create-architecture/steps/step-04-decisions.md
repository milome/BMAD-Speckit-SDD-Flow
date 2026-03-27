# Step 4: Core Architectural Decisions

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: ALWAYS read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ✅ ALWAYS treat this as collaborative discovery between architectural peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on turning product contracts into implementation-safe architecture contracts
- 🌐 ALWAYS search the web to verify current technology versions when a named technology is selected
- ⚠️ ABSOLUTELY NO TIME ESTIMATES - AI development speed has fundamentally changed
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 🌐 Search the web to verify technology versions and options for concrete technology choices
- ⚠️ Present A/P/C menu after each major decision category or consolidated decision block
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2, 3, 4]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

This step will generate content and present choices:

- **A (Advanced Elicitation)**: Use discovery protocols to deepen any unresolved architectural contract
- **P (Party Mode)**: Bring multiple perspectives to stress-test trade-offs and undefined contracts
- **C (Continue)**: Save the current decisions and proceed to implementation patterns

## PROTOCOL INTEGRATION:

- When 'A' selected: Read fully and follow: {project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml
- When 'P' selected: Read fully and follow: {project-root}/_bmad/core/workflows/party-mode/workflow.md
- PROTOCOLS always return to display this step's A/P/C menu after the A or P have completed
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Project context from step 2 is available
- Starter template choice from step 3 is available
- Project context file may contain technical preferences and rules
- Technical preferences discovered in step 3 are available
- The PRD should already define P0 journeys, evidence contracts, actor-permission-state links, failure paths, and deferred ambiguities
- Focus on decisions not already made by starter template or existing preferences
- Collaborative decision making, not one-shot recommendations

## YOUR TASK:

Facilitate collaborative architectural decision making by inheriting the PRD product contracts first, then converting those contracts into key-path-first architecture decisions while still preserving full decision coverage across data, security, API, frontend, and infrastructure domains.

## HARD GATE CHECKS:

- `No key path sequence = cannot continue`
- `No testability contract = architecture incomplete`
- If inherited PRD contracts are missing, record blocker language immediately and use A/P/C menu before proceeding

## DECISION MAKING SEQUENCE:

### 1. Load Inherited Product Contracts And Existing Preferences

Begin by reviewing the following context together:

**Your Technical Preferences:**
{{user_technical_preferences_from_step_3}}

**Starter Template Decisions:**
{{starter_template_decisions}}

**Project Context Technical Rules:**
{{project_context_technical_rules}}

Then review and restate the product contracts inherited from the PRD:

- `P0 Journey Inventory`
- `Journey Evidence Contracts`
- `Actor-Permission-State Dependencies`
- `Failure Contracts And Deferred Ambiguities`

Present them as:

```md
## Inherited Product Contracts

### P0 Journey Inventory
- Journey ID:
- Goal:
- Triggering actor + permission:
- Start state -> end state:

### Journey Evidence Contracts
- Journey ID:
- Success evidence:
- Failure evidence:
- Validation owner:

### Failure Contracts And Deferred Ambiguities
- Journey ID:
- Failure trigger:
- Expected recovery / fallback:
- Deferred ambiguity:
```

If any P0 journey lacks actor, state transition, evidence contract, or failure contract, mark it as an unresolved blocker before architecture decisions continue.

### 2. Identify Remaining Decisions

Based on inherited product contracts, starter template choice, and project context, identify remaining architectural decisions:

**Already Decided (Don't re-decide these):**

- {{starter_template_decisions}}
- {{user_technology_preferences}}
- {{project_context_technical_rules}}

**Critical Decisions:** Must be decided before implementation can proceed
**Important Decisions:** Shape architecture significantly
**Nice-to-Have Decisions:** Can be deferred if needed

### 3. Generate P0 Key Path Sequences Before Component Abstractions

For every P0 journey, define the key path sequence first. This must come before any macro component diagram or generic stack summary.

Each sequence must explicitly capture:

- Journey ID
- Entry trigger
- Major sync / async transitions
- System acceptance point
- Business completion point
- Evidence emitted at each critical checkpoint
- Failure / compensation path

Use this format:

```md
## P0 Key Path Sequences

### Journey {{id}} - {{name}}
1. Actor initiates:
2. System validates permission + starting state:
3. Sync boundary:
4. Async boundary (if any):
5. System accepted when:
6. Business done when:
7. Success evidence:
8. Failure / compensation path:
```

### 4. Decision Categories By Priority

After the key paths are explicit, facilitate category decisions in this order:

#### Category 1: Data Architecture

- Database choice (if not determined by starter)
- Data modeling approach
- Data validation strategy
- Migration approach
- Caching strategy
- Data ownership implied by key path transitions

#### Category 2: Authentication & Security

- Authentication method
- Authorization patterns
- Security middleware
- Data encryption approach
- API security strategy
- Actor / permission enforcement points for each key path

#### Category 3: API & Communication

- API design patterns (REST, GraphQL, etc.)
- API documentation approach
- Error handling standards
- Rate limiting strategy
- Communication between services
- Sync / async boundary semantics across key paths

#### Category 4: Frontend Architecture (if applicable)

- State management approach
- Component architecture
- Routing strategy
- Performance optimization
- Bundle optimization
- User-visible completion states for key journeys

#### Category 5: Infrastructure & Deployment

- Hosting strategy
- CI/CD pipeline approach
- Environment configuration
- Monitoring and logging
- Scaling strategy
- Smoke E2E fixture / environment prerequisites

### 5. Facilitate Each Decision Category

For each category, facilitate collaborative decision making while anchoring every choice back to the affected journeys.

**Present the Decision:**

First explain:
- Which journey(s) this decision affects
- What proof or evidence this decision must preserve
- Whether it changes system accepted vs business done semantics

Then adapt the discussion by user skill level:

**Expert Mode:**
"{{Decision_Category}}: {{Specific_Decision}}

Affected key paths: {{journeys}}
Options: {{concise_option_list_with_tradeoffs}}

What's your preference for this decision?"

**Intermediate Mode:**
"Next decision: {{Human_Friendly_Category}}

We need to choose {{Specific_Decision}}.

Affected key paths:
{{journey_impact_summary}}

Common options:
{{option_list_with_brief_explanations}}

For your project, I'd lean toward {{recommendation}} because {{reason}}. What are your thoughts?"

**Beginner Mode:**
"Let's talk about {{Human_Friendly_Category}}.

{{Educational_Context_About_Why_This_Matters}}

Think of it like {{real_world_analogy}}.

This choice affects:
{{journey_impact_summary}}

Your main options:
{{friendly_options_with_pros_cons}}

My suggestion: {{recommendation}}
This is good for you because {{beginner_friendly_reason}}.

What feels right to you?"

**Verify Technology Versions:**
If decision involves specific technology:

```text
Search the web: "{{technology}} latest stable version"
Search the web: "{{technology}} current LTS version"
Search the web: "{{technology}} production readiness"
```

**Record the Decision:**

- Category: {{category}}
- Decision: {{user_choice}}
- Version: {{verified_version_if_applicable}}
- Rationale: {{user_reasoning_or_default}}
- Affects: {{components_or_epics_or_journeys}}
- Provided by Starter: {{yes_if_from_starter}}

### 6. Decide Business Completion State vs System Completion State

For each P0 journey, explicitly document whether:

- the system can accept the request before business completion
- business completion requires later async work, reconciliation, or human action
- the user-visible "done" state differs from a backend "accepted" or "queued" state

This distinction is mandatory. If the architecture does not explain the difference, treat the journey as under-specified.

### 7. Decide Sync / Async Boundaries, Fallback, Observability, And Testability

For each key path, decide:

- which steps must complete synchronously for user trust and validation
- which steps may run asynchronously
- what observable state is returned to the actor at each boundary
- what retry / idempotency / deduplication behavior exists around async transitions
- fallback and compensation strategy
- minimum observability contract (logs, traces, metrics, correlation IDs, audit events)
- smoke E2E preconditions
- minimum fixture / environment prerequisites needed to prove the journey end-to-end

If the architecture cannot describe how a smoke E2E will be generated and executed for the critical journey, the architecture is incomplete.

### 8. Check For Cascading Implications

After each major decision, identify related downstream decisions:

"This choice means we'll also need to decide:

- {{related_decision_1}}
- {{related_decision_2}}"

Make dependencies between decisions explicit instead of leaving them implicit.

## REQUIRED OUTPUT CONTENT

After facilitating all decisions, prepare content that appends to the architecture document using this structure:

```markdown
## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
{{critical_decisions_made}}

**Important Decisions (Shape Architecture):**
{{important_decisions_made}}

**Deferred Decisions (Post-MVP):**
{{decisions_deferred_with_rationale}}

### Inherited Product Contracts
{{p0_journey_inventory}}
{{journey_evidence_contracts}}
{{failure_contracts_and_deferred_ambiguities}}

### P0 Key Path Sequences
{{journey_key_path_sequences}}

### Business Completion State vs System Completion State
{{completion_state_decisions}}

### Sync / Async Boundaries
{{boundary_decisions}}

### Fallback And Compensation Strategy
{{fallback_and_compensation_decisions}}

### Minimum Observability Contract
{{observability_contract}}

### Testability And Smoke E2E Preconditions
{{smoke_e2e_preconditions}}

### Data Architecture
{{data_related_decisions_with_versions_and_rationale}}

### Authentication & Security
{{security_related_decisions_with_versions_and_rationale}}

### API & Communication Patterns
{{api_related_decisions_with_versions_and_rationale}}

### Frontend Architecture
{{frontend_related_decisions_with_versions_and_rationale}}

### Infrastructure & Deployment
{{infrastructure_related_decisions_with_versions_and_rationale}}

### Decision Impact Analysis

**Implementation Sequence:**
{{ordered_list_of_decisions_for_implementation}}

**Cross-Component Dependencies:**
{{how_decisions_affect_each_other}}
```

## PRESENT CONTENT AND MENU

Show the generated decisions content and present choices:

"I've documented the architecture decisions as implementation contracts, not just stack preferences.

**Here's what I'll add to the document:**

[Show the complete markdown content]

**What would you like to do?**
[A] Advanced Elicitation - Deepen unresolved or risky contracts
[P] Party Mode - Stress-test trade-offs and missing paths
[C] Continue - Save these decisions and move to implementation patterns"

## HANDLE MENU SELECTION

### If 'A' (Advanced Elicitation):

- Read fully and follow: {project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml with focus on missing journey contracts or risky boundaries
- Ask user: "Accept these enhancements to the architectural decisions? (y/n)"
- If yes: Update content, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

### If 'P' (Party Mode):

- Read fully and follow: {project-root}/_bmad/core/workflows/party-mode/workflow.md with focus on key path sequences, sync/async boundaries, and fallback contracts
- Ask user: "Accept these changes to the architectural decisions? (y/n)"
- If yes: Update content, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

### If 'C' (Continue):

- Append the final content to `{planning_artifacts}/{branch}/architecture.md`
- Update frontmatter: `stepsCompleted: [1, 2, 3, 4]`
- Load `./step-05-patterns.md`

## SUCCESS METRICS:

✅ Every P0 journey is inherited from the PRD before technology decisions begin
✅ Key path sequences are documented for all critical journeys
✅ Business completion state vs system completion state is explicit
✅ Sync / async boundaries are decided and justified
✅ Minimum observability contract is defined
✅ Smoke E2E preconditions are defined
✅ Category coverage remains complete across data, security, API, frontend, and infrastructure
✅ Cascading implications are identified and addressed
✅ User receives explanations appropriate to skill level
✅ A/P/C menu is presented and handled correctly

## FAILURE MODES:

❌ Jumping straight to stack selection without inherited product contracts
❌ No key path sequence for a critical journey
❌ No distinction between system accepted and business done
❌ Missing fallback / compensation strategy
❌ Missing smoke E2E preconditions
❌ Dropping category coverage in favor of only key-path narrative
❌ Missing cascading implications between decisions
❌ Treating architecture as complete without a testability contract

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-05-patterns.md` to define implementation patterns that ensure consistency across AI agents.

Remember: Do NOT proceed to step-05 until user explicitly selects 'C' from the A/P/C menu and content is saved.
