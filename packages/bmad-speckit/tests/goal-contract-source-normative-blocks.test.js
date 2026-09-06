const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');

const extract = (source) => extractSourceObligations({ snapshot: buildSourceSnapshot({
  sourceType: 'source_plan', sourcePath: 'docs/source.md', rawBytes: Buffer.from(source),
}) });
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

test('explicit task-local command, acceptance and evidence declarations bind only their nearest task', () => {
  const source = ['# Plan', '', '## Implementation Tasks', '',
    '### Task J01-T01: Implement actor authority', '',
    '- AC-J01-T01-01: Actor authority is deterministic.',
    '- EVD-J01-T01-01: Actor authority receipt.',
    '- CMD-J01-T01-01: Run `node --version`.', '',
    '### Task J02-T01: Implement judge transport', '', '#### Validation', '',
    '- AC-J02-T01-01: Judge transport is deterministic.',
    '- EVD-J02-T01-01: Judge transport receipt.',
    '- CMD-J02-T01-01: Run `npm --version`.', ''].join('\n');
  const result = extract(source);
  for (const taskId of ['J01-T01', 'J02-T01']) {
    const task = result.sourceObligations.find(row => row.id === taskId);
    const command = result.sourceObligations.find(row => row.id === `CMD-${taskId}-01`);
    const commandId = command.commandDeclarations[0].id;
    assert.deepEqual(task.acceptanceRefs, [`AC-${taskId}-01`]);
    assert.deepEqual(task.evidenceRefs, [`EVD-${taskId}-01`]);
    assert.deepEqual(task.commandRefs, [commandId]);
    const relation = result.sourceRelations.find(edge => edge.fromId === taskId && edge.toId === commandId);
    assert.equal(relation.derivationRuleId, 'nearest-declared-task-local-declaration/v1');
    assert.equal(relation.toType, 'command_declaration');
    assert.ok(relation.sourceBlockRefs.includes(task.sourceBlockRefs[0]));
    assert.ok(relation.sourceBlockRefs.includes(command.sourceBlockRefs[0]));
  }
});

test('task-local declaration binding excludes examples and does not borrow global commands', () => {
  const result = extract(['# Plan', '', '- CMD-GLOBAL-01: Run `node --version`.', '',
    '## Task J01-T01: Implement actor authority', '', '### Example', '',
    '- AC-EXAMPLE-01: Example acceptance.', '- EVD-EXAMPLE-01: Example evidence.',
    '- CMD-EXAMPLE-01: Run `npm --version`.', '',
    '## Task J02-T01: Implement judge transport', '', '- Preserve transport semantics.', ''].join('\n'));
  for (const taskId of ['J01-T01', 'J02-T01']) {
    const task = result.sourceObligations.find(row => row.id === taskId);
    assert.deepEqual(task.acceptanceRefs, []);
    assert.deepEqual(task.evidenceRefs, []);
    assert.deepEqual(task.commandRefs, []);
  }
});

test('explicit command aliases resolve to their own declarations without losing the original reference', () => {
  const result = extract(['# Plan', '', '## Task J01-T01: Implement actor authority', '',
    '- Commands: CMD-CHECK-01.', '', '## Registered Commands', '',
    '- CMD-CHECK-01: Run `node --version` and `npm --version`.', ''].join('\n'));
  const task = result.sourceObligations.find(row => row.id === 'J01-T01');
  const declaration = result.sourceObligations.find(row => row.id === 'CMD-CHECK-01');
  const expectedIds = declaration.commandDeclarations.map(command => command.id).sort();
  assert.equal(expectedIds.length, 2);
  assert.deepEqual(task.commandRefs, expectedIds);
  assert.ok(task.typedRefs.some(ref => ref.kind === 'command' && ref.targetId === 'CMD-CHECK-01'));
  for (const id of expectedIds) {
    const edge = result.sourceRelations.find(row => row.fromId === task.id && row.toId === id);
    assert.equal(edge.toType, 'command_declaration');
    assert.equal(edge.declaredCommandRef, declaration.id);
    assert.equal(edge.derivationRuleId, 'explicit-command-declaration-reference/v1');
    assert.ok(edge.sourceBlockRefs.includes(declaration.sourceBlockRefs[0]));
  }
});

