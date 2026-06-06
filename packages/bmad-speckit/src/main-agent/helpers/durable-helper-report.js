function createDurableHelperDescriptor({ helperId, purpose, ownedFiles = [] }) {
  return function durableHelperDescriptor(context = {}) {
    const cwd = String(context.cwd || process.cwd());
    return {
      schemaVersion: 'main-agent-durable-helper/v1',
      helperId,
      cwd,
      mode: 'durable_helper_copy',
      targetSurface: 'package_main_agent_helper',
      publicCliAction: false,
      supportedConsumerInvocation: null,
      purpose,
      ownedFiles,
      consumerRuntimeProof: {
        usedRootScript: false,
        usedCompiledFallback: false,
        usedTypeScriptRunner: false,
      },
    };
  };
}

module.exports = {
  createDurableHelperDescriptor,
};
