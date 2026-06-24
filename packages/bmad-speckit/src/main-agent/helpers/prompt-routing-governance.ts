const { createDurableHelperDescriptor } = require('./durable-helper-report');

const promptRoutingGovernanceHelper = createDurableHelperDescriptor({
  helperId: 'prompt-routing-governance',
  purpose: 'package-local durable helper descriptor for prompt routing governance',
  ownedFiles: ['_bmad/governance/prompt-routing'],
});

module.exports = {
  promptRoutingGovernanceHelper,
};
