/**
 * Helper: run init with mocked 404 URL to trigger exit 3 (init catch outputs --offline hint)
 * Spawned as subprocess so nock intercepts HTTP before init runs
 */
const nock = require('nock');
const path = require('path');

const tmpDir = process.argv[2] || process.cwd();
nock('https://example.com')
  .get(/\/e13s2-404\.tar\.gz/)
  .reply(404);

const init = require('../src/commands/init');
process.chdir(tmpDir);

init.initCommand('.', {
  ai: 'cursor-agent',
  yes: true,
  template: 'https://example.com/e13s2-404.tar.gz',
}).catch(() => {});
