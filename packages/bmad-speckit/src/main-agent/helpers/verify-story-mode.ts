const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "verify-story-mode",
  purpose: "Verify Story Mode package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/verify-story-mode.ts"],
});

module.exports = {
  moduleExports,
};
