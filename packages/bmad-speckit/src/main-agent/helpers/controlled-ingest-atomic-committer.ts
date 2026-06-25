const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "controlled-ingest-atomic-committer",
  purpose: "Controlled Ingest Atomic Committer package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/controlled-ingest-atomic-committer.ts"],
});

module.exports = {
  moduleExports,
};
