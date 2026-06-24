const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "update-specify-passed",
  purpose: "Update Specify Passed package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/update-specify-passed.ts"],
});

module.exports = {
  moduleExports,
};
