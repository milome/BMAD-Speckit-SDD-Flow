---
name: 'step-06-final-assessment'
description: 'Compile blocker-style final readiness decision and finalize the assessment report'

outputFile: '{planning_artifacts}/{branch}/implementation-readiness-report-{{date}}.md'
remediationArtifactFile: '{planning_artifacts}/{branch}/implementation-readiness-remediation-{{date}}.md'
---

# Step 6: Final Assessment

## STEP GOAL:

To compile all findings into a blocker-style readiness decision with explicit status, blocker counts, journey coverage percentage, and smoke E2E coverage counts.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 📖 You are at the final step - complete the assessment
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are delivering the FINAL READINESS DECISION
- ✅ Your findings are objective and backed by evidence
- ✅ Provide direct, blocker-oriented recommendations
- ✅ Success is measured by how clearly implementation risk is exposed

### Step-Specific Rules:

- 🎯 Compile and summarize all findings
- 🚫 Don't soften blockers into generic prose
- 💬 Provide specific examples for the most important problems
- 🚪 Final status must be determined by blockers, not by tone

## EXECUTION PROTOCOLS:

- 🎯 Review all findings from previous steps
- 💾 Add blocker-oriented summary and recommendations
- 📖 Determine explicit readiness status
- 🚫 Complete and present final report

## FINAL ASSESSMENT PROCESS:

### 1. Initialize Final Assessment

"Completing **Final Readiness Assessment**.

I will now:

1. Review all findings from previous steps
2. Count and classify blockers
3. Summarize journey and smoke E2E coverage
4. Determine final readiness status
5. Provide direct next actions"

### 2. Review Previous Findings

Check the {outputFile} for sections added by previous steps:

- PRD journey and evidence extraction findings
- Journey traceability findings
- UX alignment issues
- Implementation readiness review findings

### 3. Determine Final Status

The final status must use one of these and only these:

- `READY`
- `READY AFTER BLOCKERS CLOSED`
- `NOT READY`

Decision rules:

- `READY`: No critical blockers remain and all required critical journeys have smoke-ready coverage
- `READY AFTER BLOCKERS CLOSED`: The path is viable, but named blockers must be closed first
- `NOT READY`: Critical journeys, smoke paths, evidence contracts, or fixture dependencies are still too incomplete

### 4. Add Final Assessment Section

Append to {outputFile}:

```markdown
## Summary and Recommendations

### Overall Readiness Status

[READY / READY AFTER BLOCKERS CLOSED / NOT READY]

### Readiness Metrics

- Blocker count: [count]
- Journey coverage percentage: [percentage]
- Smoke E2E coverage count: [count]
- Stories without journey source: [count]

### Blockers Requiring Immediate Action

[Explicit blocker list]

### Deferred Gaps

[Deferred but non-blocking gaps]

### Recommended Next Steps

1. [Specific action item 1]
2. [Specific action item 2]
3. [Specific action item 3]

### Final Note

This readiness gate identified [X] blockers and [Y] deferred gaps. Do not begin implementation on critical paths until blockers are closed or formally accepted.
```

### 5. Complete the Report

- Ensure all findings are clearly documented
- Verify blocker list is actionable
- Add date and assessor information
- Save the final report

### 6. Generate Governance Remediation Runner Outputs

After saving the final report, you must also generate a governance remediation artifact at `{remediationArtifactFile}`.

Use `npx ts-node --transpile-only scripts/governance-remediation-runner.ts` and populate the arguments from the completed readiness report using these fixed rules.

Before running the command, load provider and packet output policy from `{project-root}/_bmad/_config/governance-remediation.yaml`.
This config is the canonical source for:

- primary host selection
- provider mode selection
- packet host list

The default readiness expectation is that cursor and claude packet outputs are generated first. Codex packet output may also be generated when enabled by config.

- `--outputPath "{remediationArtifactFile}"`
- `--projectRoot "{project-root}"`
- `--promptText "<one-line summary of the user's current readiness/audit request>"`
- `--stageContextKnown true`
- `--gateFailureExists true` when final status is `READY AFTER BLOCKERS CLOSED` or `NOT READY`; otherwise `false`
- `--blockerOwnershipLocked true`
- `--rootTargetLocked true`
- `--equivalentAdapterCount 1` by default; only increase if this step actually had equivalent adapter choices
- `--attemptId "implementation-readiness-{{date}}"`
- `--sourceGateFailureIds "<comma-separated blocker ids if present, else empty>"`
- `--capabilitySlot "qa.readiness"`
- `--canonicalAgent "PM + QA / readiness reviewer"`
- `--actualExecutor "implementation readiness workflow"`
- `--adapterPath "local workflow fallback"`
- `--targetArtifacts "<comma-separated impacted artifacts such as prd.md,architecture.md,epics.md>"`
- `--expectedDelta "<short blocker-oriented repair summary>"`
- `--rerunOwner "PM"`
- `--rerunGate "implementation-readiness"`
- `--outcome "<ready|ready_after_blockers_closed|not_ready>"`
- `--sharedArtifactsUpdated "implementation-readiness-report"`
- `--contradictionsDelta "<opened/closed summary or none>"`
- `--externalProofAdded "<summary or none>"`
- `--readyToRerunGate true` only when blockers are closed and a rerun is appropriate; otherwise `false`
- `--stopReason "<why execution stops here if not rerunning>"`

Hard rules:

- `PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`
- the generated remediation artifact must say `Blocker ownership affected: no`
- prompt hints may influence entry or adapter choice only; they may not change blocker ownership in this readiness gate
- `cursor packet generated` and `claude packet generated` are mandatory unless config explicitly disables them
- packet generation must reuse governance-owned routing fields; packet selection does not change blocker ownership or root target

### 7. Present Completion

Display:
"**Implementation Readiness Assessment Complete**

Report generated: {outputFile}
Remediation artifact generated: {remediationArtifactFile}
cursor packet generated: derive from `{remediationArtifactFile}` as `.cursor-packet.md`
claude packet generated: derive from `{remediationArtifactFile}` as `.claude-packet.md`

Final status: [READY / READY AFTER BLOCKERS CLOSED / NOT READY]
Blockers found: [count]
Journey coverage: [percentage]
Smoke E2E coverage: [count]"

## WORKFLOW COMPLETE

The implementation readiness workflow is now complete. The report contains the final blocker-style decision and recommendations for the user to act on.

Implementation Readiness complete. Read fully and follow: `_bmad/core/tasks/help.md` with argument `implementation readiness`.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- All findings compiled and summarized
- Final status uses the required blocker-oriented categories
- Blocker count, journey coverage, and smoke E2E coverage are included
- Clear recommendations provided
- Final report saved
- Governance remediation artifact saved
- cursor/claude executor packets saved

### ❌ SYSTEM FAILURE:

- Softening blockers into generic commentary
- Missing blocker count or coverage metrics
- Using status labels outside the allowed set
- No clear next actions
- Failing to generate the governance remediation artifact
- Failing to generate required cursor/claude packet outputs

**Master Rule:** The final readiness decision must make it obvious whether implementation can start safely.
