---
name: bmad-check-implementation-readiness
description: 'Validate PRD, UX, Architecture and Epics specs are complete. Use when the user says "check implementation readiness".'
---

Follow ./runtime-router.md first.

If governed runtime state exists, do not load the BMAD planning readiness workflow directly.
Route through main-agent-orchestration inspect and the six mental model chain.

Only when no governed runtime state exists, or the user explicitly asks for upstream BMAD planning artifact readiness, load:
../check-implementation-readiness/workflow.md
