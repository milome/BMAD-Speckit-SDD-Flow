const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "run-confirmed-final-required-commands",
  purpose: "Run Confirmed Final Required Commands package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/run-confirmed-final-required-commands.js"],
});

module.exports = {
  moduleExports,
};
