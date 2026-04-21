# Code Reviewer Shared Core

This directory is the host-neutral semantic source for `bmad_code_reviewer`.

Rules:

1. Shared core owns reviewer business semantics.
2. Host adapters may project carrier, transport, and materialization differences only.
3. Host-local prompt/config must not redefine stage semantics, route precedence, or fallback business rules.
4. All reviewer paths must preserve implementation readiness, rerun gates, packet execution closure, and `runAuditorHost` closeout semantics.
