# TRACE-024 Rerun Source Authority Delta

- Added rerun-specific authority source refs in the requirement-record schema.
- Controlled ingest now validates rerun sourceRefs and drops trigger labels instead of persisting them as control fields.
- Delivery Closeout Gate now blocks invalid rerun loops even when their lifecycle status is resolved.
