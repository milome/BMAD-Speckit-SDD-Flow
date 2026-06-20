"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRuntimeScoringDataPath = resolveRuntimeScoringDataPath;
const node_path_1 = __importDefault(require("node:path"));
function resolveRuntimeScoringDataPath(input) {
    const root = node_path_1.default.resolve(input.root);
    const explicit = input.dataPath?.trim();
    const envPath = (input.env ?? process.env).SCORING_DATA_PATH?.trim();
    const selected = explicit || envPath || node_path_1.default.join('_bmad-output', 'scoring');
    return node_path_1.default.isAbsolute(selected) ? selected : node_path_1.default.resolve(root, selected);
}
