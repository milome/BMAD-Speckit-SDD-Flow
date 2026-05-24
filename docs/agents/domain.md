# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repo.

No root `CONTEXT.md`, root `CONTEXT-MAP.md`, or `docs/adr/` directory was present when this setup was created. If those files are added later, prefer them according to the rules below.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if it exists.
- `CONTEXT-MAP.md` at the repo root, if it exists.
- `docs/adr/`, if it exists.
- `CLAUDE.md` and `AGENTS.md` for repo-specific agent rules.
- `docs/design/` for product and architecture design context.
- `docs/reference/` for schemas and reference contracts.
- `docs/plans/` for implementation plans and historical task context.

If any of these files don't exist, proceed silently. Don't flag their absence or suggest creating them upfront.

## Use the repo vocabulary

When output names a domain concept, use the terms already present in the repo docs and contracts. Don't invent synonyms for established concepts such as requirement record, artifactIndex, Implementation Readiness Gate, Delivery Closeout Gate, six mental models, SFT, governance, runtime hooks, or closeout.

## Flag doc conflicts

If your output contradicts an existing design doc, reference, ADR, or repo instruction, surface it explicitly instead of silently overriding it.
