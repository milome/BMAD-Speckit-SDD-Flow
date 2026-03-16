/**
 * Acceptance Test: Speckit Constitution Agent Definition
 *
 * Validates that speckit-constitution agent definition exists and follows
 * the expected structure according to speckit-workflow SKILL.md §0.5.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Speckit Constitution Agent Definition', () => {
  const agentPath = resolve('.claude/agents/speckit-constitution.md');

  it('should exist at .claude/agents/speckit-constitution.md', () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe('Header and Role', () => {
    it('should have valid markdown header', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/^# Agent: Speckit Constitution/);
    });

    it('should define project principles role', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/项目原则/);
      expect(content).toMatch(/技术栈/);
      expect(content).toMatch(/架构约束/);
    });
  });

  describe('Required Inputs', () => {
    it('should define projectPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/projectPath/);
    });

    it('should define projectType input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/projectType/);
    });

    it('should define mode input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/mode/);
    });
  });

  describe('Mandatory Startup', () => {
    it('should analyze project structure', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/分析项目结构/);
    });

    it('should detect tech stack', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/技术栈检测/);
      expect(content).toMatch(/package\.json/);
    });

    it('should read existing docs', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/README\.md/);
    });

    it('should check existing constitution', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/constitution\.md/);
    });
  });

  describe('Step 1: Project Analysis', () => {
    it('should detect Node.js projects', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Node\.js/);
      expect(content).toMatch(/package\.json/);
    });

    it('should detect Python projects', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Python/);
      expect(content).toMatch(/requirements\.txt/);
    });

    it('should detect Go projects', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Go/);
      expect(content).toMatch(/go\.mod/);
    });

    it('should detect Rust projects', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Rust/);
      expect(content).toMatch(/Cargo\.toml/);
    });

    it('should identify project types', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Web Application/);
      expect(content).toMatch(/CLI Tool/);
      expect(content).toMatch(/Library/);
    });
  });

  describe('Step 2: Constitution Generation', () => {
    it('should define output paths', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/constitution\.md/);
      expect(content).toMatch(/\.specify\/memory/);
    });

    it('should include project overview section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/项目概述/);
    });

    it('should include tech stack section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/技术栈/);
      expect(content).toMatch(/运行时/);
      expect(content).toMatch(/核心依赖/);
    });

    it('should include architecture constraints section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/架构约束/);
      expect(content).toMatch(/架构模式/);
      expect(content).toMatch(/目录结构/);
    });

    it('should include coding standards section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/编码规范/);
      expect(content).toMatch(/命名规范/);
      expect(content).toMatch(/代码风格/);
    });

    it('should include quality constraints section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/质量约束/);
      expect(content).toMatch(/测试要求/);
      expect(content).toMatch(/覆盖率/);
    });

    it('should include prohibitions section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止事项/);
      expect(content).toMatch(/Must Not/);
    });

    it('should include mandatory items section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/强制事项/);
      expect(content).toMatch(/Must/);
    });

    it('should include audit basis section', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/审计依据/);
    });
  });

  describe('Step 3: Audit Loop §0.5.2', () => {
    it('should call code-review for audit', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/code-review/);
      expect(content).toMatch(/§0\.5\.2/);
    });

    it('should check tech stack clarity', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/技术栈是否明确/);
    });

    it('should check architecture constraints', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/架构约束是否合理/);
    });

    it('should iterate until pass', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/迭代修改/);
    });
  });

  describe('Integration with Other Stages', () => {
    it('should be referenced by specify', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/被 Specify 引用/);
    });

    it('should be referenced by plan', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/被 Plan 引用/);
    });

    it('should be referenced by tasks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/被 Tasks 引用/);
    });

    it('should be referenced by implement', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/被 Implement 引用/);
    });
  });

  describe('Pre-condition Constraint', () => {
    it('should require completion before specify', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/必须在 specify 之前完成/);
    });
  });

  describe('Handoff', () => {
    it('should define handoff to bmad-master', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/handoff.*bmad-master/);
    });

    it('should include projectInfo in handoff', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/projectInfo/);
      expect(content).toMatch(/techStack/);
    });
  });

  describe('Example Section', () => {
    it('should include example constitution', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/## Example/);
    });
  });

  describe('Rules', () => {
    it('should define prohibition rules', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*空泛/);
    });

    it('should define mandatory rules', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/必须.*可验证/);
    });
  });
});
