# TRACE-038 Architecture Confirmation Copy Button Evidence

Current implementation delta adds a copy-confirmation-phrase control to the architecture confirmation HTML renderer and acceptance coverage for the rendered copy target, phrase id, button label, and live copy status region.

Changed files:
- _bmad/skills/requirements-contract-authoring/scripts/render-architecture-confirmation-html.ts
- tests/acceptance/render-architecture-confirmation-html.test.ts

Boundary assertions:
- The copy button is projection-only UI and does not mutate sourceDocumentHash or implementationConfirmationHash.
- Architecture confirmation recording still requires exact user-confirmed source, implementation, recipe, and architecture artifact hashes.
- The architecture confirmation state check passes under the currently confirmed architecture artifact hash.
