# Closeout Attempt Selection

- Delivery Closeout Gate now selects requiredCommands by current closeoutAttemptId or lastRunRef.closeoutAttemptId.
- Controlled ingest can append resolved failure/RCA status records so blocked attempts remain immutable while remediation can proceed.
- Closeout evaluation uses latest failure/RCA status by id.