test('an alias without a command invocation remains unresolved instead of borrowing another declaration', () => {
  const result = extract(['# Plan', '', '## Task J01-T01: Implement actor authority', '',
    '- Commands: CMD-CHECK-01.', '', '## Registered Commands', '',
    '- CMD-CHECK-01: Preserve the command name without inventing an invocation.',
    '- CMD-OTHER-01: Run `node --version`.', ''].join('\n'));
  const task = result.sourceObligations.find(row => row.id === 'J01-T01');
  assert.deepEqual(task.commandRefs, ['CMD-CHECK-01']);
  assert.equal(result.sourceRelations.some(edge => edge.fromId === task.id && edge.toType === 'command_declaration'), false);
});

test('target modification path lists retain exact owned paths and their indented field provenance', () => {
  const result = extract(['# Plan', '', '## Task J01-T01: Implement actor authority', '',
    '- Target modification paths:', '  - `src/runtime/actor.ts`', ''].join('\n'));
  const field = result.sourceBlocks.find(block => block.text.startsWith('- Target modification paths:'));
  const value = result.sourceBlocks.find(block => block.text.includes('`src/runtime/actor.ts`'));
  assert.equal(field.fieldRole, 'product_paths');
  assert.equal(value.fieldRole, 'product_paths');
  assert.equal(value.inheritedFieldFrom, field.id);
  assert.ok(value.parentBlockRefs.includes(field.id));
  const edge = result.sourceRelations.find(row => row.kind === 'path' && row.toId === 'src/runtime/actor.ts');
  assert.equal(edge.fromId, 'J01-T01');
  assert.equal(edge.pathRole, 'owned');
  assert.equal(edge.derivationRuleId, 'indented-path-field-inheritance/v1');
  assert.ok(edge.sourceBlockRefs.includes(field.id));
  assert.ok(edge.sourceBlockRefs.includes(value.id));
});

test('path field inheritance ends at sibling fields and task headings', () => {
  const result = extract(['# Plan', '', '## Task J01-T01: Implement actor authority', '',
    '- Target modification paths:', '  - `src/runtime/actor.ts`',
    '- Notes:', '  - `docs/not-owned.md`', '', '## Task J02-T01: Implement judge authority', '',
    '  - `src/runtime/not-declared.ts`', ''].join('\n'));
  const paths = result.sourceRelations.filter(edge => edge.kind === 'path' && edge.pathRole === 'owned');
  assert.deepEqual(paths.map(edge => edge.toId), ['src/runtime/actor.ts']);
});

test('nested readonly and forbidden path fields never become writable targets', () => {
  const result = extract(['# Plan', '', '## Task J01-T01: Implement actor authority', '',
    '- Target modification paths:', '  - `src/runtime/actor.ts`',
    '- 只读 fixture 路径:', '  - `fixtures/input.json`',
    '- Forbidden paths:', '  - `.git/config`', ''].join('\n'));
  const roles = Object.fromEntries(result.sourceRelations.filter(edge => edge.kind === 'path')
    .map(edge => [edge.toId, edge.pathRole]));
  assert.deepEqual(roles, { 'src/runtime/actor.ts': 'owned', 'fixtures/input.json': 'input', '.git/config': 'forbidden' });
});

test('source blocks partition original UTF-8 including layout, frontmatter, examples and tables', () => {
  const text = '---\r\nstatus: draft\r\n---\r\n# Plan\r\n\r\n## Requirements\r\n| ID | Rule |\r\n|---|---|\r\n| REQ-X-01 | MUST retain exact bytes. |\r\n\r\n## Example\r\n```json\r\n{"taskId":"EXAMPLE-T01"}\r\n```\r\n';
  const result = extract(text);
  assert.ok(Array.isArray(result.sourceBlocks));
  let offset = 0;
  for (const block of result.sourceBlocks) {
    const ref = block.sourceRef;
    assert.equal(ref.startByte, offset);
    const bytes = Buffer.from(text).subarray(offset, ref.endByteExclusive);
    assert.equal(ref.exactTextHash, sha256(bytes));
    assert.equal(block.text, bytes.toString('utf8'));
    assert.ok(block.disposition && block.reason);
    offset = ref.endByteExclusive;
  }
  assert.equal(offset, Buffer.byteLength(text));
  assert.deepEqual(result.sourceCoverage.uncoveredByteRanges, []);
  assert.ok(result.sourceObligations.some((row) => row.id === 'REQ-X-01'));
  assert.ok(!result.sourceObligations.some((row) => row.id === 'EXAMPLE-T01'));
});

