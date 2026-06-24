const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "monitor-push",
  purpose: "Monitor Push package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/monitor-push.ts"],
});

module.exports = {
  moduleExports,
};
