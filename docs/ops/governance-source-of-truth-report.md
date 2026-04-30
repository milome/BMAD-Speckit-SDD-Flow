# Governance Source Of Truth Report

Date: 2026-04-27

The TASKS_v1 governance model uses two authoritative sources:

| Layer | Path | Responsibility |
| --- | --- | --- |
| Strategy contract | `_bmad/_config/orchestration-governance.contract.yaml` | Defines signals, stage requirements, gate policy, mapping contract, and adaptive intake governance rules. |
| Runtime fact index | `_bmad-output/runtime/governance/user_story_mapping.json` | Stores requirement-to-epic/story/sprint facts, allowed write scopes, status, and packet references. |

Validation:

- `npm run validate:single-source-whitelist`
- `tests/acceptance/governance-single-source-of-truth.test.ts`
- `tests/acceptance/governance-stage-requirements-alignment.test.ts`

Policy:

- Contract files define rules only.
- Mapping files store runtime facts only.
- Runtime policy emissions must consume contract/index hashes rather than introduce a third policy source.
