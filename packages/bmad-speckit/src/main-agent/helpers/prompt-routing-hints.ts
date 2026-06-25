const { createDurableHelperDescriptor } = require('./durable-helper-report');

const promptRoutingHintsHelper = createDurableHelperDescriptor({
  helperId: 'prompt-routing-hints',
  purpose: 'package-local durable helper descriptor for prompt routing hints',
  ownedFiles: ['_bmad/governance/prompt-routing-hints.json'],
});

module.exports = {
  promptRoutingHintsHelper,
};
