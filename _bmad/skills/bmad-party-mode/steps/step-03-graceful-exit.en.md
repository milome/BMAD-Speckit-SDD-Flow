<!-- GENERATED FROM: _bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.en.md ; DO NOT EDIT HERE -->
# Step 3: Graceful Exit and Party Mode Conclusion

## Mandatory Execution Rules

- You are concluding an engaging Party Mode session
- Provide satisfying agent farewells in authentic voice
- Express gratitude to the user
- Acknowledge session highlights
- Keep the atmosphere positive through the end

## Execution Protocols

- generate characteristic goodbyes
- complete workflow exit after farewell sequence
- update frontmatter with completion state
- clean temporary Party Mode state
- do not end abruptly

## Context Boundaries

- the session is ending naturally or by user request
- full agent roster and conversation history are available
- final workflow cleanup is required

## Your Task

Conclude the session with gratitude, agent farewells, and clean workflow shutdown.

## Graceful Exit Sequence

### 1. Acknowledge Session Conclusion

Start with a warm acknowledgement:

"That was an excellent collaborative session. Thank you {{user_name}} for engaging with the BMAD team. Your questions and input brought out strong perspectives and useful insights.

**Before we wrap up, let a few agents say goodbye...**"

### 2. Challenger Final Review (Decision / Root-Cause Mode Only)

If this was a decision/root-cause session, ensure the final challenger review is present in session output. If it was not captured in the last round, extract and format it from the transcript:

- Status: `agree | conditional | reservations`
- Deferred gaps (if any): `[ID] description | impact | recommendation`

Append it to the session output. Do not invoke new agents for this step.

> **Reference:** [Critical Auditor guide - exit and final review]({project-root}/_bmad/core/agents/critical-auditor-guide.md)

### 3. Generate Agent Farewells

Choose 2-3 agents who contributed most meaningfully or best represent the discussion.

For each selected agent:

`[Icon Emoji] **[Resolved displayName]**: [Farewell reflecting their personality, style, and role. It may reference session highlights, gratitude, or a final insight.]`

### 4. Session Highlight Summary

Summarize the session briefly:

"**Session Highlights:** Today we explored [topic] through [number] distinct perspectives and surfaced key insights on [outcomes]. The combination of [relevant expertise domains] created a stronger result than a single viewpoint could have produced."

### 5. Final Party Mode Conclusion

Conclude with a positive close:

"**Party Mode Session Complete**

Thank you for bringing the BMAD team together. The discussion showed the value of multi-agent thinking, diverse expertise, and challenge-driven convergence.

Whenever you need another deep collaborative discussion, the team will be ready."

### 6. Complete Workflow Exit

Update frontmatter:

```yaml
---
stepsCompleted: [1, 2, 3]
workflowType: 'party-mode'
user_name: '{{user_name}}'
date: '{{date}}'
agents_loaded: true
party_active: false
workflow_completed: true
---
```

Cleanup:

- clear active Party Mode state
- reset selection cache
- mark workflow as completed

### 7. Exit Workflow

Finish with:

`[PARTY MODE WORKFLOW COMPLETE]`

`Thank you for using BMAD Party Mode.`

## Success Metrics

- satisfying farewells
- meaningful recognition of contributions
- positive closure
- correct frontmatter update
- clean workflow state after exit

## Failure Modes

- generic farewells
- missing highlights
- abrupt exit
- stale Party Mode state
- dismissive tone

## Return Protocol

If this workflow was invoked from a parent workflow:

1. identify the parent step
2. re-read it to restore context
3. resume exactly where the parent workflow instructed
4. return control to the parent flow
