function failTodo(scriptName: string, nextSteps: string[]): never {
  console.error(`[${scriptName}] BLOCKED: TODO implementation not completed.`);
  console.error(`[${scriptName}] This gate is intentionally fail-closed to prevent happy-path-only releases.`);
  console.error(`[${scriptName}] Required next steps:`);
  for (const step of nextSteps) {
    console.error(`- ${step}`);
  }
  process.exit(1);
}

failTodo('main-agent-chaos-scenarios', [
  'Implement chaos scenarios for pendingPacket loss, closeout failure, rerun-gate pending, session recovery, and host switching.',
  'Fail when any scenario cannot recover to a valid continue-ready state within defined steps.',
  'Add acceptance coverage in tests/acceptance/main-agent-chaos-recovery-e2e.test.ts.',
]);
