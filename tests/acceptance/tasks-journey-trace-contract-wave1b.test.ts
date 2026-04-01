import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tasks journey-first trace contract wave 1B', () => {
  it('requires each runnable journey slice to carry evidence type and verification command metadata in both template and generator rules', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('## Journey Slice 1 - [Journey Title]');
    expect(tasksTemplate).toContain('**Evidence Type**:');
    expect(tasksTemplate).toContain('**Verification Command**:');
    expect(tasksTemplate).toContain('**Closure Note Path**:');

    expect(tasksCommand).toContain('Every runnable slice must carry:');
    expect(tasksCommand).toContain('- `Evidence Type`');
    expect(tasksCommand).toContain('- `Verification Command`');
    expect(tasksCommand).toContain('- `Closure Note Path`');
  });

  it('requires each journey trace contract to name the smoke task chain and closure task id, not only proof artifact paths', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('## Journey -> Task -> Test -> Closure 映射');
    expect(tasksTemplate).toContain('Smoke Task Chain');
    expect(tasksTemplate).toContain('Closure Task ID');

    expect(tasksCommand).toContain('- `Smoke Task Chain`');
    expect(tasksCommand).toContain('- `Closure Task ID`');
  });

  it('requires each journey slice to keep definition-gap handling and implementation-gap handling separate in generator rules, not only in global gap tables', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('**Definition Gap Handling**:');
    expect(tasksTemplate).toContain('**Implementation Gap Handling**:');

    expect(tasksCommand).toContain('- `Definition Gap Handling`');
    expect(tasksCommand).toContain('- `Implementation Gap Handling`');
  });

  it('requires setup and foundation work to declare which journey and smoke path they unlock, not only carry a journey id tag', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('**Journey Unlock**:');
    expect(tasksTemplate).toContain('**Smoke Path Unlock**:');

    expect(tasksCommand).toContain('- `Journey Unlock`');
    expect(tasksCommand).toContain('- `Smoke Path Unlock`');
  });

  it('requires PLAN_ONLY_BOOTSTRAP mode to preserve journey-level smoke, closure, and trace contracts instead of bypassing them', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('PLAN_ONLY_BOOTSTRAP');
    expect(tasksTemplate).toContain('Smoke Task Chain');
    expect(tasksTemplate).toContain('Closure Task ID');
    expect(tasksTemplate).toContain('Trace ID');
    expect(tasksTemplate).toContain('journey-level smoke/closure/trace contract');

    expect(tasksCommand).toContain('PLAN_ONLY_BOOTSTRAP');
    expect(tasksCommand).toContain('Smoke Task Chain');
    expect(tasksCommand).toContain('Closure Task ID');
    expect(tasksCommand).toContain('Trace ID');
    expect(tasksCommand).toContain('journey-level smoke/closure/trace contract');
  });

  it('requires multi-agent mode to share the same ledger and trace-map path references rather than private summaries', () => {
    const root = process.cwd();
    const tasksTemplate = readFileSync(
      path.join(root, '_bmad', 'speckit', 'templates', 'tasks-template.md'),
      'utf8'
    );
    const tasksCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.tasks.md'),
      'utf8'
    );

    expect(tasksTemplate).toContain('Shared Journey Ledger Path');
    expect(tasksTemplate).toContain('Shared Invariant Ledger Path');
    expect(tasksTemplate).toContain('Shared Trace Map Path');
    expect(tasksTemplate).toContain('same path reference');

    expect(tasksCommand).toContain('Shared Journey Ledger Path');
    expect(tasksCommand).toContain('Shared Invariant Ledger Path');
    expect(tasksCommand).toContain('Shared Trace Map Path');
    expect(tasksCommand).toContain('same path reference');
  });
});
