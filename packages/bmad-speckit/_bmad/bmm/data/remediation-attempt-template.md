# Remediation Attempt Template

## Core Fields

- Attempt ID:
- Source GateFailure IDs:
- Capability Slot:
- Canonical Agent:
- Actual Executor:
- Adapter Path:
- Target Artifact(s):
- Expected Delta:
- Rerun Owner:
- Rerun Gate:
- Outcome:

## Prompt Hint Usage

- Prompt hint present: yes | no
- Hint confidence: low | medium | high | n/a
- Consumed after: `stage context -> gate failure -> artifact state -> PromptRoutingHints`
- Hint applied to:
  - entry routing
  - adapter selection
  - interaction style
  - research policy
- Hint ignored because:
  - blocker ownership locked
  - artifact target locked
  - low confidence
  - no equivalent adapter choice
  - no failed-gate-free entry routing window
- Blocker ownership affected: no

## Evidence Delta

- Shared artifacts updated:
- Contradictions opened/closed:
- External proof added:

## Next Action

- Ready to rerun gate: yes | no
- If no, stop reason:
