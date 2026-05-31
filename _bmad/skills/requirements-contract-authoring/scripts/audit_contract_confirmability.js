#!/usr/bin/env node
const { runStageAudit } = require('./reverse_audit_stage_common');

process.exit(
  runStageAudit(process.argv.slice(2), {
    cliName: 'audit_contract_confirmability.js',
    stage: 'contract_confirmability',
    mode: 'implementation',
    exitSemantics: 'fails only when the contract confirmation surface is not confirmable or reverse-audit checks fail',
  })
);
