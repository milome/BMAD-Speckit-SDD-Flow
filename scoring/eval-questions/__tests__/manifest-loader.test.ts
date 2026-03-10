/**
 * Story 8.1: manifest-loader 单元与集成测试
 * 从生产模块 import loadManifest，使用真实 v1/v2 路径调用
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { loadManifest } from '../manifest-loader';

const EVAL_ROOT = path.resolve(process.cwd(), 'scoring', 'eval-questions');
const V1_DIR = path.join(EVAL_ROOT, 'v1');
const FIXTURES = path.join(EVAL_ROOT, '__tests__', 'fixtures');

describe('manifest-loader', () => {
  describe('空 manifest', () => {
    let emptyDir: string;
    beforeEach(() => {
      emptyDir = path.join(FIXTURES, `tmp-empty-${Date.now()}`);
      fs.mkdirSync(emptyDir, { recursive: true });
      fs.writeFileSync(path.join(emptyDir, 'manifest.yaml'), 'questions: []\n', 'utf-8');
    });
    afterEach(() => {
      if (fs.existsSync(emptyDir)) fs.rmSync(emptyDir, { recursive: true });
    });
    it('loadManifest(emptyDir) 返回 { questions: [] }', () => {
      const m = loadManifest(emptyDir);
      expect(m).toEqual({ questions: [] });
    });
  });

  describe('版本隔离', () => {
    let dir1: string;
    let dir2: string;
    beforeEach(() => {
      dir1 = path.join(FIXTURES, `tmp-v1-${Date.now()}`);
      dir2 = path.join(FIXTURES, `tmp-v2-${Date.now()}`);
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'manifest.yaml'), 'questions: []\n', 'utf-8');
      fs.writeFileSync(path.join(dir2, 'manifest.yaml'), 'questions: []\n', 'utf-8');
    });
    afterEach(() => {
      if (fs.existsSync(dir1)) fs.rmSync(dir1, { recursive: true });
      if (fs.existsSync(dir2)) fs.rmSync(dir2, { recursive: true });
    });
    it('loadManifest(dir1) 与 loadManifest(dir2) 分别返回对应清单', () => {
      const v1 = loadManifest(dir1);
      const v2 = loadManifest(dir2);
      expect(v1).toBeDefined();
      expect(v2).toBeDefined();
      expect(v1.questions).toEqual([]);
      expect(v2.questions).toEqual([]);
    });
  });

  describe('解析成功', () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = path.join(FIXTURES, `tmp-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'q001-sample.md'), '# Sample\n', 'utf-8');
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - id: q001
    title: Sample
    path: q001-sample.md
`,
        'utf-8'
      );
    });
    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
    it('合法 manifest 含题目时正确解析', () => {
      const m = loadManifest(tmpDir);
      expect(m.questions).toHaveLength(1);
      expect(m.questions[0]).toEqual({
        id: 'q001',
        title: 'Sample',
        path: 'q001-sample.md',
        difficulty: undefined,
        tags: undefined,
      });
    });
  });

  describe('格式错误', () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = path.join(FIXTURES, `tmp-err-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
    });
    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
    it('YAML 格式错误时抛错', () => {
      fs.writeFileSync(path.join(tmpDir, 'manifest.yaml'), 'invalid: yaml: [', 'utf-8');
      expect(() => loadManifest(tmpDir)).toThrow();
    });
  });

  describe('缺少必填字段', () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = path.join(FIXTURES, `tmp-missing-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
    });
    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
    it('项缺 id 时抛错', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - title: Foo
    path: foo.md
`,
        'utf-8'
      );
      expect(() => loadManifest(tmpDir)).toThrow(/missing required 'id'/);
    });
    it('项缺 title 时抛错', () => {
      fs.writeFileSync(path.join(tmpDir, 'foo.md'), '', 'utf-8');
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - id: q001
    path: foo.md
`,
        'utf-8'
      );
      expect(() => loadManifest(tmpDir)).toThrow(/missing required 'title'/);
    });
    it('项缺 path 时抛错', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - id: q001
    title: Foo
`,
        'utf-8'
      );
      expect(() => loadManifest(tmpDir)).toThrow(/missing required 'path'/);
    });
  });

  describe('id 重复', () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = path.join(FIXTURES, `tmp-dup-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.md'), '', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, 'b.md'), '', 'utf-8');
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - id: q001
    title: A
    path: a.md
  - id: q001
    title: B
    path: b.md
`,
        'utf-8'
      );
    });
    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
    it('版本内 id 重复时抛错', () => {
      expect(() => loadManifest(tmpDir)).toThrow(/duplicate id/);
    });
  });

  describe('path 不存在', () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = path.join(FIXTURES, `tmp-nopath-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'manifest.yaml'),
        `questions:
  - id: q001
    title: Missing
    path: nonexistent.md
`,
        'utf-8'
      );
    });
    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
    it('path 指向文件不存在时抛错', () => {
      expect(() => loadManifest(tmpDir)).toThrow(/does not exist/);
    });
  });

  describe('集成：从生产模块 import、真实路径调用', () => {
    it('从 scoring/eval-questions/manifest-loader 导入 loadManifest 可正确调用', () => {
      const m = loadManifest(V1_DIR);
      expect(m).toHaveProperty('questions');
      expect(Array.isArray(m.questions)).toBe(true);
    });
  });
});
