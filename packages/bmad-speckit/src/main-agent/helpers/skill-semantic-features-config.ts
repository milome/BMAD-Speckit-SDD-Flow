const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "skill-semantic-features-config",
  purpose: "Skill Semantic Features Config package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/skill-semantic-features-config.ts"],
});

module.exports = {
  moduleExports,
};
