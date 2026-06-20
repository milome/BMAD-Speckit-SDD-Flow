"use strict";
/* eslint-disable @typescript-eslint/no-var-requires */
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
exports.resolveRuntimeStepState = resolveRuntimeStepState;
exports.persistRuntimeStepState = persistRuntimeStepState;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const runtimeStepStatePathCandidates = [
    path.resolve(__dirname, '..', '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs'),
    path.resolve(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'runtime-step-state.cjs'),
];
const runtimeStepStatePath = runtimeStepStatePathCandidates.find((candidate) => fs.existsSync(candidate)) ||
    runtimeStepStatePathCandidates[0];
const runtimeStepState = require(runtimeStepStatePath);
function resolveRuntimeStepState(projectRoot, options) {
    return runtimeStepState.resolveRuntimeStepState(projectRoot, options);
}
function persistRuntimeStepState(projectRoot, state) {
    return runtimeStepState.persistRuntimeStepState(projectRoot, state);
}
