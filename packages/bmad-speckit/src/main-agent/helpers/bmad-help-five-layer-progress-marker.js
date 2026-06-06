const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "bmad-help-five-layer-progress-marker",
  purpose: "Bmad Help Five Layer Progress Marker package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/bmad-help-five-layer-progress-marker.js"],
});

module.exports = {
  moduleExports,
};
