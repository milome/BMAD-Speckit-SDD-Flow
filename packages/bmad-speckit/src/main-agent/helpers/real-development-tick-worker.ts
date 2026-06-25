const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "real-development-tick-worker",
  purpose: "Real Development Tick Worker package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/real-development-tick-worker.ts"],
});

module.exports = {
  moduleExports,
};
