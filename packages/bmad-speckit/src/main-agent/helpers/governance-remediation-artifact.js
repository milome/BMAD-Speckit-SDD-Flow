const { createDurableHelperDescriptor } = require('./durable-helper-report');

const governanceRemediationArtifactHelper = createDurableHelperDescriptor({
  helperId: 'governance-remediation-artifact',
  purpose: 'package-local durable helper descriptor for remediation artifact rendering',
  ownedFiles: ['_bmad-output/governance/remediation-artifacts'],
});

module.exports = {
  governanceRemediationArtifactHelper,
};
