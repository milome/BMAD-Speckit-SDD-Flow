const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "governance-transport-envelope",
  purpose: "Governance Transport Envelope package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/governance-transport-envelope.ts"],
});

module.exports = {
  moduleExports,
};
