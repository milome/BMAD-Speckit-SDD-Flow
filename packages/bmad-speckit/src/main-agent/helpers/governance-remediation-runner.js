const { createDurableHelperDescriptor } = require('./durable-helper-report');

const governanceRemediationRunnerHelper = createDurableHelperDescriptor({
  helperId: 'governance-remediation-runner',
  purpose: 'package-local durable helper descriptor for remediation packet execution',
  ownedFiles: ['_bmad-output/governance/remediation-runs'],
});

module.exports = {
  governanceRemediationRunnerHelper,
};
