"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AGENT_MANIFEST_RELATIVE_PATH = void 0;
exports.parseCsvLine = parseCsvLine;
exports.readAgentManifestRows = readAgentManifestRows;
exports.readAgentManifestRow = readAgentManifestRow;
const fs = require("node:fs");
const path = require("node:path");
exports.DEFAULT_AGENT_MANIFEST_RELATIVE_PATH = '_bmad/_config/agent-manifest.csv';
function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                index += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (char === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}
function readAgentManifestRows(projectRoot, relativePath = exports.DEFAULT_AGENT_MANIFEST_RELATIVE_PATH) {
    const manifestPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Agent manifest not found: ${manifestPath}`);
    }
    const lines = fs
        .readFileSync(manifestPath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length < 2) {
        return [];
    }
    const header = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
        return row;
    });
}
function readAgentManifestRow(projectRoot, agentId, relativePath = exports.DEFAULT_AGENT_MANIFEST_RELATIVE_PATH) {
    return readAgentManifestRows(projectRoot, relativePath).find((row) => row.name === agentId);
}
