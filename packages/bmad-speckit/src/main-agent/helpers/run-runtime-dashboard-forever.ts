const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "run-runtime-dashboard-forever",
  purpose: "Run Runtime Dashboard Forever package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/run-runtime-dashboard-forever.ts"],
});

module.exports = {
  moduleExports,
};
