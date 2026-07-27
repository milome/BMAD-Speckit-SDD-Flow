export type GoalContractSequenceModeModule = never;

const SEQUENCE_MODES = Object.freeze(['auto', 'required', 'disabled']);
const APPLICABILITY_DECISIONS = new Set([
  'required',
  'not_applicable_with_proof',
  'unresolved',
]);

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function resolveSequenceMode(value = 'auto') {
  if (!SEQUENCE_MODES.includes(value)) {
    throw failure('sequence_mode_invalid', {
      actualSequenceMode: value,
      permittedSequenceModes: [...SEQUENCE_MODES],
    });
  }
  return value;
}

function deriveSequenceExecutionState({
  sequenceMode,
  sequenceApplicability,
  producerAvailable,
}) {
  const mode = resolveSequenceMode(sequenceMode);
  if (!APPLICABILITY_DECISIONS.has(sequenceApplicability)) {
    throw failure('sequence_applicability_invalid', {
      sequenceApplicability,
    });
  }
  if (sequenceApplicability === 'unresolved' && mode !== 'disabled') {
    throw failure('sequence_applicability_unresolved');
  }
  if (mode === 'disabled') {
    return Object.freeze({
      sequenceMode: mode,
      sequenceApplicability,
      sequenceCoverage:
        sequenceApplicability === 'not_applicable_with_proof'
          ? 'not_applicable'
          : sequenceApplicability === 'required'
            ? 'excluded'
            : 'unresolved',
      sequenceClosureStatus:
        sequenceApplicability === 'not_applicable_with_proof'
          ? 'not_required'
          : 'not_requested',
      childContractAuthority:
        sequenceApplicability === 'not_applicable_with_proof'
          ? 'full'
          : 'core_only',
      shouldResolveProducer: false,
    });
  }
  const required = sequenceApplicability === 'required';
  return Object.freeze({
    sequenceMode: mode,
    sequenceApplicability,
    sequenceCoverage: required ? 'complete' : 'not_applicable',
    sequenceClosureStatus: required
      ? producerAvailable
        ? 'compiled'
        : 'unavailable'
      : 'not_required',
    childContractAuthority: 'full',
    shouldResolveProducer: required,
  });
}

module.exports = {
  SEQUENCE_MODES,
  deriveSequenceExecutionState,
  resolveSequenceMode,
};
