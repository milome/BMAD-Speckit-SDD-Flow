const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "subagent-current-attempt-revalidation",
  purpose: "Subagent Current Attempt Revalidation package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/subagent-current-attempt-revalidation.ts"],
});

module.exports = {
  moduleExports,
};
