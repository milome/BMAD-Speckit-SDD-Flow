# TRACE-029 Main Agent Control Hardcut Diff Summary

- Main-agent orchestration now resolves active RequirementRecord / ResolvedRuntimeContext before legacy runtime context and exposes a requirement-record-backed runtimeResumeProjection.
- Legacy orchestration-state remains observable as projection context but no longer controls dispatch authority when a requirement record exists.
- Auto-continue now requires runtimeResumeProjection.source=requirement_record with runtimeNextAction and ready=true; legacy mainAgentNextAction/mainAgentReady or next_action/ready cannot authorize continuation.
- bmad-help runtime policy now resolves active requirement context and preserves the requirement-record implementationEntryGate instead of recomputing a conflicting legacy readiness gate.
- User-story mapping and packet/orchestration artifact paths are redirected to requirement-record scoped paths, eliminating old runtime/governance control roots from dispatch authority.
- Acceptance tests cover legacy-state observation without control authority, requirement-record-backed bmad-help policy projection, auto-continue hardcut, requirement index routing, and target packet path contracts.
