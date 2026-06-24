const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "trace-closure-matrix",
  purpose: "Trace Closure Matrix package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/trace-closure-matrix.ts"],
});

module.exports = {
  moduleExports,
};
