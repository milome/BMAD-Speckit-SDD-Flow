# Readiness Audit Prompt

This file is the `prompt_template` for `modes.readiness` in `_bmad/_config/code-reviewer-config.yaml`.

Use it for:

- the `implementation_readiness` score stage
- readiness report parseable block generation
- the Four-Signal Governance Contract scoring surface

## Parseable Scoring Block (Required)

The readiness report must include the block below, aligned with `modes.readiness.dimensions`:

```markdown
## Parseable scoring block (for parseAndWriteScore)

Overall Grade: [A|B|C|D]

Dimension Scores:
- P0 Journey Coverage: XX/100
- Smoke E2E Readiness: XX/100
- Evidence Proof Chain: XX/100
- Cross-Document Traceability: XX/100
```

Forbidden:

1. score ranges or aggregated wording instead of per-dimension lines
2. grade modifiers such as `A- / B+ / C+ / D-`
3. omitting any readiness dimension
4. narrative-only output without the structured block
