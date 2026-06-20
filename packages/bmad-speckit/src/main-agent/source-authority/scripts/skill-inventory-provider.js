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
exports.resolveGovernanceSkillInventory = resolveGovernanceSkillInventory;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
function unique(values) {
    return [...new Set(values)];
}
function normalizeSkillId(value) {
    return value.trim().toLowerCase();
}
function normalizeSkillPath(value) {
    return value.replace(/\\/g, '/').trim();
}
function rootExists(rootPath) {
    return rootPath.trim() !== '' && fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory();
}
function hostSkillDir(projectRoot, hostKind) {
    switch (hostKind) {
        case 'cursor':
            return path.join(projectRoot, '.cursor', 'skills');
        case 'claude':
            return path.join(projectRoot, '.claude', 'skills');
        case 'codex':
            return path.join(projectRoot, '.codex', 'skills');
        case 'generic':
        default:
            return null;
    }
}
function globalHostSkillDir(homeDir, hostKind) {
    switch (hostKind) {
        case 'cursor':
            return path.join(homeDir, '.cursor', 'skills');
        case 'claude':
            return path.join(homeDir, '.claude', 'skills');
        case 'codex':
            return path.join(homeDir, '.codex', 'skills');
        case 'generic':
        default:
            return null;
    }
}
function candidateRoots(input) {
    const homeDir = input.homeDir ?? os.homedir();
    const roots = [];
    const projectHostRoot = hostSkillDir(input.projectRoot, input.hostKind);
    const globalHostRoot = globalHostSkillDir(homeDir, input.hostKind);
    if (projectHostRoot) {
        roots.push({
            rootPath: projectHostRoot,
            source: 'project-host',
            priority: 100,
        });
    }
    roots.push({
        rootPath: path.join(input.projectRoot, '.agents', 'skills'),
        source: 'project-agents',
        priority: 90,
    });
    if (globalHostRoot) {
        roots.push({
            rootPath: globalHostRoot,
            source: 'global-host',
            priority: 70,
        });
    }
    roots.push({
        rootPath: path.join(homeDir, '.agents', 'skills'),
        source: 'global-agents',
        priority: 60,
    });
    return roots.filter((root) => rootExists(root.rootPath));
}
function hasSkillMarkdown(dirPath) {
    try {
        return fs.readdirSync(dirPath).some((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
    }
    catch {
        return false;
    }
}
function resolveSkillMarkdownPath(dirPath) {
    try {
        const fileName = fs.readdirSync(dirPath).find((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
        return fileName ? path.join(dirPath, fileName) : null;
    }
    catch {
        return null;
    }
}
function parseFrontmatterBlock(markdown) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
    if (!match) {
        return {};
    }
    const metadata = {};
    for (const line of match[1].split(/\r?\n/u)) {
        const parsed = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/u);
        if (!parsed) {
            continue;
        }
        const key = parsed[1].trim().toLowerCase();
        const value = parsed[2].trim().replace(/^['"]|['"]$/g, '');
        if (value !== '') {
            metadata[key] = value;
        }
    }
    return metadata;
}
function compactWhitespace(value) {
    return value.replace(/\s+/gu, ' ').trim();
}
function firstMarkdownHeading(markdown) {
    const match = markdown.match(/^#\s+(.+?)\s*$/mu);
    return match ? compactWhitespace(match[1]) : undefined;
}
function firstMeaningfulParagraph(markdown) {
    const lines = markdown.split(/\r?\n/u);
    const paragraphs = [];
    let current = [];
    let inFrontmatter = false;
    let frontmatterClosed = false;
    let inCodeFence = false;
    const flush = () => {
        const text = compactWhitespace(current.join(' '));
        if (text !== '') {
            paragraphs.push(text);
        }
        current = [];
    };
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!frontmatterClosed && line === '---') {
            inFrontmatter = !inFrontmatter;
            if (!inFrontmatter) {
                frontmatterClosed = true;
            }
            flush();
            continue;
        }
        if (inFrontmatter) {
            continue;
        }
        if (/^```/.test(line)) {
            inCodeFence = !inCodeFence;
            flush();
            continue;
        }
        if (inCodeFence) {
            continue;
        }
        if (line === '') {
            flush();
            continue;
        }
        if (/^#/.test(line) || /^```/.test(line) || /^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
            flush();
            continue;
        }
        if (/^[A-Za-z0-9_-]+:\s+.+$/u.test(line) && paragraphs.length === 0 && current.length === 0) {
            continue;
        }
        current.push(line);
    }
    flush();
    return paragraphs[0];
}
function readSkillMetadata(skillMarkdownPath) {
    try {
        const markdown = fs.readFileSync(skillMarkdownPath, 'utf8');
        const frontmatter = parseFrontmatterBlock(markdown);
        const title = frontmatter.name || frontmatter.title || firstMarkdownHeading(markdown);
        const description = frontmatter.description || frontmatter.summary;
        const summary = firstMeaningfulParagraph(markdown);
        return {
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(summary ? { summary } : {}),
        };
    }
    catch {
        return {};
    }
}
function collectSkillEntries(root) {
    return fs
        .readdirSync(root.rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
        const skillDir = path.join(root.rootPath, entry.name);
        const skillMarkdownPath = resolveSkillMarkdownPath(skillDir);
        if (!skillMarkdownPath || !hasSkillMarkdown(skillDir)) {
            return null;
        }
        return {
            skillId: normalizeSkillId(entry.name),
            path: skillMarkdownPath,
            source: root.source,
            priority: root.priority,
            ...readSkillMetadata(skillMarkdownPath),
        };
    })
        .filter((entry) => entry !== null);
}
function resolveGovernanceSkillInventory(input) {
    const entries = candidateRoots(input)
        .flatMap((root) => collectSkillEntries(root))
        .sort((left, right) => {
        if (right.priority !== left.priority) {
            return right.priority - left.priority;
        }
        return left.skillId.localeCompare(right.skillId);
    });
    const dedupedBySkillId = new Map();
    for (const entry of entries) {
        if (!dedupedBySkillId.has(entry.skillId)) {
            dedupedBySkillId.set(entry.skillId, entry);
        }
    }
    const skillInventory = [...dedupedBySkillId.values()];
    return {
        availableSkills: unique(skillInventory.map((entry) => entry.skillId)),
        skillPaths: unique(skillInventory
            .map((entry) => (entry.path ? normalizeSkillPath(entry.path) : ''))
            .filter(Boolean)),
        skillInventory: skillInventory.map((entry) => ({
            ...entry,
            path: entry.path ? normalizeSkillPath(entry.path) : entry.path,
        })),
    };
}
