# TRACE-036 Implementation Delta

- Added current-attempt revalidation for accepted subagent evidence envelopes.
- Delivery Closeout Gate now fail-closes when an accepted subagent envelope lacks a matching pass revalidation report for the current closeout attempt and envelope hash.
- Rerun loop source authority now accepts controlled failure_record refs so subagent_revalidation_failed can feed the same rerun loop instead of a duplicate rework chain.
- Ingest preserves the failure_record authority type without allowing direct control-field writes from subagents.
