const { createDurableHelperDescriptor } = require('./durable-helper-report');

const partyModeRuntimeAssetsHelper = createDurableHelperDescriptor({
  helperId: 'party-mode-runtime-assets',
  purpose: 'package-local durable helper descriptor for party-mode runtime assets',
  ownedFiles: ['_bmad/core/skills/bmad-party-mode'],
});

module.exports = {
  partyModeRuntimeAssetsHelper,
};
