# Step 7: Architecture Validation & Completion

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: ALWAYS read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step with 'C', ensure the entire file is read and understood before proceeding
- ✅ ALWAYS treat this as collaborative discovery between architectural peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on validating implementation-readiness, not just documentation completeness
- ✅ VALIDATE all requirements are covered by architectural decisions, including P0 journeys, evidence contracts, smoke E2E preconditions, and failure handling
- ⚠️ ABSOLUTELY NO TIME ESTIMATES - AI development speed has fundamentally changed
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- ✅ Run comprehensive validation checks on the complete architecture
- ⚠️ Present A/P/C menu after generating validation results
- 💾 ONLY save when user chooses C (Continue)
- 📖 Update frontmatter `stepsCompleted: [1, 2, 3, 4, 5, 6, 7]` before loading next step
- 🚫 FORBIDDEN to load next step until C is selected

## COLLABORATION MENUS (A/P/C):

This step will generate content and present choices:

- **A (Advanced Elicitation)**: Use discovery protocols to resolve undefined or risky contracts
- **P (Party Mode)**: Bring multiple perspectives to challenge readiness assumptions
- **C (Continue)**: Save the validation results and complete the architecture

## PROTOCOL INTEGRATION:

- When 'A' selected: Read fully and follow: {project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml
- When 'P' selected: Read fully and follow: {project-root}/_bmad/core/workflows/party-mode/workflow.md
- PROTOCOLS always return to display this step's A/P/C menu after the A or P have completed
- User accepts/rejects protocol changes before proceeding

## CONTEXT BOUNDARIES:

- Complete architecture document with all sections is available
- All architectural decisions, patterns, and structure are defined
- Focus on validation, blockers, and readiness-to-implement
- Prepare for handoff to implementation phase

## YOUR TASK:

Validate the complete architecture for coherence, completeness, and implementation-readiness with explicit blocker language. The outcome is not a soft summary; it is a readiness decision.

## VALIDATION SEQUENCE:

### 1. Coherence Validation

Check that all architectural decisions work together:

**Decision Compatibility:**

- Do all technology choices work together without conflicts?
- Are all versions compatible with each other?
- Do key path decisions align with technology choices?
- Are there any contradictory decisions?

**Pattern Consistency:**

- Do implementation patterns support the architectural decisions?
- Are naming conventions consistent across all areas?
- Do structure patterns align with technology stack?
- Are communication patterns coherent?

**Structure Alignment:**

- Does the project structure support all architectural decisions?
- Are boundaries properly defined and respected?
- Does the structure enable the chosen patterns?
- Are integration points properly structured?

### 2. Requirements Coverage Validation

Verify all project requirements are architecturally supported:

**From Epics (if available):**

- Does every epic have architectural support?
- Are all user stories implementable with these decisions?
- Are cross-epic dependencies handled architecturally?
- Are there any gaps in epic coverage?

**From FR Categories (if no epics):**

- Does every functional requirement have architectural support?
- Are all FR categories fully covered by architectural decisions?
- Are cross-cutting FRs properly addressed?
- Are there any missing architectural capabilities?

**Non-Functional Requirements:**

- Are performance requirements addressed architecturally?
- Are security requirements fully covered?
- Are scalability considerations properly handled?
- Are compliance requirements architecturally supported?

### 3. Validate P0 Journey Coverage

For every inherited P0 journey, verify the architecture provides:

- a key path sequence
- a system acceptance point
- a business completion point
- success evidence and failure evidence
- fallback / compensation behavior
- ownership of the sync / async boundary

If any critical journey lacks one of these items, record a blocker immediately.

### 4. Validate Smoke E2E Preconditions

Check whether the architecture defines the minimum conditions required to generate and run smoke E2E tests:

- required fixtures / seed data
- required environment dependencies
- external service assumptions or stubs
- observability needed to prove success or diagnose failure
- minimum commands or verification hooks for the key paths

If a smoke E2E cannot be generated from the architecture, the document is not ready.

### 5. Validate Observability, Traceability, and Failure Handling

Verify the architecture explicitly defines:

- logs / traces / metrics / correlation IDs for critical paths
- failure detection points
- retry, compensation, rollback, or operator intervention
- mapping back to PRD journey IDs and evidence contracts

### 6. Implementation Readiness Validation

Assess if AI agents can implement consistently:

**Decision Completeness:**

- Are all critical decisions documented with versions?
- Are implementation patterns comprehensive enough?
- Are consistency rules clear and enforceable?
- Are examples provided for major patterns and key paths?

**Structure Completeness:**

- Is the project structure complete and specific?
- Are all files and directories defined?
- Are integration points clearly specified?
- Are component boundaries well-defined?

**Pattern Completeness:**

- Are all potential conflict points addressed?
- Are naming conventions comprehensive?
- Are communication patterns fully specified?
- Are process patterns (error handling, compensation, retries) complete?

### 7. Gap Analysis And Undefined Contract Risk

Identify and document missing elements:

**Critical Gaps:**

- Missing architectural decisions that block implementation
- Missing key path sequences or smoke E2E preconditions
- Missing structural elements needed for development
- Undefined integration points

**Important Gaps:**

- Areas that need more detailed specification
- Patterns that could be more comprehensive
- Documentation that would help implementation
- Examples that would clarify complex decisions

**Nice-to-Have Gaps:**

- Additional patterns that would be helpful
- Supplementary documentation
- Tooling recommendations
- Development workflow optimizations

Also identify any contract that still requires guessing during implementation:

- undefined completion semantics
- unclear async ownership
- unspecified fixture or environment requirement
- missing security or permission enforcement point
- ambiguous acceptance evidence

Any undefined contract that blocks a critical slice must remain visible in the blockers section.

### 8. Address Validation Issues

For any issues found, facilitate resolution:

**Critical Issues:**
"I found some issues that need to be addressed before implementation:

{{critical_issue_description}}

These could cause implementation problems. How would you like to resolve this?"

**Important Issues:**
"I noticed a few areas that could be improved:

{{important_issue_description}}

These aren't blocking, but addressing them would make implementation smoother. Should we work on these?"

**Minor Issues:**
"Here are some minor suggestions for improvement:

{{minor_issue_description}}

These are optional refinements. Would you like to address any of these?"

### 9. Produce Explicit Readiness Status

Do not use soft completion language such as "ready for implementation" without conditions.

The only allowed readiness statuses are:

- `READY`
- `READY WITH BLOCKERS CLOSED`
- `NOT READY`

Status rules:

- `READY`: No blockers remain for any critical journey
- `READY WITH BLOCKERS CLOSED`: Architecture is acceptable only after enumerated blockers are resolved
- `NOT READY`: Critical journeys or smoke E2E preconditions remain undefined

### 9A. Run Architecture Contract Gate Before Continue

Before you offer `[C] Continue`, validate that the closing validation package explicitly covers:

- blockers are either closed or remain visible
- undefined contracts are named
- smoke E2E preconditions are concrete
- readiness status matches the blocker state

If any blocker-level architecture contract remains unresolved:
- emit a `GateFailure`
- build a `RemediationPlan`
- do not show plain Continue until the blocker is repaired and the local gate is rerun
- present only remediation-oriented options (for example `[A]` / `[P]`) plus an explicit blocked status message
- if the local gate is still failed, `[C] Continue` is forbidden and must not appear in the menu text or selection handling

## REQUIRED OUTPUT CONTENT

Prepare the content to append to the document using this structure:

```markdown
## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
{{assessment_of_how_all_decisions_work_together}}

**Pattern Consistency:**
{{verification_that_patterns_support_decisions}}

**Structure Alignment:**
{{confirmation_that_structure_supports_architecture}}

### Requirements Coverage Validation

**Epic/Feature Coverage:**
{{verification_that_all_epics_or_features_are_supported}}

**Functional Requirements Coverage:**
{{confirmation_that_all_FRs_are_architecturally_supported}}

**Non-Functional Requirements Coverage:**
{{verification_that_NFRs_are_addressed}}

### P0 Journey Coverage Validation
{{journey_coverage_results}}

### Smoke E2E Preconditions Validation
{{smoke_e2e_results}}

### Observability, Traceability, and Failure Handling Validation
{{observability_and_failure_results}}

### Implementation Readiness Validation

**Decision Completeness:**
{{assessment_of_decision_documentation_completeness}}

**Structure Completeness:**
{{evaluation_of_project_structure_completeness}}

**Pattern Completeness:**
{{verification_of_implementation_patterns_completeness}}

### Undefined Contract Analysis
{{undefined_contract_findings}}

### Gap Analysis Results
{{gap_analysis_findings_with_priority_levels}}

### Validation Issues Addressed
{{description_of_any_issues_found_and_resolutions}}

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed
- [x] Key path sequences defined
- [x] Business done vs system accepted semantics defined

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented
- [x] Failure handling and observability documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete
- [x] Smoke E2E prerequisites identified

### Architecture Readiness Assessment

**Overall Status:** {{READY | READY WITH BLOCKERS CLOSED | NOT READY}}

**Confidence Level:** {{high/medium/low}} based on validation results

**Decision Basis:**
- Critical journeys covered:
- Smoke E2E preconditions defined:
- Observability / trace contract defined:
- Undefined contracts remaining:

**Key Strengths:**
{{list_of_architecture_strengths}}

**Areas for Future Enhancement:**
{{areas_that_could_be_improved_later}}

### Blockers
{{blocker_list}}

### Deferred Gaps
{{deferred_gap_list}}

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Do not guess missing contracts; treat blockers as real blockers

**First Implementation Priority:**
{{starter_template_command_or_first_architectural_step}}

**Required Fixtures / Environments Before Coding:**
{{fixture_and_environment_prerequisites}}

**Proof Expected From First Smoke E2E:**
{{first_smoke_e2e_proof}}
```

## PRESENT CONTENT AND MENU

Show the validation results and present choices:

"I've completed the architecture readiness validation.

**Validation Summary:**

- Coherence checked across technology, patterns, and structure
- Requirements coverage verified
- P0 journeys validated for architectural handoff
- Smoke E2E preconditions checked
- Observability and failure contracts checked
- Undefined contracts converted into explicit blockers or deferred gaps

**Here's what I'll add to complete the architecture document:**

[Show the complete markdown content]

**What would you like to do?**
- If Architecture Contract Gate = PASS:
  [A] Advanced Elicitation - Resolve undefined contracts
  [P] Party Mode - Challenge readiness from multiple perspectives
  [C] Continue - Complete the architecture and finish workflow
- If Architecture Contract Gate = FAIL:
  [A] Advanced Elicitation - Resolve undefined contracts and blockers
  [P] Party Mode - Challenge blockers and refine the remediation path
  Gate Status: ❌ FAILED - Continue is blocked until the local gate passes"

## HANDLE MENU SELECTION

### If 'A' (Advanced Elicitation):

- Read fully and follow: {project-root}/_bmad/core/workflows/advanced-elicitation/workflow.xml with focus on unresolved blockers
- Ask user: "Accept these architectural improvements? (y/n)"
- If yes: Update content, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

### If 'P' (Party Mode):

- Read fully and follow: {project-root}/_bmad/core/workflows/party-mode/workflow.md using the `architecture-contract-gate` stage profile with current blocker/gap context and validation context
- Ask user: "Accept these changes to the validation results? (y/n)"
- If yes: Update content, then return to A/P/C menu
- If no: Keep original content, then return to A/P/C menu

### If 'C' (Continue):

- Only valid when the Architecture Contract Gate has passed in the current local state
- If the gate is failed, emit `GateFailure`, restate the `RemediationPlan`, and return to the blocked menu without performing any save

- Append the final content to `{planning_artifacts}/{branch}/architecture.md`
- Update frontmatter: `stepsCompleted: [1, 2, 3, 4, 5, 6, 7]`
- Load `./step-08-complete.md`

## SUCCESS METRICS:

✅ All architectural decisions validated for coherence
✅ Complete requirements coverage verified
✅ P0 journey coverage validated
✅ Smoke E2E preconditions are explicitly validated
✅ Observability and failure handling are not implicit
✅ Undefined contracts are converted into blockers or deferred gaps
✅ Final status uses only the allowed readiness categories
✅ Comprehensive validation checklist completed
✅ A/P/C menu is presented and handled correctly
✅ Gate failure blocks plain Continue and forces remediation-first choices

## FAILURE MODES:

❌ Skipping coherence or structure validation
❌ Not verifying all requirements are architecturally supported
❌ Missing smoke E2E preconditions
❌ Missing observability / trace / failure contracts
❌ Hiding undefined contracts inside generic prose
❌ Using soft readiness language instead of explicit status
❌ Showing `[C] Continue` while blocker-level architecture contracts remain unresolved

## NEXT STEP:

After user selects 'C' and content is saved to document, load `./step-08-complete.md` to complete the workflow and provide implementation guidance.

Remember: Do NOT proceed to step-08 until user explicitly selects 'C' from the A/P/C menu and content is saved.