test('Chinese child prohibitions survive observation headings and priority-list inheritance', () => {
  const result = extract('# Plan\n\n## 当前实现偏差\n\n- DataService 路径目前有重复决策。\n- DataService 不得写入权威数据。\n\n## 权威顺序\n\n发生冲突时必须按以下顺序裁决：\n\n1. 当前测试不得覆盖用户要求。\n2. 未提交文件不得自动成为验收权威。\n');
  const deviation = result.sourceBlocks.find((block) => block.text.includes('目前有重复'));
  const prohibited = result.sourceBlocks.filter((block) => block.kind === 'list_item' && block.text.includes('不得'));
  assert.equal(deviation.disposition, 'observed_deviation');
  for (const block of prohibited) {
    assert.ok(block.clauses.every((clause) => clause.polarity === 'forbidden'));
    assert.ok(block.clauses.every((clause) => clause.derivation.premiseBlockRefs.includes(block.id)));
  }
  const inherited = prohibited.find((block) => block.text.startsWith('1.'));
  assert.ok(inherited.clauses[0].conditions.some((condition) => condition.sourceBlockRefs.length));
});

test('Chinese clauses distinguish normative verbs from forbidden objects and quoted permission', () => {
  const result = extract('# Plan\n\nREQ-X-01：hot 使用 identity map；固定数量不能删除它。\n\nREQ-X-02：不得伪装成可由历史数据补回的事件。\n\nREQ-X-03：每个 Task 必须包含明确禁止行为和证据路径。\n\nREQ-X-04：不为普通 descriptor 建立 lease 或 TTL。\n');
  const clauses = (id) => {
    const obligation = result.sourceObligations.find((row) => row.id === id);
    return result.sourceBlocks.flatMap((block) => block.clauses).filter((clause) => obligation.clauseRefs.includes(clause.id));
  };
  assert.deepEqual(clauses('REQ-X-01').map((clause) => clause.polarity), ['required', 'forbidden']);
  assert.deepEqual(clauses('REQ-X-02')[0].modalities, ['forbidden']);
  assert.deepEqual(clauses('REQ-X-03')[0].modalities, ['required']);
  assert.deepEqual(clauses('REQ-X-04')[0].modalities, ['forbidden']);
});

test('task ownership and localized typed references carry exact source premises', () => {
  const result = extract('# Plan\n\n### WORK-01：建立基线\n\n### WORK-02：实现功能\n\n- 前置任务：`WORK-01`。\n- Acceptance：`AC-01`。\n- 红灯命令：`node --test tests/task.test.js`。\n\n### AC-01：基线保留\n\n- Goal Task：`WORK-02`。\n- 证据：`reports/task.json`。\n');
  const task = result.sourceObligations.find((row) => row.id === 'WORK-02');
  assert.equal(task.kind, 'declared_execution_task');
  assert.deepEqual(task.dependencyRefs, ['WORK-01']);
  assert.ok(task.typedRefs.some((ref) => ref.kind === 'dependency' && ref.targetId === 'WORK-01' && ref.sourceBlockRefs.length));
  assert.ok(result.sourceRelations.some((edge) => edge.fromType === 'obligation' && edge.fromId === 'WORK-02'
    && edge.toType === 'obligation' && edge.toId === 'WORK-01' && edge.sourceBlockRefs.length));
  assert.ok(!result.sourceObligations.some((row) => row.kind === 'declared_execution_task' && !/^WORK-/u.test(row.id)));
});

test('unqualified descriptive lists, tables and code do not become mandatory work', () => {
  const result = extract('# Notes\n\n## Background\n\n- The current cache uses a map.\n\n| Component | Description |\n|---|---|\n| Cache | Existing map |\n\n```json\n{"cache":"map"}\n```\n');
  for (const block of result.sourceBlocks.filter((row) => ['list_item', 'table_row', 'fence'].includes(row.kind))) {
    assert.ok(['structure', 'background', 'example', 'unresolved'].includes(block.disposition), block.disposition);
    assert.ok(block.clauses.every((clause) => ['descriptive', 'unresolved'].includes(clause.polarity)));
  }
  assert.ok(result.sourceObligations.every((row) => !row.required));
});

test('a heading that states an explicit prohibition remains an effective source requirement', () => {
  const result = extract('# Rules\n\n## Workers must not delete unrelated files\n');
  const heading = result.sourceBlocks.find((block) => block.text.includes('must not'));
  assert.equal(heading.disposition, 'normative');
  assert.ok(heading.clauses.some((clause) => clause.polarity === 'forbidden'));
  assert.ok(result.sourceObligations.some((row) => row.sourceBlockRefs.includes(heading.id)));
});

