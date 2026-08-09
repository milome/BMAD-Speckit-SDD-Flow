const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  auditCompletedChild,
} = require('../../../_bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-completed-campaign.js');

test('exports one child audit seam for immediate post-child closure verification', () => {
  assert.equal(typeof auditCompletedChild, 'function');
});
