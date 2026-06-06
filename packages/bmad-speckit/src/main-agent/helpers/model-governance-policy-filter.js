const { createDurableHelperDescriptor } = require('./durable-helper-report');

const modelGovernancePolicyFilterHelper = createDurableHelperDescriptor({
  helperId: 'model-governance-policy-filter',
  purpose: 'package-local durable helper descriptor for model governance policy filtering',
  ownedFiles: ['_bmad/governance/model-policy'],
});

module.exports = {
  modelGovernancePolicyFilterHelper,
};
