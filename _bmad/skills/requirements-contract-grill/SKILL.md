---
name: requirements-contract-grill
description: Resolve source-grounded requirement decisions through a dependency-ordered batch frontier.
---

# Requirements Contract Grill

Use this skill only for unresolved requirement decisions that remain after source,
repository, architecture, policy, glossary, and test investigation.

## Runtime

- Question graph protocol: `requirements-grill-question-graph/v1`
- Response protocol: `requirements-grill-answers/v1`
- Session protocol: `requirements-grill-session/v1`
- Decision protocol: `requirements-contract-decision-receipt/v1`
- Model owner: `requirements-contract-grill-model.ts`
- Session owner: `requirements-contract-grill-session.ts`
- Decision receipt owner: `requirements-contract-grill-session.ts`

## Rules

1. Investigate every required evidence class before asking.
2. Persist the complete acyclic question graph and stable dependency order, then
   expose the same `0..N ready frontier` across every host and resume path.
3. Accept only `frontierVersion` plus answer items containing `questionId`,
   `questionVersion`, and `value`; users never supply timestamps, nonces,
   provider metadata, hashes, or paths.
4. Show source evidence, issue code, options, provenance, behavior impact,
   delivery impact, dependencies, affected artifacts, and all response paths.
5. Label one recommendation separately; it is never automatically selected.
6. Create `human_confirmed` authority only from an explicit schema-valid option
   or custom response.
7. The session owner creates one deterministic decision receipt per accepted
   question. Reject and defer responses create no receipt and preserve unresolved
   state.
8. Reuse resolved receipts monotonically. Reopen only when affected fields,
   question version, or business authority premises conflict.
   Locator-only source binding changes never reopen Grill; use binding refresh without a new
   decision receipt or before/after semantic model hashes.
9. Update context only with domain vocabulary. Create an ADR only when the
   decision is hard to reverse, surprising, and has a real trade-off.
10. Conversation, glossary, ADR, and recommendation prose never substitute for
    the immutable decision receipt.
