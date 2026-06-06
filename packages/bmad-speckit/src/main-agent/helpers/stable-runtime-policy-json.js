const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "stable-runtime-policy-json",
  purpose: "Stable Runtime Policy Json package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/stable-runtime-policy-json.js"],
});

module.exports = {
  moduleExports,
};
