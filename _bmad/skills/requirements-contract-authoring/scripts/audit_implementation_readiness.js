#!/usr/bin/env node
const { runStageAudit } = require('./reverse_audit_stage_common');

process.exit(
  runStageAudit(process.argv.slice(2), {
    cliName: 'audit_implementation_readiness.js',
    stage: 'implementation_readiness',
    mode: 'implementation',
    exitSemantics:
      'fails when contract confirmation, current hashes, required sections, or reverse-audit checks fail; deliveryReadiness.ready is not required before implementation runs',
  })
);
