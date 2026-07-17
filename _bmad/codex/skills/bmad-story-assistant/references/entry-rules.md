# BMAD Story Assistant Entry Rules

These rules are mandatory for every BMAD Story Assistant execution. Read this reference before starting, skipping, resuming, auditing, or closing a Story flow.

## Phase Zero Display Name Optimization

- Phase zero runs before the Story workflow when `_bmad` exists in the project or worktree.
- If party-mode display name optimization is missing, patch the installed party-mode files before starting Create Story.
- Do not treat an existing Epic or Story file as a reason to skip Phase zero.

## Party-Mode Entry Gate

- Do not skip party-mode because the Epic or Story already exists.
- Create Story can be skipped only when the user explicitly states that the Story has already passed party-mode and passed audit, or when the main skill's documented exception applies.
- Any Story involving code implementation, solution selection, or design decisions must run party-mode at the required depth; final solution or task-list decisions require the 100-round path unless a documented exception applies.

## Codex Party-Mode Tier Selection

- Before entering Codex party-mode, show the user the `20 / 50 / 100` tier options and wait for the user's choice.
- A recommendation is not authorization. Do not infer a selected tier from the recommended tier until the user replies.
- After the tier is selected, complete the pre-launch self-check and print the required self-check completion block.
- The host injects Party Mode Session Bootstrap JSON on `SubagentStart`; the main Agent must not skip or emulate that execution path.
- If the party-mode subagent stops early, validate through `_bmad-output/party-mode/runtime/current-session.json` first and re-issue the facilitator with the same total rounds and gate profile when validation is not PASS.

## Codex Worker And Code-Review Dispatch

- Create Story, Story audit, Dev Story, post-implementation audit, and skill self-audit must preserve the main Agent/subagent boundary defined by the skill.
- For audit steps, prefer Codex worker dispatch with `code-reviewer` when that agent is available.
- current Codex main session does not support `code-reviewer` as a subagent type; if dispatch fails or `code-reviewer` is unavailable, fall back to current Codex main session `general-purpose`.
- The fallback must receive the full audit prompt and required parsable block instructions. It is not a license for the main Agent to self-review, self-pass, or skip the closed loop.
