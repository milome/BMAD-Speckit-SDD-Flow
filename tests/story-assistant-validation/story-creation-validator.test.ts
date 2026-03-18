import { describe, it, expect, beforeEach } from 'vitest';
import { StoryCreationValidator } from '../../src/story-assistant-validation/story-creation-validator';
import { StoryDocument } from '../../src/story-assistant-validation/types';

describe('StoryCreationValidator', () => {
  let validator: StoryCreationValidator;

  beforeEach(() => {
    validator = new StoryCreationValidator({
      epic: 'E001',
      story: 'S001',
      epicSlug: 'test-epic',
      storySlug: 'test-story',
    });
  });

  describe('T1.1: StoryCreationValidator 基础结构', () => {
    it('should create validator with required options', () => {
      expect(validator).toBeDefined();
      expect(validator.options.epic).toBe('E001');
      expect(validator.options.story).toBe('S001');
    });

    it('should have validate method', () => {
      expect(validator.validate).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });

    it('should have validateDocumentStructure method', () => {
      expect(validator.validateDocumentStructure).toBeDefined();
      expect(typeof validator.validateDocumentStructure).toBe('function');
    });

    it('should have validateMetadata method', () => {
      expect(validator.validateMetadata).toBeDefined();
      expect(typeof validator.validateMetadata).toBe('function');
    });
  });

  describe('T1.2: 禁止词检查功能', () => {
    it('should detect prohibited words in content', () => {
      const content = '这个功能可能需要考虑一下';
      const result = validator.checkProhibitedWords(content);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no prohibited words', () => {
      const content = '这个功能必须实现';
      const result = validator.checkProhibitedWords(content);
      expect(result).toEqual([]);
    });

    it('should identify specific prohibited words', () => {
      const content = '这个也许可以用，或者稍后处理';
      const result = validator.checkProhibitedWords(content);
      const words = result.map((r) => r.word);
      expect(words).toContain('也许');
      expect(words).toContain('稍后');
    });

    it('should include line number in match', () => {
      const content = '第一行\n第二行考虑一下';
      const result = validator.checkProhibitedWords(content);
      expect(result[0].line).toBe(2);
    });

    it('should include context in match', () => {
      const content = '这是一个包含可能词的句子';
      const result = validator.checkProhibitedWords(content);
      expect(result[0].context).toContain('可能');
    });
  });

  describe('T1.3: 文档结构验证', () => {
    it('should validate all required sections exist', () => {
      const doc: StoryDocument = {
        metadata: {
          epic: 'E001',
          story: 'S001',
          epicSlug: 'test-epic',
          storySlug: 'test-story',
          status: 'draft',
          createdAt: '2024-01-01',
        },
        sections: {
          background: '背景',
          objectives: '目标',
          requirements: '需求',
          acceptanceCriteria: ['AC1'],
          technicalConstraints: '约束',
          dependencies: ['Dep1'],
          risks: ['Risk1'],
          outputs: ['Output1'],
          relatedInfo: '相关信息',
        },
        rawContent: '',
      };

      const results = validator.validateDocumentStructure(doc);
      const sectionCheck = results.find((r) => r.check === 'required_sections');
      expect(sectionCheck?.passed).toBe(true);
    });

    it('should fail when required sections missing', () => {
      const doc: StoryDocument = {
        metadata: {
          epic: 'E001',
          story: 'S001',
          epicSlug: 'test-epic',
          storySlug: 'test-story',
          status: 'draft',
          createdAt: '2024-01-01',
        },
        sections: {},
        rawContent: '',
      };

      const results = validator.validateDocumentStructure(doc);
      const sectionCheck = results.find((r) => r.check === 'required_sections');
      expect(sectionCheck?.passed).toBe(false);
    });
  });

  describe('T1.4: 元信息验证', () => {
    it('should validate all required metadata fields exist', () => {
      const metadata = {
        epic: 'E001',
        story: 'S001',
        epicSlug: 'test-epic',
        storySlug: 'test-story',
        status: 'draft',
        createdAt: '2024-01-01',
      };

      const results = validator.validateMetadata(metadata);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should fail when metadata fields missing', () => {
      const metadata = {
        epic: 'E001',
      };

      const results = validator.validateMetadata(metadata);
      expect(results.some((r) => !r.passed)).toBe(true);
    });
  });

  describe('完整验证流程', () => {
    it('should return validation report', async () => {
      const doc: StoryDocument = {
        metadata: {
          epic: 'E001',
          story: 'S001',
          epicSlug: 'test-epic',
          storySlug: 'test-story',
          status: 'draft',
          createdAt: '2024-01-01',
        },
        sections: {
          background: '背景描述',
          objectives: '目标描述',
          requirements: '需求描述',
          acceptanceCriteria: ['AC1', 'AC2'],
          technicalConstraints: '约束描述',
          dependencies: ['Dep1'],
          risks: ['Risk1'],
          outputs: ['Output1'],
          relatedInfo: '相关信息',
        },
        rawContent: '背景描述\n目标描述\n需求描述',
      };

      const report = await validator.validate(doc);
      expect(report).toBeDefined();
      expect(report.epic).toBe('E001');
      expect(report.story).toBe('S001');
      expect(report.results).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });
});
