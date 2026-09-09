const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  validateGoalContractSchema,
} = require('../src/utils/goal-contract/control-plane/schema-registry.ts');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHARED = path.join(ROOT, '_bmad', 'shared', 'goal-contract');
const REFERENCES = path.join(
  ROOT,
  '_bmad',
  'skills',
  'goal-execution-contract-generator',
  'references'
);

describe('standalone Source Plan v1 profile', () => {
  it('ships canonical assets and byte-identical installed projections', () => {
    const template = path.join(SHARED, 'standalone-source-plan-template.md');
    const profile = path.join(SHARED, 'standalone-source-plan-profile.json');
    const projectedTemplate = path.join(REFERENCES, path.basename(template));
    const projectedProfile = path.join(REFERENCES, path.basename(profile));

    for (const file of [
      template,
      profile,
      projectedTemplate,
      projectedProfile,
      path.join(SHARED, 'standalone-source-plan-profile.schema.json'),
      path.join(SHARED, 'canonical-requirement-graph.schema.json'),
      path.join(SHARED, 'canonical-requirement-graph-v2.schema.json'),
      path.join(SHARED, 'standalone-source-plan-lint-result.schema.json'),
    ]) {
      assert.equal(fs.existsSync(file), true, file);
    }
    assert.deepEqual(fs.readFileSync(projectedTemplate), fs.readFileSync(template));
    assert.deepEqual(fs.readFileSync(projectedProfile), fs.readFileSync(profile));
  });

  it('defines every canonical node kind and validates its own profile schema', () => {
    const profile = JSON.parse(
      fs.readFileSync(path.join(SHARED, 'standalone-source-plan-profile.json'), 'utf8')
    );
    validateGoalContractSchema('standalone-source-plan-profile.schema.json', profile);
    assert.deepEqual(
      [...profile.nodeKinds].sort(),
      ['AC', 'ART', 'CMD', 'DEP', 'EVD', 'NEG', 'NFR', 'OUT', 'PATH', 'REQ', 'STOP', 'TASK']
    );
    assert.equal(profile.parser.headingTextIsSemantic, false);
    assert.equal(profile.parser.sectionOrderIsSemantic, false);
    assert.equal(profile.confirmation.implementationConfirmationRequired, false);
    assert.equal(profile.confirmation.confirmedSourceAdapterTarget, 'CanonicalRequirementGraph/v1');
    assert.equal(profile.confirmation.canonicalGraphLintRequired, true);
    assert.deepEqual(profile.confirmation.sharedCompilerStages, [
      'compileGoalExecutionIR',
      'compileGoalExecutionClosure',
      'renderGoalExecutionProjection',
    ]);
    assert.deepEqual(profile.normalization.commandDeclarationClasses, [
      'executable_expression',
      'source_command_set',
      'conditional_selector',
    ]);
    assert.deepEqual(profile.referenceFields.commandSetRefs, ['CMD']);
    assert.deepEqual(profile.ownerRules.PATH, ['REQ', 'NFR', 'TASK', 'AC']);
    assert.match(profile.identity.canonicalPattern, /^\^/u);
  });

  it('documents explicit typed blocks without making headings parser authority', () => {
    const template = fs.readFileSync(
      path.join(SHARED, 'standalone-source-plan-template.md'),
      'utf8'
    );
    const skill = fs.readFileSync(
      path.join(ROOT, '_bmad', 'skills', 'goal-execution-contract-generator', 'SKILL.md'),
      'utf8'
    );
    for (const fragment of [
      'standalone-source-plan/v1',
      '```standalone-source-plan',
      '```standalone-source-plan-node',
      'ownerRef:',
      'requirementRefs:',
      'globalAuthorityRef:',
      'pass the same canonical graph lint',
    ]) {
      assert.match(template, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    }
    for (const kind of ['REQ', 'NFR', 'NEG', 'OUT', 'TASK', 'AC', 'PATH', 'CMD', 'EVD', 'ART', 'DEP', 'STOP']) {
      assert.match(template, new RegExp(`kind: ${kind}\\b`, 'u'));
    }
    assert.match(skill, /goal-contract lint-source/u);
    assert.match(skill, /standalone-source-plan-template\.md/u);
    assert.match(skill, /standalone-source-plan-profile\.json/u);
  });

  it('verifies schema, hash, and projection integrity through the canonical verifier', () => {
    const verifier = path.join(SHARED, 'scripts', 'verify-standalone-source-plan-profile.js');
    const result = spawnSync(process.execPath, [verifier], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.issues.length, 0);
    assert.equal(receipt.checkedReferences.length, 2);
  });

  it('declares every Source Plan contract asset as a required package mirror file', () => {
    const buildSource = fs.readFileSync(
      path.join(ROOT, 'packages', 'bmad-speckit', 'scripts', 'build-main-agent-dist.cjs'),
      'utf8'
    );
    for (const relativePath of [
      'shared/goal-contract/standalone-source-plan-template.md',
      'shared/goal-contract/standalone-source-plan-profile.json',
      'shared/goal-contract/standalone-source-plan-profile.schema.json',
      'shared/goal-contract/canonical-requirement-graph.schema.json',
      'shared/goal-contract/canonical-requirement-graph-v2.schema.json',
      'shared/goal-contract/standalone-source-plan-lint-result.schema.json',
      'shared/goal-contract/scripts/verify-standalone-source-plan-profile.js',
      'skills/goal-execution-contract-generator/references/standalone-source-plan-template.md',
      'skills/goal-execution-contract-generator/references/standalone-source-plan-profile.json',
    ]) {
      assert.ok(buildSource.includes(relativePath), `missing package asset: ${relativePath}`);
    }
  });
});
