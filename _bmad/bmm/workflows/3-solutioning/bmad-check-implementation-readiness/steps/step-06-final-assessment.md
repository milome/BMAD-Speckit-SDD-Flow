---
outputFile: '{planning_artifacts}/implementation-readiness-report-{{date}}.md'
remediationArtifactFile: '{planning_artifacts}/implementation-readiness-remediation-{{date}}.md'
---

# Step 6: Final Assessment

## STEP GOAL:

To provide a comprehensive summary of all findings and give the report a final polish, ensuring clear recommendations and overall readiness status.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER generate content without user input
- 📖 CRITICAL: Read the complete step file before taking any action
- 📖 You are at the final step - complete the assessment
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the config `{communication_language}`

### Role Reinforcement:

- ✅ You are delivering the FINAL ASSESSMENT
- ✅ Your findings are objective and backed by evidence
- ✅ Provide clear, actionable recommendations
- ✅ Success is measured by value of findings

### Step-Specific Rules:

- 🎯 Compile and summarize all findings
- 🚫 Don't soften the message - be direct
- 💬 Provide specific examples for problems
- 🚪 Add final section to the report

## EXECUTION PROTOCOLS:

- 🎯 Review all findings from previous steps
- 💾 Add summary and recommendations
- 📖 Determine overall readiness status
- 🚫 Complete and present final report

## FINAL ASSESSMENT PROCESS:

### 1. Initialize Final Assessment

"Completing **Final Assessment**.

I will now:

1. Review all findings from previous steps
2. Provide a comprehensive summary
3. Add specific recommendations
4. Determine overall readiness status"

### 2. Review Previous Findings

Check the {outputFile} for sections added by previous steps:

- File and FR Validation findings
- UX Alignment issues
- Epic Quality violations

### 3. Add Final Assessment Section

Before appending the final section, you must also append a structured `Deferred Gaps Tracking` section to `{outputFile}`.

Rules for `Deferred Gaps Tracking`:

- Every deferred gap from `## Deferred Gaps` must appear exactly once in the table.
- Every row must include `Gap ID`, `描述`, `原因`, `解决时机`, `Owner`, `状态检查点`.
- If a gap from the previous readiness report no longer appears, you must add explicit resolution evidence in the report body before removing it.
- `Owner` and `解决时机` are mandatory; missing values mean the report is incomplete.

Append this table shape:

```markdown
## Deferred Gaps Tracking

| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |
|--------|------|------|----------|-------|-----------|
| J04-Smoke-E2E | P0 Journey J04 缺少 Smoke E2E | P2 优先级 | Sprint 2+ | Dev Team | Sprint Planning |
| Epic3-4-UX | 缺少正式 UX 规范 | MVP 可基于 PRD | Epic 3 开始前 | UX Designer | Epic 3 Planning |

**防漂移检查**：
- [ ] 上次 deferred gaps 仍存在，或本次报告已提供明确解决证据
- [ ] 每个 deferred gap 都有 Owner
- [ ] 每个 deferred gap 都有 resolution_target
```

Append to {outputFile}:

```markdown
## Summary and Recommendations

### Overall Readiness Status

[READY/NEEDS WORK/NOT READY]

### Critical Issues Requiring Immediate Action

[List most critical issues that must be addressed]

### Recommended Next Steps

1. [Specific action item 1]
2. [Specific action item 2]
3. [Specific action item 3]

### Final Note

This assessment identified [X] issues across [Y] categories. Address the critical issues before proceeding to implementation. These findings can be used to improve the artifacts or you may choose to proceed as-is.
```

### 4. Complete the Report

- Ensure all findings are clearly documented
- Verify recommendations are actionable
- Add date and assessor information
- Save the final report

### 5. Generate Governance Remediation Runner Outputs

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
- `--gateFailureExists true` when readiness status is not `READY`; otherwise `false`
- `--blockerOwnershipLocked true`
- `--rootTargetLocked true`
- `--equivalentAdapterCount 1` by default
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
- `--outcome "<ready|needs_work|not_ready>"`
- `--sharedArtifactsUpdated "implementation-readiness-report"`
- `--contradictionsDelta "<opened/closed summary or none>"`
- `--externalProofAdded "<summary or none>"`
- `--readyToRerunGate false`
- `--stopReason "<why execution stops here>"`

Hard rules:

- `PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`
- the generated remediation artifact must say `Blocker ownership affected: no`
- the generated remediation artifact must include a `## Structured Deferred Gaps` section with a YAML block beginning with `deferred_gaps:`
- prompt hints may influence entry or adapter choice only; they may not change blocker ownership in this readiness gate
- `cursor packet generated` and `claude packet generated` are mandatory unless config explicitly disables them
- packet generation must reuse governance-owned routing fields; packet selection does not change blocker ownership or root target
- Do not manually write `.cursor-packet.md` or `.claude-packet.md`
- Packets must be derived only from `scripts/governance-remediation-runner.ts` / `writeGovernanceExecutorPacket()`
- The only allowed host-specific differences are `Host Kind` and `Execution Mode`; all other packet sections must come from the same remediation artifact body

### 6. Present Completion

Display:
"**Implementation Readiness Assessment Complete**

Report generated: {outputFile}
Remediation artifact generated: {remediationArtifactFile}
cursor packet generated: derive from `{remediationArtifactFile}` as `.cursor-packet.md`
claude packet generated: derive from `{remediationArtifactFile}` as `.claude-packet.md`

The assessment found [number] issues requiring attention. Review the detailed report for specific findings and recommendations."

## WORKFLOW COMPLETE

The implementation readiness workflow is now complete. The report contains all findings and recommendations for the user to consider.

Implementation Readiness complete. Invoke the `bmad-help` skill.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- All findings compiled and summarized
- Clear recommendations provided
- Readiness status determined
- Final report saved
- Governance remediation artifact saved
- cursor/claude executor packets saved

### ❌ SYSTEM FAILURE:

- Not reviewing previous findings
- Incomplete summary
- No clear recommendations
- Failing to generate the governance remediation artifact
- Failing to generate required cursor/claude packet outputs
- Hand-writing host-specific packets instead of deriving them from the governance remediation runner
