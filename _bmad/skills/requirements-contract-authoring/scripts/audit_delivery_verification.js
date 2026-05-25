#!/usr/bin/env node
const { runStageAudit } = require('./reverse_audit_stage_common');

process.exit(
  runStageAudit(process.argv.slice(2), {
    cliName: 'audit_delivery_verification.js',
    stage: 'delivery_verification',
    mode: 'readiness',
    exitSemantics: 'fails unless the confirmed contract is ready for delivery verification evidence',
  })
);
