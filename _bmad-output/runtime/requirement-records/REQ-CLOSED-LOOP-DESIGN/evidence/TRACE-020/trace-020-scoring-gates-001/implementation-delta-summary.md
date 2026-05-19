# TRACE-020 Scoring Gates Delta

- Added requirement-scoped scoring gates checker for score_materialization and score_evaluation gateChecks.
- Extended controlled implementation evidence ingest to accept failureRecords[] and rerunLoops[] without result/decision control fields.
- Delivery Closeout Gate now blocks unresolved score gate failures from gateChecks/failureRecords instead of reading score files directly.
- Added acceptance coverage for missing score gates, score write failure, score evaluation failure, controlled rerun loop recording, and closeout blocking.
- Score artifact remains evidence/read_model only; score.written is not a control event.
