#!/usr/bin/env node
const { runStageAudit } = require('./reverse_audit_stage_common');

process.exit(
  runStageAudit(process.argv.slice(2), {
    cliName: 'audit_closeout_integrity.js',
    stage: 'closeout_integrity',
    mode: 'readiness',
    exitSemantics: 'fails unless closeout can rely on current delivery verification readiness',
  })
);
