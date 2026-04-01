import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('scoring journey contract propagation wave 1B', () => {
  it('requires code-reviewer config and audit-item-mapping to declare dedicated journey contract items', () => {
    const root = process.cwd();
    const reviewerConfig = readFileSync(
      path.join(root, '_bmad', '_config', 'code-reviewer-config.yaml'),
      'utf8'
    );
    const itemMapping = readFileSync(
      path.join(root, '_bmad', '_config', 'audit-item-mapping.yaml'),
      'utf8'
    );

    expect(reviewerConfig).toContain('journey_smoke_chain_contract');
    expect(reviewerConfig).toContain('journey_closure_task_contract');
    expect(reviewerConfig).toContain('journey_unlock_contract');
    expect(reviewerConfig).toContain('journey_gap_split_contract');
    expect(reviewerConfig).toContain('journey_shared_path_reference');

    expect(itemMapping).toContain('journey_smoke_chain');
    expect(itemMapping).toContain('journey_closure_task');
    expect(itemMapping).toContain('journey_unlock_contract');
    expect(itemMapping).toContain('journey_gap_split_contract');
    expect(itemMapping).toContain('shared_path_reference');
  });

  it('requires scoring rules and score records to carry dedicated journey contract signals', () => {
    const root = process.cwd();
    const tasksRules = readFileSync(
      path.join(root, 'packages', 'scoring', 'rules', 'tasks-scoring.yaml'),
      'utf8'
    );
    const implementRules = readFileSync(
      path.join(root, 'packages', 'scoring', 'rules', 'default', 'implement-scoring.yaml'),
      'utf8'
    );
    const writerTypes = readFileSync(
      path.join(root, 'packages', 'scoring', 'writer', 'types.ts'),
      'utf8'
    );
    const schema = readFileSync(
      path.join(root, 'packages', 'scoring', 'schema', 'run-score-schema.json'),
      'utf8'
    );

    expect(tasksRules).toContain('journey_smoke_chain');
    expect(tasksRules).toContain('journey_closure_task');
    expect(tasksRules).toContain('journey_gap_split_contract');

    expect(implementRules).toContain('journey_smoke_chain');
    expect(implementRules).toContain('journey_closure_task');
    expect(implementRules).toContain('shared_path_reference');

    expect(writerTypes).toContain('journey_contract_signals');
    expect(schema).toContain('journey_contract_signals');
  });
});
