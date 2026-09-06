const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');

const fixture = path.join(__dirname, 'fixtures/standalone-goal/real-source-plan-20260904');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const key = (start, end) => `${start}:${end}`;
let expected;
let actual;
let blocks;
let actualBySpan;

before(() => {
  const oracleBytes = fs.readFileSync(`${fixture}.expected.json`);
  assert.equal(hash(oracleBytes), 'ed319186e6d12ed7fbfa8c94aaf807cbb432733f677c5af0dcc07ae3faea0f86');
  expected = JSON.parse(oracleBytes.toString('utf8'));
  const bytes = fs.readFileSync(`${fixture}.md`);
  assert.equal(hash(bytes), expected.source.sha256);
  actual = extractSourceObligations({ snapshot: buildSourceSnapshot({
    sourceType: 'source_plan', sourcePath: 'docs/real-source-plan.md', rawBytes: bytes,
  }) });
  blocks = expected.sections.flatMap((section) => section.blocks);
  actualBySpan = new Map(actual.sourceBlocks.map((block) => [key(block.sourceRef.startByte, block.sourceRef.endByteExclusive), block]));
});

function report(name, mismatches) {
  const directory = path.resolve(__dirname, '../../../.artifacts/test-portfolio/source-parser-real-oracle');
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${name}.json`);
  fs.writeFileSync(target, `${JSON.stringify({ sourceSha256: expected.source.sha256, mismatches }, null, 2)}\n`, 'utf8');
  assert.equal(mismatches.length, 0, `${name}: ${mismatches.length} mismatches; full report ${target}; sample ${JSON.stringify(mismatches.slice(0, 12))}`);
}

test('the production parser partitions every frozen source block without omissions or exclusions hidden from the manifest', () => {
  const mismatches = [];
  for (const block of blocks) {
    const parsed = actualBySpan.get(key(block.source.byteStart, block.source.byteEnd));
    if (!parsed) mismatches.push({ line: block.source.lineStart, issue: 'block_span_missing' });
    else if (parsed.text !== block.text || parsed.sourceRef.exactTextHash !== `sha256:${block.source.textSha256}`) mismatches.push({ line: block.source.lineStart, issue: 'block_source_changed' });
  }
  report('source-block-coverage', mismatches);
  assert.deepEqual(actual.sourceCoverage.uncoveredByteRanges, []);
});

const classOf = (disposition) => ['layout', 'metadata', 'structure', 'example'].includes(disposition) ? 'structural'
  : ['baseline_fact', 'observed_deviation', 'observed_user_issue', 'historical_evidence', 'review_pending'].includes(disposition) ? 'descriptive'
    : disposition === 'unresolved' ? 'unresolved' : 'effective';

test('every frozen source block retains its effective versus descriptive authority class', () => {
  const mismatches = [];
  for (const block of blocks) {
    const parsed = actualBySpan.get(key(block.source.byteStart, block.source.byteEnd));
    if (parsed && classOf(parsed.disposition) !== classOf(block.disposition)) mismatches.push({
      line: block.source.lineStart, expected: block.disposition, actual: parsed.disposition,
    });
  }
  report('source-block-disposition', mismatches);
});

test('every frozen clause has a byte-exact production clause, including table cell obligations', () => {
  const parsedClauses = new Map(actual.sourceBlocks.flatMap((block) => block.clauses)
    .map((clause) => [key(clause.sourceRef.startByte, clause.sourceRef.endByteExclusive), clause]));
  const mismatches = [];
  for (const block of blocks) for (const clause of block.semantics) {
    const parsed = parsedClauses.get(key(clause.byteStart, clause.byteEnd));
    if (!parsed || parsed.text !== clause.text) mismatches.push({ line: block.source.lineStart, clause: clause.id, issue: 'clause_span_missing' });
  }
  report('source-clause-coverage', mismatches);
});

test('all source WORK dependencies agree with the independently reviewed manifest', () => {
  const mismatches = [];
  for (const work of expected.sections.flatMap((section) => section.works)) {
    const parsed = actual.sourceObligations.find((row) => row.id === work.id);
    if (!parsed || JSON.stringify([...parsed.dependencyRefs].sort()) !== JSON.stringify([...work.dependencies].sort())) mismatches.push({
      work: work.id, expected: work.dependencies, actual: parsed?.dependencyRefs || null,
    });
  }
  report('work-dependencies', mismatches);
});

test('the frozen clause polarity and explicit inherited source conditions remain visible to the production parser', () => {
  const parsedClauses = new Map(actual.sourceBlocks.flatMap((block) => block.clauses)
    .map((clause) => [key(clause.sourceRef.startByte, clause.sourceRef.endByteExclusive), clause]));
  const parsedBlocks = new Map(actual.sourceBlocks.map((block) => [block.id, block]));
  const mismatches = [];
  for (const block of blocks) for (const clause of block.semantics) {
    const parsed = parsedClauses.get(key(clause.byteStart, clause.byteEnd));
    if (!parsed) continue;
    if (parsed.polarity !== clause.polarity) mismatches.push({ line: block.source.lineStart,
      clause: clause.id, expected: clause.polarity, actual: parsed.polarity });
    for (const condition of clause.conditions.filter((item) => item.sourceLine)) {
      const conditionLines = parsed.conditions.flatMap((item) => item.sourceBlockRefs)
        .map((id) => parsedBlocks.get(id)?.sourceRef.lineStart);
      if (!conditionLines.includes(condition.sourceLine)) mismatches.push({ line: block.source.lineStart,
        clause: clause.id, missingConditionSourceLine: condition.sourceLine });
    }
  }
  report('clause-semantics', mismatches);
});

test('every concrete source command is byte-exact and command mentions are not promoted into invocations', () => {
  const expectedBlocks = new Map(blocks.map((block) => [block.id, block]));
  const concrete = expected.sections.flatMap((section) => section.commands).filter((command) => command.expression && !command.derivedFrom);
  const parsed = actual.sourceBlocks.flatMap((block) => block.commandDeclarations.map((command) => ({ block, command })));
  const identity = (line, invocation) => `${line}:${invocation}`;
  const wanted = new Set(concrete.map((command) => identity(expectedBlocks.get(command.blockId).source.lineStart, command.expression)));
  const found = new Set(parsed.map(({ block, command }) => identity(block.sourceRef.lineStart, command.invocation)));
  const mismatches = [...wanted].filter((item) => !found.has(item)).map((item) => ({ issue: 'missing_command', item }));
  mismatches.push(...[...found].filter((item) => !wanted.has(item)).map((item) => ({ issue: 'invented_command', item })));
  for (const { command } of parsed) {
    assert.equal(command.executionStatus, 'source_declared_not_executed');
    assert.ok(command.clauseRefs.length);
  }
  report('source-command-declarations', mismatches);
});

test('all source-declared path roles and scenario ownership links retain explicit or derived source premises', () => {
  const roles = { scenario_product_file: 'owned', scenario_evidence: 'artifact', allows_product_file: 'owned', allows_test_file: 'owned', work_evidence: 'artifact' };
  const relations = expected.sections.flatMap((section) => section.relations);
  const mismatches = [];
  for (const relation of relations.filter((item) => roles[item.kind] || item.kind === 'scenario_implemented_by')) {
    const edge = actual.sourceRelations.find((item) => item.fromId === relation.from && item.toId === relation.to
      && (roles[relation.kind] ? item.pathRole === roles[relation.kind] : item.kind === 'task'));
    if (!edge) mismatches.push({ kind: relation.kind, from: relation.from, to: relation.to });
    else assert.ok(edge.sourceBlockRefs.length);
  }
  report('source-path-and-owner-relations', mismatches);
});

test('source command aliases, explicit sets and conditional selections retain their distinct derivations', () => {
  const expectedBlocks = new Map(blocks.map((block) => [block.id, block]));
  const commands = new Map(expected.sections.flatMap((section) => section.commands).map((command) => [command.id, command]));
  const parsedCommands = new Map(actual.sourceBlocks.flatMap((block) => block.commandDeclarations).map((command) => [command.id, command]));
  const mismatches = [];
  for (const relation of expected.sections.flatMap((section) => section.relations)
    .filter((item) => ['same_command_as', 'command_set_includes', 'conditional_command_selection'].includes(item.kind))) {
    const source = expectedBlocks.get(relation.blockId);
    const block = actualBySpan.get(key(source.source.byteStart, source.source.byteEnd));
    const target = commands.get(relation.to);
    const targetBlock = target && expectedBlocks.get(target.blockId);
    const edge = actual.sourceRelations.find((item) => item.sourceBlockRefs.includes(block.id)
      && (relation.kind === 'conditional_command_selection' ? item.kind === relation.kind && item.resolutionStatus === 'conditional'
        : item.toType === 'command_declaration' && parsedCommands.get(item.toId)?.invocation === target.expression
          && parsedCommands.get(item.toId).sourceRef.startByte >= targetBlock.source.byteStart
          && parsedCommands.get(item.toId).sourceRef.endByteExclusive <= targetBlock.source.byteEnd));
    if (!edge) mismatches.push({ kind: relation.kind, from: relation.from, to: relation.to, line: source.source.lineStart });
    else assert.ok(edge.sourceBlockRefs.length);
  }
  report('source-command-reference-relations', mismatches);
});
