# TRACE-021 Scoring Policy Resolution Delta

- Added _bmad/_config/scoring-policy.contract.yaml as the only user-configurable scoring policy entry.
- Added resolveScoringPolicy() and ResolvedScoringPolicy with contract hash, policy hash, and stage rule fragment hashes.
- Runtime policy snapshots now include resolvedScoringPolicy.
- Score gate check now fails closed when the snapshot lacks resolved scoring policy or score artifact policy hash mismatches the resolver output.
