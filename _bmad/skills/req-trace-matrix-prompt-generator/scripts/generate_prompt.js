#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('./load-js-yaml');

const SKILL_LINE = '$executing-plans $verification-before-completion';
const COMMAND_PREFIXES = [
  'npm ',
  'npx ',
  'node ',
  'python ',
  'py ',
  'pnpm ',
  'yarn ',
  'rg ',
  'Get-ChildItem ',
  'pwsh ',
  'powershell ',
];

class BlockedInput extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.message = message;
  }
}

function parseArgs(argv) {
  const args = {
    finalGate: [],
    extraRule: [],
    noAutoCommit: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-auto-commit') {
      args.noAutoCommit = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (key === 'finalGate' || key === 'extraRule') {
      args[key].push(value);
    } else {
      args[key] = value;
    }
    index += 1;
  }

  const sourceInputs = [args.sourceDocument, args.contract, args.sourceFile].filter(Boolean);
  if (sourceInputs.length !== 1) {
    throw new Error('Provide exactly one of --source-document, --contract, or --source-file');
  }
  return args;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function displayPath(file) {
  return file.split(path.sep).join('/');
}

function unique(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function commandish(value) {
  const normalized = String(value ?? '').trim();
  return COMMAND_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function objects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function strings(value) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => String(item ?? '').trim()));
}

function block(code, message) {
  return `${code}\n${message}`;
}

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256(stableStringify(semanticConfirmationForHash(confirmation)));
}

function extractConfirmationBlock(text) {
  const lines = text.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_REQUIRED',
      'Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.'
    );
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function parseConfirmation(blockText) {
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object') {
    return { implementationConfirmation: {} };
  }
  return parsed;
}

function latestConfirmationEvent(record) {
  const history = record.confirmationHistory;
  if (!Array.isArray(history) || history.length === 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      'requirement-record.json must contain confirmationHistory[] before generating an implementation prompt.'
    );
  }
  const confirmations = history.filter(
    (item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded'
  );
  if (confirmations.length === 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      'requirement-record.json confirmationHistory[] has no confirmation_recorded event.'
    );
  }
  return confirmations.at(-1);
}

function validateRequirementRecord(args, sourceText, blockText, confirmation) {
  if (!args.requirementRecord) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_REQUIRED',
      '--requirement-record is required; source status alone is not sufficient authority.'
    );
  }

  const record = readJson(args.requirementRecord);
  const event = latestConfirmationEvent(record);
  const sourceHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const confirmationHash = implementationConfirmationHashFor(confirmation);
  const mismatches = [];

  if (event.sourceDocumentHash !== sourceHash) mismatches.push('sourceDocumentHash');
  if (event.implementationConfirmationHash !== confirmationHash) {
    mismatches.push('implementationConfirmationHash');
  }
  if (record.sourceDocumentHash && record.sourceDocumentHash !== sourceHash) {
    mismatches.push('record.sourceDocumentHash');
  }
  if (record.implementationConfirmationHash && record.implementationConfirmationHash !== confirmationHash) {
    mismatches.push('record.implementationConfirmationHash');
  }

  if (mismatches.length > 0) {
    throw new BlockedInput(
      'BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH',
      `Latest confirmationHistory[] hash does not match current source document: ${mismatches.join(', ')}`
    );
  }
}

function ids(items) {
  if (!Array.isArray(items)) return new Set();
  return new Set(items.filter((item) => item && item.id).map((item) => String(item.id)));
}

