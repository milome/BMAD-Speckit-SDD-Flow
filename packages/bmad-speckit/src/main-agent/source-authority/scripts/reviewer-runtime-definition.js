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
exports.materializeReviewerDefinition = materializeReviewerDefinition;
exports.ensureReviewerRuntimeDefinition = ensureReviewerRuntimeDefinition;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const reviewer_contract_1 = require("./reviewer-contract");
function sourceRelativePath(host) {
    if (host === 'cursor')
        return reviewer_contract_1.CURSOR_REVIEWER_CANONICAL_SOURCE_PATH;
    if (host === 'codex')
        return reviewer_contract_1.CODEX_REVIEWER_CANONICAL_SOURCE_PATH;
    return reviewer_contract_1.CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH;
}
function targetRelativePath(host) {
    if (host === 'cursor')
        return reviewer_contract_1.CURSOR_REVIEWER_RUNTIME_TARGET_PATH;
    if (host === 'codex')
        return reviewer_contract_1.CODEX_REVIEWER_RUNTIME_TARGET_PATH;
    return reviewer_contract_1.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH;
}
function generatedHeader(host, metadata) {
    const body = `RUNTIME-MATERIALIZED reviewer source=${metadata.sourceRelativePath}` +
        ` shared_metadata=${reviewer_contract_1.REVIEWER_SHARED_CORE_METADATA_PATH}` +
        ` shared_profiles=${reviewer_contract_1.REVIEWER_SHARED_CORE_PROFILE_PACK_PATH}` +
        ` shared_prompt=${reviewer_contract_1.REVIEWER_SHARED_CORE_BASE_PROMPT_PATH}`;
    return host === 'codex' ? `# ${body}` : `<!-- ${body} -->`;
}
function injectGeneratedHeader(host, content, metadata) {
    const separator = content.includes('\r\n') ? '\r\n' : '\n';
    const header = generatedHeader(host, metadata);
    if (host === 'codex') {
        return `${header}${separator}${content}`;
    }
    if (content.startsWith(`---${separator}`)) {
        const closingMarker = `${separator}---${separator}`;
        const closingIndex = content.indexOf(closingMarker, 4);
        if (closingIndex >= 0) {
            const splitAt = closingIndex + closingMarker.length;
            return `${content.slice(0, splitAt)}${header}${separator}${content.slice(splitAt)}`;
        }
    }
    return `${header}${separator}${content}`;
}
function stripGeneratedHeader(content) {
    return content
        .replace(/<!-- RUNTIME-MATERIALIZED reviewer[\s\S]*? -->\r?\n?/u, '')
        .replace(/^# RUNTIME-MATERIALIZED reviewer[^\r\n]*(?:\r?\n)?/u, '');
}
function materializeReviewerDefinition(projectRoot, host) {
    const targetPath = path.join(projectRoot, targetRelativePath(host));
    const sourceRelative = sourceRelativePath(host);
    const sourcePath = path.join(projectRoot, sourceRelative);
    if (!fs.existsSync(sourcePath)) {
        return {
            host,
            targetPath,
            updated: false,
            skippedReason: `source asset missing: ${sourceRelative}`,
        };
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    const materialized = injectGeneratedHeader(host, stripGeneratedHeader(source), {
        sourceRelativePath: sourceRelative,
    });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (previous === materialized) {
        return {
            host,
            targetPath,
            sourceRelativePath: sourceRelative,
            updated: false,
        };
    }
    fs.writeFileSync(targetPath, materialized, 'utf8');
    return {
        host,
        targetPath,
        sourceRelativePath: sourceRelative,
        updated: true,
    };
}
function ensureReviewerRuntimeDefinition(projectRoot, options) {
    const hosts = options?.hosts ?? ['cursor', 'claude', 'codex'];
    return hosts.map((host) => {
        const runtimeDir = host === 'cursor'
            ? path.join(projectRoot, '.cursor', 'agents')
            : host === 'codex'
                ? path.join(projectRoot, '.codex', 'agents')
                : path.join(projectRoot, '.claude', 'agents');
        if (!fs.existsSync(runtimeDir)) {
            return {
                host,
                targetPath: path.join(projectRoot, targetRelativePath(host)),
                updated: false,
                skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
            };
        }
        return materializeReviewerDefinition(projectRoot, host);
    });
}
