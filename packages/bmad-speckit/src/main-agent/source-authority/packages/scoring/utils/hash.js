"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeContentHash = computeContentHash;
exports.computeStringHash = computeStringHash;
exports.getGitHeadHash = getGitHeadHash;
exports.getGitHeadHashFull = getGitHeadHashFull;
const crypto = require("crypto");
const fs = require("fs");
const child_process_1 = require("child_process");
/**
 * 计算文件内容的 SHA-256 指纹。
 * 用于阶段间版本锁定：审计通过后锁定文件指纹，下游阶段校验一致性。
 * @param {string} filePath - 文件路径
 * @returns {string} SHA-256 hex 字符串
 */
function computeContentHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return computeStringHash(content);
}
/**
 * 计算字符串的 SHA-256 指纹。
 * @param {string} content - 待哈希字符串
 * @returns {string} SHA-256 hex 字符串
 */
function computeStringHash(content) {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}
/**
 * 获取当前 git HEAD 的 commit hash（短 hash，前 8 位）。
 * 返回 undefined 而非抛异常：适配非 git 环境降级。
 * @param {string} [cwd] - 工作目录，默认 process.cwd()
 * @returns {string | undefined} 8 位短 hash 或 undefined
 */
function getGitHeadHash(cwd) {
    try {
        const hash = (0, child_process_1.execSync)('git rev-parse HEAD', {
            cwd: cwd ?? process.cwd(),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return hash.length >= 8 ? hash.slice(0, 8) : hash;
    }
    catch {
        return undefined;
    }
}
/**
 * 获取当前 git HEAD 的完整 commit hash（40 字符）。
 * 返回 undefined 而非抛异常：适配非 git 环境降级。
 * @param {string} [cwd] - 工作目录，默认 process.cwd()
 * @returns {string | undefined} 40 位完整 hash 或 undefined
 */
function getGitHeadHashFull(cwd) {
    try {
        return (0, child_process_1.execSync)('git rev-parse HEAD', {
            cwd: cwd ?? process.cwd(),
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch {
        return undefined;
    }
}