function validateConfirmation(parsed) {
  const confirmation = parsed.implementationConfirmation;
  if (!confirmation || typeof confirmation !== 'object') {
    throw new BlockedInput(
      'BLOCK: SOURCE_DOCUMENT_REQUIRED',
      'Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.'
    );
  }

  if (confirmation.status !== 'user_confirmed') {
    throw new BlockedInput('BLOCK: CONFIRMATION_REQUIRED', 'implementationConfirmation.status is not user_confirmed.');
  }

  const openQuestions = Array.isArray(confirmation.openQuestions) ? confirmation.openQuestions : [];
  if (openQuestions.some((item) => item?.blocksImplementation === true)) {
    throw new BlockedInput(
      'BLOCK: BLOCKING_QUESTIONS',
      'implementationConfirmation.openQuestions contains blocksImplementation=true.'
    );
  }

  const mustIds = ids(confirmation.must);
  const notDoneIds = ids(confirmation.notDone);
  const evidenceIds = ids(confirmation.evidence);
  const mustNotIds = ids(confirmation.mustNot);
  const allowedCoverIds = new Set([...mustIds, ...notDoneIds]);
  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  if (traceRows.length === 0) {
    throw new BlockedInput('BLOCK: TRACE_REFERENCE_INVALID', 'implementationConfirmation.traceRows is missing or empty.');
  }

  const invalid = [];
  const semanticKeys = new Set(['text', 'scenario', 'expected', 'expectedBehavior', 'requirement', 'description']);
  const semanticRows = [];

  for (const row of traceRows) {
    const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
    const covers = Array.isArray(row?.covers) ? row.covers : [];
    const evidenceRefs = Array.isArray(row?.evidenceRefs) ? row.evidenceRefs : [];
    for (const coverId of covers) {
      if (!allowedCoverIds.has(coverId)) {
        if (mustNotIds.has(coverId) || String(coverId).startsWith('OUT-')) {
          invalid.push(`${rowId}.covers:${coverId} (mustNot boundary IDs belong in boundaryViews or boundaryRefs)`);
        } else {
          invalid.push(`${rowId}.covers:${coverId}`);
        }
      }
    }
    for (const evidenceRef of evidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) invalid.push(`${rowId}.evidenceRefs:${evidenceRef}`);
    }
    if (Object.keys(row ?? {}).some((key) => semanticKeys.has(key))) {
      semanticRows.push(rowId);
    }
  }

  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: TRACE_REFERENCE_INVALID',
      `traceRows reference missing must/notDone/evidence IDs: ${invalid.join(', ')}`
    );
  }

  if (semanticRows.length > 0) {
    throw new BlockedInput(
      'BLOCK: TRACE_RESTATES_REQUIREMENTS',
      `traceRows contain new requirement semantics instead of references only: ${semanticRows.join(', ')}`
    );
  }

  return confirmation;
}

function renderFinalGates(commands) {
  return commands.map((command) => `    - ${command}`).join('\n');
}

function renderExtraRules(rules) {
  if (!rules.length) return '';
  return rules.map((rule, index) => `\n${index + 4}. ${rule}`).join('');
}

function commandId(command) {
  return String(command?.id ?? command?.commandId ?? '').trim();
}

function commandText(command) {
  return String(command?.command ?? command?.gate ?? '').trim();
}

function validateRequiredCommandDefinitions(confirmation) {
  const invalid = [];
  const duplicates = [];
  const seen = new Set();
  objects(confirmation.requiredCommands).forEach((command, index) => {
    const location = `requiredCommands[${index}]`;
    const id = commandId(command);
    if (!id) {
      invalid.push(`${location}.id`);
      return;
    }
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
    if (!commandText(command)) invalid.push(`${id}.command`);
  });
  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] entries must include id and runnable command text: ${invalid.join(', ')}`
    );
  }
  if (duplicates.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] IDs must be unique: ${unique(duplicates).join(', ')}`
    );
  }
}

function commandRegistry(confirmation) {
  const registry = new Map();
  for (const command of objects(confirmation.requiredCommands)) {
    const id = commandId(command);
    const text = commandText(command);
    if (id) registry.set(id, { id, command: text, source: 'required' });
  }
  for (const command of objects(confirmation.suggestedCommands)) {
    const id = commandId(command);
    const text = commandText(command);
    if (id && !registry.has(id)) registry.set(id, { id, command: text, source: 'suggested' });
  }
  return registry;
}

function validateCommandReferences(confirmation, registry) {
  const missing = [];
  const invalid = [];
  const requiredCommandIds = new Set(objects(confirmation.requiredCommands).map((command) => commandId(command)).filter(Boolean));
  const requireCommand = (ref, location) => {
    const command = registry.get(ref);
    if (!command || !requiredCommandIds.has(ref)) {
      missing.push(`${location}:${ref}`);
      return;
    }
    if (!command.command) invalid.push(`${location}:${ref}`);
  };
  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  for (const row of traceRows) {
    const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
    for (const ref of strings(row?.contractValidationCommandRefs)) {
      requireCommand(ref, `${rowId}.contractValidationCommandRefs`);
    }
    for (const ref of strings(row?.deliveryEvidenceCommandRefs)) {
      requireCommand(ref, `${rowId}.deliveryEvidenceCommandRefs`);
    }
  }
  for (const ref of strings(confirmation.closeoutReadinessPreview?.requiredCommands)) {
    requireCommand(ref, 'closeoutReadinessPreview.requiredCommands');
  }
  if (missing.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_REFERENCE_INVALID',
      `implementationConfirmation command references are missing from requiredCommands[]: ${missing.join(', ')}`
    );
  }
  if (invalid.length > 0) {
    throw new BlockedInput(
      'BLOCK: COMMAND_DEFINITION_INVALID',
      `implementationConfirmation requiredCommands[] entries must include runnable command text: ${invalid.join(', ')}`
    );
  }
}

