"use strict";
/**
 * Story 2.1: 环节 2/3/4、gaps、iteration-tier 的 YAML 类型定义
 * Architecture §9、plan-E2-S1 §2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefResolutionError = void 0;
class RefResolutionError extends Error {
    ref;
    itemId;
    configPath;
    constructor(ref, itemId, configPath) {
        super(`Ref resolution failed: ${ref} (item_id=${itemId}) not found in config${configPath ? ` at ${configPath}` : ''}`);
        this.ref = ref;
        this.itemId = itemId;
        this.configPath = configPath;
        this.name = 'RefResolutionError';
    }
}
exports.RefResolutionError = RefResolutionError;
