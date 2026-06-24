const { createDurableHelperDescriptor } = require('./durable-helper-report');

const partyModeRuntimeHelper = createDurableHelperDescriptor({
  helperId: 'party-mode-runtime',
  purpose: 'package-local durable helper descriptor for party-mode session runtime state',
  ownedFiles: ['_bmad-output/party-mode/runtime'],
});

module.exports = {
  partyModeRuntimeHelper,
};
