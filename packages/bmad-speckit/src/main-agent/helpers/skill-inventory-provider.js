const { createDurableHelperDescriptor } = require('./durable-helper-report');

const skillInventoryProviderHelper = createDurableHelperDescriptor({
  helperId: 'skill-inventory-provider',
  purpose: 'package-local durable helper descriptor for governance skill inventory discovery',
  ownedFiles: ['_bmad/skills', '.codex/skills'],
});

module.exports = {
  skillInventoryProviderHelper,
};
