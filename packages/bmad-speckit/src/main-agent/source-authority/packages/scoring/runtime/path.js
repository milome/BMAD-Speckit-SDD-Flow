"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRuntimeRoot = resolveRuntimeRoot;
exports.resolveRuntimeEventsPath = resolveRuntimeEventsPath;
const path = require("path");
function resolveRuntimeRoot(root = process.cwd()) {
    return path.join(root, '_bmad-output', 'runtime');
}
function resolveRuntimeEventsPath(root = process.cwd()) {
    return path.join(resolveRuntimeRoot(root), 'events');
}
