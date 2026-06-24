const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "bmad-sync-from-v6",
  purpose: "Bmad Sync From V6 package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/bmad-sync-from-v6.ts"],
});

module.exports = {
  moduleExports,
};
