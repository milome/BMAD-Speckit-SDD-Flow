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
exports.REVIEWER_SHARED_CORE_PROFILE_PACK = exports.REVIEWER_SHARED_CORE_METADATA = exports.REVIEWER_SHARED_CORE_VERSION = void 0;
exports.readReviewerSharedCoreMetadata = readReviewerSharedCoreMetadata;
exports.readReviewerSharedCoreProfilePack = readReviewerSharedCoreProfilePack;
exports.reviewerSharedCoreBasePromptPath = reviewerSharedCoreBasePromptPath;
exports.assertReviewerSharedCoreMatchesContract = assertReviewerSharedCoreMatchesContract;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const reviewer_contract_1 = require("./reviewer-contract");
exports.REVIEWER_SHARED_CORE_VERSION = 'reviewer_shared_core_v1';
function repoRoot() {
    const candidates = [
        process.cwd(),
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '..', '..'),
        path.resolve(__dirname, '..', '..', '..'),
        path.resolve(__dirname, '..', '..', '..', '..'),
    ];
    const uniqueCandidates = [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
    for (const candidate of uniqueCandidates) {
        const marker = path.resolve(candidate, reviewer_contract_1.REVIEWER_SHARED_CORE_METADATA_PATH);
        if (fs.existsSync(marker)) {
            return candidate;
        }
    }
    return path.resolve(process.cwd());
}
function resolveRepoRelative(relativePath) {
    return path.resolve(repoRoot(), relativePath);
}
function readJsonFile(relativePath) {
    const absolutePath = resolveRepoRelative(relativePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Reviewer shared core file missing: ${relativePath}`);
    }
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}
function readReviewerSharedCoreMetadata() {
    return readJsonFile(reviewer_contract_1.REVIEWER_SHARED_CORE_METADATA_PATH);
}
function readReviewerSharedCoreProfilePack() {
    return readJsonFile(reviewer_contract_1.REVIEWER_SHARED_CORE_PROFILE_PACK_PATH);
}
function reviewerSharedCoreBasePromptPath() {
    return resolveRepoRelative(reviewer_contract_1.REVIEWER_SHARED_CORE_BASE_PROMPT_PATH);
}
function assertReviewerSharedCoreMatchesContract() {
    const metadata = readReviewerSharedCoreMetadata();
    const profiles = readReviewerSharedCoreProfilePack();
    if (metadata.version !== exports.REVIEWER_SHARED_CORE_VERSION) {
        throw new Error(`Reviewer shared core version mismatch: expected ${exports.REVIEWER_SHARED_CORE_VERSION}, got ${metadata.version}`);
    }
    if (metadata.identity !== reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY) {
        throw new Error(`Reviewer shared core identity mismatch: expected ${reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY}, got ${metadata.identity}`);
    }
    const profileIds = profiles.map((entry) => entry.profile);
    if (JSON.stringify(profileIds) !== JSON.stringify([...reviewer_contract_1.REVIEWER_PROFILES])) {
        throw new Error(`Reviewer shared core profile pack mismatch: expected ${JSON.stringify(reviewer_contract_1.REVIEWER_PROFILES)}, got ${JSON.stringify(profileIds)}`);
    }
}
exports.REVIEWER_SHARED_CORE_METADATA = readReviewerSharedCoreMetadata();
exports.REVIEWER_SHARED_CORE_PROFILE_PACK = readReviewerSharedCoreProfilePack();
assertReviewerSharedCoreMatchesContract();
