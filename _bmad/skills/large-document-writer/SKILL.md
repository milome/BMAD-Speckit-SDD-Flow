---
name: large-document-writer
description: Use for generic large generated text documents when streaming may be interrupted or final promotion must be safe and verifiable. Applies to Markdown, JSON, YAML, TOML, README, AGENTS, contracts, prompts, model packets, and generated documentation; routes agents through bmad-speckit large-doc draft sessions, validation, promotion, and cleanup.
---

# Large Document Writer

Use this skill as a transport layer for large generated text. It does not own domain semantics.

## Boundaries

- Do not generate goal task IDs, acceptance IDs, trace rows, required commands, stop conditions, docs-review fixes, or goal-contract semantic content.
- Do not parse, synthesize, validate, repair, or reinterpret `implementationConfirmation`.
- Do not replace `requirements-contract-authoring`; requirements source document promotion keeps its requirement-specific front door.
- Do not recommend repository root runtime helpers for generic large-document writing.

## Workflow

1. Classify the write as `create`, `replace`, or generator-only `upsert`; `upsert` applies only to generator internals that call the package safe writer directly.
2. Run `bmad-speckit large-doc init --target <path> --mode create|replace --profile markdown --json` with declared chunks, required headings/fragments, and thresholds.
3. Write each generated section to a chunk file with matching boundary markers:

```markdown
<!-- large-document-writer chunkId=001 sectionId=scope begin -->
...content...
<!-- large-document-writer chunkId=001 sectionId=scope end -->
```

4. Run `bmad-speckit large-doc add-chunk --session <session> --chunk-id <id> --section-id <id> --content-file <chunk> --json` for each complete chunk.
5. After any interruption, run `bmad-speckit large-doc status --session <session> --json` and continue from `nextChunkId`; inspect `missingChunks` and `corruptChunks` before adding more chunks.
6. Run `bmad-speckit large-doc assemble --session <session> --json`.
7. Run `bmad-speckit large-doc validate --session <session> --json`.
8. Run `bmad-speckit large-doc promote --session <session> --json` only after validation succeeds.
9. Run `bmad-speckit large-doc cleanup --session <session> --policy keep|prune|archive|delete --json` after final hash verification.
10. Run the repository encoding integrity gate before and after Markdown, AGENTS, README, skill, or generated-surface edits.

## Evidence

Keep the JSON receipts from `init`, `status`, `add-chunk`, `assemble`, `validate`, `promote`, and `cleanup`. Completion requires the final target hash, backup hash when replacing, and a cleanup receipt.
