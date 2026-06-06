const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "write-runtime-registry",
  purpose: "Write Runtime Registry package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/write-runtime-registry.js"],
});

module.exports = {
  moduleExports,
};
