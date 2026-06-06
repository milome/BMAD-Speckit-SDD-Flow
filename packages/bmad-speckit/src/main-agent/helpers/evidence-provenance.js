const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "evidence-provenance",
  purpose: "Evidence Provenance package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/evidence-provenance.js"],
});

module.exports = {
  moduleExports,
};
