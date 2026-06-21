"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePatchSnapshotDir = resolvePatchSnapshotDir;
exports.persistPatchSnapshot = persistPatchSnapshot;
exports.readPatchSnapshot = readPatchSnapshot;
const fs = require("node:fs");
const path = require("node:path");
const node_child_process_1 = require("node:child_process");
const hash_1 = require("./hash");
function sanitizePathSegment(value) {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}
function resolvePatchSnapshotDir(dataPath) {
    return path.join(dataPath, '_patch-snapshots');
}
function persistPatchSnapshot(input) {
    if (!input.baseCommitHash) {
        return null;
    }
    const cwd = input.cwd ?? process.cwd();
    const headHash = (0, hash_1.getGitHeadHashFull)(cwd);
    if (!headHash) {
        return null;
    }
    try {
        (0, node_child_process_1.execSync)(`git rev-parse --verify ${input.baseCommitHash}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch {
        return null;
    }
    let diff = '';
    const diffCommands = [
        `git diff ${input.baseCommitHash} ${headHash}`,
        `git show --format= --patch ${headHash}`,
        `git show -m --format= --patch ${headHash}`,
        `git diff-tree --no-commit-id --patch -m -r ${headHash}`,
    ];
    for (const command of diffCommands) {
        try {
            diff = (0, node_child_process_1.execSync)(command, {
                cwd,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
        catch {
            diff = '';
        }
        if (diff.trim() !== '') {
            break;
        }
    }
    if (diff.trim() === '') {
        return null;
    }
    const patchRef = `sha256:${(0, hash_1.computeStringHash)(diff)}`;
    const patchDir = resolvePatchSnapshotDir(input.dataPath);
    fs.mkdirSync(patchDir, { recursive: true });
    const fileName = `${sanitizePathSegment(input.runId)}-${sanitizePathSegment(input.stage)}-${patchRef.slice(7, 19)}.patch`;
    const patchPath = path.join(patchDir, fileName);
    fs.writeFileSync(patchPath, diff, 'utf-8');
    return {
        patch_ref: patchRef,
        patch_snapshot_path: patchPath,
    };
}
function readPatchSnapshot(snapshotPath, cwd) {
    const resolved = path.isAbsolute(snapshotPath)
        ? snapshotPath
        : path.resolve(cwd ?? process.cwd(), snapshotPath);
    if (!fs.existsSync(resolved)) {
        return null;
    }
    try {
        return fs.readFileSync(resolved, 'utf-8');
    }
    catch {
        return null;
    }
}
