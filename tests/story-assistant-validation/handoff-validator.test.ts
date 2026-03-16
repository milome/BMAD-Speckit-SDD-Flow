import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandoffValidator } from '../../src/story-assistant-validation/handoff-validator';
import { HandoffFile } from '../../src/story-assistant-validation/types';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as os from 'os';

describe('HandoffValidator', () => {
  let validator: HandoffValidator;
  const mockHandoff: HandoffFile = {
    epic: 'E001',
    story: 'S005',
    layer: 4,
    stage: 'layer-4',
    artifactPath:
      '_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-5-verify-story-assistant-enhancement/tasks.md',
    nextAction: 'implement',
    nextAgent: 'speckit-implement',
    timestamp: '2024-01-01T00:00:00Z',
    metadata: {
      epic: 'E001',
      story: 'S005',
    },
  };

  beforeEach(() => {
    validator = new HandoffValidator({
      epic: 'E001',
      story: 'S005',
      epicSlug: 'test-epic',
      storySlug: 'verify-story-assistant-enhancement',
    });
    vi.restoreAllMocks();
  });

  describe('T4.1: HandoffValidator 基础结构', () => {
    it('should create validator with required options', () => {
      expect(validator).toBeDefined();
      expect(validator.options.epic).toBe('E001');
      expect(validator.options.story).toBe('S005');
    });

    it('should have validateHandoff method', () => {
      expect(validator.validateHandoff).toBeDefined();
      expect(typeof validator.validateHandoff).toBe('function');
    });

    it('should have loadHandoff method', () => {
      expect(validator.loadHandoff).toBeDefined();
      expect(typeof validator.loadHandoff).toBe('function');
    });

    it('should have validateRequiredFields method', () => {
      expect(validator.validateRequiredFields).toBeDefined();
      expect(typeof validator.validateRequiredFields).toBe('function');
    });

    it('should have validateArtifactPath method', () => {
      expect(validator.validateArtifactPath).toBeDefined();
      expect(typeof validator.validateArtifactPath).toBe('function');
    });

    it('should have validateNextAgentRouting method', () => {
      expect(validator.validateNextAgentRouting).toBeDefined();
      expect(typeof validator.validateNextAgentRouting).toBe('function');
    });
  });

  describe('T4.2: Handoff 字段验证', () => {
    it('should validate all required fields exist', () => {
      const result = validator.validateRequiredFields(mockHandoff);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when layer is missing', () => {
      const invalidHandoff = { ...mockHandoff };
      delete (invalidHandoff as Record<string, unknown>).layer;
      const result = validator.validateRequiredFields(invalidHandoff);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: layer');
    });

    it('should fail when stage is missing', () => {
      const invalidHandoff = { ...mockHandoff };
      delete (invalidHandoff as Record<string, unknown>).stage;
      const result = validator.validateRequiredFields(invalidHandoff);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: stage');
    });

    it('should fail when artifactPath is missing', () => {
      const invalidHandoff = { ...mockHandoff };
      delete (invalidHandoff as Record<string, unknown>).artifactPath;
      const result = validator.validateRequiredFields(invalidHandoff);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: artifactPath');
    });

    it('should fail when nextAction is missing', () => {
      const invalidHandoff = { ...mockHandoff };
      delete (invalidHandoff as Record<string, unknown>).nextAction;
      const result = validator.validateRequiredFields(invalidHandoff);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: nextAction');
    });

    it('should fail when nextAgent is missing', () => {
      const invalidHandoff = { ...mockHandoff };
      delete (invalidHandoff as Record<string, unknown>).nextAgent;
      const result = validator.validateRequiredFields(invalidHandoff);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: nextAgent');
    });

    it('should validate YAML format is valid', async () => {
      const validYaml = `
layer: 4
stage: layer-4
artifactPath: path/to/file.md
nextAction: implement
nextAgent: speckit-implement
timestamp: 2024-01-01T00:00:00Z
      `;
      const result = await validator.validateYamlFormat(validYaml);
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid YAML format', async () => {
      // Use a clearly invalid YAML that js-yaml will reject
      const invalidYaml = '[this is not valid yaml: : :';
      const result = await validator.validateYamlFormat(invalidYaml);
      expect(result.passed).toBe(false);
    });
  });

  describe('T4.3: 路径和路由验证', () => {
    it('should validate artifact path format', () => {
      const result = validator.validateArtifactPath(mockHandoff.artifactPath);
      expect(result.passed).toBe(true);
    });

    it('should validate artifact path contains epic identifier', () => {
      const validPath = '_bmad-output/implementation-artifacts/epic-E001-test/story-S001/tasks.md';
      const result = validator.validateArtifactPath(validPath);
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid artifact path', () => {
      const invalidPath = 'invalid/path/file.md';
      const result = validator.validateArtifactPath(invalidPath);
      expect(result.passed).toBe(false);
    });

    it('should validate nextAgent matches stage routing', () => {
      const result = validator.validateNextAgentRouting(mockHandoff);
      expect(result.passed).toBe(true);
    });

    it('should fail when nextAgent does not match stage routing', () => {
      const invalidHandoff = {
        ...mockHandoff,
        stage: 'layer-4',
        nextAgent: 'wrong-agent',
      };
      const result = validator.validateNextAgentRouting(invalidHandoff);
      expect(result.passed).toBe(false);
    });

    it('should validate nextAgent for layer-3 stage', () => {
      const layer3Handoff = {
        ...mockHandoff,
        stage: 'layer-3',
        nextAgent: 'speckit-specify',
      };
      const result = validator.validateNextAgentRouting(layer3Handoff);
      expect(result.passed).toBe(true);
    });

    it('should validate nextAgent for story-audit stage', () => {
      const auditHandoff = {
        ...mockHandoff,
        stage: 'story-audit',
        nextAgent: 'story-auditor',
      };
      const result = validator.validateNextAgentRouting(auditHandoff);
      expect(result.passed).toBe(true);
    });
  });

  describe('T4.4: 完整 Handoff 验证流程', () => {
    it('should validate complete handoff file', async () => {
      // Use a path that matches the expected format
      const baseDir =
        '_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-5-verify';
      const tmpFile = `${baseDir}/handoff.yaml`;

      // Ensure directory exists
      const dirs = baseDir.split('/');
      let currentDir = '';
      for (const dir of dirs) {
        currentDir = currentDir ? `${currentDir}/${dir}` : dir;
        if (!fs.existsSync(currentDir)) {
          fs.mkdirSync(currentDir, { recursive: true });
        }
      }
      fs.writeFileSync(tmpFile, yaml.dump(mockHandoff));

      try {
        const result = await validator.validateHandoff(tmpFile);
        if (!result.valid) {
          console.log('Validation errors:', result.errors);
        }
        expect(result.valid).toBe(true);
        expect(result.handoff).toBeDefined();
        expect(result.errors).toHaveLength(0);
      } finally {
        // Cleanup
        fs.unlinkSync(tmpFile);
        fs.rmSync(baseDir, { recursive: true, force: true });
      }
    });

    it('should load handoff from file', async () => {
      const tmpDir = fs.mkdtempSync(os.tmpdir() + '/handoff-test-');
      const tmpFile = `${tmpDir}/handoff.yaml`;
      fs.writeFileSync(tmpFile, yaml.dump(mockHandoff));

      try {
        const handoff = await validator.loadHandoff(tmpFile);
        expect(handoff).toBeDefined();
        expect(handoff.epic).toBe('E001');
        expect(handoff.layer).toBe(4);
      } finally {
        fs.unlinkSync(tmpFile);
        fs.rmdirSync(tmpDir);
      }
    });

    it('should report all validation errors', async () => {
      const invalidHandoff = {
        layer: 4,
        // Missing stage, nextAction, nextAgent
        artifactPath: 'path/to/file.md',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = validator.validateRequiredFields(invalidHandoff as HandoffFile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should validate handoff file path', () => {
      const validPath =
        '_bmad-output/implementation-artifacts/epic-E001-test/story-S001/handoff.yaml';
      const result = validator.validateHandoffPath(validPath);
      expect(result.passed).toBe(true);
    });
  });
});
