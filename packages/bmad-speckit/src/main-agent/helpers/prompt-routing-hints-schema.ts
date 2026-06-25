const { createDurableHelperDescriptor } = require('./durable-helper-report');

const promptRoutingHintsSchemaHelper = createDurableHelperDescriptor({
  helperId: 'prompt-routing-hints-schema',
  purpose: 'package-local durable helper descriptor for prompt routing hint schemas',
  ownedFiles: ['_bmad/governance/prompt-routing-hints.schema.json'],
});

module.exports = {
  promptRoutingHintsSchemaHelper,
};
