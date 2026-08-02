const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeRequirementSourceInput,
} = require('../source-authority/scripts/requirements-contract-model');

function normalizeText(value) {
  return String(value || '').trim();
}

function resolvePath(cwd, value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
}

function selectedInputs(args) {
  return [
    ['session_prompt', normalizeText(args.sessionPromptFile), 'file'],
    ['session_prompt', args.sessionPromptStdin === 'true' ? '<stdin>' : '', 'stdin'],
    ['prd_draft', normalizeText(args.prdDraft), 'file'],
    ['existing_contract', normalizeText(args.existingContract), 'file'],
    ['intake_document', normalizeText(args.intakeDocument), 'file'],
  ].filter((entry) => entry[1]);
}

function readInput(context, selected) {
  const [kind, rawPath, channel] = selected;
  if (channel === 'stdin') {
    return {
      kind,
      sourceText: fs.readFileSync(0, 'utf8'),
      sourcePath: null,
      inputChannel: 'stdin',
    };
  }
  const sourcePath = resolvePath(context.cwd, rawPath);
  return {
    kind,
    sourceText: fs.readFileSync(sourcePath, 'utf8'),
    sourcePath,
    inputChannel: 'file',
  };
}

function maybeWriteReceipt(context, receipt) {
  const output = resolvePath(context.cwd, context.args.out || context.args.output || '');
  if (!output) return null;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return output;
}

function requirementsContractSourceIntakeAction(context) {
  const inputs = selectedInputs(context.args);
  if (inputs.length === 0) {
    return {
      status: 'requirements_source_input_missing',
      exitCode: 2,
      errors: [
        {
          code: 'requirements_source_input_missing',
          message:
            'Provide exactly one of --session-prompt-file, --session-prompt-stdin, --prd-draft, --existing-contract, or --intake-document.',
        },
      ],
    };
  }
  if (inputs.length > 1) {
    return {
      status: 'requirements_source_input_conflict',
      exitCode: 2,
      errors: [
        {
          code: 'requirements_source_input_conflict',
          message: 'Requirement source intake accepts exactly one source input variant.',
          selectedInputs: inputs.map(([kind, value, channel]) => ({ kind, value, channel })),
        },
      ],
    };
  }

  const sourceInput = readInput(context, inputs[0]);
  const ast = normalizeRequirementSourceInput(sourceInput);
  const receipt = {
    schemaVersion: 'requirements-contract-source-intake-receipt/v1',
    status: 'requirements_source_intake_compiled',
    inputKind: ast.inputKind,
    inputChannel: ast.inputChannel,
    sourcePath: ast.sourcePath ? path.relative(context.cwd, ast.sourcePath).replace(/\\/g, '/') : null,
    sourceHash: ast.sourceHash,
    normalizedHash: ast.normalizedHash,
    modelHash: ast.normalizedHash,
    headingCount: ast.headings.length,
    blockCount: ast.blocks.length,
    pathCount: ast.paths.all.length,
    commandCount: ast.commands.all.length,
    canonicalIdCount: ast.canonicalIds.length,
    staleProjectionBoundaryCount: ast.staleProjectionBoundaries.length,
    ast,
  };
  const receiptPath = maybeWriteReceipt(context, receipt);
  return {
    status: 'requirements_source_intake_compiled',
    exitCode: 0,
    receiptPath,
    receipt,
  };
}

module.exports = {
  requirementsContractSourceIntakeAction,
};
