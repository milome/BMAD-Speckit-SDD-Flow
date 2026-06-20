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
exports.governanceQueueDir = governanceQueueDir;
exports.governanceQueueBucketDir = governanceQueueBucketDir;
exports.governancePendingQueueFilePath = governancePendingQueueFilePath;
exports.governanceProcessingQueueFilePath = governanceProcessingQueueFilePath;
exports.governanceDoneQueueFilePath = governanceDoneQueueFilePath;
exports.governanceFailedQueueFilePath = governanceFailedQueueFilePath;
exports.governanceCurrentRunPath = governanceCurrentRunPath;
exports.governancePreContinueQueueFilePath = governancePreContinueQueueFilePath;
exports.ensureGovernanceQueueDirs = ensureGovernanceQueueDirs;
exports.readGovernanceCurrentRun = readGovernanceCurrentRun;
exports.appendGovernanceCurrentRun = appendGovernanceCurrentRun;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function governanceQueueDir(projectRoot) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}
function governanceQueueBucketDir(projectRoot, bucket) {
    return path.join(governanceQueueDir(projectRoot), bucket);
}
function governancePendingQueueFilePath(projectRoot, id) {
    return path.join(governanceQueueBucketDir(projectRoot, 'pending'), `${id}.json`);
}
function governanceProcessingQueueFilePath(projectRoot, id) {
    return path.join(governanceQueueBucketDir(projectRoot, 'processing'), `${id}.json`);
}
function governanceDoneQueueFilePath(projectRoot, id) {
    return path.join(governanceQueueBucketDir(projectRoot, 'done'), `${id}.json`);
}
function governanceFailedQueueFilePath(projectRoot, id) {
    return path.join(governanceQueueBucketDir(projectRoot, 'failed'), `${id}.json`);
}
function governanceCurrentRunPath(projectRoot) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'current-run.json');
}
function governancePreContinueQueueFilePath(projectRoot, id) {
    return path.join(governanceQueueBucketDir(projectRoot, 'pending'), `${id}.json`);
}
function ensureGovernanceQueueDirs(projectRoot) {
    for (const bucket of ['pending', 'processing', 'done', 'failed']) {
        fs.mkdirSync(governanceQueueBucketDir(projectRoot, bucket), { recursive: true });
    }
}
function readGovernanceCurrentRun(projectRoot) {
    const file = governanceCurrentRunPath(projectRoot);
    if (!fs.existsSync(file)) {
        return [];
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function appendGovernanceCurrentRun(projectRoot, entry) {
    const file = governanceCurrentRunPath(projectRoot);
    const current = readGovernanceCurrentRun(projectRoot);
    current.push(entry);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
}
