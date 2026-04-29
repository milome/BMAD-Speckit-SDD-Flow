# Codex Setup

Codex is a first-class no-hooks host for BMAD-Speckit-SDD-Flow. It uses the same main-agent control plane as Cursor and Claude, but enters through `cli_ingress` and dispatch packets instead of hook events.

## Install

```bash
npm install --save-dev bmad-speckit-sdd-flow@latest
npx bmad-speckit-init . --agent codex --full --no-package-json
npx bmad-speckit check
```

The install is valid only when `.codex/commands`, `.codex/agents`, `.codex/skills`, `.codex/i18n`, `.codex/README.md`, and the install manifest are present.

## Five-Layer Entry

Start from `bmads`, then follow the main-agent five-layer flow. Use `bmad-help` separately for upstream BMAD Method workflow guidance:

1. `layer_1_intake`: intake and runtime context.
2. `layer_2_architecture`: architecture constraints.
3. `layer_3_story`: epics, stories, and readiness.
4. `layer_4_speckit`: `specify -> plan -> gaps -> tasks -> implement`.
5. `layer_5_closeout`: `post_audit -> pr_review -> release_gate -> delivery_truth_gate`.

## Governed Runtime Entry

Use `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit` when you want BMAD-Speckit-SDD-Flow to take root governed runtime control in Codex. Short aliases `$bmads`, `/bmads`, and `bmads` are equivalent.

The install intentionally does not register `$bmad`; that root name is reserved to avoid upstream BMAD Method conflicts.

## Runtime

```bash
npx --no-install bmad-speckit main-agent-orchestration --action run-loop --host codex
```

Codex workers must consume dispatch packets, respect `allowedWriteScope`, write a strict TaskReport, and return to the main-agent gate loop.
