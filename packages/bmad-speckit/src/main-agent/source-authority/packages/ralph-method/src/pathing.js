"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRalphTrackingPaths = resolveRalphTrackingPaths;
const path = require("node:path");
function resolveRoot(projectRoot) {
    return path.resolve(projectRoot ?? process.cwd());
}
function resolveFromRoot(root, value) {
    if (!value) {
        return undefined;
    }
    return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}
function deriveStem(filePath) {
    if (!filePath) {
        return undefined;
    }
    return path.basename(filePath, path.extname(filePath));
}
function resolveRalphTrackingPaths(input) {
    const root = resolveRoot(input.projectRoot);
    const referenceDocumentPath = resolveFromRoot(root, input.referenceDocumentPath);
    const tasksPath = resolveFromRoot(root, input.tasksPath);
    const preferredBaseDir = resolveFromRoot(root, input.preferredBaseDir);
    const baseDir = referenceDocumentPath
        ? path.dirname(referenceDocumentPath)
        : tasksPath
            ? path.dirname(tasksPath)
            : preferredBaseDir
                ? preferredBaseDir
                : root;
    const stem = deriveStem(referenceDocumentPath) ?? deriveStem(tasksPath);
    return {
        baseDir,
        ...(stem ? { stem } : {}),
        prdPath: path.join(baseDir, stem ? `prd.${stem}.json` : 'prd.json'),
        progressPath: path.join(baseDir, stem ? `progress.${stem}.txt` : 'progress.txt'),
    };
}
