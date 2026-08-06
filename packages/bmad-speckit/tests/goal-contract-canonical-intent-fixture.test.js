const assert = require('node:assert');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  kernelPlanPath,
  primaryPath,
  readFixtureMetadata,
} = require('./goal-contract-canonical-intent-fixture.js');

const FIXTURE_ROOT = path.resolve(__dirname, 'fixtures');

describe('goal-contract canonical intent fixture', () => {
  it('loads canonical intent sources only from tracked test fixtures', () => {
    assert.equal(path.dirname(primaryPath), FIXTURE_ROOT);
    assert.equal(path.dirname(kernelPlanPath), FIXTURE_ROOT);
    assert.doesNotThrow(() => readFixtureMetadata());
  });
});
