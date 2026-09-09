const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  lintStandaloneSourcePlan,
} = require('../src/utils/goal-contract/source-plan/standalone-source-plan.ts');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SOURCE_COMMAND = path.join(PACKAGE_ROOT, 'src', 'commands', 'goal-contract.ts');
const TSX = path.join(PACKAGE_ROOT, '..', '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');

function sourcePlan(extraNode = '') {
  return [
    '# Arbitrary heading',
    '```standalone-source-plan',
    'sourcePlanVersion: standalone-source-plan/v1',
    'sourcePlanId: PLAN-CORE-001',
    'intendedConsumer: goal-execution-contract-generator',
    'purpose: implementation_execution',
    'sourceLanguage: en-US',
    'goal: Compile a typed source.',
    'scope: [compiler]',
    'nonGoals: [business_execution]',
    'globalBindingsAllowed: false',
    '```',
    '## Requirements can appear in any section order',
    '```standalone-source-plan-node',
    'kind: REQ',
    'id: REQ-CORE-001',
    'title: Typed source',
    'statement: The compiler MUST preserve typed ownership.',
    'normativeStrength: MUST',
    'polarity: required',
    'applicability: { mode: always }',
    'scope: local',
    'taskRefs: [TASK-CORE-001]',
    'acceptanceRefs: [AC-CORE-001]',
    '```',
    '```standalone-source-plan-node',
    'kind: TASK',
    'id: TASK-CORE-001',
    'title: Compile source',
    'statement: Compile the typed source.',
    'normativeStrength: MUST',
    'polarity: required',
    'applicability: { mode: always }',
    'scope: local',
    'requirementRefs: [REQ-CORE-001]',
    'acceptanceRefs: [AC-CORE-001]',
    'commandRefs: [CMD-CORE-001]',
    'evidenceRefs: [EVD-CORE-001]',
    'executionClass: executable_child',
    'ownedProductionPaths: [packages/bmad-speckit/src/utils/goal-contract/source-plan]',
    'steps: [Parse the typed source, Compile the canonical graph, Validate sparse bindings]',
    '```',
    '```standalone-source-plan-node',
    'kind: AC',
    'id: AC-CORE-001',
    'title: Ownership acceptance',
    'statement: Typed ownership is preserved.',
    'normativeStrength: MUST',
    'polarity: required',
    'applicability: { mode: always }',
    'scope: local',
    'ownerRef: TASK-CORE-001',
    'requirementRefs: [REQ-CORE-001]',
    'predicate: The graph contains the declared owner relation.',
    '```',
    '```standalone-source-plan-node',
    'kind: CMD',
    'id: CMD-CORE-001',
    'title: Focused test',
    'statement: Run the focused test.',
    'normativeStrength: MUST',
    'polarity: required',
    'applicability: { mode: always }',
    'scope: local',
    'ownerRef: TASK-CORE-001',
    'requirementRefs: [REQ-CORE-001]',
    'acceptanceRefs: [AC-CORE-001]',
    'command: node --test tests/example.test.js',
    'workingDirectory: packages/bmad-speckit',
    'passCriteria: Exit code is zero.',
    '```',
    '```standalone-source-plan-node',
    'kind: EVD',
    'id: EVD-CORE-001',
    'title: Test evidence',
    'statement: Capture the focused test result.',
    'normativeStrength: MUST',
    'polarity: required',
    'applicability: { mode: always }',
    'scope: local',
    'ownerRef: AC-CORE-001',
    'requirementRefs: [REQ-CORE-001]',
    'producerRef: CMD-CORE-001',
    'expectedFields: [exitCode]',
    '```',
    extraNode,
    '',
  ].join('\n');
}

