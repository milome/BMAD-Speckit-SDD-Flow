const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "bmad-help-routing-state",
  purpose: "Bmad Help Routing State package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/bmad-help-routing-state.ts"],
});

module.exports = {
  moduleExports,
};
