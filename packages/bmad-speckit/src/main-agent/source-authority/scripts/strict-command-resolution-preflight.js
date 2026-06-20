"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainStrictCommandResolutionPreflight = mainStrictCommandResolutionPreflight;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const requirement_record_control_store_1 = require("./requirement-record-control-store");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h')
            out.help = true;
        else if (arg === '--json')
            out.json = true;
        else if (arg.startsWith('--')) {
            const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
            const value = argv[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error(`Missing value for ${arg}`);
            out[key] = value;
            index += 1;
        }
        else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }
    return out;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function nested(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function extractImplementationConfirmation(sourceText) {
    const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
    const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
    if (start < 0)
        throw new Error('missing implementationConfirmation block');
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === '')
            continue;
        if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
            end = index;
            break;
        }
    }
    const parsed = yaml.load(lines.slice(start, end).join('\n'));
    const confirmation = nested(parsed?.implementationConfirmation);
    if (Object.keys(confirmation).length === 0) {
        throw new Error('implementationConfirmation block is not valid YAML');
    }
    return confirmation;
}
function resolveSourcePath(record, explicitSource) {
    const source = text(explicitSource) || text(record.sourcePath);
    if (!source)
        throw new Error('source path missing; pass --source or set sourcePath in requirement record');
    return path.resolve(source);
}
function packageScripts(projectRoot) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath))
        return {};
    const parsed = readJson(packageJsonPath);
    const scripts = nested(parsed.scripts);
    return Object.fromEntries(Object.entries(scripts).map(([key, value]) => [key, text(value)]));
}
function globToRegExp(pattern) {
    const normalized = normalizePathForRecord(pattern);
    let out = '^';
    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const next = normalized[index + 1];
        if (char === '*' && next === '*') {
            out += '.*';
            index += 1;
        }
        else if (char === '*') {
            out += '[^/]*';
        }
        else if (char === '?') {
            out += '[^/]';
        }
        else {
            out += char.replace(/[\\^$+?.()|[\]{}]/gu, '\\$&');
        }
    }
    return new RegExp(`${out}$`, 'u');
}
function listFiles(root) {
    const files = [];
    const visit = (directory) => {
        if (!fs.existsSync(directory))
            return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === '.git')
                continue;
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory())
                visit(entryPath);
            else
                files.push(normalizePathForRecord(path.relative(root, entryPath)));
        }
    };
    visit(root);
    return files;
}
function globMatches(root, glob) {
    const normalized = normalizePathForRecord(glob);
    if (!/[?*]/u.test(normalized)) {
        const absolute = path.resolve(root, normalized);
        return fs.existsSync(absolute) ? [normalized] : [];
    }
    const regex = globToRegExp(normalized);
    return listFiles(root).filter((file) => regex.test(file));
}
function looksPlaceholder(command) {
    const normalized = command.trim().toLowerCase();
    return (normalized.length === 0 ||
        /^todo\b/u.test(normalized) ||
        /^tbd\b/u.test(normalized) ||
        normalized.includes('<source-document.md>') ||
        normalized.includes('<requirement-record.json>') ||
        normalized.includes('<confirmation.html>') ||
        normalized.includes('<skill-dir>') ||
        normalized.includes('<encoding-integrity-guardian-dir>') ||
        normalized.includes('placeholder'));
}
function resolveSkillDir(projectRoot, skillName) {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const packageRoot = path.resolve(__dirname, '..');
    const candidates = [
        path.join(projectRoot, '.codex', 'skills', skillName),
        path.join(projectRoot, '.cursor', 'skills', skillName),
        path.join(projectRoot, '.claude', 'skills', skillName),
        path.join(projectRoot, '_bmad', 'skills', skillName),
        path.join(projectRoot, '.agents', 'skills', skillName),
        path.join(packageRoot, '.codex', 'skills', skillName),
        path.join(packageRoot, '.cursor', 'skills', skillName),
        path.join(packageRoot, '.claude', 'skills', skillName),
        path.join(packageRoot, '_bmad', 'skills', skillName),
        ...(home
            ? [
                path.join(home, '.codex', 'skills', skillName),
                path.join(home, '.cursor', 'skills', skillName),
                path.join(home, '.claude', 'skills', skillName),
                path.join(home, '.agents', 'skills', skillName),
            ]
            : []),
    ];
    return (candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md'))) ?? candidates[0]);
}
function commandTemplateValues(input) {
    const render = nested(input.confirmation.confirmationRender);
    const htmlPath = text(render.htmlPath) ||
        path.join(path.dirname(input.recordPath), 'confirmation', 'confirmation.html');
    return {
        '<source-document.md>': normalizePathForRecord(input.sourcePath),
        '<requirement-record.json>': normalizePathForRecord(input.recordPath),
        '<confirmation.html>': normalizePathForRecord(htmlPath),
        '<recordId>': text(input.record.recordId) || text(input.confirmation.recordId),
        '<requirementSetId>': text(input.record.requirementSetId) ||
            text(input.confirmation.requirementSetId) ||
            text(input.record.recordId),
        '<skill-dir>': normalizePathForRecord(resolveSkillDir(input.root, 'requirements-contract-authoring')),
        '<encoding-integrity-guardian-dir>': normalizePathForRecord(resolveSkillDir(input.root, 'encoding-integrity-guardian')),
    };
}
function resolveCommandTemplate(command, replacements) {
    let resolved = command;
    for (const [placeholder, replacement] of Object.entries(replacements)) {
        resolved = resolved.split(placeholder).join(replacement);
    }
    return resolved;
}
function resolveCommand(input) {
    const commandId = text(input.command.commandId ?? input.command.id);
    const commandText = resolveCommandTemplate(text(input.command.command), input.replacements);
    const mustResolve = nested(input.command.mustResolve);
    const entrypoints = strings(input.command.entrypoints).map((entrypoint) => resolveCommandTemplate(entrypoint, input.replacements));
    const testGlobs = strings(input.command.testGlobs).map((glob) => resolveCommandTemplate(glob, input.replacements));
    const scriptNames = strings(input.command.packageScripts);
    const issues = [];
    const resolvedEntrypoints = entrypoints.map((entrypoint) => ({
        path: normalizePathForRecord(entrypoint),
        exists: fs.existsSync(path.resolve(input.root, entrypoint)),
    }));
    const resolvedScripts = scriptNames.map((scriptName) => ({
        scriptName,
        exists: Object.prototype.hasOwnProperty.call(input.scripts, scriptName),
        command: input.scripts[scriptName] ?? null,
    }));
    const resolvedTestGlobs = testGlobs.map((glob) => ({
        glob,
        matches: globMatches(input.root, glob),
    }));
    if (!commandId)
        issues.push('command_id_missing');
    if (!commandText)
        issues.push('command_text_missing');
    if (looksPlaceholder(commandText))
        issues.push('command_placeholder_or_unsubstituted_token');
    if (mustResolve.entrypointsExist === true && entrypoints.length === 0) {
        issues.push('entrypoints_required_but_missing');
    }
    for (const entrypoint of resolvedEntrypoints) {
        if (!entrypoint.exists)
            issues.push(`entrypoint_missing:${entrypoint.path}`);
    }
    if (mustResolve.packageScriptsExist === true && scriptNames.length === 0) {
        issues.push('package_scripts_required_but_missing');
    }
    for (const script of resolvedScripts) {
        if (!script.exists)
            issues.push(`package_script_missing:${script.scriptName}`);
        else if (looksPlaceholder(text(script.command))) {
            issues.push(`package_script_placeholder:${script.scriptName}`);
        }
    }
    if (mustResolve.testFilesExist === true && testGlobs.length === 0) {
        issues.push('test_globs_required_but_missing');
    }
    for (const glob of resolvedTestGlobs) {
        if (glob.matches.length === 0)
            issues.push(`test_glob_empty:${glob.glob}`);
    }
    return {
        commandId,
        command: commandText,
        kind: text(input.command.kind),
        passed: issues.length === 0,
        issues,
        resolvedEntrypoints,
        resolvedPackageScripts: resolvedScripts,
        resolvedTestGlobs,
    };
}
function evaluate(input) {
    const requiredCommands = objects(input.confirmation.requiredCommands);
    const scripts = packageScripts(input.root);
    const replacements = commandTemplateValues({
        record: input.record,
        confirmation: input.confirmation,
        root: input.root,
        sourcePath: input.sourcePath,
        recordPath: input.recordPath,
    });
    const commands = requiredCommands.map((command) => resolveCommand({ command, root: input.root, scripts, replacements }));
    const blockingReasons = commands.flatMap((command) => strings(command.issues).map((issue) => `command_unresolved:${text(command.commandId) || '<missing>'}:${issue}`));
    const requiredIds = new Set(objects(input.confirmation.traceRows).flatMap((trace) => [
        ...strings(trace.contractValidationCommandRefs),
        ...strings(trace.deliveryEvidenceCommandRefs),
    ]));
    const definedIds = new Set(commands.map((command) => text(command.commandId)).filter(Boolean));
    for (const commandId of requiredIds) {
        if (!definedIds.has(commandId))
            blockingReasons.push(`command_ref_missing:${commandId}`);
    }
    const hashChecks = [
        {
            id: 'source-document-hash-current',
            passed: text(input.record.sourceDocumentHash) === text(input.confirmation.sourceDocumentHash),
        },
        {
            id: 'implementation-confirmation-hash-current',
            passed: text(input.record.implementationConfirmationHash) ===
                text(input.confirmation.implementationConfirmationHash),
        },
    ];
    for (const check of hashChecks) {
        if (!check.passed)
            blockingReasons.push(check.id);
    }
    return {
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons: [...new Set(blockingReasons)],
        checks: [
            {
                id: 'required-commands-present',
                passed: requiredCommands.length > 0,
                count: requiredCommands.length,
            },
            {
                id: 'all-trace-command-refs-defined',
                passed: [...requiredIds].every((id) => definedIds.has(id)),
                requiredCommandRefs: [...requiredIds],
            },
            ...hashChecks,
            ...commands.map((command) => ({
                id: `command-resolution:${text(command.commandId) || '<missing>'}`,
                passed: command.passed === true,
                issues: strings(command.issues),
            })),
        ],
        commands,
    };
}
function updateRecord(record, input) {
    const gateCheck = {
        eventType: 'gate_check_recorded',
        checkId: `strict-command-resolution-preflight:${input.evaluatedAt}`,
        gate: 'Strict Command Resolution Preflight',
        decision: input.decision,
        blockingReasons: input.blockingReasons,
        checks: input.checks,
        reportPath: normalizePathForRecord(input.reportPath),
        sourceRefs: [{ sourceType: 'requirement_record', id: text(record.recordId) }],
        recordedAt: input.evaluatedAt,
        recordedBy: input.evaluatedBy,
    };
    return {
        ...record,
        gateChecks: [...objects(record.gateChecks), gateCheck],
        lastEventType: 'strict_command_resolution_preflight_recorded',
        updatedAt: input.evaluatedAt,
    };
}
function mainStrictCommandResolutionPreflight(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: strict-command-resolution-preflight --requirement-record <json> [--source <md>] [--json]');
        return 0;
    }
    if (!args.requirementRecord)
        throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    const record = readJson(recordPath);
    const sourcePath = resolveSourcePath(record, args.source);
    const confirmation = extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8'));
    const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
    const evaluatedBy = args.evaluatedBy ?? 'agent';
    const reportPath = path.resolve(args.reportPath ?? path.join(path.dirname(recordPath), 'runnable-command-report.json'));
    const evaluation = evaluate({
        record,
        confirmation,
        root: process.cwd(),
        sourcePath,
        recordPath,
    });
    const report = {
        reportType: 'strict_command_resolution_preflight',
        generatedAt: evaluatedAt,
        recordId: text(record.recordId),
        requirementSetId: text(record.requirementSetId),
        sourcePath: normalizePathForRecord(sourcePath),
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        commands: evaluation.commands,
    };
    writeJson(reportPath, report);
    const payload = {
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        reportPath,
        evaluatedAt,
        evaluatedBy,
    };
    const commit = (0, requirement_record_control_store_1.appendControlEventAndReplay)({
        recordPath,
        writerId: 'strict-command-resolution-preflight-writer',
        eventType: 'strict_command_resolution_preflight_recorded',
        recordedAt: evaluatedAt,
        payload,
        reduce: (currentRecord) => updateRecord(currentRecord, payload),
    });
    const output = {
        ok: true,
        reportPath: normalizePathForRecord(reportPath),
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        controlEventId: commit.event.eventId,
        controlEventHash: commit.event.eventHash,
        eventLogPath: normalizePathForRecord(commit.eventLogPath),
        receiptPath: normalizePathForRecord(commit.receiptPath),
    };
    process.stdout.write(args.json
        ? `${JSON.stringify(output, null, 2)}\n`
        : `strict_command_resolution=${evaluation.decision}\n`);
    return evaluation.decision === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainStrictCommandResolutionPreflight(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
