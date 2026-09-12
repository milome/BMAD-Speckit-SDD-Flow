const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { compileSourceBlocks } = require('../src/utils/goal-contract/source-normative-blocks.ts');

const compile = (text) => {
  const bytes = Buffer.from(text);
  return compileSourceBlocks({ sourceBytes: bytes, snapshot: buildSourceSnapshot({
    sourceType: 'source_plan', sourcePath: 'test-only/source-roles.md', rawBytes: bytes,
  }) });
};
const clauses = (text) => compile(`# Rules\n\n${text}\n`).sourceBlocks.flatMap((block) => block.clauses);

test('an optimization allowlist inherits permission without promoting noun phrases to execution', () => {
  const result = clauses('优化只能发生在以下位置：\n\n- 缓存读取和增量加载。\n- 数据发布。\n- 必须保留旧值。');
  assert.deepEqual(result.slice(1).map((clause) => clause.polarity), ['permitted', 'permitted', 'required']);
});

test('confirmation status is descriptive while its child restrictions remain enforceable', () => {
  const result = clauses('本文件当前状态为“待人工审阅”。用户明确确认本版本之前：\n\n- 不得执行生产命令。');
  assert.deepEqual(result.map((clause) => clause.polarity), ['descriptive', 'descriptive', 'forbidden']);
  assert.ok(result[2].conditions.some((condition) => condition.kind === 'source_confirmation_gate'));
});

test('direct assertions and PASS or FAIL criteria require the stated test state without forbidding the assertion', () => {
  for (const field of ['直接断言', 'PASS', 'FAIL']) {
    const result = clauses(`- ${field}：旧数据不进入数组；新数据必须存在。`);
    assert.deepEqual(result.map((clause) => clause.polarity), ['required', 'required']);
    assert.ok(result[0].expectedOutcome.assertionText.includes('不进入数组'));
  }
});

test('runnable artifacts are objects and confirmed-only execution is a mandatory condition, not MAY', () => {
  for (const text of ['必须保留可执行命令。', '把要求变成可执行证据。', '用户确认后，作者才可执行：']) {
    assert.equal(clauses(text)[0].polarity, 'required', text);
  }
});

test('source command set expansion includes all scoped scenario commands alongside a concrete command', () => {
  const result = compile('# Rules\n\n## Scenarios\n\n### AC-X-01: one\n\n- 红灯命令：`node --test tests/one.js`。\n\n### AC-X-02: two\n\n- 红灯命令：`node --test tests/two.js`。\n\n## Tasks\n\n### WORK-01: verify\n\n- 红灯命令：先运行各AC nodeid和`node --test tests/perf.js`。\n');
  const commands = new Map(result.sourceBlocks.flatMap((block) => block.commandDeclarations).map((command) => [command.id, command]));
  const selected = result.sourceRelations.filter((edge) => edge.fromId === 'WORK-01' && edge.kind === 'command')
    .map((edge) => commands.get(edge.toId)?.invocation).sort();
  assert.deepEqual(selected, ['node --test tests/one.js', 'node --test tests/perf.js', 'node --test tests/two.js']);
});

test('forbidden path membership is exact and never leaks to an unrelated task', () => {
  const result = compile('# Rules\n\n### WORK-01: preserve\n\n- 禁止路径：`private/**`、`data/store.db`。\n\n### WORK-02: execute\n\n- 产品路径：`src/two.ts`。\n');
  const paths = result.sourceRelations.filter((edge) => edge.toType === 'path');
  assert.deepEqual(paths.map((edge) => [edge.fromId, edge.toId, edge.pathRole]).sort(), [
    ['WORK-01', 'data/store.db', 'forbidden'], ['WORK-01', 'private/**', 'forbidden'], ['WORK-02', 'src/two.ts', 'owned'],
  ]);
  assert.ok(paths.every((edge) => edge.sourceBlockRefs.length === 1));
});

test('an independent source-scoped path oracle rejects omissions, widened scope and polarity mutations', () => {
  const result = compile('# Rules\n\n### WORK-01: preserve\n\n- 禁止路径：`private/**`、`data/store.db`。\n\n### WORK-02: execute\n\n- 产品路径：`src/two.ts`。\n');
  const paths = result.sourceRelations.filter((edge) => edge.toType === 'path');
  const expected = [['WORK-01', 'data/store.db', 'forbidden'], ['WORK-01', 'private/**', 'forbidden'], ['WORK-02', 'src/two.ts', 'owned']];
  const verify = (edges) => assert.deepEqual(edges.map((edge) => [edge.fromId, edge.toId, edge.pathRole]).sort(), expected);
  verify(paths);
  assert.throws(() => verify(paths.filter((edge) => edge.toId !== 'private/**')), assert.AssertionError);
  assert.throws(() => verify([...paths, { ...paths[0], fromId: 'WORK-02' }]), assert.AssertionError);
  assert.throws(() => verify(paths.map((edge) => edge.pathRole === 'forbidden' ? { ...edge, pathRole: 'owned' } : edge)), assert.AssertionError);
});

test('a banned wildcard scope expression does not prohibit the concrete authorized files beneath it', () => {
  const result = compile('# Rules\n\nREQ-X-01: 每个任务只选择精确文件。不得使用`src/**`或“必要文件”作为范围。\n\n### WORK-01: execute\n\n- 产品路径：`src/one.ts`。\n');
  const prohibition = result.sourceBlocks.flatMap((block) => block.clauses).find((clause) => clause.text.includes('不得使用'));
  assert.equal(prohibition.polarity, 'forbidden');
  assert.ok(!result.sourceRelations.some((edge) => edge.toId === 'src/**' && edge.pathRole === 'forbidden'));
  assert.ok(result.sourceRelations.some((edge) => edge.toId === 'src/one.ts' && edge.pathRole === 'owned'));
});

test('an inequality predicate remains independent of its negated subject and an outer prohibition', () => {
  for (const [text, expected] of [
    ['被过滤事件不进入缓存不等于历史缺口，不得触发恢复。', 'mixed'],
    ['被过滤事件不等于历史缺口。', 'required'],
    ['不得声称被过滤事件不等于历史缺口。', 'forbidden'],
  ]) assert.equal(clauses(text)[0].polarity, expected, text);
});

test('a descriptive tool purpose does not add execution work but a declared usage constraint remains required', () => {
  for (const text of ['- 单元测试用于定位算法错误，但不能替代端到端验收。',
    '- 图示用于解释架构，但不得作为实现证据。']) assert.equal(clauses(text)[0].polarity, 'forbidden', text);
  assert.equal(clauses('REQ-X-01: sequence用于cursor和诊断，不用于推断消息缺失。')[0].polarity, 'mixed');
});

test('an implicit expected state in a triggered acceptance scenario is required without erasing explicit prohibitions', () => {
  const result = clauses('**真实场景验收**\n\n- 关闭订阅后，后续消息仍存在于缓存但归档器不写库。\n- 禁止删除用户原始数据库。');
  assert.deepEqual(result.map((clause) => clause.polarity), ['required', 'forbidden']);
  assert.ok(result[0].conditions.some((condition) => condition.kind === 'source_condition'));
});