function parseCommands(confirmation, extraGates, registry) {
  const commands = [];
  const previewCommandRefs = strings(confirmation.closeoutReadinessPreview?.requiredCommands);
  if (previewCommandRefs.length > 0) {
    for (const ref of previewCommandRefs) {
      const command = registry.get(ref);
      if (command?.command) commands.push(command.command);
    }
  } else {
    for (const command of objects(confirmation.requiredCommands)) {
      const text = commandText(command);
      if (text) commands.push(text);
    }
  }
  const evidence = Array.isArray(confirmation.evidence) ? confirmation.evidence : [];
  for (const item of evidence) {
    const gate = String(item?.gate ?? '').trim();
    if (gate && commandish(gate)) commands.push(gate);
  }
  commands.push(...extraGates);
  return unique(commands);
}

function renderRefs(values) {
  const refs = strings(values);
  return refs.length > 0 ? refs.join(', ') : '(none)';
}

function renderTraceRows(traceRows) {
  return traceRows
    .map((row) => {
      const rowId = String(row?.id ?? 'TRACE-UNKNOWN');
      return `${rowId}
covers: ${renderRefs(row?.covers)}
evidenceRefs: ${renderRefs(row?.evidenceRefs)}
taskRefs: ${renderRefs(row?.taskRefs)}
contract gates: ${renderRefs(row?.contractValidationCommandRefs)}
delivery gates: ${renderRefs(row?.deliveryEvidenceCommandRefs)}`;
    })
    .join('\n\n');
}

function renderRequiredCommands(confirmation) {
  const requiredCommands = objects(confirmation.requiredCommands).filter(
    (command) => commandId(command) || commandText(command)
  );
  if (requiredCommands.length === 0) return '(none declared; legacy evidence gates and --final-gate remain the only final gates)';
  return requiredCommands
    .map((command) => {
      const id = commandId(command) || 'CMD-UNKNOWN';
      const text = commandText(command) || '(missing command text; referenced commands are blocked before prompt generation)';
      return `${id}:
${text}`;
    })
    .join('\n\n');
}

function renderSuggestedCommands(confirmation) {
  const suggested = objects(confirmation.suggestedCommands).filter((command) => commandText(command));
  if (suggested.length === 0) return '';
  return `\nSuggested smoke only, not acceptance by itself:\n${suggested
    .map((command) => commandText(command))
    .join('\n')}\n`;
}

function auditPrompt(prompt) {
  const requiredFragments = [
    SKILL_LINE,
    'continue nonstop',
    '#implementationConfirmation',
    'Only ',
    'Do not implement prose, diagrams, or conversation content',
    'traceRows',
    'confirmed source traceRows are contract projection only',
    'Runtime closure authority is the requirement-record/control store',
    'must not rewrite confirmed source traceRows.status',
    'requirementClosures',
    'PASS requires evidence for covered must, notDone, and evidence IDs',
    'MISSING_EVIDENCE',
    'reconfirm_required',
    'Trace order:',
    '执行切片:',
    'Required commands:',
    'Completion Evidence Packet',
  ];
  return requiredFragments.filter((fragment) => !prompt.includes(fragment));
}

