const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "cleanup-packed-bmad",
  purpose: "Cleanup Packed Bmad package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/cleanup-packed-bmad.ts"],
});

module.exports = {
  moduleExports,
};
