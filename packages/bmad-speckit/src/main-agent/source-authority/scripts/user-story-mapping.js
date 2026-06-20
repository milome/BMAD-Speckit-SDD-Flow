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
exports.userStoryMappingIndexPath = userStoryMappingIndexPath;
exports.defaultUserStoryMappingIndex = defaultUserStoryMappingIndex;
exports.readUserStoryMappingIndexOrDefault = readUserStoryMappingIndexOrDefault;
exports.writeUserStoryMappingIndex = writeUserStoryMappingIndex;
exports.isActiveUserStoryMappingStatus = isActiveUserStoryMappingStatus;
exports.findMappingsForRequirement = findMappingsForRequirement;
exports.selectBestMappingForRuntimeContext = selectBestMappingForRuntimeContext;
exports.upsertUserStoryMappingItem = upsertUserStoryMappingItem;
exports.deactivateSiblingActiveMappings = deactivateSiblingActiveMappings;
exports.normalizeCandidateId = normalizeCandidateId;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function userStoryMappingIndexPath(projectRoot) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
}
function defaultUserStoryMappingIndex() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/requirement-records/index.json',
        items: [],
    };
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function normalizePathForRecord(value) {
    return value.replace(/\\/g, '/');
}
function mappingFromRequirementRecord(projectRoot, recordEntry) {
    const recordPath = text(recordEntry.recordPath ?? recordEntry.path ?? recordEntry.controlRecordPath);
    const requirementSetId = text(recordEntry.requirementSetId ?? recordEntry.recordId);
    const absoluteRecordPath = recordPath
        ? path.resolve(projectRoot, normalizePathForRecord(recordPath))
        : requirementSetId
            ? path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', requirementSetId, 'requirement-record.json')
            : '';
    if (!absoluteRecordPath || !fs.existsSync(absoluteRecordPath))
        return null;
    try {
        const record = JSON.parse(fs.readFileSync(absoluteRecordPath, 'utf8'));
        const flow = text(record.flow ?? record.entryFlow);
        if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks')
            return null;
        const bindings = Array.isArray(record.taskBindings)
            ? record.taskBindings.filter((item) => Boolean(object(item)))
            : [];
        const activeBinding = bindings.find((item) => ['planned', 'in_progress'].includes(text(item.status))) ??
            bindings[0] ??
            {};
        const artifactRoot = text(record.artifactRoot ?? record.artifactPath ?? record.sourcePath);
        return {
            requirementId: text(record.recordId) || requirementSetId,
            sourceType: flow === 'bugfix' ? 'bugfix' : flow === 'standalone_tasks' ? 'standalone' : 'prd',
            epicId: text(activeBinding.epicId ?? record.epicId) || 'unscoped',
            storyId: text(activeBinding.storyId ?? record.storyId) ||
                text(record.recordId) ||
                requirementSetId ||
                'unscoped',
            flow,
            sprintId: text(activeBinding.sprintId ?? record.sprintId) || 'unscoped',
            allowedWriteScope: Array.isArray(activeBinding.allowedWriteScope) &&
                activeBinding.allowedWriteScope.every((item) => typeof item === 'string')
                ? activeBinding.allowedWriteScope
                : artifactRoot
                    ? [normalizePathForRecord(artifactRoot), `${normalizePathForRecord(artifactRoot)}/**`]
                    : [],
            status: (['planned', 'in_progress', 'blocked', 'done'].includes(text(activeBinding.status))
                ? text(activeBinding.status)
                : text(record.status) === 'closed'
                    ? 'done'
                    : text(record.status) === 'blocked'
                        ? 'blocked'
                        : 'planned'),
            acceptanceRefs: Array.isArray(activeBinding.acceptanceRefs)
                ? activeBinding.acceptanceRefs.map(text).filter(Boolean)
                : [],
            lastPacketId: text(activeBinding.lastPacketId) || null,
            updatedAt: text(record.updatedAt),
        };
    }
    catch {
        return null;
    }
}
function entriesFromRequirementRecordIndex(index) {
    const records = index.records;
    if (Array.isArray(records)) {
        return records.filter((item) => Boolean(object(item)));
    }
    if (records && typeof records === 'object') {
        return Object.entries(records).map(([id, value]) => typeof value === 'string'
            ? { requirementSetId: id, recordPath: value }
            : { requirementSetId: id, ...(object(value) ?? {}) });
    }
    return [];
}
function readRequirementRecordBackedIndex(projectRoot, indexPath, parsed) {
    const items = entriesFromRequirementRecordIndex(parsed)
        .map((entry) => mappingFromRequirementRecord(projectRoot, entry))
        .filter((item) => item !== null);
    return {
        version: 1,
        updatedAt: text(parsed.updatedAt) || new Date().toISOString(),
        source: path.relative(projectRoot, indexPath).replace(/\\/g, '/'),
        items,
    };
}
function readUserStoryMappingIndexOrDefault(projectRoot) {
    const file = userStoryMappingIndexPath(projectRoot);
    if (!fs.existsSync(file)) {
        return defaultUserStoryMappingIndex();
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed.items)) {
        return readRequirementRecordBackedIndex(projectRoot, file, parsed);
    }
    return {
        ...defaultUserStoryMappingIndex(),
        ...parsed,
        items: Array.isArray(parsed.items) ? parsed.items : [],
        source: '_bmad-output/runtime/requirement-records/index.json',
    };
}
function writeUserStoryMappingIndex(projectRoot, index) {
    const file = userStoryMappingIndexPath(projectRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const payload = {
        ...index,
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/requirement-records/index.json',
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}
function isActiveUserStoryMappingStatus(status) {
    return status === 'planned' || status === 'in_progress';
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function stringList(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
}
function scoreRuntimeMatch(item, runtimeContext, flow) {
    let score = item.flow === flow ? 50 : 0;
    if (runtimeContext?.storyId && item.storyId === runtimeContext.storyId) {
        score += 200;
    }
    if (runtimeContext?.epicId && item.epicId === runtimeContext.epicId) {
        score += 80;
    }
    if (runtimeContext?.artifactRoot) {
        const artifactRoot = runtimeContext.artifactRoot.toLowerCase();
        score += stringList(item.allowedWriteScope).some((scope) => artifactRoot.includes(scope.toLowerCase()))
            ? 20
            : 0;
    }
    if (runtimeContext?.stage === 'implement' && isActiveUserStoryMappingStatus(item.status)) {
        score += 15;
    }
    return score;
}
function findMappingsForRequirement(index, requirementId) {
    return index.items.filter((item) => item.requirementId === requirementId);
}
function selectBestMappingForRuntimeContext(index, runtimeContext, flow) {
    if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') {
        return null;
    }
    return (index.items
        .map((item) => ({
        item,
        score: scoreRuntimeMatch(item, runtimeContext, flow),
    }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return left.item.storyId.localeCompare(right.item.storyId);
    })[0]?.item ?? null);
}
function upsertUserStoryMappingItem(index, nextItem) {
    const now = new Date().toISOString();
    const items = index.items.map((item) => ({ ...item }));
    const matchIndex = items.findIndex((item) => item.requirementId === nextItem.requirementId && item.storyId === nextItem.storyId);
    if (matchIndex >= 0) {
        items[matchIndex] = { ...items[matchIndex], ...nextItem, updatedAt: now };
    }
    else {
        items.push({ ...nextItem, updatedAt: now });
    }
    return {
        ...index,
        updatedAt: now,
        items,
    };
}
function deactivateSiblingActiveMappings(index, requirementId, preservedStoryId) {
    const now = new Date().toISOString();
    return {
        ...index,
        updatedAt: now,
        items: index.items.map((item) => {
            if (item.requirementId === requirementId &&
                item.storyId !== preservedStoryId &&
                isActiveUserStoryMappingStatus(item.status)) {
                return { ...item, status: 'blocked', updatedAt: now };
            }
            return item;
        }),
    };
}
function normalizeCandidateId(value) {
    const normalized = normalizeText(value).replace(/[^A-Za-z0-9._-]+/g, '-');
    return normalized === '' ? 'unknown-requirement' : normalized;
}
