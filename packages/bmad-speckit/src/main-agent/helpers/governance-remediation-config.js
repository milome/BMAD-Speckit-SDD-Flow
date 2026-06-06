const { createDurableHelperDescriptor } = require('./durable-helper-report');

const governanceRemediationConfigHelper = createDurableHelperDescriptor({
  helperId: 'governance-remediation-config',
  purpose: 'package-local durable helper descriptor for governance remediation configuration',
  ownedFiles: ['_bmad/config/governance-remediation.yaml'],
});

module.exports = {
  governanceRemediationConfigHelper,
};
