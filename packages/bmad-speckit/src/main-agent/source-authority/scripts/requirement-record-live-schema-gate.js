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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequirementRecordSchemaObject = validateRequirementRecordSchemaObject;
exports.validateRequirementRecordSchema = validateRequirementRecordSchema;
exports.mainRequirementRecordLiveSchemaGate = mainRequirementRecordLiveSchemaGate;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function schemaPath() {
    return path.resolve(__dirname, '..', '_bmad', '_schemas', 'requirement-record.schema.json');
}
function compileValidator() {
    const schema = readJson(schemaPath());
    const ajv = new _2020_1.default({ allErrors: true, strict: false });
    (0, ajv_formats_1.default)(ajv);
    return ajv.compile(schema);
}
function validateRequirementRecordSchemaObject(record) {
    const validate = compileValidator();
    const ok = validate(record);
    const errors = (validate.errors ?? []);
    return { ok, errorCount: errors.length, errors };
}
function validateRequirementRecordSchema(recordPath) {
    return validateRequirementRecordSchemaObject(readJson(recordPath));
}
function isDirectCli(entry) {
    return /(^|[\\/])requirement-record-live-schema-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
function mainRequirementRecordLiveSchemaGate(argv) {
    const recordArg = argv.find((arg) => !arg.startsWith('--'));
    const json = argv.includes('--json');
    if (!recordArg || argv.includes('--help') || argv.includes('-h')) {
        console.log('Usage: requirement-record-live-schema-gate <requirement-record.json> [--json]');
        return recordArg ? 0 : 2;
    }
    const recordPath = path.resolve(recordArg);
    const result = validateRequirementRecordSchema(recordPath);
    const output = {
        ok: result.ok,
        requirementRecordPath: recordPath.replace(/\\/gu, '/'),
        errorCount: result.errorCount,
        errors: result.errors.slice(0, 50),
    };
    process.stdout.write(json
        ? `${JSON.stringify(output, null, 2)}\n`
        : `requirement_record_schema=${result.ok ? 'pass' : 'fail'} errors=${result.errorCount}\n`);
    return result.ok ? 0 : 1;
}
if (require.main === module && isDirectCli(process.argv[1])) {
    try {
        process.exitCode = mainRequirementRecordLiveSchemaGate(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
