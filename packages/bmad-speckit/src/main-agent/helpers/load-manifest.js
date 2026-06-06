const { createDurableHelperDescriptor } = require('./durable-helper-report');

const loadManifestHelper = createDurableHelperDescriptor({
  helperId: 'load-manifest',
  purpose: 'package-local durable helper descriptor for manifest loading',
  ownedFiles: ['_bmad/manifest.json'],
});

module.exports = {
  loadManifestHelper,
};
