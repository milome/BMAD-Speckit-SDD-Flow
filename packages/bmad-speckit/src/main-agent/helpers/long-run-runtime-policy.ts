const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "long-run-runtime-policy",
  purpose: "Long Run Runtime Policy package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/long-run-runtime-policy.ts"],
});

module.exports = {
  moduleExports,
};
