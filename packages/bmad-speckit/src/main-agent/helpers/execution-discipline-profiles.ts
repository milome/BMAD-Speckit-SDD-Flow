const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "execution-discipline-profiles",
  purpose: "Execution Discipline Profiles package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/execution-discipline-profiles.ts"],
});

module.exports = {
  moduleExports,
};
