function runLoopAction(context, runtimeState) {
  return {
    runId: context.args.runId || `main-agent-package-run-loop-${Date.now()}`,
    status: 'completed',
    steps: [
      {
        step: 'inspect.initial',
        status: 'pass',
        summary: `source=${runtimeState.source}`,
      },
      {
        step: 'dispatch-plan',
        status: 'pass',
        summary: 'package runtime dispatch plan generated',
      },
      {
        step: 'inspect.final',
        status: 'pass',
        summary: `source=${runtimeState.source}`,
      },
    ],
    runtimeState,
  };
}

module.exports = {
  runLoopAction,
};
