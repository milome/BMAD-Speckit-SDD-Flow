const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runUserStoryMapping = createPackageRuntimeReportAction({
  action: "user-story-mapping",
  checkSummary: "User Story Mapping resolved through package runtime",
});

module.exports = {
  runUserStoryMapping,
};
