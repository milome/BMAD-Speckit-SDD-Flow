const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "runtime-dashboard-server-state",
  purpose: "Runtime Dashboard Server State package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/runtime-dashboard-server-state.js"],
});

module.exports = {
  moduleExports,
};
