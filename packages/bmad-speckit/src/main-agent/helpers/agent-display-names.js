const { createDurableHelperDescriptor } = require('./durable-helper-report');

const agentDisplayNamesHelper = createDurableHelperDescriptor({
  helperId: 'agent-display-names',
  purpose: 'package-local durable helper descriptor for localized agent display names',
  ownedFiles: ['_bmad/i18n/agents'],
});

module.exports = {
  agentDisplayNamesHelper,
};
