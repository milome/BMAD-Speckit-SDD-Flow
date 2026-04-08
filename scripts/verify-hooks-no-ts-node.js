#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * 验证 Hooks 无 ts-node 依赖
 *
 * 本脚本检查所有 hooks 文件确保：
 * 1. 不包含 "ts-node" 字符串
 * 2. 不包含 require('.ts') 或 require(".ts")
 * 3. 所有文件都是 .cjs 扩展名
 *
 * 使用方式:
 *   node scripts/verify-hooks-no-ts-node.js
 *
 * @module scripts/verify-hooks-no-ts-node
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * 验证结果
 * @typedef {Object} VerificationResult
 * @property {boolean} passed - 是否通过
 * @property {string[]} errors - 错误列表
 * @property {string[]} warnings - 警告列表
 */

/**
 * 颜色输出
 * @param {string} text - 文本
 * @param {string} color - 颜色
 * @returns {string}
 */
function color(text, color) {
  const codes = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  };
  return `${codes[color] || ''}${text}${codes.reset}`;
}

/**
 * 检查单个文件
 * @param {string} filePath - 文件路径
 * @returns {{passed: boolean, issues: string[]}}
 */
function checkFile(filePath) {
  const issues = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const basename = path.basename(filePath);

  // 检查 1: 不包含 ts-node
  if (content.includes('ts-node')) {
    issues.push(`Found "ts-node" reference`);
  }

  // 检查 2: 不包含 require('.ts') 或 require(".ts")
  if (/require\(['"]\.[^'"]+\.ts['"]\)/.test(content)) {
    issues.push(`Found require() of .ts file`);
  }

  // 检查 3: 文件扩展名是 .cjs
  if (!basename.endsWith('.cjs')) {
    issues.push(`File extension is not .cjs`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * 递归获取目录中所有文件
 * @param {string} dir - 目录
 * @param {string[]} [files] - 累积的文件列表
 * @returns {string[]}
 */
function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 主验证流程
 * @returns {VerificationResult}
 */
function verify() {
  const result = {
    passed: true,
    errors: [],
    warnings: [],
  };

  console.log(color('\n=== BMAD Hooks ts-node 依赖验证 ===\n', 'reset'));

  const hooksDir = path.join(__dirname, '..', '_bmad', 'runtime', 'hooks');

  if (!fs.existsSync(hooksDir)) {
    result.errors.push(`Hooks directory does not exist: ${hooksDir}`);
    result.passed = false;
    return result;
  }

  const files = getAllFiles(hooksDir).filter(f =>
    f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.ts')
  );

  console.log(`Found ${files.length} hook files\n`);

  let passedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const check = checkFile(file);

    if (check.passed) {
      console.log(color(`✓ ${relativePath}`, 'green'));
      passedCount++;
    } else {
      console.log(color(`✗ ${relativePath}`, 'red'));
      for (const issue of check.issues) {
        console.log(color(`  - ${issue}`, 'red'));
        result.errors.push(`${relativePath}: ${issue}`);
      }
      failedCount++;
      result.passed = false;
    }
  }

  console.log(`\n${color('=== 总结 ===', 'reset')}`);
  console.log(`Total files: ${files.length}`);
  console.log(color(`Passed: ${passedCount}`, 'green'));
  console.log(color(`Failed: ${failedCount}`, failedCount > 0 ? 'red' : 'green'));

  if (result.passed) {
    console.log(color('\n✓ 所有 hooks 通过 ts-node 依赖验证！\n', 'green'));
  } else {
    console.log(color('\n✗ 部分 hooks 未通过验证，请修复上述问题\n', 'red'));
  }

  return result;
}

/**
 * 主入口
 */
function main() {
  const result = verify();
  process.exit(result.passed ? 0 : 1);
}

// 运行
main();
