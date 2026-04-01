<!-- BLOCK_LABEL_POLICY=B -->
---
name: bmad-party-mode
description: Orchestrates group discussions between all installed BMAD agents, enabling natural multi-agent conversations. Use when the user requests party mode.
---

Follow the instructions in `./workflow.md`. This `_bmad/skills/bmad-party-mode/` copy is aligned with `_bmad/core/skills/bmad-party-mode/`; both ship the same Party-Mode steps next to this file, and the workflow library also publishes `_bmad/core/workflows/party-mode/` for BMAD runtime references.

**Speaking format (mandatory, highest priority)**: During party-mode, every speaker in every round **must** use the format `[Icon Emoji] **[display name]**: [content]` (e.g. `🏗️ **Winston (Architect)**: ...`, `⚔️ **Critical Auditor**: ...`). Icons and display names come from the `icon` and `displayName` fields in `_bmad/_config/agent-manifest.csv`; omitting them is forbidden. See `Response Structure` in `./steps/step-02-discussion-orchestration.md`.
