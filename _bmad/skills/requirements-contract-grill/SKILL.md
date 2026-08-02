---
name: requirements-contract-grill
description: Resolve source-grounded requirement decisions through one dependency-ordered question at a time.
---

# Requirements Contract Grill

Use this skill only for unresolved requirement decisions that remain after source,
repository, architecture, policy, glossary, and test investigation.

## Runtime

- Question protocol: `requirements-grill-question/v1`
- Response protocol: `requirements-grill-response/v1`
- Session protocol: `requirements-grill-session/v1`
- Decision protocol: `requirements-decision-receipt/v1`
- Model owner: `requirements-contract-grill-model.ts`
- Session owner: `requirements-contract-grill-session.ts`
- Decision receipt owner: `requirements-contract-interaction-resolver.ts`

## Rules

1. Investigate every required evidence class before asking.
2. Expose exactly one active question.
3. Follow dependency order and preserve unresolved state across resume.
4. Show source evidence, issue code, options, provenance, behavior impact,
   delivery impact, dependencies, affected artifacts, and all response paths.
5. Label one recommendation separately; it is never automatically selected.
6. Create `human_confirmed` authority only from an explicit schema-valid option
   or custom response.
7. Reject and defer responses create no decision receipt and preserve unresolved
   state.
8. Bind every decision receipt to before and after semantic model hashes and the
   exact invalidated IR, Render, Oracle, RED, packet, and evidence refs.
9. Update context only with domain vocabulary. Create an ADR only when the
   decision is hard to reverse, surprising, and has a real trade-off.
10. Conversation, glossary, ADR, and recommendation prose never substitute for
    the immutable decision receipt.
