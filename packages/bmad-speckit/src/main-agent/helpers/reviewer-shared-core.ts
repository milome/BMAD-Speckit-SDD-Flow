const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "reviewer-shared-core",
  purpose: "Reviewer Shared Core package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/reviewer-shared-core.ts"],
});

module.exports = {
  moduleExports,
};
