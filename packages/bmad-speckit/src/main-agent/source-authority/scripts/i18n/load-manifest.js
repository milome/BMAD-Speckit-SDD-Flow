"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultManifestRoot = getDefaultManifestRoot;
exports.loadManifest = loadManifest;
/**
 * Load audit template manifest YAML from `_bmad/i18n/manifests/{id}.yaml`.
 */
const node_fs_1 = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
function getDefaultManifestRoot() {
    return path.join(process.cwd(), '_bmad', 'i18n', 'manifests');
}
/**
 * Load a manifest by id.
 * @param {string} id - Manifest id without extension (e.g. `speckit.audit.spec`)
 * @param {string} [manifestRoot] - Optional root directory; defaults to `_bmad/i18n/manifests` under cwd
 * @returns {TemplateManifest} Parsed manifest object
 */
function loadManifest(id, manifestRoot = getDefaultManifestRoot()) {
    const filePath = path.join(manifestRoot, `${id}.yaml`);
    if (!(0, node_fs_1.existsSync)(filePath)) {
        throw new Error(`Manifest not found: ${filePath}`);
    }
    const raw = (0, node_fs_1.readFileSync)(filePath, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid manifest YAML: ${filePath}`);
    }
    return parsed;
}
