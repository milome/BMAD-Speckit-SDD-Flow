# TRACE-026 Codex Hook Trust Probe Delta

- GovernanceTransportEnvelope now recognizes hook trust decision events.
- Codex hooks_enabled envelopes require independent capability probe, SessionStart smoke, hook trust receipt, managed hook config hash, and runtimePolicySnapshot hash.
- main-agent unified ingress keeps Codex on no_hooks unless a validated hook trust envelope is explicitly supplied.
