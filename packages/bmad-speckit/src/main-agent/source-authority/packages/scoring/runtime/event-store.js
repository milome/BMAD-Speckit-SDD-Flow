"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendRuntimeEvent = appendRuntimeEvent;
exports.readRuntimeEvents = readRuntimeEvents;
const fs = require("fs");
const path = require("path");
const path_1 = require("./path");
const SUPPORTED_EVENT_VERSION = 1;
function sanitizeFilePart(input) {
    return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}
function isRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}
function isRuntimeEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (typeof value.event_id !== 'string' || value.event_id.trim() === '') {
        return false;
    }
    if (typeof value.event_type !== 'string' || value.event_type.trim() === '') {
        return false;
    }
    if (value.event_version !== SUPPORTED_EVENT_VERSION) {
        return false;
    }
    if (typeof value.timestamp !== 'string' || value.timestamp.trim() === '') {
        return false;
    }
    if (typeof value.run_id !== 'string' || value.run_id.trim() === '') {
        return false;
    }
    if (!isRecord(value.payload)) {
        return false;
    }
    return true;
}
function compareEvents(left, right) {
    const byTimestamp = left.timestamp.localeCompare(right.timestamp);
    if (byTimestamp !== 0) {
        return byTimestamp;
    }
    return left.event_id.localeCompare(right.event_id);
}
function appendRuntimeEvent(event, options = {}) {
    const root = options.root ?? process.cwd();
    const eventsRoot = (0, path_1.resolveRuntimeEventsPath)(root);
    fs.mkdirSync(eventsRoot, { recursive: true });
    const fileName = `${sanitizeFilePart(event.timestamp)}-${sanitizeFilePart(event.event_id)}.json`;
    const filePath = path.join(eventsRoot, fileName);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    const body = JSON.stringify(event, null, 2) + '\n';
    fs.writeFileSync(tmpPath, body, 'utf-8');
    fs.renameSync(tmpPath, filePath);
    return filePath;
}
function readRuntimeEvents(options = {}) {
    const root = options.root ?? process.cwd();
    const eventsRoot = (0, path_1.resolveRuntimeEventsPath)(root);
    if (!fs.existsSync(eventsRoot)) {
        return [];
    }
    const events = [];
    const entries = fs.readdirSync(eventsRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }
        if (entry.name.endsWith('.tmp') || !entry.name.endsWith('.json')) {
            continue;
        }
        const filePath = path.join(eventsRoot, entry.name);
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (isRuntimeEvent(parsed)) {
                events.push(parsed);
            }
        }
        catch {
            // Ignore malformed event files.
        }
    }
    return events.sort(compareEvents);
}
