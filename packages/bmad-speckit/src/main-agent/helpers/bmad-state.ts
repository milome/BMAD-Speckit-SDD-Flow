const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "bmad-state",
  purpose: "Bmad State package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/bmad-state.ts"],
});

module.exports = {
  moduleExports,
};
