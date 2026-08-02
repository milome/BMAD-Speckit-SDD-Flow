#!/usr/bin/env node
const checker = require("../../../shared/goal-contract/scripts/check-contract-command-portability");

if (require.main === module) {
  process.exitCode = checker.commandPortabilityCli();
}

module.exports = checker;
