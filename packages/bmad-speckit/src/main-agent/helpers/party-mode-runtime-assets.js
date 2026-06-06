const { createDurableHelperDescriptor } = require('./durable-helper-report');

const partyModeRuntimeAssetsHelper = createDurableHelperDescriptor({
  helperId: 'party-mode-runtime-assets',
  purpose: 'package-local durable helper descriptor for party-mode runtime assets',
  ownedFiles: ['_bmad/party-mode/runtime-assets'],
});

module.exports = {
  partyModeRuntimeAssetsHelper,
};
