#!/usr/bin/env ts-node
import * as fs from 'fs';

interface AgentCheck {
  name: string;
  path: string;
  expectedPrerequisite?: string;
}

const REQUIRED_AGENTS: AgentCheck[] = [
  { name: 'bmad-master', path: '.claude/agents/bmad-master.md' },
  { name: 'bmad-story-create', path: '.claude/agents/bmad-story-create.md' },
  { name: 'bmad-story-audit', path: '.claude/agents/bmad-story-audit.md' },
  { name: 'bmad-layer4-speckit-specify', path: '.claude/agents/layers/bmad-layer4-speckit-specify.md' },
  { name: 'bmad-layer4-speckit-plan', path: '.claude/agents/layers/bmad-layer4-speckit-plan.md', expectedPrerequisite: 'specify_passed' },
  { name: 'bmad-layer4-speckit-gaps', path: '.claude/agents/layers/bmad-layer4-speckit-gaps.md', expectedPrerequisite: 'plan_passed' },
  { name: 'bmad-layer4-speckit-tasks', path: '.claude/agents/layers/bmad-layer4-speckit-tasks.md', expectedPrerequisite: 'gaps_passed' },
  { name: 'bmad-layer4-speckit-implement', path: '.claude/agents/layers/bmad-layer4-speckit-implement.md', expectedPrerequisite: 'tasks_passed' },
];

const REQUIRED_SPECKIT_ALIASES: AgentCheck[] = [
  { name: 'speckit-specify', path: '.claude/agents/speckit-specify.md' },
  { name: 'speckit-plan', path: '.claude/agents/speckit-plan.md' },
  { name: 'speckit-gaps', path: '.claude/agents/speckit-gaps.md' },
  { name: 'speckit-tasks', path: '.claude/agents/speckit-tasks.md' },
];

const REQUIRED_AUDITORS: AgentCheck[] = [
  { name: 'auditor-spec', path: '.claude/agents/auditors/auditor-spec.md' },
  { name: 'auditor-plan', path: '.claude/agents/auditors/auditor-plan.md' },
  { name: 'auditor-gaps', path: '.claude/agents/auditors/auditor-gaps.md' },
  { name: 'auditor-tasks', path: '.claude/agents/auditors/auditor-tasks.md' },
  { name: 'auditor-implement', path: '.claude/agents/auditors/auditor-implement.md' },
  { name: 'auditor-document', path: '.claude/agents/auditors/auditor-document.md' },
  { name: 'auditor-bugfix', path: '.claude/agents/auditors/auditor-bugfix.md' },
];

function verifyAgentFiles(): void {
  let hasErrors = false;

  console.log('=== Agent 文件完整性验证 ===\n');

  console.log('【检查 1】Layer 4 执行体:');
  REQUIRED_AGENTS.forEach(agent => {
    if (fs.existsSync(agent.path)) {
      console.log(`✅ ${agent.name}: ${agent.path}`);

      if (agent.expectedPrerequisite) {
        const content = fs.readFileSync(agent.path, 'utf-8');
        if (content.includes(agent.expectedPrerequisite)) {
          console.log(`   ✅ Prerequisites 包含 ${agent.expectedPrerequisite}`);
        } else {
          console.log(`   ❌ Prerequisites 未包含 ${agent.expectedPrerequisite} — 可能是 Bug`);
          hasErrors = true;
        }
      }
    } else {
      console.log(`❌ ${agent.name}: ${agent.path} — 文件缺失`);
      hasErrors = true;
    }
  });

  console.log('\n【检查 1.5】Speckit 顶层 alias:');
  REQUIRED_SPECKIT_ALIASES.forEach(agent => {
    if (fs.existsSync(agent.path)) {
      console.log(`✅ ${agent.name}: ${agent.path}`);
    } else {
      console.log(`❌ ${agent.name}: ${agent.path} — 文件缺失`);
      hasErrors = true;
    }
  });

  console.log('\n【检查 2】Auditor 执行体:');
  REQUIRED_AUDITORS.forEach(agent => {
    if (fs.existsSync(agent.path)) {
      console.log(`✅ ${agent.name}: ${agent.path}`);
    } else {
      console.log(`❌ ${agent.name}: ${agent.path} — 文件缺失`);
      hasErrors = true;
    }
  });

  console.log(`\n=== 验证结果: ${hasErrors ? '❌ 存在问题' : '✅ 全部通过'} ===`);
  process.exit(hasErrors ? 1 : 0);
}

verifyAgentFiles();
