const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "model-governance-hints-schema",
  purpose: "Model Governance Hints Schema package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/model-governance-hints-schema.ts"],
});

module.exports = {
  moduleExports,
};
