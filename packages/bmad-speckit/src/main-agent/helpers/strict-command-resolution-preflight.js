const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "strict-command-resolution-preflight",
  purpose: "Strict Command Resolution Preflight package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/strict-command-resolution-preflight.js"],
});

module.exports = {
  moduleExports,
};
