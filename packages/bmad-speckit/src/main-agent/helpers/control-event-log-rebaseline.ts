const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "control-event-log-rebaseline",
  purpose: "Control Event Log Rebaseline package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/control-event-log-rebaseline.ts"],
});

module.exports = {
  moduleExports,
};
