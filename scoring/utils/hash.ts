import * as crypto from 'crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * 计算文件内容的 SHA-256 指纹。
 * 用于阶段间版本锁定：审计通过后锁定文件指纹，下游阶段校验一致性。
 */
export function computeContentHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return computeStringHash(content);
}

/**
 * 计算字符串的 SHA-256 指纹。
 */
export function computeStringHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 获取当前 git HEAD 的 commit hash（短 hash，前 8 位）。
 * 返回 undefined 而非抛异常：适配非 git 环境降级。
 */
export function getGitHeadHash(cwd?: string): string | undefined {
  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return hash.length >= 8 ? hash.slice(0, 8) : hash;
  } catch {
    return undefined;
  }
}

/**
 * 获取当前 git HEAD 的完整 commit hash（40 字符）。
 * 返回 undefined 而非抛异常：适配非 git 环境降级。
 */
export function getGitHeadHashFull(cwd?: string): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}
