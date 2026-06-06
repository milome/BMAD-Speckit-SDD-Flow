const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "requirement-record-event-reducer",
  purpose: "Requirement Record Event Reducer package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/requirement-record-event-reducer.js"],
});

module.exports = {
  moduleExports,
};
