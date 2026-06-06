const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "architecture-confirmation-hash-recipe",
  purpose: "Architecture Confirmation Hash Recipe package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/architecture-confirmation-hash-recipe.js"],
});

module.exports = {
  moduleExports,
};
