'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { writeCanonicalArtifact } = require('./canonical-artifact.cjs');
const { createBootstrapTimingSummary } = require('./summarize-test-timings.cjs');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, '.artifacts', 'test-portfolio');
const target = path.join(outputDir, 'ci-test-timing-summary.json');

if (!fs.existsSync(target)) {
  writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: path.basename(target),
    artifact: createBootstrapTimingSummary(),
  });
}
