const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "sdd-artifact-manifest",
  purpose: "Sdd Artifact Manifest package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/sdd-artifact-manifest.js"],
});

module.exports = {
  moduleExports,
};
