const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { compileSourceBlocks, modalitiesOf } = require('../src/utils/goal-contract/source-normative-blocks.ts');

const sourcePath = path.join(__dirname, 'fixtures/standalone-goal/real-source-plan-20260904.md');
const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sourceHash(sourceBytes), '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
const compile = (bytes) => compileSourceBlocks({ sourceBytes: bytes, snapshot: buildSourceSnapshot({
  sourceType: 'source_plan', sourcePath: 'test-only/source.md', rawBytes: bytes,
}) });
const real = compile(sourceBytes);
const realClause = (line, anchor) => {
  const block = real.sourceBlocks.find((row) => row.sourceRef.lineStart <= line && row.sourceRef.lineEnd >= line);
  const clause = block?.clauses.find((row) => row.text.includes(anchor));
  assert.ok(clause, `source clause missing at ${line}: ${anchor}`);
  const bytes = sourceBytes.subarray(clause.sourceRef.startByte, clause.sourceRef.endByteExclusive);
  assert.equal(clause.text, bytes.toString('utf8'));
  assert.equal(clause.sourceRef.exactTextHash, `sha256:${sourceHash(bytes)}`);
  return clause;
};

for (const [line, anchor] of [[210, '不再增加'], [303, '不参与'], [519, '不 monkeypatch'],
  [553, '历史查询不进入'], [624, '不轮询'], [691, '不读取'], [700, '不携带'],
  [701, '不参与该决定'], [729, '不进入缓冲'], [738, '不添加'], [773, 'batch不包含'],
  [849, '主进程不做'], [1143, '不发布伪造值'], [1282, '状态不推进'], [1346, 'actual自动换月不递增']]) {
  test(`frozen source line ${line} preserves the explicit prohibition`, () => {
    assert.equal(realClause(line, anchor).polarity, 'forbidden');
  });
}

for (const [line, anchor] of [[228, '不封存'], [232, 'ABORTED'], [256, '崩溃重放'],
  [412, '历史 IPC'], [418, '不匹配时'], [454, '任何字段缺失'], [546, '串行'],
  [552, '聚合 admission'], [591, '内部 replay'], [655, 'Queue 消息'], [662, 'Recorder 按'],
  [701, 'checkpoint 只保存'], [815, '解析入口迁到'], [860, '验证失败则拒绝'],
  [903, '删除只含'], [1101, 'buffer overrun'], [1107, '缓存Tick replay'],
  [1174, '同一精确范围'], [1182, 'coverage计算'], [1255, 'DataService为'],
  [1278, '不命中当前'], [1358, '普通query失败'], [1362, '不同但相交range']]) {
  test(`frozen source line ${line} preserves action and prohibition components`, () => {
    const clause = realClause(line, anchor);
    assert.ok(clause.modalities.includes('required'), `missing action: ${clause.text}`);
    assert.ok(clause.modalities.includes('forbidden'), `missing boundary: ${clause.text}`);
    assert.equal(clause.polarity, 'mixed');
  });
}

for (const [line, anchor] of [[1095, 'PROCESS_READY之后'], [1318, '可合并']]) {
  test(`frozen source line ${line} preserves permission alongside prohibition`, () => {
    assert.deepEqual(realClause(line, anchor).modalities, ['forbidden', 'permitted']);
  });
}

test('frozen source adjective and explicit positive child are not negated', () => {
  assert.equal(realClause(346, '不依赖缺口的增量').polarity, 'required');
  const child = realClause(267, '只复用一个 bounded');
  assert.equal(child.polarity, 'required');
  assert.ok(child.conditions.some((condition) => condition.kind === 'prohibited_alternatives'));
});

for (const source of ['无法打开数据库时返回 BLOCKED。', '不能连接服务时必须返回 BLOCKED。',
  '如果不能证明输入有效，则返回 BLOCKED。', 'If the database cannot be opened, return BLOCKED.']) {
  test(`negative antecedent does not prohibit its required response: ${source}`, () => {
    const clause = compile(Buffer.from(`# Rules\n\nREQ-X-01: ${source}\n`)).sourceBlocks.flatMap((row) => row.clauses).at(-1);
    assert.equal(clause.polarity, 'required');
    assert.ok(clause.conditions.some((condition) => condition.kind === 'source_condition'));
  });
}

test('negative expected state does not negate the assertion action', () => {
  assert.deepEqual(modalitiesOf('断言 C 不补写、D 写入。'), ['required']);
  assert.deepEqual(modalitiesOf('Assert that the worker does not publish stale data.'), ['required']);
  assert.equal(realClause(743, '断言C不补写').polarity, 'required');
});

