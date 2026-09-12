# <Feature> Design Spec

## Goal

<Stable outcome and user value.>

## Contracts And Invariants

- <Contract or invariant that phases must preserve.>

## Compatibility

- <Supported consumers, versions, and migration constraints.>

## Non-Goals

- <Explicitly excluded behavior.>

## Phase Map

| Phase | Independently reviewable outcome | Depends on |
|---|---|---|
| <phase-id> | <outcome> | <dependency> |

## Successor Policy

Store the exact code-to-target allowlist in a separate file based on
`assets/successor-policy-template.json`. Use `RELEASED` only for a release
decision; every other target is the exact next phase id.

## Freeze Authority

- Required authority: `<repository role or named owner>`
- External receipt: `<path based on assets/design-freeze-receipt-template.json>`

The receipt is external because embedding this document's SHA256 in the
document would change the SHA256.