test('problem statements retain descriptive context without excluding explicit requirements', () => {
  const result = extract('# Plan\n\n## Problem Statement\n\nThe old implementation allowed optional paths.\n\nThe replacement must retain exact source bytes.\n');
  const observation = result.sourceBlocks.find((block) => block.text.includes('old implementation'));
  assert.equal(observation.disposition, 'background');
  assert.ok(!result.sourceObligations.some((row) => row.sourceBlockRefs.includes(observation.id)));
  assert.ok(result.sourceObligations.some((row) => row.exactText.includes('must retain') && row.polarity === 'required'));
});

test('explicit release blocking conditions remain conditional source boundaries', () => {
  const result = extract('# Plan\n\n## Decision\n\nThis repair blocks release until coverage passes.\n');
  const gate = result.sourceObligations.find((row) => row.exactText.includes('blocks release'));
  assert.ok(gate);
  assert.equal(gate.polarity, 'forbidden');
  assert.equal(gate.applicabilityState, 'conditional');
  assert.equal(gate.required, false);
  assert.equal(result.sourceCoverage.unresolvedBlockRefs.length, 0);
});

test('mixed permissions and pending conditions are not promoted to unconditional must', () => {
  const result = extract('# Plan\n\nREQ-X-01: The worker may inspect evidence, but must not modify it.\n\nREQ-X-02: If the user confirms this version, run the compiler.\n');
  const mixed = result.sourceObligations.find((row) => row.id === 'REQ-X-01');
  const conditional = result.sourceObligations.find((row) => row.id === 'REQ-X-02');
  assert.equal(mixed.normativeStrength, 'mixed');
  assert.equal(mixed.polarity, 'mixed');
  assert.equal(mixed.required, false);
  assert.equal(conditional.applicabilityState, 'conditional');
  assert.equal(conditional.required, false);
  assert.ok(conditional.semanticResolution.clauseRefs.length);
});

test('explicit file instructions and evidence preservation assign distinct source-backed path roles', () => {
  const result = extract('# Plan\n\n## File Map\n\n- Modify `src/export.ts`.\n- MUST NOT mutate `.git/**`.\n\n## Completion Evidence Packet\n\n- Preserve `reports/coverage.json` as the evidence receipt.\n\n## Background\n\n- The old report is `reports/previous.json`.\n');
  const roles = result.sourceRelations.filter((edge) => edge.toType === 'path');
  assert.ok(roles.some((edge) => edge.toId === 'src/export.ts' && edge.pathRole === 'owned'));
  assert.ok(roles.some((edge) => edge.toId === '.git/**' && edge.pathRole === 'forbidden'));
  assert.ok(roles.some((edge) => edge.toId === 'reports/coverage.json' && edge.pathRole === 'artifact'));
  assert.ok(!roles.some((edge) => edge.toId === 'reports/previous.json'));
  assert.ok(roles.every((edge) => edge.sourceBlockRefs.length && edge.sourceRef.exactTextHash));
});

test('multiple shell commands have individual exact spans and non-shell examples have none', () => {
  const result = extract('# Plan\n\n## Required Commands\n\n```powershell\nnode --version\nnode --test tests/export.test.js\n```\n\n## Example\n\n```text\nnode --version\n```\n');
  const declarations = result.sourceBlocks.flatMap((block) => block.commandDeclarations);
  assert.deepEqual(declarations.map((item) => item.invocation), ['node --version', 'node --test tests/export.test.js']);
  assert.ok(declarations.every((item) => item.sourceRef.lineStart === item.sourceRef.lineEnd));
  assert.ok(declarations.every((item) => item.executionStatus === 'source_declared_not_executed'));
});

test('FIX, requirement, scenario and declared ownership links remain typed without inventing tasks', () => {
  const result = extract('# Plan\n\n### FIX-01：修复读路径\n\nREQ-DATA-001：必须保留源数组。\n\n### AC-01-S01：源数组保留\n\n- 对应修复：FIX-01。\n- 对应工作包：WORK-01。\n\n### WORK-01：实现只读查询\n\n- 验收：AC-01-S01。\n- Purpose：落实REQ-DATA-001。\n');
  assert.ok(result.sourceRelations.some((edge) => edge.kind === 'fix' && edge.fromId === 'AC-01-S01' && edge.toId === 'FIX-01'));
  assert.ok(result.sourceRelations.some((edge) => edge.kind === 'requirement' && edge.fromId === 'WORK-01' && edge.toId === 'REQ-DATA-001'));
  assert.ok(result.sourceRelations.some((edge) => edge.kind === 'declared_owner' && edge.fromType === 'block' && edge.toId === 'FIX-01'));
  assert.deepEqual(result.sourceObligations.filter((row) => row.kind === 'declared_execution_task').map((row) => row.id), ['WORK-01']);
});

