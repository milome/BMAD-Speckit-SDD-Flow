const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "run-confirmed-trace-slice",
  purpose: "Run Confirmed Trace Slice package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/run-confirmed-trace-slice.ts"],
});

module.exports = {
  moduleExports,
};
