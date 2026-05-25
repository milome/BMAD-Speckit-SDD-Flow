#!/usr/bin/env node
const { runStageAudit } = require('./reverse_audit_stage_common');

process.exit(
  runStageAudit(process.argv.slice(2), {
    cliName: 'audit_implementation_readiness.js',
    stage: 'implementation_readiness',
    mode: 'readiness',
    exitSemantics: 'fails when confirmability fails or deliveryReadiness.ready is false',
  })
);
