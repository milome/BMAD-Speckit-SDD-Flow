const { createDurableHelperDescriptor } = require('./durable-helper-report');

const governancePacketReconcilerHelper = createDurableHelperDescriptor({
  helperId: 'governance-packet-reconciler',
  purpose: 'package-local durable helper descriptor for governance packet reconciliation',
  ownedFiles: ['_bmad-output/governance/execution-records', '_bmad-output/governance/packets'],
});

module.exports = {
  governancePacketReconcilerHelper,
};
