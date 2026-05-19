# TRACE-023 ContractCheck Decision Field Delta

- Controlled ingest maps legacy contractChecks[].result to decision at the boundary.
- Canonical requirement records persist contractChecks[].decision only.
- The decision-field checker validates contractChecks independently from gateChecks.
