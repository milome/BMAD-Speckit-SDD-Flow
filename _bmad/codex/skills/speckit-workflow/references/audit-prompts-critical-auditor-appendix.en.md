# Critical Auditor conclusion format (all stages)

This appendix defines the required **Critical Auditor** section for audit prompts §1–§5 and PRD/Arch/PR audits. For **standard** or **strict** strictness, the report **must** include this section; **simple** may omit it.

---

## 1. Required structure

The Critical Auditor section must include all of the following; missing any item ⇒ **invalid report format**, regenerate:

| # | Item | Description |
|---|------|-------------|
| 1 | Dimensions checked | List skeptic dimensions actually reviewed |
| 2 | Per-dimension verdict | Pass/fail with rationale |
| 3 | Round gap conclusion | State **no new gaps** or **gaps remain**; if gaps, list items |

---

## 2. Output format

Use a dedicated section with heading:

```
## Critical Auditor Conclusion
```

**Length**: This section should be at least as long as the rest of the report (≥50% share) so the model allocates enough depth to the adversarial role.

---

## 3. Suggested skeptic dimensions (document/code audits)

| Dimension | Focus |
|-----------|--------|
| Missing requirements | Points in upstream docs not covered |
| Undefined boundaries | Edge cases / error paths unclear |
| Untestable acceptance | Criteria not measurable |
| Contradictions | Conflicts with spec/plan/GAPS |

(Stages may trim dimensions as appropriate.)

---

## 4. Parseable scoring linkage

Reports must still end with the **parseable scoring block** required by the stage (`Overall Grade` / `总体评级`, dimension lines) so `parseAndWriteScore` and dashboards work.

---

## 5. Round conclusion text

Use either:

- `**Round conclusion**: no new gaps`  
- `**Round conclusion**: gaps remain. Items: 1) …; 2) …`

Chinese equivalents remain valid for zh locale (`本轮结论`, `具体项`).

---

## Critical Auditor checklist (summary)

- [ ] Section heading `## Critical Auditor Conclusion` present
- [ ] Three required structural items addressed
- [ ] Sufficient length vs. rest of report (standard/strict)
- [ ] Compatible with stage parseable block requirements
