const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "sprint-status-authorized-update",
  purpose: "Sprint Status Authorized Update package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/sprint-status-authorized-update.ts"],
});

module.exports = {
  moduleExports,
};
