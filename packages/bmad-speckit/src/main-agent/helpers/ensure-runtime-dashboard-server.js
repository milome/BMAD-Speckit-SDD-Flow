const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "ensure-runtime-dashboard-server",
  purpose: "Ensure Runtime Dashboard Server package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/ensure-runtime-dashboard-server.js"],
});

module.exports = {
  moduleExports,
};
