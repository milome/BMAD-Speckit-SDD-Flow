const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "subagent-surface-inventory",
  purpose: "Subagent Surface Inventory package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/subagent-surface-inventory.js"],
});

module.exports = {
  moduleExports,
};