test('a temporal adjunct inside a prohibited action is not an incapability antecedent', () => {
  assert.deepEqual(modalitiesOf('不能在冷启动时发布结果。'), ['forbidden']);
  assert.deepEqual(modalitiesOf('不能在检查失败时调用旧处理器。'), ['forbidden']);
});

test('an explicit absent repository authority is descriptive, not an implementation action', () => {
  assert.equal(realClause(932, '仓库没有冻结的全局lint权威').polarity, 'descriptive');
});

test('authority absence facts stay separate from commands and conditional responses', () => {
  for (const [source, expected] of [['项目尚无冻结的验证基线。', 'descriptive'],
    ['The repository has no frozen verification baseline.', 'descriptive'],
    ['仓库不得使用过期权威。', 'forbidden'],
    ['如果仓库没有冻结权威，则返回 BLOCKED。', 'required'],
    ['If the database cannot be opened, do not publish results.', 'forbidden']]) {
    const clauses = compile(Buffer.from(`# Rules\n\n${source}\n`)).sourceBlocks.flatMap((row) => row.clauses);
    assert.equal(clauses.at(-1).polarity, expected, source);
  }
});

test('real peer requirements never inherit the previous peer as their semantic owner', () => {
  for (const id of ['REQ-GAP-002', 'REQ-IND-002', 'REQ-COLD-004']) {
    const block = real.sourceBlocks.find((row) => row.declaredId === id);
    assert.equal(block.scope.ownerId, id);
  }
});

test('conjunctions preserve positive and negative predicates without inventing permission', () => {
  assert.deepEqual(modalitiesOf('必须保留当前 stream 且不得重启进程。'), ['required', 'forbidden']);
  assert.deepEqual(modalitiesOf('可以读取缓存但不能修改旧值。'), ['forbidden', 'permitted']);
  assert.deepEqual(modalitiesOf('不得伪装成可由历史数据补回的事件。'), ['forbidden']);
  assert.deepEqual(modalitiesOf('发布不依赖外部服务的增量。'), ['required']);
});

test('relationship columns preserve source bytes but never become action clauses', () => {
  const rows = real.sourceBlocks.filter((row) => row.kind === 'table_row' && /AUDIT-[BM]\d+/u.test(row.text));
  assert.equal(rows.length, 24);
  for (const row of rows) {
    const binding = row.text.split('|').at(-2).trim();
    const bindingClauses = row.clauses.filter((clause) => clause.text.replace(/\|/gu, '').trim() === binding);
    assert.ok(bindingClauses.every((clause) => clause.polarity === 'descriptive'
      && clause.modalities.every((mode) => mode === 'descriptive')), binding);
    assert.ok(!row.clauses.some((clause) => clause.text.replace(/\|/gu, '').trim() === row.declaredId
      && clause.polarity !== 'descriptive'));
    assert.ok(row.clauses.some((clause) => clause.disposition === 'normative'));
  }
  assert.equal(real.sourceCoverage.coveredBytes, sourceBytes.length);
});

test('new peer declarations own themselves and their following child rules', () => {
  const result = compile(Buffer.from('# Rules\n\nREQ-X-01: 保留结果。\n\nREQ-X-02: 发布结果。\n\n- 不修改原文。\n'));
  const peer = result.sourceBlocks.find((row) => row.declaredId === 'REQ-X-02');
  const child = result.sourceBlocks.find((row) => row.text.includes('- 不修改原文'));
  assert.equal(peer.scope.ownerId, 'REQ-X-02');
  assert.equal(child.scope.ownerId, 'REQ-X-02');
  assert.ok(!result.sourceRelations.some((edge) => edge.kind === 'declared_owner' && edge.fromId === peer.id && edge.toId === 'REQ-X-01'));
});

test('fixture declarations are not Fix relationship labels and commands stay unexecuted', () => {
  const result = compile(Buffer.from('# Rules\n\nFIXTURE-001: `data/input.parquet`。\n\n- Fix: FIX-01。\n\n## Required Commands\n\n```sh\nnode --test test-only.js\n```\n'));
  assert.notEqual(result.sourceBlocks.find((row) => row.declaredId === 'FIXTURE-001').fieldRole, 'fix_reference');
  assert.equal(result.sourceBlocks.find((row) => row.text.includes('- Fix:')).fieldRole, 'fix_reference');
  assert.ok(result.sourceBlocks.flatMap((row) => row.commandDeclarations).every((row) => row.executionStatus === 'source_declared_not_executed'));
});
