function failTodo(scriptName: string, nextSteps: string[]): never {
  console.error(`[${scriptName}] BLOCKED: TODO implementation not completed.`);
  console.error(`[${scriptName}] This gate is intentionally fail-closed to prevent manual status spoofing.`);
  console.error(`[${scriptName}] Required next steps:`);
  for (const step of nextSteps) {
    console.error(`- ${step}`);
  }
  process.exit(1);
}

failTodo('sync-task-audit-status', [
  'Parse structured test/gate outputs and update TASKS_v1.audit-log.md status board automatically.',
  'Detect invalid dependency state transitions (upstream fail with downstream pass/in_progress).',
  'Add acceptance coverage in tests/acceptance/task-audit-status-sync.test.ts.',
]);