test('explicit acceptance path references and evidence basenames resolve only with source-backed declarations', () => {
  const result = extract('# Plan\n\n## AC-01: Input\n\n### AC-01-S01: Validate input\n\n- 测试nodeid：`tests/input.py::test_input`。\n- 证据：`reports/input/main.json`和`extra.json`。\n\n## AC-02: Output\n\n### AC-02-S01: Validate output\n\n- 测试nodeid：`tests/output.py::test_output`。\n\n## Tasks\n\n### WORK-01: Implement\n\n- 测试路径：AC-01至AC-02对应测试文件。\n- 产品路径：`src/main.ts`。\n\n### WORK-02: Remove old path\n\n- 产品路径：仅限WORK-01已列出的产品文件。\n- 测试路径：仅限WORK-01已列出的测试文件。\n');
  const paths = result.sourceRelations.filter((edge) => edge.toType === 'path');
  assert.ok(paths.some((edge) => edge.fromId === 'AC-01-S01' && edge.toId === 'reports/input/extra.json' && edge.pathRole === 'artifact'));
  for (const owner of ['WORK-01', 'WORK-02']) for (const file of ['tests/input.py', 'tests/output.py']) {
    const edge = paths.find((item) => item.fromId === owner && item.toId === file && item.pathRole === 'owned');
    assert.ok(edge, `${owner}: ${file}`);
    assert.ok(edge.sourceBlockRefs.length >= 2);
    assert.equal(edge.declarationStatus, 'derived');
  }
  assert.ok(paths.some((edge) => edge.fromId === 'WORK-02' && edge.toId === 'src/main.ts'));
  assert.ok(!paths.some((edge) => edge.fromId === 'AC-01-S01' && edge.toId === 'tests/input.py' && edge.pathRole === 'owned'));
});

test('command prefixes, aliases, bounded command sets and conditional selection do not imply execution authorization', () => {
  const result = extract('# Plan\n\n## 1. Acceptance\n\n### AC-01: Input\n\n- Command：`node --test tests/input.js`。\n\n## 2. Tasks\n\n### WORK-01: Implement\n\n- 红灯命令：`node --test tests/changed.js`。\n- 绿灯命令：同一命令必须通过AC-01。\n- 回归命令：`node --test tests/regression.js`。\n\n### WORK-02: Verify\n\n- 绿灯命令：逐scenario执行第1节精确命令。\n- 回归命令：执行WORK-01回归命令。\n- 红灯命令：每次删除前运行对应AC。\n\n## Rules\n\nDo not nest `pwsh -Command`; `$env:` is the environment prefix.\n');
  const commands = result.sourceBlocks.flatMap((block) => block.commandDeclarations);
  assert.deepEqual(commands.map((command) => command.invocation), ['node --test tests/input.js', 'node --test tests/changed.js', 'node --test tests/regression.js']);
  const byId = new Map(commands.map((command) => [command.id, command.invocation]));
  const alias = result.sourceBlocks.find((block) => block.text.startsWith('- 绿灯命令：同一'));
  assert.deepEqual(alias.typedRefs.filter((ref) => ref.kind === 'command').map((ref) => byId.get(ref.targetId)), ['node --test tests/changed.js']);
  const edges = result.sourceRelations.filter((edge) => edge.fromId === 'WORK-02');
  assert.deepEqual(edges.filter((edge) => edge.toType === 'command_declaration').map((edge) => byId.get(edge.toId)), ['node --test tests/input.js', 'node --test tests/regression.js']);
  assert.ok(edges.some((edge) => edge.kind === 'conditional_command_selection' && edge.resolutionStatus === 'conditional'));
  assert.ok(commands.every((command) => command.authorization !== 'authorized'));
});

test('all explicit test files in this section do not capture unrelated sections', () => {
  const result = extract('# Plan\n\n## First Tasks\n\n### WORK-01: First\n\n- 测试路径：`tests/first.py`。\n\n### WORK-02: Verify first\n\n- 测试路径：本节全部明确测试文件。\n\n## Other Tasks\n\n### WORK-03: Other\n\n- 测试路径：`tests/other.py`。\n');
  assert.deepEqual(result.sourceRelations.filter((edge) => edge.fromId === 'WORK-02' && edge.pathRole === 'owned').map((edge) => edge.toId), ['tests/first.py']);
});
