const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "prepublish-check",
  purpose: "Prepublish Check package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/prepublish-check.js"],
});

module.exports = {
  moduleExports,
};
