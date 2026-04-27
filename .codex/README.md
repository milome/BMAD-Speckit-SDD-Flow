# BMAD-Speckit Codex Runtime

Codex uses the no-hooks path. Run main-agent orchestration through CLI surfaces such as:

- `npm run main-agent-orchestration -- --action inspect`
- `npm run main-agent-orchestration -- --action dispatch-plan`
- `npm run main-agent:run-loop -- --taskReportPath <path>`

Custom Codex agents are installed under `.codex/agents/`.
Codex protocols are installed under `.codex/protocols/` and required by reviewer/auditor/closeout agents.
BMAD dispatch packets resolve `role` to these TOML agents and fail closed if a role is missing.
Five-layer entry: `bmad-help` -> `layer_1_intake` -> `layer_2_architecture` -> `layer_3_story` -> `layer_4_speckit` -> `layer_5_closeout`.
Governed runtime entry: `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit`; short aliases `$bmads`, `/bmads`, and `bmads` are equivalent.
