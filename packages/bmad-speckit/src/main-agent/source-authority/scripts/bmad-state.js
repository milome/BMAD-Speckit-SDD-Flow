"use strict";
/**
 * BMAD Multi-Story State Management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalState = getGlobalState;
exports.saveGlobalState = saveGlobalState;
exports.getStoryStatePath = getStoryStatePath;
exports.getStoryState = getStoryState;
exports.saveStoryState = saveStoryState;
exports.createStory = createStory;
exports.updateStoryState = updateStoryState;
exports.completeStory = completeStory;
exports.listActiveStories = listActiveStories;
exports.getCurrentContext = getCurrentContext;
exports.setCurrentContext = setCurrentContext;
exports.getLockPath = getLockPath;
exports.getLock = getLock;
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.withLock = withLock;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const STATE_DIR = '.claude/state';
const STORIES_DIR = (0, node_path_1.join)(STATE_DIR, 'stories');
const LOCKS_DIR = (0, node_path_1.join)(STATE_DIR, 'locks');
const GLOBAL_STATE_FILE = (0, node_path_1.join)(STATE_DIR, 'bmad-progress.yaml');
function toYaml(obj) {
    return JSON.stringify(obj, null, 2);
}
function fromYaml(yaml) {
    try {
        return JSON.parse(yaml);
    }
    catch {
        return {};
    }
}
function ensureDirs() {
    if (!(0, node_fs_1.existsSync)(STORIES_DIR))
        (0, node_fs_1.mkdirSync)(STORIES_DIR, { recursive: true });
    if (!(0, node_fs_1.existsSync)(LOCKS_DIR))
        (0, node_fs_1.mkdirSync)(LOCKS_DIR, { recursive: true });
}
function getGlobalState() {
    ensureDirs();
    if (!(0, node_fs_1.existsSync)(GLOBAL_STATE_FILE)) {
        const defaultState = {
            version: '2.0',
            active_stories: [],
            completed_stories: [],
            current_context: null,
        };
        saveGlobalState(defaultState);
        return defaultState;
    }
    return fromYaml((0, node_fs_1.readFileSync)(GLOBAL_STATE_FILE, 'utf8'));
}
function saveGlobalState(state) {
    ensureDirs();
    (0, node_fs_1.writeFileSync)(GLOBAL_STATE_FILE, toYaml(state));
}
function getStoryStatePath(epic, story) {
    return (0, node_path_1.join)(STORIES_DIR, `${epic}-${story}-progress.yaml`);
}
function getStoryState(epic, story) {
    const path = getStoryStatePath(epic, story);
    if (!(0, node_fs_1.existsSync)(path))
        return null;
    return fromYaml((0, node_fs_1.readFileSync)(path, 'utf8'));
}
function saveStoryState(state) {
    ensureDirs();
    (0, node_fs_1.writeFileSync)(getStoryStatePath(state.epic, state.story), toYaml(state));
}
function createStory(epic, story, storySlug, initialStage = 'specify') {
    const global = getGlobalState();
    const existing = global.active_stories.find((s) => s.epic === epic && s.story === story);
    if (existing)
        throw new Error(`Story ${epic}-${story} already exists`);
    const now = new Date().toISOString();
    const storyState = {
        version: '2.0',
        epic,
        story,
        story_slug: storySlug,
        layer: 4,
        stage: initialStage,
        audit_status: 'pending',
        artifacts: {},
        scores: {},
        git_control: { commit_allowed: false },
        runtime: { last_action: 'story_created' },
    };
    global.active_stories.push({
        epic,
        story,
        stage: initialStage,
        status: 'active',
        created_at: now,
        updated_at: now,
    });
    global.current_context = { epic, story };
    saveStoryState(storyState);
    saveGlobalState(global);
    return storyState;
}
function updateStoryState(epic, story, patch) {
    const state = getStoryState(epic, story);
    if (!state)
        throw new Error(`Story ${epic}-${story} not found`);
    const updated = { ...state, ...patch };
    saveStoryState(updated);
    const global = getGlobalState();
    const storyRef = global.active_stories.find((s) => s.epic === epic && s.story === story);
    if (storyRef) {
        storyRef.stage = updated.stage;
        storyRef.updated_at = new Date().toISOString();
        global.current_context = { epic, story };
        saveGlobalState(global);
    }
    return updated;
}
function completeStory(epic, story) {
    const global = getGlobalState();
    const index = global.active_stories.findIndex((s) => s.epic === epic && s.story === story);
    if (index === -1)
        throw new Error(`Story ${epic}-${story} not found`);
    global.completed_stories.push({ epic, story, completed_at: new Date().toISOString() });
    global.active_stories.splice(index, 1);
    global.current_context =
        global.active_stories.length > 0
            ? { epic: global.active_stories[0].epic, story: global.active_stories[0].story }
            : null;
    saveGlobalState(global);
}
function listActiveStories() {
    return getGlobalState().active_stories;
}
function getCurrentContext() {
    return getGlobalState().current_context;
}
function setCurrentContext(epic, story) {
    const global = getGlobalState();
    if (!global.active_stories.some((s) => s.epic === epic && s.story === story)) {
        throw new Error(`Story ${epic}-${story} is not active`);
    }
    global.current_context = { epic, story };
    saveGlobalState(global);
}
function getLockPath(epic, story) {
    return (0, node_path_1.join)(LOCKS_DIR, `${epic}-${story}.lock`);
}
function getLock(epic, story) {
    const path = getLockPath(epic, story);
    if (!(0, node_fs_1.existsSync)(path)) {
        return {
            locked: false,
            owner: null,
            epic,
            story,
            acquired_at: null,
            expires_at: null,
            type: 'write',
        };
    }
    const lock = fromYaml((0, node_fs_1.readFileSync)(path, 'utf8'));
    if (lock.expires_at && new Date(lock.expires_at) < new Date()) {
        releaseLock(epic, story, lock.owner || '');
        return {
            locked: false,
            owner: null,
            epic,
            story,
            acquired_at: null,
            expires_at: null,
            type: 'write',
        };
    }
    return lock;
}
function acquireLock(epic, story, owner, type = 'write', durationMinutes = 60) {
    const existing = getLock(epic, story);
    if (existing.locked && existing.owner !== owner)
        return false;
    const now = new Date();
    const lock = {
        locked: true,
        owner,
        epic,
        story,
        acquired_at: now.toISOString(),
        expires_at: new Date(now.getTime() + durationMinutes * 60000).toISOString(),
        type,
    };
    (0, node_fs_1.writeFileSync)(getLockPath(epic, story), toYaml(lock));
    return true;
}
function releaseLock(epic, story, owner) {
    const existing = getLock(epic, story);
    if (!existing.locked)
        return true;
    if (existing.owner !== owner)
        return false;
    try {
        (0, node_fs_1.unlinkSync)(getLockPath(epic, story));
    }
    catch {
        // intentional: ignore unlink errors
    }
    return true;
}
function withLock(epic, story, owner, fn, type = 'write') {
    if (!acquireLock(epic, story, owner, type))
        throw new Error(`Failed to acquire lock for ${epic}-${story}`);
    try {
        return fn();
    }
    finally {
        releaseLock(epic, story, owner);
    }
}
