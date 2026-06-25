const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "generate-codex-agents-from-claude",
  purpose: "Generate Codex Agents From Claude package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/generate-codex-agents-from-claude.ts"],
});

module.exports = {
  moduleExports,
};
