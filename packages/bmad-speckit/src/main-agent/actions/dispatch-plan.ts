function dispatchPlanAction(context, runtimeState) {
  const active = runtimeState.active && typeof runtimeState.active === 'object' ? runtimeState.active : {};
  const requirementSetId =
    context.args.requirementSetId || active.requirementSetId || active.id || runtimeState.active || null;
  return {
    dispatchInstruction: {
      action: 'dispatch-plan',
      owner: 'main-agent-package-runtime',
      cwd: context.cwd,
      requirementSetId,
      flow: context.args.flow || active.flow || null,
      stage: context.args.stage || active.stage || null,
      packetId: context.args.packetId || null,
    },
    runtimeState,
  };
}

module.exports = {
  dispatchPlanAction,
};
