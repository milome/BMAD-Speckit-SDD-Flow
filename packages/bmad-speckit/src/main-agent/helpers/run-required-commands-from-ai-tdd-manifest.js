const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "run-required-commands-from-ai-tdd-manifest",
  purpose: "Run Required Commands From Ai Tdd Manifest package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/run-required-commands-from-ai-tdd-manifest.js"],
});

module.exports = {
  moduleExports,
};
