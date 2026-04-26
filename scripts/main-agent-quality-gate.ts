function failTodo(scriptName: string, nextSteps: string[]): never {
  console.error(`[${scriptName}] BLOCKED: TODO implementation not completed.`);
  console.error(`[${scriptName}] This gate is intentionally fail-closed to prevent low-quality merges.`);
  console.error(`[${scriptName}] Required next steps:`);
  for (const step of nextSteps) {
    console.error(`- ${step}`);
  }
  process.exit(1);
}

failTodo('main-agent-quality-gate', [
  'Implement threshold checks for lint errors, complexity regression, duplication, and key-path coverage.',
  'Load thresholds from a versioned source of truth and fail on version mismatch.',
  'Add acceptance coverage in tests/acceptance/main-agent-quality-gate-thresholds.test.ts.',
]);