describe('standalone Source Plan lint', () => {
  it('distinguishes executable expressions, source command sets, and conditional selectors', () => {
    const commandSet = [
      '```standalone-source-plan-node',
      'kind: CMD',
      'id: CMD-CORE-002',
      'title: Focused command set',
      'statement: Bind the reviewed focused command set without inventing an invocation.',
      'normativeStrength: MUST',
      'polarity: descriptive',
      'applicability: { mode: always }',
      'scope: local',
      'ownerRef: TASK-CORE-001',
      'requirementRefs: [REQ-CORE-001]',
      'commandDeclarationClass: source_command_set',
      'commandSetRefs: [CMD-CORE-001]',
      'workingDirectory: packages/bmad-speckit',
      'passCriteria: Every member resolves to an executable command declaration.',
      '```',
    ].join('\n');
    const valid = lintStandaloneSourcePlan({ sourcePath: 'command-set.md', sourceText: sourcePlan(commandSet) });
    assert.equal(valid.ok, true, JSON.stringify(valid.issues));
    assert.ok(valid.canonicalGraph.relations.some(({ type, fromRef, toRef }) =>
      type === 'includes_command' && fromRef === 'CMD-CORE-002' && toRef === 'CMD-CORE-001'));

    const missing = lintStandaloneSourcePlan({
      sourcePath: 'command-set-missing.md',
      sourceText: sourcePlan(commandSet.replace('commandSetRefs: [CMD-CORE-001]\n', '')),
    });
    assert.ok(missing.issues.some(({ failureClass }) => failureClass === 'source_command_set_members_missing'));

    const forged = lintStandaloneSourcePlan({
      sourcePath: 'command-set-forged.md',
      sourceText: sourcePlan(commandSet.replace('workingDirectory:', 'command: synthetic command\nworkingDirectory:')),
    });
    assert.ok(forged.issues.some(({ failureClass }) => failureClass === 'source_command_set_expression_forbidden'));

    const selector = [
      '```standalone-source-plan-node',
      'kind: CMD',
      'id: CMD-CORE-002',
      'title: Corresponding acceptance selector',
      'statement: Select the command owned by the corresponding acceptance scenario.',
      'normativeStrength: MUST',
      'polarity: descriptive',
      'applicability: { mode: conditional, condition: Before each owned bypass is removed. }',
      'scope: local',
      'ownerRef: TASK-CORE-001',
      'requirementRefs: [REQ-CORE-001]',
      'commandDeclarationClass: conditional_selector',
      'selectionRule: Select the declared executable command for the acceptance scenario corresponding to the bypass being removed.',
      'selectionTarget: corresponding_acceptance_command',
      'workingDirectory: packages/bmad-speckit',
      'passCriteria: The selector resolves only after the corresponding acceptance owner is known.',
      '```',
    ].join('\n');
    const validSelector = lintStandaloneSourcePlan({ sourcePath: 'command-selector.md', sourceText: sourcePlan(selector) });
    assert.equal(validSelector.ok, true, JSON.stringify(validSelector.issues));

    const selectorWithoutRule = lintStandaloneSourcePlan({
      sourcePath: 'command-selector-rule-missing.md',
      sourceText: sourcePlan(selector.replace(/^selectionRule:.*\n/mu, '')),
    });
    assert.ok(selectorWithoutRule.issues.some(({ failureClass }) => failureClass === 'source_command_selector_rule_missing'));

    const forgedSelector = lintStandaloneSourcePlan({
      sourcePath: 'command-selector-forged.md',
      sourceText: sourcePlan(selector.replace('workingDirectory:', 'command: synthetic command\nworkingDirectory:')),
    });
    assert.ok(forgedSelector.issues.some(({ failureClass }) => failureClass === 'source_command_selector_expression_forbidden'));
  });

  it('accepts the canonical producer template as a complete example', () => {
    const template = path.resolve(
      PACKAGE_ROOT,
      '..',
      '..',
      '_bmad',
      'shared',
      'goal-contract',
      'standalone-source-plan-template.md'
    );
    const result = lintStandaloneSourcePlan({
      sourcePath: template,
      rawBytes: fs.readFileSync(template),
    });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.nodeCount, 12);
    assert.ok(result.relationCount > 0);
  });

  it('builds the same canonical graph independently of headings', () => {
    const first = lintStandaloneSourcePlan({ sourcePath: 'first.md', sourceText: sourcePlan() });
    const second = lintStandaloneSourcePlan({
      sourcePath: 'second.md',
      sourceText: sourcePlan().replace('# Arbitrary heading', '# 完全不同的标题'),
    });
    assert.equal(first.ok, true);
    assert.equal(first.issueCount, 0);
    assert.equal(first.nodeCount, 5);
    assert.equal(first.canonicalGraphHash, second.canonicalGraphHash);
  });

  it('rejects missing semantic owners and purpose conflicts with located issues', () => {
    const orphan = lintStandaloneSourcePlan({
      sourcePath: 'orphan.md',
      sourceText: sourcePlan().replace('ownerRef: AC-CORE-001', 'ownerRef: AC-CORE-999'),
    });
    assert.equal(orphan.ok, false);
    assert.ok(orphan.issues.some((issue) => issue.failureClass === 'source_semantic_owner_missing'));

    const conflict = lintStandaloneSourcePlan({
      sourcePath: 'conflict.md',
      sourceText: sourcePlan([
        '```standalone-source-plan-node',
        'kind: NEG',
        'id: NEG-CORE-001',
        'title: Invalid self denial',
        'statement: Goal contract generation is forbidden.',
        'normativeStrength: MUST',
        'polarity: forbidden',
        'applicability: { mode: always }',
        'prohibits: [goal_contract_generation]',
        '```',
      ].join('\n')),
    });
    assert.equal(conflict.ok, false);
    assert.ok(conflict.issues.some((issue) => issue.failureClass === 'source_plan_purpose_conflict'));
    assert.ok(conflict.issues.every((issue) => issue.lineStart > 0 && issue.excerptHash));
  });

  it('rejects invalid semantic enums, provenance aliases, and implicit global authority', () => {
    const invalid = lintStandaloneSourcePlan({
      sourcePath: 'invalid-fields.md',
      sourceText: sourcePlan().replace(
        'normativeStrength: MUST\npolarity: required\napplicability: { mode: always }\nscope: local\ntaskRefs:',
        'normativeStrength: REQUIRED\npolarity: unknown\napplicability: { mode: always }\nscope: global\naliases: [SRC-INVALID]\ntaskRefs:'
      ),
    });
    assert.equal(invalid.ok, false);
    const failureClasses = new Set(invalid.issues.map((issue) => issue.failureClass));
    assert.ok(failureClasses.has('source_semantic_normative_strength_invalid'));
    assert.ok(failureClasses.has('source_semantic_polarity_invalid'));
    assert.ok(failureClasses.has('source_alias_invalid'));
    assert.ok(failureClasses.has('source_global_fanout_invalid'));
  });

  it('exposes lint-source and runs the same lint before obligation extraction', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-plan-lint-'));
    const sourcePath = path.join(root, 'source.md');
    fs.writeFileSync(sourcePath, sourcePlan(), 'utf8');
    const result = spawnSync(
      process.execPath,
      [TSX, '-e', SOURCE_RUNNER, SOURCE_COMMAND, 'lint-source', '--entry', 'standalone_goal_contract', '--source', sourcePath, '--json'],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).schemaVersion, 'StandaloneSourcePlanLintResult/v1');

    const commandSource = fs.readFileSync(SOURCE_COMMAND, 'utf8');
    const wholeSource = commandSource.slice(
      commandSource.indexOf('async function generateWholeSource'),
      commandSource.indexOf('async function generatePartitionBound')
    );
    assert.ok(
      wholeSource.indexOf('const sourceLint = lintStandaloneSourcePlan(') <
      wholeSource.indexOf('const source = extractGoalContractSourceModel(')
    );
  });
});