function buildPrompt(args) {
  if (args.sourceFile) {
    throw new BlockedInput(
      'BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT',
      'Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.'
    );
  }

  const sourcePath = args.sourceDocument || args.contract;
  const sourceText = readText(sourcePath);
  const blockText = extractConfirmationBlock(sourceText);
  const confirmation = validateConfirmation(parseConfirmation(blockText));
  validateRequirementRecord(args, sourceText, blockText, confirmation);
  const sourceLabel = args.sourceLabel || displayPath(sourcePath);
  const sourceAuthority = `${sourceLabel}#implementationConfirmation`;

  const traceRows = Array.isArray(confirmation.traceRows) ? confirmation.traceRows : [];
  const traceIds = traceRows.filter((row) => row?.id).map((row) => String(row.id));
  const traceText = traceIds.join(' -> ');
  validateRequiredCommandDefinitions(confirmation);
  const registry = commandRegistry(confirmation);
  validateCommandReferences(confirmation, registry);
  const gates = parseCommands(confirmation, args.finalGate, registry);
  if (gates.length === 0) {
    throw new BlockedInput(
      'BLOCK: FINAL_GATES_REQUIRED',
      'Final gate commands must be derived from implementationConfirmation.requiredCommands, closeoutReadinessPreview.requiredCommands, evidence, or --final-gate before PASS.'
    );
  }
  const commitRule = args.noAutoCommit
    ? '不要自动提交；只有用户明确要求提交时才提交，并且禁止 push。'
    : '改为 PASS 后立即本地提交一次，禁止 push。若源文档或用户指定 commit message 格式，严格使用该格式；否则使用仓库提交规范。';

  const prompt = `${SKILL_LINE}

continue nonstop

任务：严格执行 ${sourceAuthority} 的 confirmed traceRows，直到闭环验收完成。

Source of authority:
Only ${sourceAuthority} is authoritative.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

Trace order:
${traceText}

Trace closure authority:
confirmed source traceRows are contract projection only.
Runtime closure authority is the requirement-record/control store: record closure evidence through executionIterations, requirementClosures, gateChecks, contractChecks, deliveryEvidence.requiredCommands, artifactIndex, or project-equivalent governed fields.
The executor must not rewrite confirmed source traceRows.status or source evidence fields to represent runtime PASS/MISSING_EVIDENCE.

范围与意图锁定：
1. 只能实施 implementationConfirmation 中的 must/notDone/evidence/traceRows IDs，禁止实现未被确认块引用的 prose、diagram 或会话内容。
2. 禁止缩减范围、替换范围、改变原始需求、禁止把原始需求解释成更小交付。
3. 禁止 MVP downgrade、stub、mock-only、happy-path-only、representative-only coverage、later-batch coverage、seed-only coverage 或局部样例冒充完整交付。${renderExtraRules(args.extraRule)}

执行切片:
${renderTraceRows(traceRows)}

Required commands:
${renderRequiredCommands(confirmation)}
${renderSuggestedCommands(confirmation)}
强制执行规则：
1. 以 traceRows 为唯一主执行切片，按 ${traceText} 顺序推进。
2. 每个 TRACE 切片只能关闭其 covers/evidenceRefs 引用的 confirmed IDs。
3. taskRefs 完成不等于 requirement PASS。
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. 每完成一个 TRACE 切片，必须通过受控 runtime/control-store 记录 closure evidence；confirmed source traceRows.status 不得作为运行时 PASS/MISSING_EVIDENCE 回写目标。
6. ${commitRule}
7. 没有证据时 runtime closure 必须保持 open/PENDING 或记录 MISSING_EVIDENCE。
8. 严禁虚构验证结果、证据路径或 PASS 状态。
9. 如果需要改变 must/notDone/mustNot/evidence/traceRows 语义，必须把源文档状态改为 reconfirm_required 并停止。
10. 遇到测试失败、构建失败、审计失败、E2E 失败或 gate 失败时，自动使用 systematic-debugging 思路定位并修复；不要立刻停止询问。
11. 仅在真实阻塞时停止：缺少用户决策、需要语义变更、需要改 shared contract/schema/根配置且超出确认块、依赖无法安装或运行、外部约束与确认块冲突、或连续系统化修复后仍无法定位根因。
12. 每个 TRACE 切片结束必须运行该切片对应 gate。
13. 最终必须运行并记录结果：
${renderFinalGates(gates)}
14. 全部完成后输出 Completion Evidence Packet，至少包含关闭 IDs、开放 IDs、命令结果、E2E 证据、审计证据、残留风险和 scope changes。

现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。`;

  const missing = auditPrompt(prompt);
  if (missing.length > 0) {
    console.error(`Prompt audit failed. Missing fragments: ${missing.join(', ')}`);
    process.exit(2);
  }
  return prompt;
}

function main() {
  try {
    process.stdout.write(`${buildPrompt(parseArgs(process.argv.slice(2)))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof BlockedInput) {
      process.stdout.write(`${block(error.code, error.message)}\n`);
      return 3;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main();
}
