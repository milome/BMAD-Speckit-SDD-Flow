/**
 * Story 3.1 验收脚本 AC-1～AC-3
 */
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

const projectRoot = process.cwd();
const skillPath = path.join(projectRoot, '_bmad', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md');
const stageMappingPath = path.join(projectRoot, 'config', 'stage-mapping.yaml');
const reportPathsPath = path.join(projectRoot, 'config', 'eval-lifecycle-report-paths.yaml');

function main(): void {
  let passed = 0;
  const total = 3;

  // AC-1: Skill 定义存在且含引用声明（code-reviewer、audit-prompts、code-reviewer-config、scoring/rules）
  try {
    if (!fs.existsSync(skillPath)) {
      console.error('AC-1: FAIL - SKILL.md not found');
    } else {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const refs = ['code-reviewer', 'audit-prompts', 'code-reviewer-config', 'scoring/rules'];
      const hasAll = refs.every((r) => content.includes(r));
      if (hasAll && content.includes('bmad-code-reviewer-lifecycle')) {
        console.log('AC-1: PASS');
        passed++;
      } else {
        console.error('AC-1: FAIL - missing references or name');
      }
    }
  } catch (e) {
    console.error('AC-1: FAIL', e);
  }

  // AC-2: stage 映射表存在且 prd、arch、story→环节映射正确
  try {
    if (!fs.existsSync(stageMappingPath)) {
      console.error('AC-2: FAIL - stage-mapping.yaml not found');
    } else {
      const content = fs.readFileSync(stageMappingPath, 'utf-8');
      const doc = yaml.load(content) as Record<string, unknown>;
      const stageToPhase = doc?.stage_to_phase as Record<string, number[]>;
      if (!stageToPhase) {
        console.error('AC-2: FAIL - stage_to_phase missing');
      } else {
        const prdOk = Array.isArray(stageToPhase.prd) && stageToPhase.prd.includes(1);
        const archOk = Array.isArray(stageToPhase.arch) && stageToPhase.arch.includes(1) && stageToPhase.arch.includes(2);
        const storyOk = Array.isArray(stageToPhase.story) && stageToPhase.story.includes(1);
        if (prdOk && archOk && storyOk) {
          console.log('AC-2: PASS');
          passed++;
        } else {
          console.error('AC-2: FAIL - prd/arch/story mapping incorrect', { prdOk, archOk, storyOk });
        }
      }
    }
  } catch (e) {
    console.error('AC-2: FAIL', e);
  }

  // AC-3: 报告路径约定含 AUDIT_Story_{epic}-{story}.md 格式
  try {
    if (!fs.existsSync(reportPathsPath)) {
      console.error('AC-3: FAIL - eval-lifecycle-report-paths.yaml not found');
    } else {
      const content = fs.readFileSync(reportPathsPath, 'utf-8');
      const hasAuditStory =
        content.includes('AUDIT_Story_') &&
        (content.includes('{epic}') || content.includes('3-1'));
      if (hasAuditStory) {
        console.log('AC-3: PASS');
        passed++;
      } else {
        console.error('AC-3: FAIL - AUDIT_Story format not found');
      }
    }
  } catch (e) {
    console.error('AC-3: FAIL', e);
  }

  console.log(`\nAcceptance: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  process.exit(passed === total ? 0 : 1);
}

main();
