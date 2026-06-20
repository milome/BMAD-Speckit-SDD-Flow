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
exports.loadForbiddenWords = loadForbiddenWords;
exports.validateForbiddenWords = validateForbiddenWords;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
/** TB.5 scheme 2: user-visible coach output is English; terms cover CN audit text and EN output. */
const DEFAULT_FORBIDDEN_WORDS = {
    dominant_terms: ['面试', '面试官', '应聘', '候选人', 'interview', 'interviewer', 'candidate'],
    ambiguous_terms: [
        '可选',
        '可考虑',
        '后续',
        '先实现',
        '后续扩展',
        '待定',
        '酌情',
        '视情况',
        '技术债',
        'optional',
        'TBD',
        'later',
        'maybe',
    ],
};
function resolveForbiddenPath(forbiddenWordsPath) {
    if (forbiddenWordsPath == null || forbiddenWordsPath === '') {
        return path.resolve(process.cwd(), 'packages', 'scoring', 'coach', 'forbidden-words.yaml');
    }
    return path.isAbsolute(forbiddenWordsPath)
        ? forbiddenWordsPath
        : path.resolve(process.cwd(), forbiddenWordsPath);
}
function uniqueMatches(text, terms) {
    const hits = [];
    for (const term of terms) {
        if (text.includes(term) && !hits.includes(term)) {
            hits.push(term);
        }
    }
    return hits;
}
/**
 * Load forbidden words from YAML.
 * @param {string} [forbiddenWordsPath] - Optional path; defaults to scoring/coach/forbidden-words.yaml
 * @returns {ForbiddenWords} ForbiddenWords
 */
function loadForbiddenWords(forbiddenWordsPath) {
    const filePath = resolveForbiddenPath(forbiddenWordsPath);
    if (!fs.existsSync(filePath)) {
        return { ...DEFAULT_FORBIDDEN_WORDS };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    if (parsed == null || typeof parsed !== 'object') {
        return { ...DEFAULT_FORBIDDEN_WORDS };
    }
    return {
        dominant_terms: parsed.dominant_terms ?? DEFAULT_FORBIDDEN_WORDS.dominant_terms,
        ambiguous_terms: parsed.ambiguous_terms ?? DEFAULT_FORBIDDEN_WORDS.ambiguous_terms,
    };
}
/**
 * Validate text against forbidden words.
 * @param {string} text - Text to validate
 * @param {ForbiddenWords} [words] - ForbiddenWords; defaults to built-in
 * @returns {ForbiddenValidationResult} ForbiddenValidationResult with passed, violations, warnings
 */
function validateForbiddenWords(text, words = DEFAULT_FORBIDDEN_WORDS) {
    const violations = uniqueMatches(text, words.dominant_terms);
    const warnings = uniqueMatches(text, words.ambiguous_terms);
    return {
        passed: violations.length === 0,
        violations,
        warnings,
    };
}
