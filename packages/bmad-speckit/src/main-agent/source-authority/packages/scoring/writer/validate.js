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
exports.validateRunScoreRecord = validateRunScoreRecord;
exports.validateScenarioConstraints = validateScenarioConstraints;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_1 = require("../constants/path");
let validateFn;
function getValidate() {
    if (validateFn)
        return validateFn;
    const schemaDir = (0, path_1.resolveSchemaDir)();
    const schemaPath = path.join(schemaDir, 'run-score-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new ajv_1.default();
    (0, ajv_formats_1.default)(ajv);
    validateFn = ajv.compile(schema);
    return validateFn;
}
/**
 * Validate record against run-score-schema. Throws if invalid.
 * @param {unknown} record - Unknown value to validate
 * @throws {Error} If validation fails
 * @returns {void}
 */
function validateRunScoreRecord(record) {
    const validate = getValidate();
    const ok = validate(record);
    if (!ok) {
        const err = validate.errors;
        throw new Error(`RunScoreRecord validation failed: ${JSON.stringify(err)}`);
    }
}
/**
 * Validate scenario constraints (Story 4.3 spec §2.1).
 * scenario must be real_dev | eval_question; when eval_question, question_version required.
 * @param {RunScoreRecord} record - RunScoreRecord to validate
 * @throws {Error} If constraints violated
 * @returns {void}
 */
function validateScenarioConstraints(record) {
    if (record.scenario !== 'real_dev' && record.scenario !== 'eval_question') {
        throw new Error(`validateScenarioConstraints: scenario must be real_dev or eval_question, got ${record.scenario}`);
    }
    if (record.scenario === 'eval_question') {
        const qv = record.question_version;
        if (qv == null || (typeof qv === 'string' && qv.trim() === '')) {
            throw new Error('validateScenarioConstraints: question_version 必填 when scenario=eval_question');
        }
    }
}
