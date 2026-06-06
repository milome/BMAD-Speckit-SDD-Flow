const { createDurableHelperDescriptor } = require('./durable-helper-report');

const governancePacketExecutionStoreHelper = createDurableHelperDescriptor({
  helperId: 'governance-packet-execution-store',
  purpose: 'package-local durable helper descriptor for governance packet execution records',
  ownedFiles: ['_bmad-output/governance/execution-records'],
});

module.exports = {
  governancePacketExecutionStoreHelper,
};
